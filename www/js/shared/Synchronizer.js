var should = require("should");
var JsonUtil = require("./JsonUtil");
var Logger = require("./Logger");

// OVERVIEW
// --------
// Synchronizer instances are used to synchronize JSON trees with their remote 
// clones using a simple three-step request/response message protocol.
// JSON messages are created by createSyncRequest() and applied by sync():
//   STEP1: clone.createSyncRequest() => message   
//   STEP2: base.sync(message) => newMessage
//   STEP3: clone.sync(newMessage) 
//
// Synchronization frequently happens in the context of a
// clone-requested base transformation, which can be functionally
// handled with two synchronizations. The first interaction synchronizes
// clone/base trees prior to the clone-requested base
// transformation. The second interaction synchronizes the clone with
// the results of the clone-requested base transformation.
// However, given the cost of synchronizing remote clones, this
// double synchronization should ideally happen as a single transaction.
// To minimize potentially costly clone/base interaction, 
// you can optimize base post-sync transformations with syncUpdate():
//
// Method #1: inefficient double sync()
//   clone.createSyncRequest() => message
//     base.sync(message) => newMessage
//     clone.sync(newMessage) 
//   clone.createSyncRequest() => message2
//     base.postSyncTransformation(...);
//     base.sync(message2) => postTransformMessage
//     clone.sync(postTransformMessage) 
//
// Method #2: optimized interaction with syncUpdate()
//   clone.createSyncRequest() => message
//     base.sync(message) => newMessage
//     base.postSyncTransformation(...);
//     base.syncUpdate(newMessage) => postTransformMessage
//     clone.sync(postTransformMessage) 
//
// MESSAGE ATTRIBUTES
// ------------------   
// op:      message operation
// newRev:  model snapshot revision
// syncRev: cloned base model revision 
// model:   full synchronization data
// diff:    differential synchronization data 
// text:    message text
//
// SYNCHRONIZATION STATES
// ----------------------
// S0   Uninitialized
// SB   Base
// SBD  Base (with changes)
// SC   Synchronized clone
// SCX  Synchronized clone (stale)
// SCD  Synchronized clone (with changes)
// SCDX Synchronized clone (stale with changes)
//
// OP    newRev syncRev model diff DESCRIPTION
// ------------------------------------------------------------
// CLONE                           clone synchronization request
// RETRY                           retry later
// SYNC  RRR            MMM        synchronize clone with model MMM and syncRev RRR
// UPDB         SSS                request update for clone
// UPDB         SSS           DDD  request update for clone; update base with clone changes DDD 
// UPDC  RRR    SSS           DDD  update clone with new syncRev RRR and base changes DDD since SSS 
// UPDC  RRR    SSS                update clone with new syncRev RRR; no base changes for clone
// STALE RRR            MMM        synchronize stale clone with model MMM and syncRev RRR
// ERR                             sadness and disaster
// OK           SSS                no action required (clone synchronized response)
// IDLE                            enter idle state and only createSyncRequests() if clone has changes or is watching base

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    function Synchronizer(model, options) {
        var that = this;
        options = options || {};

        that.model = model;
        that.idle = false;
        (typeof options.beforeUpdate === 'function') && (that.beforeUpdate = options.beforeUpdate);
        (typeof options.afterUpdate === 'function') && (that.afterUpdate = options.afterUpdate);
        (typeof options.beforeRebase === 'function') && (that.beforeRebase = options.beforeRebase);
        that.baseRev = 0;
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    Synchronizer.prototype.createSyncRequest = function(options) {
        var that = this;
        if (that.baseRev === 0) {
            return {
                op: Synchronizer.OP_CLONE,
            };
        }
        options = options || {};
        var snapshot = JSON.stringify(that.model);
        if (snapshot === that.baseSnapshot) { // no clone changes
            if (that.idle && !options.pollBase) {
                return null;
            }
            that.idle = false;
            return {
                op: Synchronizer.OP_UPDB,
                syncRev: that.syncRev,
            };
        }

        that.idle = false;
        var diff = JsonUtil.diffUpsert(that.model, that.baseModel, {
            filter$: true,
        });
        if (diff == null) {
            that.rebase(); // clone has been edited without differences
            return {
                op: Synchronizer.OP_UPDB,
                syncRev: that.syncRev,
            };
        }
        return {
            op: Synchronizer.OP_UPDB,
            syncRev: that.syncRev,
            diff: diff,
        };
    }
    Synchronizer.prototype.rebase = function() {
        var that = this;
        var snapshot = JSON.stringify(that.model);
        if (snapshot != that.baseSnapshot) {
            that.beforeRebase && that.beforeRebase(that.model);
            that.baseSnapshot = JSON.stringify(that.model); // include decorations
            that.baseModel = JSON.parse(that.baseSnapshot);
            that.baseRev = Synchronizer.revision(that.baseSnapshot);
        }
        return that;
    }
    Synchronizer.prototype.createErrorResponse = function(request, text) {
        var that = this;
        that.verbose && verboseLogger.debug("Synchronizer.createErrorResponse() text:", text,
            " request:", JSON.stringify(request));
        return {
            op: Synchronizer.OP_ERR,
            text: text,
        }
    }
    Synchronizer.prototype.sync_clone = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_CLONE) {
            return null;
        }
        if (that.baseRev === 0 || that.baseRev == null) {
            return {
                op: Synchronizer.OP_RETRY,
                text: Synchronizer.TEXT_RETRY,
            }
        }

        that.rebase();
        //that.verbose && verboseLogger.debug("Synchronizer.sync_clone() baseRev:", that.baseRev);
        return {
            op: Synchronizer.OP_SYNC,
            newRev: that.baseRev,
            text: Synchronizer.TEXT_SYNC,
            model: that.model,
        }
    }
    Synchronizer.prototype.sync_echo = function(request, op) {
        var that = this;
        if (request.op !== op) {
            return null;
        }
        return request;
    }
    Synchronizer.prototype.sync_idle = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_IDLE) {
            return null;
        }
        that.idle = true;
        return request;
    }
    Synchronizer.prototype.sync_sync = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_SYNC) {
            return null;
        }

        if (!request.hasOwnProperty("model")) {
            return that.createErrorResponse(request, Synchronizer.ERR_MODEL);
        } else if (!request.hasOwnProperty("newRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_NEWREV);
        }

        that.update(request.model);
        that.rebase();
        that.syncRev = request.newRev;
        return {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_CLONED,
            syncRev: that.syncRev,
        };
    }
    Synchronizer.prototype.sync_stale = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_STALE) {
            return null;
        }

        if (!request.hasOwnProperty("model")) {
            return that.createErrorResponse(request, Synchronizer.ERR_MODEL);
        } else if (!request.hasOwnProperty("newRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_NEWREV);
        }

        // TODO: Deal with stale model
        // for now, slam and hope for the best (ugly)
        that.update(request.model);
        that.rebase(); // TODO: new clone structures won't get sync'd

        that.syncRev = request.newRev;
        return {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_CLONED,
            syncRev: that.syncRev,
        };
    }
    Synchronizer.prototype.sync_updb = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_UPDB) {
            return null;
        }
        if (!request.hasOwnProperty("syncRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_SYNCREV);
        }
        if (request.syncRev !== that.baseRev) {
            that.rebase();
            return {
                op: Synchronizer.OP_STALE,
                text: Synchronizer.TEXT_STALE,
                newRev: that.baseRev,
                model: that.baseModel,
            }
        }
        var response = {};
        var baseModel = that.baseModel;
        that.update(request.diff);
        request.diff && JsonUtil.applyJson(baseModel, request.diff);
        that.rebase();
        var diff = JsonUtil.diffUpsert(that.model, baseModel);
        //console.log("UPDATE model:" + JSON.stringify(that.model), " baseModel:" + JSON.stringify(baseModel));
        if (diff == null) {
            if (request.diff) {
                response.op = Synchronizer.OP_UPDC;
                response.text = Synchronizer.TEXT_UPDB;
                response.syncRev = request.syncRev;
                response.newRev = that.baseRev;
            } else {
                response.op = Synchronizer.OP_IDLE;
                response.text = Synchronizer.TEXT_IDLE;
            }
            response.syncRev = request.syncRev;
        } else {
            response.op = Synchronizer.OP_UPDC;
            response.diff = diff;
            response.text = Synchronizer.TEXT_UPDC;
            response.syncRev = request.syncRev;
            response.newRev = that.baseRev;
        }
        return response;
    }
    Synchronizer.prototype.sync_updc = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_UPDC) {
            return null;
        }
        if (!request.hasOwnProperty("newRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_NEWREV);
        } else if (!request.hasOwnProperty("syncRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_SYNCREV);
        } else if (request.syncRev !== that.syncRev) {
            return that.createErrorResponse(request, Synchronizer.ERR_STALE);
        }

        var response = {};
        that.syncRev = request.newRev;
        response.syncRev = that.syncRev;
        that.update(request.diff);
        that.rebase();
        response.op = Synchronizer.OP_OK;
        response.text = Synchronizer.TEXT_SYNC;
        return response;
    }
    Synchronizer.prototype.sync = function(request) {
        var that = this;
        request = request || {
            op: Synchronizer.OP_CLONE,
        };
        if (request.op == null) {
            return that.createErrorResponse(request, Synchronizer.ERR_OP);
        }
        var response = that.sync_clone(request) ||
            that.sync_echo(request, Synchronizer.OP_ERR) ||
            that.sync_echo(request, Synchronizer.OP_OK) ||
            that.sync_echo(request, Synchronizer.OP_RETRY) ||
            that.sync_idle(request) ||
            that.sync_updb(request) ||
            that.sync_updc(request) ||
            that.sync_stale(request) ||
            that.sync_sync(request);
        if (!response) {
            throw new Error("Synchronizer.sync() unhandled request:" + JSON.stringify(request));
        }
        return response;
    }
    Synchronizer.prototype.syncUpdate = function(curResponse) {
        var that = this;
        if (curResponse.op === Synchronizer.OP_IDLE) {
            var newResponse = that.sync({
                op:"UPDB",
                syncRev: curResponse.syncRev,
            });
        } else {
            var newResponse = that.sync({
                op:"UPDB",
                syncRev: curResponse.newRev,
            });
            curResponse = JSON.parse(JSON.stringify(curResponse)); 
            var diff = curResponse.diff || {};
            newResponse.syncRev = curResponse.syncRev;
            JsonUtil.applyJson(diff, newResponse.diff);
            newResponse.diff = diff;
        }
        return newResponse;
    }
    Synchronizer.prototype.update = function(diff) {
        var that = this;
        that.beforeUpdate && that.beforeUpdate(diff);
        diff && JsonUtil.applyJson(that.model, diff);
        that.afterUpdate && that.afterUpdate(diff);
        return that;
    }

    Synchronizer.TEXT_RETRY = "Retry: base model uninitialized";
    Synchronizer.TEXT_STALE = "Stale: B#>C UPDB ignored. Response includes base model";
    Synchronizer.TEXT_SYNC = "SyncBC: B<=>C models updated and synchronized";
    Synchronizer.TEXT_UPDB = "SyncB: B<=C models updated and synchronized";
    Synchronizer.TEXT_UPDC = "UPDC: B=>C base updated; clone synchronization pending";
    Synchronizer.TEXT_REBASE = "Rebase: B!>C stale request ignored";
    Synchronizer.TEXT_CLONED = "Cloned: B>>C base model cloned and synchronized";
    Synchronizer.TEXT_IDLE = "Idle: no changes to base or clone models";
    Synchronizer.ERR_OP = "Error: op expected";
    Synchronizer.ERR_MODEL = "Error: model expected";
    Synchronizer.ERR_NEWREV = "Error: newRev expected";
    Synchronizer.ERR_SYNCREV = "Error: syncRev expected";
    Synchronizer.ERR_DIFF = "Error: diff expected";
    Synchronizer.ERR_STALE = "Error: unknown syncRev for clone";
    Synchronizer.OP_CLONE = "CLONE";
    Synchronizer.OP_RETRY = "RETRY";
    Synchronizer.OP_SYNC = "SYNC";
    Synchronizer.OP_STALE = "STALE";
    Synchronizer.OP_UPDB = "UPDB";
    Synchronizer.OP_UPDC = "UPDC";
    Synchronizer.OP_OK = "OK";
    Synchronizer.OP_IDLE = "IDLE";
    Synchronizer.OP_ERR = "ERR";

    Synchronizer.revision = function(model) {
        if (typeof model === 'string') {
            var json = model;
        } else {
            var json = model == null ? "" : JSON.stringify(model);
        }
        if (json.length === 0) {
            return 0;
        }
        var sum1 = 0;
        var sum2 = 0;
        var sum3 = 0;
        var sum5 = 0;
        var sum7 = 0;
        var sum11 = 0;
        var sum13 = 0;
        for (var i = json.length; i-- > 0;) {
            var code = json.charCodeAt(i);
            sum1 += code;
            (i % 2 === 0) && (sum2 += code);
            (i % 3 === 0) && (sum3 += code);
            (i % 5 === 0) && (sum5 += code);
            (i % 7 === 0) && (sum7 += code);
            (i % 11 === 0) && (sum11 += code);
            (i % 13 === 0) && (sum13 += code);
        }
        var result = (json.length + 1) / (sum1 + 1) + ((sum2 << 2) ^ (sum3 << 3) ^ (sum5 << 5) ^ (sum7 << 7) ^ (sum11 << 11) ^ (sum13 << 13));
        //console.log("Synchronizer.revision()", result, " json:", json);
        return result;
    }

    module.exports = exports.Synchronizer = Synchronizer;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Synchronizer", function() {
    var Synchronizer = exports.Synchronizer;
    var beforeRebase = function(model) {
        model.d = model.d ? model.d + 10 : 10;
    }
    var baseOptions = {
        verbose: true,
        beforeRebase: beforeRebase,
    };
    var testScenario = function(isRebase, isSync, isbeforeRebase, beforeUpdate, afterUpdate, baseModel) {
        baseModel = baseModel || JSON.parse('{"a": 1}');
        var scenario = {
            baseModel: baseModel,
            cloneModel: {},
        };
        var baseOptions = {
            verbose: true,
        };
        var cloneOptions = {
            beforeUpdate: beforeUpdate,
            afterUpdate: afterUpdate,
        };
        beforeUpdate && (typeof beforeUpdate).should.equal("function");
        afterUpdate && (typeof afterUpdate).should.equal("function");
        isbeforeRebase != false && (baseOptions.beforeRebase = beforeRebase);
        scenario.baseSync = new Synchronizer(scenario.baseModel, baseOptions);
        scenario.cloneSync = new Synchronizer(scenario.cloneModel, cloneOptions);
        isRebase && scenario.baseSync.rebase();
        if (isSync) {
            scenario.cloneSync.sync(
                scenario.baseSync.sync(
                    scenario.cloneSync.createSyncRequest()));
            should.deepEqual(scenario.cloneModel, scenario.baseModel);
        }
        return scenario;
    }
    it("createSyncRequest() returns synchronization request or null", function() {
        var baseModel = {
            a: 1,
            b: 2,
            c: 3,
        };
        var baseSync = new Synchronizer(baseModel);
        baseSync.rebase();
        var cloneModel = {};
        var cloneSync = new Synchronizer(cloneModel);
        var messages = [];
        messages.push(cloneSync.createSyncRequest());
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_CLONE,
        });
        messages.push(baseSync.sync(messages[messages.length - 1]));
        messages.push(cloneSync.sync(messages[messages.length - 1]));
        should.deepEqual(cloneModel, {
            a: 1,
            b: 2,
            c: 3,
        });
        var cloneBaseRev = cloneSync.baseRev;
        should.deepEqual(cloneSync.createSyncRequest(), {
            op: Synchronizer.OP_UPDB,
            syncRev: cloneSync.syncRev,
        });
        cloneBaseRev.should.equal(cloneSync.baseRev);

        // baseRev changes, but not content
        delete cloneModel.a;
        delete cloneModel.b;
        delete cloneModel.c;
        cloneModel.b = 2; // change creation order
        cloneModel.c = 3; // change creation order
        cloneModel.a = 1; // change creation order
        should.deepEqual(cloneSync.createSyncRequest(), {
            op: Synchronizer.OP_UPDB,
            syncRev: cloneSync.syncRev,
        });
        cloneBaseRev.should.not.equal(cloneSync.baseRev); // different serialization of same content

        // baseRev and content changes
        cloneModel.a = 10;
        should.deepEqual(cloneSync.createSyncRequest(), {
            op: Synchronizer.OP_UPDB,
            syncRev: cloneSync.syncRev,
            diff: {
                a: 10,
            },
        });
    });
    it("sync() returns initial synchronization model", function() {
        var baseModel = {
            a: 1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions);
        var expected1 = {
            op: Synchronizer.OP_RETRY,
            text: Synchronizer.TEXT_RETRY,
        };
        should.deepEqual(syncBase.sync(), expected1);
        should.deepEqual(syncBase.sync(), expected1); // idempotent

        // base model changes but remains uninitialized
        baseModel.a = 2;
        should.deepEqual(syncBase.sync(), expected1);
        should.deepEqual(syncBase.sync(), expected1); // idempotent

        // rebase() marks first synchronizable version
        should.deepEqual(syncBase.rebase(), syncBase);
        var modelExpected = {
            a: 2,
            d: 10,
        };
        should.deepEqual(syncBase.sync(), {
            op: Synchronizer.OP_SYNC,
            newRev: syncBase.baseRev,
            text: Synchronizer.TEXT_SYNC,
            model: modelExpected,
        });

        // base model changes 
        baseModel.a = 3;
        var modelExpected3 = {
            a: 3,
            d: 20,
        };
        var expected3 = {
            op: Synchronizer.OP_SYNC,
            text: Synchronizer.TEXT_SYNC,
            newRev: Synchronizer.revision(modelExpected3),
            model: modelExpected3,
        };
        should.deepEqual(syncBase.sync(), expected3);
        should.deepEqual(syncBase.sync(), expected3); // idempotent

    });
    it("rebase() marks model as initialized", function() {
        var baseModel = {
            a: 1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions);
        var modelExpected = {
            a: 1,
            d: 10,
        };
        var expected1 = {
            op: Synchronizer.OP_SYNC,
            text: Synchronizer.TEXT_SYNC,
            newRev: Synchronizer.revision(modelExpected),
            model: modelExpected,
        }
        should.deepEqual(syncBase.rebase(), syncBase);
        should.deepEqual(syncBase.sync(), expected1);
    });
    it("sync(initial) initializes clone model", function() {
        var baseModel = {
            a: {
                aa: 1
            },
        };
        var syncBase = new Synchronizer(baseModel, baseOptions);
        var clonea = {
            aa: 2,
        };
        var cloneModel = {
            a: clonea,
        };
        var syncClone = new Synchronizer(cloneModel);

        // nothing should happen with uninitialized models
        var initial = syncBase.sync();
        var expected1 = {
            op: Synchronizer.OP_RETRY,
            text: Synchronizer.TEXT_RETRY,
        };
        should.deepEqual(initial, expected1);
        should.deepEqual(syncClone.sync(initial), expected1);
        should.deepEqual(syncClone.sync(initial), expected1); // idempotent
        syncBase.rebase();

        // error message
        should.deepEqual(syncClone.sync({
            newRev: 1,
        }), {
            op: Synchronizer.OP_ERR,
            text: Synchronizer.ERR_OP,
        });
        should.deepEqual(syncClone.sync({
            op: Synchronizer.OP_SYNC,
            newRev: 1,
        }), {
            op: Synchronizer.OP_ERR,
            text: Synchronizer.ERR_MODEL
        });
        should.deepEqual(syncClone.sync({
            op: Synchronizer.OP_SYNC,
            model: {},
        }), {
            op: Synchronizer.OP_ERR,
            text: Synchronizer.ERR_NEWREV,
        });

        // synchronize to base model
        clonea.aa.should.equal(2);
        initial = syncBase.sync(); // OP_SYNC
        var expectedSync = {
            op: Synchronizer.OP_OK,
            syncRev: syncBase.baseRev,
            text: Synchronizer.TEXT_CLONED,
        };
        should.deepEqual(syncClone.sync(initial), expectedSync);
        should.deepEqual(cloneModel, baseModel);
        //JSON.stringify(cloneModel).should.equal(JSON.stringify(baseModel));
        syncBase.baseRev.should.equal(syncClone.baseRev);
        // IMPORTANT: synchronization should maintain clone structure
        clonea.aa.should.equal(1);
        should.deepEqual(syncClone.sync(initial), expectedSync); // idempotent

        // re-synchronizate after clone changes 
        cloneModel.a.aa = 11;
        cloneModel.c = 3;
        should.deepEqual(syncClone.sync(initial), expectedSync);
        cloneModel.a.aa.should.equal(1); // synchronize overwrites change to base model attribute
        cloneModel.c.should.equal(3); // synchronize ignores non base model attribute
    });
    it("revision(model) returns the revision hash code for the given model", function() {
        var j1 = {
            a: 1,
        };
        Synchronizer.revision({
            a: 1
        }).should.equal(827036.0153550864);
        Synchronizer.revision(JSON.stringify(j1)).should.equal(827036.0153550864);
        Synchronizer.revision("").should.equal(0);
        Synchronizer.revision().should.equal(0);
    });
    it("3-step synchronization should initialize clone", function() {
        var so = testScenario(true, false);
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3

        should.deepEqual(messages[0], {
            op: Synchronizer.OP_CLONE,
        });
        var model2 = {
            a: 1,
            d: 10,
        };
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_SYNC,
            text: Synchronizer.TEXT_SYNC,
            newRev: so.baseSync.baseRev,
            model: model2,
        });
        so.baseSync.baseRev.should.equal(Synchronizer.revision(model2));
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_CLONED,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
        should.deepEqual(so.baseModel, {
            a: 1,
            d: 10,
        });
        so.cloneSync.syncRev.should.equal(so.baseSync.baseRev);
    });
    it("3-step synchronization accepts clone-only change", function() {
        var so = testScenario(true, true, false);
        var syncRev1 = so.cloneSync.syncRev; // initial syncRev
        so.cloneModel.b = 2; // clone change
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
            diff: {
                b: 2, // clone change
            }
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDB,
            syncRev: messages[0].syncRev,
            newRev: so.baseSync.baseRev,
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_SYNC,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
    });
    it("beforeRebase callback may change base and require clone update", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.cloneSync.syncRev; // initial syncRev
        so.cloneModel.b = 2; // clone change
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
            diff: {
                b: 2, // clone change
            }
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: messages[0].syncRev,
            newRev: so.baseSync.baseRev,
            diff: {
                d: 20, // base decoration 
            }
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_SYNC,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
    });
    it("3-step synchronization enter idle state if base and clone have no changes", function() {
        var so = testScenario(true, true);
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: so.cloneSync.syncRev,
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_IDLE,
            text: Synchronizer.TEXT_IDLE,
            syncRev: messages[0].syncRev,
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_IDLE,
            text: Synchronizer.TEXT_IDLE,
            syncRev: messages[0].syncRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);

        // go silent until change
        should(so.cloneSync.createSyncRequest()).equal(null);

        // pollBase option should create request even if clone hasn't changed
        should.deepEqual(so.cloneSync.createSyncRequest({
            pollBase: true
        }), {
            op: Synchronizer.OP_UPDB,
            syncRev: so.cloneSync.syncRev,
        });

        // clone changes
        so.cloneModel.a = 100;
        should.deepEqual(so.cloneSync.createSyncRequest(), {
            op: Synchronizer.OP_UPDB,
            syncRev: so.cloneSync.syncRev,
            diff: {
                a: 100,
            }
        });

    });
    it("3-step synchronization should handle base changes", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.baseSync.baseRev;
        so.baseModel.a = 11; // base change
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: messages[0].syncRev,
            newRev: so.baseSync.baseRev,
            diff: {
                a: 11, // base change
                d: 20, // base decoration
            }
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_SYNC,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
        should.deepEqual(so.cloneModel, {
            a: 11,
            d: 20,
        });
    });
    it("3-step synchronization should handle base+clone changes", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.baseSync.baseRev;
        so.baseModel.a = 11; // base change
        so.cloneModel.b = 2; // clone change
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
            diff: {
                b: 2,
            }
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: messages[0].syncRev,
            newRev: so.baseSync.baseRev,
            diff: {
                a: 11, // base change
                d: 20, // base decoration
            }
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_SYNC,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
        should.deepEqual(so.cloneModel, {
            a: 11,
            b: 2,
            d: 20,
        });
    });
    it("3-step synchronization should slam base model over stale clone", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.baseSync.baseRev;
        so.baseModel.a = 11; // base change
        so.baseSync.rebase(); // make clone stale 
        syncRev1.should.not.equal(so.baseSync.baseRev);
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_STALE,
            text: Synchronizer.TEXT_STALE,
            newRev: so.baseSync.baseRev,
            model: {
                a: 11,
                d: 20,
            }
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_CLONED,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.baseModel, {
            a: 11,
            d: 20,
        });
        should.deepEqual(so.cloneModel, {
            a: 11,
            d: 20,
        });
    });
    it("3-step synchronization of stale clone will be unfriendly to clone changes", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.baseSync.baseRev;
        so.baseModel.a = 11; // base change
        so.baseSync.rebase(); // make clone stale 
        syncRev1.should.not.equal(so.baseSync.baseRev);
        so.cloneModel.a = 10; // clone change
        so.cloneModel.b = 2; // clone change
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
            diff: {
                a: 10,
                b: 2,
            }
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_STALE,
            text: Synchronizer.TEXT_STALE,
            newRev: so.baseSync.baseRev,
            model: {
                a: 11,
                d: 20,
            }
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_CLONED,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.baseModel, {
            a: 11,
            d: 20,
        });
        // TODO: The following outcome is ugly
        should.deepEqual(so.cloneModel, {
            a: 11, // base value slammed over clone change (ugh)
            b: 2, // orphaned clone value won't sync till changed (ugh)
            d: 20,
        });
    });
    it("constructor options can specify functions for beforeUpdate and afterUpdate", function() {
        var before = 0;
        var beforeDiff = 0;
        var beforeUpdate = function(diff) {
            before++;
            diff && beforeDiff++;
        }
        var after = 0;
        var afterDiff = 0;
        var afterUpdate = function(diff) {
            after++;
            diff && afterDiff++;
        }
        var so = testScenario(false, false, false, beforeUpdate, afterUpdate);
        should(typeof so.cloneSync.beforeUpdate).equal("function");
        should(typeof so.cloneSync.afterUpdate).equal("function");
        // Uninitialized
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages[0].op.should.equal(Synchronizer.OP_CLONE);
        messages[1].op.should.equal(Synchronizer.OP_RETRY);
        messages[2].op.should.equal(Synchronizer.OP_RETRY);
        before.should.equal(0);
        after.should.equal(0);
        // Clone
        so.baseSync.rebase();
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages[3].op.should.equal(Synchronizer.OP_CLONE);
        messages[4].op.should.equal(Synchronizer.OP_SYNC);
        messages[5].op.should.equal(Synchronizer.OP_OK);
        before.should.equal(1);
        after.should.equal(1);
        // Idle
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages[6].op.should.equal(Synchronizer.OP_UPDB);
        messages[7].op.should.equal(Synchronizer.OP_IDLE);
        messages[8].op.should.equal(Synchronizer.OP_IDLE);
        before.should.equal(1);
        after.should.equal(1);
        // Clone changes
        so.cloneModel.b = 2;
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        so.cloneSync.idle.should.equal(false);
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages[9].op.should.equal(Synchronizer.OP_UPDB);
        messages[10].op.should.equal(Synchronizer.OP_UPDC);
        should(messages[10].diff == null).True;
        messages[11].op.should.equal(Synchronizer.OP_OK);
        before.should.equal(2);
        beforeDiff.should.equal(1);
        after.should.equal(2);
        afterDiff.should.equal(1);
        // Base changes
        so.baseModel.a = 11;
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages[12].op.should.equal(Synchronizer.OP_UPDB);
        messages[13].op.should.equal(Synchronizer.OP_UPDC);
        messages[14].op.should.equal(Synchronizer.OP_OK);
        before.should.equal(3);
        beforeDiff.should.equal(2);
        after.should.equal(3);
        afterDiff.should.equal(2);
        // Stale clone changes
        so.cloneModel.b = 20;
        so.baseModel.a = 111;
        so.baseSync.rebase();
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[messages.length - 1])); // step 2
        messages.push(so.cloneSync.sync(messages[messages.length - 1])); // step 3
        messages[15].op.should.equal(Synchronizer.OP_UPDB);
        messages[16].op.should.equal(Synchronizer.OP_STALE);
        messages[17].op.should.equal(Synchronizer.OP_OK);
        before.should.equal(4);
        beforeDiff.should.equal(3);
        after.should.equal(4);
        afterDiff.should.equal(3);
    });
    it("3-step synchronization enter idle state if base and clone have no changes", function() {
        var so = testScenario(true, true, false, null, null, {
            a: 1,
            b: [{
                b1x: 20,
                b1y: 21,
                b1z: 22
            }, {
                b2x: 20,
                b2y: 21
            }, {
                b3x: 20,
                b3y: 21
            }, ]
        });
        var messages = [];
        so.baseModel.b[0] = {
            b1z: 22,
            b1x: 20,
            b1y: 21,
        };
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        messages.push(so.cloneSync.sync(messages[1])); // step 3
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: messages[0].syncRev,
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_IDLE,
            text: Synchronizer.TEXT_IDLE,
            syncRev: messages[0].syncRev,
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_IDLE,
            text: Synchronizer.TEXT_IDLE,
            syncRev: messages[0].syncRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);

        // go silent until change
        should(so.cloneSync.createSyncRequest()).equal(null);

        // pollBase option should create request even if clone hasn't changed
        should.deepEqual(so.cloneSync.createSyncRequest({
            pollBase: true
        }), {
            op: Synchronizer.OP_UPDB,
            syncRev: so.cloneSync.syncRev,
        });

        // clone changes
        so.cloneModel.a = 100;
        should.deepEqual(so.cloneSync.createSyncRequest(), {
            op: Synchronizer.OP_UPDB,
            syncRev: so.cloneSync.syncRev,
            diff: {
                a: 100,
            }
        });
    });
    it("TESTTESTsyncUpdate(curResponse) merges in post-sync base changes (base/clone prior changes)", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.baseSync.baseRev;
        so.baseModel.a = 11; // base change
        so.cloneModel.b = 2; // clone change
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        so.baseModel.a = 12; // post-sync operation changes base
        messages.push(so.baseSync.syncUpdate(messages[1])); // step 3
        messages.push(so.cloneSync.sync(messages[2])); // step 4
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
            diff: {
                b: 2,
            }
        });
        should.deepEqual(messages[1], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: messages[0].syncRev,
            newRev: messages[1].newRev,
            diff: {
                a: 11, // base change
                d: 20, // base decoration
            }
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: messages[0].syncRev,
            newRev: messages[2].newRev,
            diff: {
                a: 12, // base change due to "REST" operation
                d: 30, // base decoration
            }
        });
        should.deepEqual(messages[3], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_SYNC,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
        should.deepEqual(so.cloneModel, {
            a: 12,
            b: 2,
            d: 30,
        });
    });
    it("TESTTESTsyncUpdate(curResponse) merges in post-sync base changes (base/clone already sync'd)", function() {
        var so = testScenario(true, true);
        var syncRev1 = so.baseSync.baseRev;
        var messages = [];
        messages.push(so.cloneSync.createSyncRequest()); // step 1
        messages.push(so.baseSync.sync(messages[0])); // step 2
        so.baseModel.a = 12; // post-sync operation changes base
        messages.push(so.baseSync.syncUpdate(messages[1])); // step 3
        messages.push(so.cloneSync.sync(messages[2])); // step 4
        should.deepEqual(messages[0], {
            op: Synchronizer.OP_UPDB,
            syncRev: syncRev1,
        });
        should.deepEqual(messages[1], { // already sync'd
            op: Synchronizer.OP_IDLE,
            text: Synchronizer.TEXT_IDLE,
            syncRev: messages[0].syncRev,
        });
        should.deepEqual(messages[2], {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: messages[0].syncRev,
            newRev: messages[2].newRev,
            diff: {
                a: 12, // base change due to "REST" operation
                d: 20, // base decoration
            }
        });
        should.deepEqual(messages[3], {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_SYNC,
            syncRev: so.baseSync.baseRev,
        });
        should.deepEqual(so.cloneModel, so.baseModel);
        should.deepEqual(so.cloneModel, {
            a: 12,
            d: 20,
        });
    });
})

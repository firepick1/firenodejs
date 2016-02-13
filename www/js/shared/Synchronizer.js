const should = require("should");
const JsonUtil = require("./JsonUtil");
const Logger = require("./Logger");

// JSON messages synchronize base and clone.
// Messages are created by createSyncRequest()
// and returned by sync():
//   createSyncRequest() => message
//   sync(message) => newMessage
//
// ATTRIBUTES
// ----------   
// op:      message operation
// newRev:  model snapshot revision
// syncRev: cloned base model revision 
// model:   full synchronization data
// diff:    differential synchronization data 
// text:    message text
//
// STATES
// ------
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
// UPDB         SSS           DDD  update base model with clone changes DDD since SSS
// UPDC  RRR    SSS           DDD  update clone with new syncRev RRR and base changes DDD since SSS 
// ERR                             sadness and disaster
// NOP                             no action required 
// OK           SSS                no action required (clone synchronized response)

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    function Synchronizer(model, options) {
        var that = this;
        options = options || {};

        that.model = model;
        that.decorate = options.decorate || function(model) {
            // add time-variant model decorations
        };
        that.baseRev = 0;
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    Synchronizer.prototype.createSyncRequest = function() {
        var that = this;
        if (that.baseRev === 0) {
            return {
                op: Synchronizer.OP_CLONE,
            };
        } 
        var request = {
            op: Synchronizer.OP_UPDB,
            syncRev: that.syncRev,
        };
        var snapshot = JSON.stringify(that.model);
        if (snapshot !== that.baseSnapshot) {
            request.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
        } 
        return request;
    }
    Synchronizer.prototype.rebase = function() {
        var that = this;
        var snapshot = JSON.stringify(that.model);
        if (snapshot != that.baseSnapshot) {
            that.decorate(that.model);
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
        return  {
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
        that.verbose && verboseLogger.debug("Synchronizer.sync_clone() baseRev:", that.baseRev);
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

        JsonUtil.applyJson(that.model, request.model); // preserve structure
        that.rebase();
        that.syncRev = request.newRev; 
        return {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_INITIALIZED,
            syncRev: that.syncRev,
        };
    }
    Synchronizer.prototype.sync_updb = function(request) {
        var that = this;
        if (request.op !== Synchronizer.OP_UPDB) {
            return null;
        }
        if (!request.hasOwnProperty("diff")) {
            return that.createErrorResponse(request, Synchronizer.ERR_DIFF);
        } else if (!request.hasOwnProperty("syncRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_SYNCREV);
        }
        var response = {};
        response.syncRev = request.newRev;
        JsonUtil.applyJson(that.model, request.diff);
        var baseModel = that.baseModel;
        JsonUtil.applyJson(baseModel, request.diff);
        that.rebase();
        var diff = JsonUtil.diffUpsert(that.model, baseModel);
        //console.log("UPDATE model:" + JSON.stringify(that.model), " baseModel:" + JSON.stringify(baseModel));
        if (diff == null) {
            response.op = Synchronizer.OP_OK;
            response.text = Synchronizer.TEXT_UPDATED;
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
        if (!request.hasOwnProperty("diff")) {
            return that.createErrorResponse(request, Synchronizer.ERR_DIFF);
        } else if (!request.hasOwnProperty("newRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_NEWREV);
        } else if (!request.hasOwnProperty("syncRev")) {
            return that.createErrorResponse(request, Synchronizer.ERR_SYNCREV);
        } else if (request.syncRev !== that.syncRev) {
            return that.createErrorResponse(request, Synchronizer.ERR_STALE);
        }

        var response = {};
        that.syncRev = request.newRev;
        response.syncRev = that.syncRev;
        JsonUtil.applyJson(that.model, request.diff);
        that.rebase();
        response.op = Synchronizer.OP_OK;
        response.text = Synchronizer.TEXT_UPDATED;
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
            that.sync_echo(request, Synchronizer.OP_NOP) ||
            that.sync_echo(request, Synchronizer.OP_RETRY) ||
            that.sync_updb(request) ||
            that.sync_updc(request) ||
            that.sync_sync(request);
        if (response) {
            return response;
        }

        throw new Error("OOPS:" + JSON.stringify(request));

        request = request || {
            syncRev: 0,
        };
        var snapshot = JSON.stringify(that.model);
        var response = {};

        if (that.baseSnapshot && snapshot !== that.baseSnapshot) {
            that.rebase();
        }

        //if (request.newRev == null) {
        //response.text = Synchronizer.ERR_REV;
        //} else if (request.newRev === 0) {
        console.log("request:",request);
        if (request.syncRev === 0) {
            // full synchronization request
            if (that.baseRev === 0) {
                response.text = Synchronizer.TEXT_RETRY;
                response.syncRev = 0;
            } else {
                response.text = Synchronizer.TEXT_SYNC;
                response.model = that.model;
                response.syncRev = that.baseRev;
            }
        } else if (request.newRev && request.newRev === that.baseRev || 
            request.syncRev && request.syncRev === that.baseRev ||
            that.baseRev && request.syncRev === that.baseRev) {
            // differential synchronization request
            if (request.diff) {
                response.syncRev = request.newRev;
                JsonUtil.applyJson(that.model, request.diff);
                var baseModel = that.baseModel;
                JsonUtil.applyJson(baseModel, request.diff);
                that.rebase();
                var diff = JsonUtil.diffUpsert(that.model, baseModel);
                //console.log("UPDATE model:" + JSON.stringify(that.model), " baseModel:" + JSON.stringify(baseModel));
                if (diff == null) {
                    response.text = Synchronizer.TEXT_UPDATED;
                } else {
                    response.diff = diff;
                    response.text = Synchronizer.TEXT_UPDC;
                    that.baseRev = that.baseRev;
                }
            } else {
                response.text = Synchronizer.TEXT_IDLE;
            }
        } else if (that.baseRev === 0) {
            if (!request.hasOwnProperty("model")) {
                response.text = Synchronizer.ERR_MODEL;
            } else {
                response.text = Synchronizer.TEXT_INITIALIZED;
                JsonUtil.applyJson(that.model, request.model); // preserve structure
                that.rebase();
                that.baseRev = request.newRev; // override
                that.baseRev = request.newRev;
            }
        } else {
            // stale request
            that.verbose && verboseLogger.debug("DEBUG\t: ignoring stale request",
                " newRev:" + request.newRev, " expected newRev:" + that.baseRev);
            response.text = Synchronizer.TEXT_REBASE;
            response.model = that.model;
        }
        response.newRev = that.baseRev;

        return response;
    }

    Synchronizer.TEXT_RETRY = "Retry: base model uninitialized";
    Synchronizer.TEXT_SYNC = "Synchronize: response includes base model";
    Synchronizer.TEXT_UPDATED = "Updated: model synchronized";
    Synchronizer.TEXT_UPDC = "Synchronize: base updated with diff for clone";
    Synchronizer.TEXT_REBASE = "Rebase: stale request ignored";
    Synchronizer.TEXT_INITIALIZED = "Initialized: models are synchronized";
    Synchronizer.ERR_OP = "Error: op expected";
    Synchronizer.ERR_MODEL = "Error: model expected";
    Synchronizer.ERR_NEWREV = "Error: newRev expected";
    Synchronizer.ERR_SYNCREV = "Error: syncRev expected";
    Synchronizer.ERR_DIFFREV = "Error: diff expected";
    Synchronizer.ERR_STALE = "Error: unknown syncRev for client";
    Synchronizer.OP_CLONE = "CLONE";
    Synchronizer.OP_RETRY = "RETRY";
    Synchronizer.OP_SYNC = "SYNC"; 
    Synchronizer.OP_UPDB = "UPDB";
    Synchronizer.OP_UPDC = "UPDC";
    Synchronizer.OP_NOP = "NOP";
    Synchronizer.OP_OK = "OK";
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
        console.log("Synchronizer.revision()", result, " json:", json);
        return result;
    }

    module.exports = exports.Synchronizer = Synchronizer;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Synchronizer", function() {
    var Synchronizer = exports.Synchronizer;
    var decorateBase = function(model) {
        model.d = model.d ? model.d + 10 : 10;
    }
    var baseOptions = {
        verbose: true,
        decorate: decorateBase,
    };
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
            model:{},
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
            text: Synchronizer.TEXT_INITIALIZED,
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
    it("createSyncRequest() is used to for synchronization cycle", function() {
        var baseModel = {
            a: 1,
        };
        var baseSync = new Synchronizer(baseModel, baseOptions);
        baseSync.rebase();

        var cloneModel = {};
        var cloneSync = new Synchronizer(cloneModel);

        /////////////////////// Initialize clone
        // Step 1. Create synchronization cloneRequest from clone
        var cloneRequest = cloneSync.createSyncRequest();
        should.deepEqual(cloneRequest, {
            op: Synchronizer.OP_CLONE,
        });

        // Step 2. Pass synchronization cloneRequest to base
        var baseResponse = baseSync.sync(cloneRequest);
        var model2 = {
            a: 1,
            d: 10,
        };
        should.deepEqual(baseResponse, {
            op: Synchronizer.OP_SYNC,
            text: Synchronizer.TEXT_SYNC,
            newRev: baseSync.baseRev,
            model: model2,
        });
        baseSync.baseRev.should.equal(Synchronizer.revision(model2));

        // Step 3. Synchronize clone to baseResponse
        var cloneResponse = cloneSync.sync(baseResponse)
        should.deepEqual(cloneResponse, {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_INITIALIZED,
            syncRev: baseSync.baseRev,
        });
        should.deepEqual(cloneModel, baseModel);
        should.deepEqual(baseModel, {
            a: 1,
            d: 10,
        });
        cloneSync.syncRev.should.equal(baseSync.baseRev);

        /////////// Change clone and synchronize to base
        // Step 1. Create synchronization cloneRequest from clone
        cloneModel.b = 2;
        cloneRequest = cloneSync.createSyncRequest();
        should.deepEqual(cloneRequest, {
            op: Synchronizer.OP_UPDB,
            syncRev: cloneSync.syncRev, // no change
            diff: {
                b: 2,
            },
        });

        // Step 2. Pass synchronization cloneRequest to base
        // Since base is decorated, it will ALSO have changes for
        // clone
        var baseResponse = baseSync.sync(cloneRequest);
        should.deepEqual(baseResponse, {
            op: Synchronizer.OP_UPDC,
            text: Synchronizer.TEXT_UPDC,
            syncRev: cloneRequest.syncRev,
            newRev: baseSync.baseRev, 
            diff: {
                d: 20, // decoration
            }
        });
        should.deepEqual(baseModel, {
            a: 1,
            b: 2, // clone change
            d: 20, // base decoration change (not yet in clone)
        });

        // Step 3. Synchronize clone to baseResponse
        var cloneResponse = cloneSync.sync(baseResponse)
        should.deepEqual(cloneResponse, {
            op: Synchronizer.OP_OK,
            text: Synchronizer.TEXT_UPDATED,
            syncRev: baseResponse.newRev,
        });
        should.deepEqual(cloneModel, baseModel);
        cloneSync.syncRev.should.equal(baseSync.baseRev);

        /////////// Change nothing and synchronize with base
        cloneRequest = cloneSync.createSyncRequest();
        should.deepEqual(cloneRequest, {
            op: Synchronizer.OP_UPDB,
            syncRev: cloneSync.syncRev,
        });

        /*
        // Step 2. Pass synchronization cloneRequest to base
        // Since base is decorated, it will ALSO have changes for
        // clone
        var baseResponse = baseSync.sync(cloneRequest);
        var model2 = {
            a: 1,
            b: 2, // clone change
            d: 20, // base decoration change (not yet in clone)
        };
        should.deepEqual(baseModel, model2);
        should.deepEqual(baseResponse, {
            text: Synchronizer.TEXT_UPDC,
            syncRev: cloneRequest.newRev,
            newRev: Synchronizer.revision(baseModel),
            diff: {
                d: 20, // decoration
            }
        });

        // Step 3. Synchronize clone to baseResponse
        var cloneResponse = cloneSync.sync(baseResponse)
        should.deepEqual(cloneResponse, {
            text: Synchronizer.TEXT_UPDATED,
            syncRev: baseResponse.newRev,
            newRev: Synchronizer.revision(cloneModel),
        });
        should.deepEqual(cloneModel, baseModel);
        */
    });
})

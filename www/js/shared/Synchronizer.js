const should = require("should");
const JsonUtil = require("./JsonUtil");
const Logger = require("./Logger");

(function(exports) {
    var verboseLogger = new Logger({
        level: "debug"
    });

    function Synchronizer(model, options) {
        var that = this;
        options = options || {};

        that.model = model;
        that.decorate = options.decorate || function(model) {
            // add time-variant model decorations
        };
        that.rev = 0;
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    Synchronizer.prototype.rebase = function() {
        var that = this;
        that.decorate(that.model);
        that.baseSnapshot = JSON.stringify(that.model);
        that.baseModel = JSON.parse(that.baseSnapshot);
        that.rev = Synchronizer.revision(that.baseSnapshot);
        return that;
    }
    Synchronizer.prototype.request = function() {
        var that = this;
        var request = {
            rev: that.baseRev || that.rev,
        };
        if (that.baseSnapshot) {
            var snapshot = JSON.stringify(that.model);
            if (snapshot !== that.baseSnapshot) {
                request.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
            }
        }
        return request;
    }

    Synchronizer.prototype.sync = function(request) {
        var that = this;
        request = request || {
            rev:0,
        };
        var snapshot = JSON.stringify(that.model);
        var response = {};

        if (that.baseSnapshot && snapshot !== that.baseSnapshot) {
            that.rebase();
        }

        if (request.rev == null) {
            response.msg = Synchronizer.ERR_REV;
        } else if (request.rev === 0) {
            // full synchronization request
            if (that.rev === 0) {
                response.msg = Synchronizer.MSG_RETRY;
            } else {
                response.msg = Synchronizer.MSG_CLONE;
                response.model = that.model; 
            }
        } else if (request.rev === that.rev || that.baseRev && request.baseRev === that.baseRev) {
            // differential synchronization request
            if (request.diff) {
                response.baseRev = request.rev;
                JsonUtil.applyJson(that.model, request.diff);
                var baseModel = that.baseModel;
                JsonUtil.applyJson(baseModel, request.diff);
                that.rebase();
                var diff = JsonUtil.diffUpsert(that.model, baseModel);
                //console.log("UPDATE model:" + JSON.stringify(that.model), " baseModel:" + JSON.stringify(baseModel));
                if (diff == null) {
                    response.msg = Synchronizer.MSG_UPDATED;
                } else {
                    response.diff = diff;
                    response.msg = Synchronizer.MSG_SYNCHRONIZE;
                    that.baseRev = that.rev;
                }
            } else {
                response.msg = Synchronizer.MSG_IDLE;
            }
        } else if (that.rev === 0) {
            if (!request.hasOwnProperty("model")) {
                response.msg = Synchronizer.ERR_MODEL;
            } else {
                response.msg = Synchronizer.MSG_INITIALIZED;
                JsonUtil.applyJson(that.model, request.model); // preserve structure
                that.rebase();
                that.rev = request.rev; // override
                that.baseRev = request.rev;
            }
        } else {
            // stale request
            that.verbose && verboseLogger.debug("DEBUG\t: ignoring stale request",
                "rev:" + request.rev, "expected rev:" + that.rev);
            response.msg = Synchronizer.MSG_REBASE;
            response.model = that.model; 
        }
        response.rev = that.rev;

        return response;
    }

    Synchronizer.MSG_RETRY = "Retry: base model uninitialized";
    Synchronizer.MSG_CLONE = "Clone: clone must synchronize to returned base model ";
    Synchronizer.MSG_UPDATED = "Updated: model synchronized";
    Synchronizer.MSG_SYNCHRONIZE = "Synchronize: base updated with diff for clone";
    Synchronizer.MSG_REBASE = "Rebase: stale request ignored";
    Synchronizer.MSG_INITIALIZED = "Initialized: models are synchronized";
    Synchronizer.MSG_IDLE = "Idle: no change";
    Synchronizer.ERR_MODEL = "Error: model expected";
    Synchronizer.ERR_REV = "Error: rev expected";

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
        for (var i=json.length; i-- > 0; ) {
            var code = json.charCodeAt(i);
            sum1 += code;
            (i % 2 === 0) && (sum2 += code);
            (i % 3 === 0) && (sum3 += code);
            (i % 5 === 0) && (sum5 += code);
            (i % 7 === 0) && (sum7 += code);
            (i % 11 === 0) && (sum11 += code);
            (i % 13 === 0) && (sum13 += code);
        }
        var result = (json.length+1)/(sum1+1) + ((sum2<<2) ^ (sum3<<3) ^ (sum5<<5) ^ (sum7<<7) ^ (sum11 << 11) ^ (sum13 << 13));
        console.log("Synchronizer.revision()", result, " json:", json);
        return result;
    }
    module.exports = exports.Synchronizer = Synchronizer;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Synchronizer", function() {
    var Synchronizer = exports.Synchronizer;
    var decorateBase = function(model) {
        model.d = model.d ? model.d+10 : 10;
    }
    var baseOptions = {
        decorate: decorateBase,
    };
    it("sync() returns initial synchronization model", function() {
        var baseModel = {
            a:1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var expected1 = {
            rev: 0,
            msg: Synchronizer.MSG_RETRY,
        };
        should.deepEqual(syncBase.sync(), expected1);
        should.deepEqual(syncBase.sync(), expected1);  // idempotent

        // base model changes but remains uninitialized
        baseModel.a = 2;
        var expected2 = {
            msg: Synchronizer.MSG_RETRY,
            rev: 0,
        };
        should.deepEqual(syncBase.sync(), expected2);
        should.deepEqual(syncBase.sync(), expected2); // idempotent

        // rebase() marks first synchronizable version
        should.deepEqual(syncBase.rebase(), syncBase);
        var modelExpected ={
            a:2,
            d:10,
        };
        should.deepEqual(syncBase.sync(), {
            rev: Synchronizer.revision(modelExpected),
            msg: Synchronizer.MSG_CLONE,
            model: modelExpected,
        });

        // base model changes 
        baseModel.a = 3;
        var modelExpected3 ={
            a:3,
            d:20,
        };
        var expected3 = {
            msg: Synchronizer.MSG_CLONE,
            rev: Synchronizer.revision(modelExpected3),
            model: modelExpected3,
        };
        should.deepEqual(syncBase.sync(), expected3);
        should.deepEqual(syncBase.sync(), expected3); // idempotent
    });
    it("rebase() marks model as initialized", function() {
        var baseModel = {
            a:1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var modelExpected = {
            a:1,
            d: 10,
        };
        var expected1 = {
            msg: Synchronizer.MSG_CLONE,
            rev: Synchronizer.revision(modelExpected),
            model: modelExpected,
        }
        should.deepEqual(syncBase.rebase(), syncBase);
        should.deepEqual(syncBase.sync(), expected1);
    });
    it("sync(initial) initializes clone model", function() {
        var baseModel = {
            a:{aa:1},
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var clonea = {
            aa:2,
        };
        var cloneModel = {
            a:clonea,
        };
        var syncClone = new Synchronizer(cloneModel);

        // nothing should happen with uninitialized models
        var initial = syncBase.sync();
        var expected1 = {
            rev: 0,
            msg: Synchronizer.MSG_RETRY,
        };
        should.deepEqual(syncClone.sync(initial), expected1);
        should.deepEqual(syncClone.sync(initial), expected1); // idempotent
        syncBase.rebase();

        // error message
        should.deepEqual(syncClone.sync({
            rev:1,
        }), {
            rev: 0,
            msg: Synchronizer.ERR_MODEL
        });
        should.deepEqual(syncClone.sync({
            model:{},
        }), {
            rev: 0,
            msg: Synchronizer.ERR_REV
        });

        // synchronize to base model
        clonea.aa.should.equal(2);
        initial = syncBase.sync();
        should.deepEqual(syncClone.sync(initial), {
            rev: syncBase.rev,
            msg: Synchronizer.MSG_INITIALIZED,
        });
        should.deepEqual(cloneModel,baseModel);
        //JSON.stringify(cloneModel).should.equal(JSON.stringify(baseModel));
        syncBase.rev.should.equal(syncClone.rev);
        // IMPORTANT: synchronization should maintain clone structure
        clonea.aa.should.equal(1);

        // re-synchronization should do nothing
        should.deepEqual(syncClone.sync(initial), {
            rev: syncBase.rev,
            msg: Synchronizer.MSG_IDLE,
        }); 

        cloneModel.c = 3;
        // re-synchronization after clone changes should allow clone to re-synchronize
        should.deepEqual(syncClone.sync(initial), {
            rev: Synchronizer.revision(cloneModel),
            msg: Synchronizer.MSG_REBASE,
            model: {
                a: {
                    aa:1
                },
                c: 3,
                d: 10,
            }
        }); 
    });
    it("revision(model) returns the revision hash code for the given model", function() {
        var j1 = {
            a:1,
        };
        Synchronizer.revision({a:1}).should.equal(827036.0153550864);
        Synchronizer.revision(JSON.stringify(j1)).should.equal(827036.0153550864);
        Synchronizer.revision("").should.equal(0);
        Synchronizer.revision().should.equal(0);
    });
    it("request() is used to for synchronization cycle", function() {
        var baseModel = {
            a:1,
        };
        var baseSync = new Synchronizer(baseModel, baseOptions);
        baseSync.rebase();

        var cloneModel = {};
        var cloneSync = new Synchronizer(cloneModel);

        /////////////////////// Initialize clone
        // Step 1. Create synchronization cloneRequest from clone
        var cloneRequest = cloneSync.request();
        should.deepEqual(cloneRequest, {
            rev:0,
        });

        // Step 2. Pass synchronization cloneRequest to base
        var baseResponse = baseSync.sync(cloneRequest);
        var model2 = {
            a: 1,
            d: 10,
        };
        should.deepEqual(baseResponse, {
            msg: Synchronizer.MSG_CLONE,
            rev: Synchronizer.revision(model2),
            model: model2,
        });

        // Step 3. Synchronize clone to baseResponse
        var cloneResponse = cloneSync.sync(baseResponse)
        should.deepEqual(cloneResponse, {
            msg: Synchronizer.MSG_INITIALIZED,
            rev: baseSync.rev,
        });
        should.deepEqual(cloneModel, baseModel);
        should.deepEqual(baseModel, {
            a: 1,
            d: 10,
        });

        /////////// Change clone and synchronize to base
        // Step 1. Create synchronization cloneRequest from clone
        cloneModel.b = 2;
        cloneRequest = cloneSync.request(); 
        should.deepEqual(cloneRequest, {
            rev: baseSync.rev, // no change
            diff: {
                b:2,
            },
        });

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
            msg: Synchronizer.MSG_SYNCHRONIZE,
            baseRev: cloneRequest.rev,
            rev: Synchronizer.revision(baseModel),
            diff: {
                d: 20, // decoration
            }
        });

        // Step 3. Synchronize clone to baseResponse
        var cloneResponse = cloneSync.sync(baseResponse)
        should.deepEqual(cloneResponse, {
            msg: Synchronizer.MSG_UPDATED,
            baseRev: baseResponse.rev,
            rev: Synchronizer.revision(cloneModel),
        });
        should.deepEqual(cloneModel, baseModel);
        
        /////////// Change nothing and synchronize with base
        cloneRequest = cloneSync.request(); 
        /*
        should.deepEqual(cloneRequest, {
            rev: baseSync.rev, // no change
        });

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
            msg: Synchronizer.MSG_SYNCHRONIZE,
            baseRev: cloneRequest.rev,
            rev: Synchronizer.revision(baseModel),
            diff: {
                d: 20, // decoration
            }
        });

        // Step 3. Synchronize clone to baseResponse
        var cloneResponse = cloneSync.sync(baseResponse)
        should.deepEqual(cloneResponse, {
            msg: Synchronizer.MSG_UPDATED,
            baseRev: baseResponse.rev,
            rev: Synchronizer.revision(cloneModel),
        });
        should.deepEqual(cloneModel, baseModel);
        */
    });
})

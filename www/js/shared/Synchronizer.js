const should = require("should");
const JsonUtil = require("./JsonUtil");

(function(exports) {

    function Synchronizer(model, options) {
        var that = this;
        options = options || {};

        that.model = model;
        that.decorate = options.decorate || function(model) {
            // add time-variant model decorations
        };
        that.rebase(); // uninitialized
        that.rev = 0;

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
        var snapshot = JSON.stringify(that.model);
        var request = {
            rev: that.rev,
        };
        if (snapshot !== that.baseSnapshot) {
            request.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
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

        if (snapshot !== that.baseSnapshot) {
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
        } else if (request.rev === that.rev) {
            // differential synchronization request
            if (request.diff) {
                response.msg = Synchronizer.MSG_UPDATED;
                JsonUtil.applyJson(that.model, request.diff);
                JsonUtil.applyJson(that.baseModel, request.diff);
                that.rebase();
                that.rev = request.rev;
                response.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
            } else {
                response.msg = Synchronizer.MSG_IDLE;
            }
        } else if (that.rev === 0) {
            if (!request.hasOwnProperty("model")) {
                response.msg = Synchronizer.ERR_MODEL;
            } else {
                response.msg = Synchronizer.MSG_SYNCHRONIZED;
                JsonUtil.applyJson(that.model, request.model); // preserve structure
                that.rebase()
                that.rev = request.rev;
            }
        } else {
            // stale request
            console.log("WARN\t: ignoring stale request rev:" + request.rev + " expected:"+that.rev);
            response.msg = Synchronizer.MSG_REBASE;
            response.model = that.model; 
        }
        response.rev = that.rev;

        return response;
    }

    Synchronizer.MSG_RETRY = "Retry: base model uninitialized";
    Synchronizer.MSG_CLONE = "Clone: synchronize to base model";
    Synchronizer.MSG_UPDATED = "Synchronize: base model updated";
    Synchronizer.MSG_REBASE = "Rebase: stale request ignored";
    Synchronizer.MSG_SYNCHRONIZED = "Synchronized: model initialized";
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
        return (json.length+1)/(sum1+1) + ((sum2<<2) ^ (sum3<<3) ^ (sum5<<5) ^ (sum7<<7) ^ (sum11 << 11) ^ (sum13 << 13));
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
    it("request() creates initial synchronization request", function() {
        var model = {
            a:1,
        };
        var sync = new Synchronizer(model, baseOptions);
        should.deepEqual(model, {
            a:1,
            d:10, // added by decorate()
        });

        // no change in base model
        should.deepEqual(sync.request(), {
            rev:0,
        });

        // model changed
        model.b = 2;
        should.deepEqual(sync.request(), {
            rev:0,
            diff: {
                b:2
            },
        });
    });
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

        // base model changes 
        baseModel.a = 2;
        var expected2 = {
            msg: Synchronizer.MSG_CLONE,
            rev: Synchronizer.revision({a:2,d:20}),
            model: {
                a:2,
                d:20,
            },
        };
        should.deepEqual(syncBase.sync(), expected2);
        should.deepEqual(syncBase.sync(), expected2); // idempotent

        // base model changes 
        baseModel.a = 3;
        var expected3 = {
            msg: Synchronizer.MSG_CLONE,
            rev: Synchronizer.revision({a:3,d:30}),
            model: {
                a:3,
                d:30,
            },
        };
        should.deepEqual(syncBase.sync(), expected3);
        should.deepEqual(syncBase.sync(), expected3); // idempotent
    });
    it("rebase() marks model as initialized", function() {
        var baseModel = {
            a:1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var expected1 = {
            msg: Synchronizer.MSG_CLONE,
            rev: Synchronizer.revision({a:1,d:20}),
            model: {
                a:1,
                d: 20,
            }
        }
        should.deepEqual(syncBase.rebase(), syncBase);
        should.deepEqual(syncBase.sync(), expected1);
    });
    it("sync(initial) initializes clone model", function() {
        var baseModel = {
            a:1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var cloneModel = {};
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
        initial = syncBase.sync();
        should.deepEqual(syncClone.sync(initial), {
            rev: syncBase.rev,
            msg: Synchronizer.MSG_SYNCHRONIZED,
        });
        should.deepEqual(cloneModel,baseModel);
        //JSON.stringify(cloneModel).should.equal(JSON.stringify(baseModel));
        syncBase.rev.should.equal(syncClone.rev);

        // re-synchronization should do nothing
        should.deepEqual(syncClone.sync(initial), {
            rev: syncBase.rev,
            msg: Synchronizer.MSG_IDLE,
        }); 

        cloneModel.c = 3;
        // re-synchronization after clone changes should allow clone to re-synchronize
        should.deepEqual(syncClone.sync(initial), {
            rev: 1117628.0173697271,  
            msg: Synchronizer.MSG_REBASE,
            model: {
                a: 1,
                c: 3,
                d: 20,
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
})

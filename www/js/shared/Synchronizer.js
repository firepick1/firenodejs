const should = require("should");
const JsonUtil = require("./JsonUtil");

(function(exports) {

    function Synchronizer(model, options) {
        var that = this;
        options = options || {};

        that.model = model;
        that.age = options.age || 0;
        that.decorate = options.decorate || function(model) {
            // add time-variant model decorations
        };
        that.rebase(0); // uninitialized

        return that;
    }

    Synchronizer.prototype.rebase = function(age) {
        var that = this;
        that.age = age == null ? 1 : age;
        that.decorate(that.model);
        that.baseTag = JSON.stringify(that.model);
        that.baseModel = JSON.parse(that.baseTag);
        return that;
    }
    Synchronizer.prototype.request = function() {
        var that = this;
        var tag = JSON.stringify(that.model);
        var request = {
            age: that.age,
        };
        if (tag !== that.baseTag) {
            request.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
        }
        return request;
    }

    Synchronizer.prototype.sync = function(request) {
        var that = this;
        request = request || {
            age:0,
        };
        var tag = JSON.stringify(that.model);
        var response = {};

        if (tag !== that.baseTag) {
            that.rebase(that.age+1);
        }

        if (request.age == null) {
            response.msg = Synchronizer.ERR_AGE;
        } else if (request.age === 0) {
            // full synchronization request
            if (that.age === 0) {
                response.msg = Synchronizer.MSG_RETRY;
            } else {
                response.msg = Synchronizer.MSG_CLONE;
                response.model = that.model; 
            }
        } else if (request.age === that.age) {
            // differential synchronization request
            if (request.diff) {
                response.msg = Synchronizer.MSG_UPDATED;
                JsonUtil.applyJson(that.model, request.diff);
                JsonUtil.applyJson(that.baseModel, request.diff);
                that.rebase(that.age+1);
                response.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
            } else {
                response.msg = Synchronizer.MSG_IDLE;
            }
        } else if (that.age === 0) {
            if (!request.hasOwnProperty("model")) {
                response.msg = Synchronizer.ERR_MODEL;
            } else {
                response.msg = Synchronizer.MSG_SYNCHRONIZED;
                JsonUtil.applyJson(that.model, request.model);
                that.rebase(request.age)
            }
        } else {
            // stale request
            response.msg = Synchronizer.MSG_REBASE;
            response.model = that.model; 
        }
        response.age = that.age;

        return response;
    }

    Synchronizer.MSG_RETRY = "Retry: base model uninitialized";
    Synchronizer.MSG_CLONE = "Clone: synchronize to base model";
    Synchronizer.MSG_UPDATED = "Synchronize: base model updated";
    Synchronizer.MSG_REBASE = "Rebase: stale request ignored";
    Synchronizer.MSG_SYNCHRONIZED = "Synchronized: model initialized";
    Synchronizer.MSG_IDLE = "Idle: no change";
    Synchronizer.ERR_MODEL = "Error: model expected";
    Synchronizer.ERR_AGE = "Error: age expected";

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
            age:0,
        });

        // model changed
        model.b = 2;
        should.deepEqual(sync.request(), {
            age:0,
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
            age: 0,
            msg: Synchronizer.MSG_RETRY,
        };
        should.deepEqual(syncBase.sync(), expected1);
        should.deepEqual(syncBase.sync(), expected1);  // idempotent

        // base model changes 
        baseModel.a = 2;
        var expected2 = {
            msg: Synchronizer.MSG_CLONE,
            age:1,
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
            age:2,
            model: {
                a:3,
                d:30,
            },
        };
        should.deepEqual(syncBase.sync(), expected3);
        should.deepEqual(syncBase.sync(), expected3); // idempotent
    });
    it("rebase(age) initialize model to given age > 0", function() {
        var baseModel = {
            a:1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var expected1 = {
            msg: Synchronizer.MSG_CLONE,
            age: 10,
            model: {
                a:1,
                d: 20,
            }
        }
        should.deepEqual(syncBase.rebase(10), syncBase);
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
            age: 0,
            msg: Synchronizer.MSG_RETRY,
        };
        should.deepEqual(syncClone.sync(initial), expected1);
        should.deepEqual(syncClone.sync(initial), expected1); // idempotent
        syncBase.rebase(7);

        // error message
        should.deepEqual(syncClone.sync({
            age:1,
        }), {
            age: 0,
            msg: Synchronizer.ERR_MODEL
        });
        should.deepEqual(syncClone.sync({
            model:{},
        }), {
            age: 0,
            msg: Synchronizer.ERR_AGE
        });

        // synchronize to base model
        initial = syncBase.sync();
        should.deepEqual(syncClone.sync(initial), {
            age: 7,
            msg: Synchronizer.MSG_SYNCHRONIZED,
        });

        // re-synchronization should do nothing
        should.deepEqual(syncClone.sync(initial), {
            age: 7,
            msg: Synchronizer.MSG_IDLE,
        }); 

        cloneModel.c = 3;
        // re-synchronization after clone changes should allow clone to re-synchronize
        should.deepEqual(syncClone.sync(initial), {
            age: 8, // not 7!
            msg: Synchronizer.MSG_REBASE,
            model: {
                a: 1,
                c: 3,
                d: 20,
            }
        }); 
    });
})

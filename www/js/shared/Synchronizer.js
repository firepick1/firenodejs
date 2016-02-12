const should = require("should");
const JsonUtil = require("./JsonUtil");

(function(exports) {

    function Synchronizer(model, options) {
        var that = this;
        options = options || {};

        that.model = model;
        that.model.age = that.model.age || 0;
        that.decorate = options.decorate || function(model) {
            // add time-variant model decorations
        };
        that.rebase();

        return that;
    }

    Synchronizer.prototype.rebase = function() {
        var that = this;
        that.decorate(that.model);
        that.baseTag = JSON.stringify(that.model);
        that.baseModel = JSON.parse(that.baseTag);
    }
    Synchronizer.prototype.request = function() {
        var that = this;
        var tag = JSON.stringify(that.model);
        var request = {
            age: that.model.age,
        };
        if (tag !== that.baseTag) {
            request.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
        }
        return request;
    }

    Synchronizer.prototype.sync = function(request) {
        var that = this;
        request = request || {};
        var tag = JSON.stringify(that.model);
        var response = {
        };

        if (tag !== that.baseTag) {
            that.model.age++;
            that.rebase();
        }

        if (request.age == null || request.age === 0) {
            // full synchronization request
            if (that.model.age === 0) {
                response.msg = Synchronizer.MSG_RETRY;
            } else {
                response.msg = Synchronizer.MSG_CLONE;
                response.model = that.model; 
            }
        } else if (request.age === that.model.age) {
            // differential synchronization request
            if (request.diff) {
                response.msg = "Synchronize: base model updated";
                JsonUtil.applyJson(that.model, request.diff);
                JsonUtil.applyJson(that.baseModel, request.diff);
                that.rebase();
                response.diff = JsonUtil.diffUpsert(that.model, that.baseModel);
            } else {
                response.msg = "Idle: no change";
            }
        } else {
            // stale request
            response.msg = "Rebase: stale request ignored";
            response.rebase = that.model; 
        }
        return response;
    }

    Synchronizer.MSG_RETRY = "Retry: base model uninitialized";
    Synchronizer.MSG_CLONE = "Clone: synchronize to base model";

    module.exports = exports.Synchronizer = Synchronizer;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Synchronizer", function() {
    var Synchronizer = exports.Synchronizer;
    var decorateBase = function(model) {
        model.d = model.d ? model.d+1 : 1;
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
            age: 0, // added by Synchronizer
            a:1,
            d:1, // added by decorate()
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
            msg: Synchronizer.MSG_RETRY,
        };
        should.deepEqual(syncBase.sync(), expected1);
        should.deepEqual(syncBase.sync(), expected1);  // idempotent

        // base model changes 
        baseModel.a = 2;
        var expected2 = {
            msg: Synchronizer.MSG_CLONE,
            model: {
                age:1,
                a:2,
                d:2,
            },
        };
        should.deepEqual(syncBase.sync(), expected2);
        should.deepEqual(syncBase.sync(), expected2); // idempotent

        // base model changes 
        baseModel.a = 3;
        var expected3 = {
            msg: Synchronizer.MSG_CLONE,
            model: {
                age:2,
                a:3,
                d:3,
            },
        };
        should.deepEqual(syncBase.sync(), expected3);
        should.deepEqual(syncBase.sync(), expected3); // idempotent
    });
    it("sync(initial) updates clone model", function() {
        var baseModel = {
            a:1,
        };
        var syncBase = new Synchronizer(baseModel, baseOptions); 
        var cloneModel = {};
        var syncClone = new Synchronizer(cloneModel);
        var initial = syncBase.sync();
        var expected1 = {
            msg: Synchronizer.MSG_RETRY,
        };
        should.deepEqual(syncClone.sync(initial), expected1);
    });
})

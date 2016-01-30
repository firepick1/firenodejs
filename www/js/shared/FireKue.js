var should = require("should");
var Logger = require("./Logger");
var JsonError = require("./JsonError");

// FireKue is a bare-bones subset of kue without redis and all that...

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function FireKue(options) {
        var that = this;

        options = options || {};
        that.model = {
            idNext: options.idNext || 1,
            jobMap: options.jobMap == null ? {} : JSON.parse(JSON.stringify(options.jobMap)),
        };
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    FireKue.COMPLETE = "complete";
    FireKue.FAILED = "failed";
    FireKue.ACTIVE = "active";
    FireKue.INACTIVE = "inactive";

    FireKue.prototype.stats = function() {
        var that = this;
        var jobMap = that.model.jobMap;
        var result = {
            inactiveCount: 0,
            completeCount: 0,
            failedCount: 0,
            activeCount: 0,
        }
        var keys = Object.keys(jobMap);
        for (var i = 0; i < keys.length; i++) {
            var job = jobMap[keys[i]];
            if (job.state === FireKue.INACTIVE) {
                result.inactiveCount++;
            } else if (job.state === FireKue.COMPLETE) {
                result.completeCount++;
            } else if (job.state === FireKue.FAILED) {
                result.failedCount++;
            } else if (job.state === FireKue.ACTIVE) {
                result.activeCount++;
            }
        }
        return result;
    }
    FireKue.prototype.processOne = function(type, jobHandler) {
        var that = this;
        var options = {
            state: "inactive",
            type: type,
        };
        that.findIds(function(err, ids) {
            if (ids.length > 0) {
                ids.sort();
                var job = that.get(ids[0]);
                job.state = "active";
                var done = function(err, result) {
                    if (err instanceof Error) {
                        job.state = "failed";
                    } else {
                        job.state = "complete";
                    }
                    job.result = result;
                    verboseLogger.info("FireKue job id:", job.id, " type:", job.type, " state:", job.state);
                };
                that.verbose && verboseLogger.debug("FireKue processing job id:", job.id, " type:", job.type);
                jobHandler(job, done);
            }
        }, options);
        return that;
    }
    FireKue.prototype.putResult = function(id, result) {
        var that = this;
        if (!that.model.jobMap.hasOwnProperty(id)) {
            return null;
        }
        var job = this.model.jobMap[id];
        if (result == null) {
            delete job.result;
        } else {
            job.result = JSON.parse(JSON.stringify(result));
        }
        return job;
    }
    FireKue.prototype.add = function(job) {
        var that = this;
        job.id = that.model.idNext++;
        that.model.jobMap[job.id] = job;
        if (!job.hasOwnProperty("state")) {
            job.state = "inactive";
        }

        return {
            message: "job created",
            id: job.id,
        };
    }
    FireKue.prototype.findIds = function(onResults, options) {
        var that = this;
        onResults.should.Function;
        var jobMap = that.model.jobMap;
        var ids = [];
        var err = null;
        var keys = Object.keys(jobMap);
        for (var i = 0; i < keys.length; i++) {
            var job = jobMap[keys[i]];
            if (that.matches(job, options)) {
                ids.push(job.id);
            }
        }
        onResults(err, ids);
        return that;
    }
    FireKue.prototype.active = function(onResults) {
        var that = this;
        that.findIds(onResults, {
            state: "active",
        });
        return that;
    }
    FireKue.prototype.inactive = function(onResults) {
        var that = this;
        that.findIds(onResults, {
            state: "inactive",
        });
        return that;
    }
    FireKue.prototype.complete = function(onResults) {
        var that = this;
        that.findIds(onResults, {
            state: "complete",
        });
        return that;
    }
    FireKue.prototype.failed = function(onResults) {
        var that = this;
        that.findIds(onResults, {
            state: "failed",
        });
        return that;
    }
    FireKue.prototype.get = function(id) {
        var that = this;
        return that.model.jobMap.hasOwnProperty(id) ? that.model.jobMap[id] : null;
    }
    FireKue.prototype.delete = function(id) {
        var that = this;
        if (!that.model.jobMap.hasOwnProperty(id)) {
            throw new JsonError("FireKue.delete() no job:" + id);
        }
        delete that.model.jobMap[id];
        return {
            message: "job " + id + " removed",
        };
    }
    FireKue.prototype.matches = function(job, options) {
        options = options || {};
        if (options.to != null && options.to < job.id) {
            return false;
        }
        if (options.from != null && job.id < options.from) {
            return false;
        }
        if (options.state != null && job.state !== options.state) {
            return false;
        }
        if (options.type != null && job.type !== options.type) {
            return false;
        }
        return true;
    }
    FireKue.prototype.findJobs = function(options) {
        var that = this;
        var result = [];
        var keys = Object.keys(that.model.jobMap);
        options = options || {};
        for (var i = 0; i < keys.length; i++) {
            var job = that.model.jobMap[keys[i]];
            if (that.matches(job, options)) {
                result.push(job);
            }
        }
        if (options.order === "asc") {
            result = result.sort(function(a, b) {
                return a.id - b.id;
            });
        } else if (options.order === "desc") {
            result = result.sort(function(a, b) {
                return b.id - a.id;
            });
        }
        return result;
    }
    FireKue.prototype.serialize = function() {
        var that = this;
        return JSON.stringify(that.model);
    }

    module.exports = exports.FireKue = FireKue;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("FireKue", function() {
    var FireKue = require("./FireKue");
    var job1 = {
        type: "test",
        data: "data1",
        options: {}
    };
    var job2 = {
        type: "test",
        data: "data2",
        options: {}
    };
    var job3 = {
        type: "test",
        data: "data3",
        options: {}
    };
    var options = {
        verbose: true
    };

    function shouldJobEqual(actual, expected) {
        actual.type.should.equal(expected.type);
        should.deepEqual(actual.data, expected.data);
        should.deepEqual(actual.options, expected.options);
        should.deepEqual(actual.result, expected.result);
    }
    it("FireKue() should create a job queue", function() {
        var q = new FireKue();
    })
    it("add(job) should add a job", function() {
        var q = new FireKue();
        should.deepEqual(q.add(job1), {
            message: "job created",
            id: 1,
        });
        should.deepEqual(q.add(job2), {
            message: "job created",
            id: 2,
        });
    });
    it("get(id) should return job with given id", function() {
        var q = new FireKue();
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        shouldJobEqual(q.get(add1.id), job1);
        shouldJobEqual(q.get(add2.id), job2);
        should.equal(q.get(-1), null);
    });
    it("putResult(id, result) should update job with result", function() {
        var q = new FireKue();
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        shouldJobEqual(q.putResult(add1.id), job1);
        var job1Hello = JSON.parse(JSON.stringify(job1));
        job1Hello.result = "hello";
        shouldJobEqual(q.putResult(add1.id, "hello"), job1Hello);
        shouldJobEqual(q.putResult(add1.id), job1);
        shouldJobEqual(q.putResult(add1.id, "hello"), job1Hello);
        shouldJobEqual(q.get(add1.id), job1Hello);
        shouldJobEqual(q.get(add2.id), job2);
        should.equal(q.putResult(-1), null); // no such job
    });
    it("delete(id) should delete job with given id", function() {
        var q = new FireKue();
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        shouldJobEqual(q.get(add1.id), job1);
        shouldJobEqual(q.get(add2.id), job2);
        should.equal(q.get(-1), null);
        should.deepEqual(q.delete(add1.id), {
            message: "job 1 removed"
        })
        should.equal(null, q.get(add1.id));
        shouldJobEqual(job2, q.get(add2.id));
        should.throws(function() {
            q.delete(-1);
        });
    });
    it("serialize() should return a serialized job queue", function() {
        var q = new FireKue();
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        shouldJobEqual(q.get(add1.id), job1);
        shouldJobEqual(q.get(add2.id), job2);
        should.equal(q.get(-1), null);
        var s = q.serialize();

        var qNew = new FireKue(JSON.parse(s));
        shouldJobEqual(qNew.get(add1.id), job1);
        shouldJobEqual(qNew.get(add2.id), job2);
        should.equal(qNew.get(-1), null);
    });
    it("findJobs(options) should return an array of matching jobs", function() {
        var q = new FireKue();
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        var add3 = q.add(job3);
        var f2 = q.findJobs({
            from: 2,
            to: 2,
        });
        f2.length.should.equal(1);
        f2[0].type.should.equal(job2.type);
        shouldJobEqual(f2[0], job2);
        var f21 = q.findJobs({
            from: -1,
            to: 2,
            order: "desc",
        });
        f21.length.should.equal(2);
        shouldJobEqual(f21[0], job2);
        shouldJobEqual(f21[1], job1);
        var f32 = q.findJobs({
            from: 2,
            to: 20,
            order: "desc",
        });
        f32.length.should.equal(2);
        shouldJobEqual(f32[0], job3);
        shouldJobEqual(f32[1], job2);
        var fA2 = q.findJobs({
            from: 2,
            state: "inactive",
            order: "asc"
        });
        fA2.length.should.equal(2);
        shouldJobEqual(fA2[0], job2);
        shouldJobEqual(fA2[1], job3);
        var fActive = q.findJobs({
            state: "active",
        });
        fActive.length.should.equal(0);
    });
    it("stats() should return job counts by type", function() {
        var q = new FireKue();
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        var add3 = q.add(job3);
        should.deepEqual(q.stats(), {
            activeCount: 0,
            failedCount: 0,
            completeCount: 0,
            inactiveCount: 3,
        });
    });
    it("processJob(type, handler) should process one job from the queue", function() {
        var q = new FireKue({
            verbose: false
        });
        var add1 = q.add(job1);
        var add2 = q.add(job2);
        var add3 = q.add(job3);
        q.processOne("test", function(job, done) {
            shouldJobEqual(job, job1);
            should.deepEqual(q.stats(), {
                activeCount: 1,
                failedCount: 0,
                completeCount: 0,
                inactiveCount: 2,
            });
            done(null, "happy");
            should.deepEqual(q.stats(), {
                activeCount: 0,
                failedCount: 0,
                completeCount: 1,
                inactiveCount: 2,
            });
            job.state.should.equal("complete");
            job.result.should.equal("happy");
        });
        q.processOne(null, function(job, done) {
            shouldJobEqual(job, job2);
            var err = new JsonError("a bad day");
            should.deepEqual(q.stats(), {
                activeCount: 1,
                failedCount: 0,
                completeCount: 1,
                inactiveCount: 1,
            });
            done(err, "sad");
            should.deepEqual(q.stats(), {
                activeCount: 0,
                failedCount: 1,
                completeCount: 1,
                inactiveCount: 1,
            });
            job.state.should.equal("failed");
            job.result.should.equal("sad");
        });
        q.processOne("never", function(job, done) {
            should.fail();
        });
        setTimeout(function() {
            should.deepEqual(q.stats(), {
                activeCount: 0,
                failedCount: 1,
                completeCount: 1,
                inactiveCount: 1,
            });
        }, 100);
    });
})

var should = require("should");
var FireKue = require("../../www/js/shared/FireKue");
var Logger = require("../../www/js/shared/Logger");
var RESTworker = require("./RESTworker");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function FireKueREST(options) {
        var that = this;
        options = options || {};

        that.fireKue = options.firekue || new FireKue();
        that.model = {
            rest: "FireKueREST",
        };
        that.workers = [
            new RESTworker(options),
        ];
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    var httpInclude = [
        "/camera",
        "/images",
        "/firestep",
        "/firesight",
        "/mesh",
        "/measure",
    ];
    var httpExclude = [
        "/model",
        "/image.jpg",
        "/images/location",
        "/out.jpg",
    ]

    FireKueREST.prototype.observe_http = function(req) {
        var that = this;
        var url = req.url;
        var observe = false;
        for (var i = httpInclude.length; i-- > 0;) {
            if (req.url.startsWith(httpInclude[i])) {
                observe = true;
            }
        }
        for (var i = httpExclude.length; observe && i-- > 0;) {
            if (req.path.endsWith(httpExclude[i])) {
                observe = false;
            }
        }
        if (!observe) {
            return;
        }
        console.log("FireKue\t:", req.method, url);
    }
    FireKueREST.prototype.isAvailable = function() {
        var that = this;
        return that.model.rest === "FireKueREST";
    }
    FireKueREST.prototype.step_GET = function(onStep) {
        var that = this;
        var nIdle = 0;
        var nStepped = 0;
        // step active workers
        for (var i=0; i<that.workers.length; i++) {
            if (that.workers[i].isAvailable()) {
                nIdle++;
            } else {
                that.verbose && verboseLogger.debug("FireKueREST.step_GET() active worker(s) stepped:", i);
                nStepped += that.workers[i].step(onStep) ? 1 : 0; 
            }
        }
        if (nIdle > 0) { 
            var inactive = that.fireKue.findJobs({
                state: FireKue.INACTIVE,
                order:"asc",
            });
            for (var i=0; inactive.length>0 && i<that.workers.length; i++) {
                var w = that.workers[i];
                if (w.isAvailable()) {
                    if (w.startJob(inactive[0], onStep)) {
                        that.verbose && verboseLogger.debug("FireKueREST.step_GET() assigning job", inactive[0].id, " to worker:", i);
                        inactive = inactive.splice(1);
                        nStepped++;
                    }
                }
            }
        }
        if (nStepped === 0) {
            onStep(null, {
                progress: 1,
                isBusy: false,
            });
        }
        that.verbose && verboseLogger.debug("FireKueREST.step_GET() workers stepped:", nStepped);
        return nStepped > 0;
    }
    FireKueREST.prototype.job_GET = function(id) {
        var that = this;
        var job = that.fireKue.get(Number(id));
        if (job == null) {
            return new Error("job " + id + " not found");
        }
        return job;
    }
    FireKueREST.prototype.job_DELETE = function(id) {
        var that = this;
        try {
            id = Number(id);
            var job = that.fireKue.get(id);
            if (job && job.state === FireKue.ACTIVE) {
                job.state = FireKue.FAILED;
                job.progress = 1;
                job.err = new Error("Job deleted while active");
            }
            return that.fireKue.delete(id);
        } catch (e) {
            return e;
        }
    }
    FireKueREST.prototype.job_POST = function(job) {
        var that = this;
        job.state = job.state || FireKue.INACTIVE;
        job.progress = 0;
        job.isBusy = false;
        job.err = null;
        return that.fireKue.add(job);
    }
    FireKueREST.prototype.jobs_GET = function(tokens) {
        var that = this;
        if (tokens.length < 1) {
            return new Error("Invalid jobs url (too short)");
        }
        var options = {};
        var order = {
            asc: "asc",
            desc: "desc"
        };
        var state = {
            active: "active",
            inactive: "inactive",
            complete: "complete",
            failed: "failed",
        };
        var end = tokens.length - 1;
        options.order = order[tokens[end]];
        if (options.order) {
            end--;
        }
        var fromto = tokens[end].split("..");
        if (fromto.length !== 2) {
            return new Error('Expected jobs url to end with "/:from..:to/:order?"');
        }
        options.from = fromto[0].length ? Number(fromto[0]) : null;
        options.to = fromto[1].length ? Number(fromto[1]) : null;
        end--;
        if (end >= 0) {
            options.state = state[tokens[end]];
            if (options.state == null) {
                return new Error("Could not parse jobs url with unknown state:" + tokens[end]);
            }
            end--;
        }
        if (end >= 0) {
            options.type = tokens[end];
            end--;
        }
        if (end != -1) {
            return new Error("Unknown token in jobs url:", tokens[end]);
        }
        //that.verbose && verboseLogger.debug("jobs options:", options);
        return that.fireKue.findJobs(options);
    }

    module.exports = exports.FireKueREST = FireKueREST;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("FireKueREST", function() {
    var FireKueREST = exports.FireKueREST; // require("./FireKueREST");
    var job1 = {
        type: "test",
        data: {
            color: "red1"
        }
    };
    var job2 = {
        type: "test",
        state: "active",
        data: {
            color: "green2"
        }
    };
    var job3 = {
        type: "testAlt",
        data: {
            color: "blue3"
        }
    };
    var job1expected = {
        id: 1,
        state: "inactive",
        err: null,
        progress: 0,
        isBusy: false,
        data: job1.data,
        type: job1.type,
    };
    var job2expected = {
        id: 2,
        state: "active",
        err: null,
        progress: 0,
        isBusy: false,
        data: job2.data,
        type: job2.type,
    };
    var job3expected = {
        id: 3,
        state: "inactive",
        err: null,
        progress: 0,
        isBusy: false,
        data: job3.data,
        type: job3.type,
    };

    it("job_POST(job) adds a new job", function() {
        var firekue = new FireKue();
        var rest = new FireKueREST({
            firekue: firekue,
        });
        should.deepEqual(rest.job_POST(JSON.parse(JSON.stringify(job1))), {
            id: 1,
            message: "job created"
        });
    });
    it("job_GET(id) returns requested job", function() {
        var firekue = new FireKue();
        var rest = new FireKueREST({
            firekue: firekue,
        });
        rest.job_POST(JSON.parse(JSON.stringify(job1)));
        rest.job_POST(JSON.parse(JSON.stringify(job2)));
        rest.job_POST(JSON.parse(JSON.stringify(job3)));
        should.deepEqual(rest.job_GET(1), job1expected);
        should.deepEqual(rest.job_GET("2"), job2expected);
    });
    it("job_DELETE(id) deletes requested job", function() {
        var firekue = new FireKue();
        var rest = new FireKueREST({
            firekue: firekue,
        });
        rest.job_POST(JSON.parse(JSON.stringify(job1)));
        rest.job_POST(JSON.parse(JSON.stringify(job2)));
        rest.job_POST(JSON.parse(JSON.stringify(job3)));
        should.deepEqual(rest.job_GET(2), job2expected);
        should.deepEqual(rest.job_DELETE(2), {
            message: "job 2 removed"
        });
        should.deepEqual(rest.job_GET(2), new Error("job 2 not found"));
        should.deepEqual(rest.job_DELETE("2"), new Error("FireKue.delete() no job:2"));
    });
    it("jobs_GET(tokens) returns requested jobs", function() {
        var firekue = new FireKue();
        var rest = new FireKueREST({
            firekue: firekue,
        });
        rest.job_POST(JSON.parse(JSON.stringify(job1)));
        rest.job_POST(JSON.parse(JSON.stringify(job2)));
        rest.job_POST(JSON.parse(JSON.stringify(job3)));
        should.deepEqual(rest.jobs_GET(["1..1"]), [job1expected]);
        should.deepEqual(rest.jobs_GET(["2..3"]), [job2expected, job3expected]);
        should.deepEqual(rest.jobs_GET(["3..5"]), [job3expected]);
        should.deepEqual(rest.jobs_GET(["5..6"]), []);
        should.deepEqual(rest.jobs_GET(["inactive", "1..", "desc"]), [job3expected, job1expected]);
        should.deepEqual(rest.jobs_GET(["inactive", "2..3"]), [job3expected]);
        should.deepEqual(rest.jobs_GET(["badstate", "1.."]), new Error("Could not parse jobs url with unknown state:badstate"));
        should.deepEqual(rest.jobs_GET(["test", "active", "..10"]), [job2expected]);
        should.deepEqual(rest.jobs_GET(["testAlt", "inactive", "1.."]), [job3expected]);
        should.deepEqual(rest.jobs_GET(["test", "complete", "..10"]), []);
        should.deepEqual(rest.jobs_GET(["1..3", "asc"]), [job1expected, job2expected, job3expected]);
        should.deepEqual(rest.jobs_GET(["1..3", "desc"]), [job3expected, job2expected, job1expected]);
    });
    it("step_GET() steps job(s)", function() {
        var options = {
            verbose: false,
        };
        var firekue = new FireKue(options);
        var rest = new FireKueREST({
            firekue: firekue,
            verbose: options.verbose,
        });
        var onStep = function(err, status) {
            should(err == null).True;
        }
        rest.step_GET(onStep).should.False; // empty
        var jTemplate = {
            type: "REST",
            data: {
                url: "http://www.time.gov/actualtime.cgi?test=url",
            },
        };
        var jobs = [
            JSON.parse(JSON.stringify(jTemplate)),
            JSON.parse(JSON.stringify(jTemplate)),
            JSON.parse(JSON.stringify(jTemplate)),
        ];
        rest.job_POST(jobs[0]);
        rest.job_POST(jobs[1]);
        rest.job_POST(jobs[2]);
        rest.step_GET(onStep).should.True;
        jobs[0].state.should.equal(FireKue.ACTIVE);
        jobs[1].state.should.equal(FireKue.INACTIVE);
        jobs[2].state.should.equal(FireKue.INACTIVE);
        rest.step_GET(onStep).should.False; // worker is blocked
        jobs[0].state.should.equal(FireKue.ACTIVE);
        jobs[1].state.should.equal(FireKue.INACTIVE);
        jobs[2].state.should.equal(FireKue.INACTIVE);
        setTimeout(function() {
            rest.step_GET(onStep).should.True; // worker is no longer blocked
            jobs[0].state.should.equal(FireKue.COMPLETE);
            jobs[1].state.should.equal(FireKue.ACTIVE);
            jobs[2].state.should.equal(FireKue.INACTIVE);
            rest.step_GET(onStep).should.False; // worker is blocked
            setTimeout(function() {
                rest.step_GET(onStep).should.True; // worker is no longer blocked
                jobs[0].state.should.equal(FireKue.COMPLETE);
                jobs[1].state.should.equal(FireKue.COMPLETE);
                jobs[2].state.should.equal(FireKue.ACTIVE);
                rest.step_GET(onStep).should.False; // worker is blocked
                setTimeout(function() {
                    rest.step_GET(onStep).should.False; // no more work
                    jobs[0].state.should.equal(FireKue.COMPLETE);
                    jobs[1].state.should.equal(FireKue.COMPLETE);
                    jobs[2].state.should.equal(FireKue.COMPLETE);
                }, 1000);
            }, 1000);
        }, 1000);
    });
    it("job_DELETE() will force failure of active job", function() {
        var options = {
            verbose: false,
        };
        var firekue = new FireKue(options);
        var rest = new FireKueREST({
            firekue: firekue,
            verbose: options.verbose,
        });
        var nSuccess = 0;
        var nFail = 0;
        var onStep = function(err, status) {
            err == null && nSuccess++;
            err != null && nFail++;
        }
        rest.step_GET(onStep).should.False; // empty
        var jTemplate = {
            type: "REST",
            data: {
                url: "http://www.time.gov/actualtime.cgi?test=url",
            },
        };
        var jobs = [
            JSON.parse(JSON.stringify(jTemplate)),
            JSON.parse(JSON.stringify(jTemplate)),
            JSON.parse(JSON.stringify(jTemplate)),
        ];
        rest.job_POST(jobs[0]);
        rest.job_POST(jobs[1]);
        rest.job_POST(jobs[2]);
        rest.step_GET(onStep).should.True;
        jobs[0].state.should.equal(FireKue.ACTIVE);
        jobs[1].state.should.equal(FireKue.INACTIVE);
        jobs[2].state.should.equal(FireKue.INACTIVE);
        rest.job_DELETE(jobs[0].id);
        jobs[0].state.should.equal(FireKue.FAILED);
        jobs[1].state.should.equal(FireKue.INACTIVE);
        jobs[2].state.should.equal(FireKue.INACTIVE);
        setTimeout(function() {
            jobs[0].state.should.equal(FireKue.FAILED); // success completion should be ignored
            jobs[1].state.should.equal(FireKue.INACTIVE);
            jobs[2].state.should.equal(FireKue.INACTIVE);
            nSuccess.should.equal(1);
            nFail.should.equal(1);
        }, 2000);
    });
})

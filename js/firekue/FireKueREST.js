var should = require("should");
var FireKue = require("../../www/js/shared/FireKue");
var Logger = require("../../www/js/shared/Logger");

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
            return that.fireKue.delete(Number(id));
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
})

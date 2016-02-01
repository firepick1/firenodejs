var should = require("should");
var http = require("http");
var querystring = require("querystring");
var FireKue = require("../../www/js/shared/FireKue");
var Logger = require("../../www/js/shared/Logger");
var JsonError = require("../../www/js/shared/JsonError");
var Steppable = require("./Steppable");
var URL = require("url");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ///////////////////////// private instance variables

    ////////////////// constructor
    function RESTworker(options) {
        var that = this;
        options = options || {};
        that.defaultPort = options.defaultPort || 80;
        that.clear();

        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    RESTworker.prototype.setPort = function(port) {
        var that = this;
        this.defaultPort = port;
        that.verbose && verboseLogger.debug("RESTworker.setPort(" + port + ")");
    }
    RESTworker.prototype.dataAt = function(iData) {
        var that = this;
        var job = that.job;
        if (job.data instanceof Array) {
            return job.data[iData];
        }
        return job.data;
    }
    RESTworker.prototype.jobSize = function(job) {
        var that = this;
        job = job == null ? that.job : job;
        if (job == null) {
            return 0;
        }
        if (job.data instanceof Array) {
            return job.data.length;
        }
        return 1;
    }
    RESTworker.prototype.clear = function() {
        var that = this;
        that.job = null;
        that.iData = 0;
        return that;
    }
    RESTworker.prototype.beforeAdd = function(job) {
        var that = this;
        if (job.type !== 'REST') {
            return null;
        }
        if (job.data == null) {
            return new JsonError("RESTworker.beforeAdd() missing required property:job.data");
        }
        if (job.data instanceof Array) {
            if (job.data.length === 0) {
                return new JsonError("RESTworker.beforeAdd() job.data cannot be empty");
            }
        } else {
            job.data = [job.data];
        }
        for (var i=0; i< job.data.length; i++) {
            var req = job.data[i];
            if (req.path == null && req.url == null) {
                return new JsonError("RESTworker.beforeAdd() REST request must have path or url:" + JSON.stringify(req));
            }
            if (req.method == null) {
                req.method = (req.postData == null) ? "GET" : "POST";
            }
            if (req.method === 'POST' && req.postData == null) {
                return new JsonError("RESTworker.beforeAdd() POST request must have postData:" + JSON.stringify(req));
            }
            if (req.port == null) {
                req.port = that.defaultPort;
            }
        }
        return job;
    }
    RESTworker.prototype.step = function(onStep) {
        var that = this;
        var n = that.jobSize();
        if (that.iData >= n) {
            return false;
        }
        var job = that.job;
        if (job.isBusy) {
            return false;
        }
        if (job.err != null) {
            return false;
        }
        job.isBusy = true;
        job.tStart = new Date();
        var jobData = that.dataAt(that.iData);
        if (jobData.url == null && jobData.path == null) {
            return false;
        }
        var reqOptions = {
            path: jobData.path,
            method: jobData.method || "GET",
            hostname: jobData.hostname || "localhost",
            port: jobData.port || that.defaultPort,
        };
        if (jobData.url) {
            var parsed = URL.parse(jobData.url);
            if (parsed) {
                reqOptions.hostname = parsed.hostname;
                reqOptions.port = parsed.port;
                reqOptions.path = parsed.pathname;
            }
        }
        var postData = jobData.postData;
        if (postData && reqOptions.method === 'POST') {
            if (typeof postData !== "string") {
                postData = JSON.stringify(postData);
            }
            //reqOptions.headers["Content-Type"] = 'application/x-www-form-urlencoded';
            reqOptions.headers = reqOptions.headers || {};
            reqOptions.headers["Content-Type"] = 'application/json';
            reqOptions.headers["Content-Length"] = postData.length;
            that.verbose && verboseLogger.debug("RESTworker.step() postData:", postData);
        }
        reqOptions.path.should.exist;
        reqOptions.toString = function() {
            var that = this;
            return that.method + " http://" + that.hostname + ":" + that.port + that.path;
        }
        that.verbose && verboseLogger.debug("RESTworker.step() reqOptions:", reqOptions);
        var req = http.request(reqOptions, function(res) {
            res.setEncoding('utf8');
            var body = "";
            res.on('data', function(chunk) {
                body += chunk;
                //that.verbose && verboseLogger.debug("RESTworker.step() iData:", that.iData, " chunk:", chunk);
            });
            res.on('end', function() {
                job.tEnd = new Date();
                that.verbose && verboseLogger.debug("RESTworker.step() iData:", that.iData,
                    " job:", job.id, " => HTTP" + res.statusCode); //, " body:", body);
                that.job.isBusy = false;
                if (res.statusCode === 200) {
                    that.iData++;
                    addJobResult(job, body, res);
                    if (that.iData >= that.jobSize()) {
                        if (job.state === FireKue.ACTIVE) {
                            job.state = FireKue.COMPLETE;
                            job.progress = 1;
                        }
                        that.clear();
                    }
                } else if (res.statusCode === 404) {
                    job.err == null && (job.err = new JsonError("HTTP404 not found:" + reqOptions));
                    console.log("WARN\t: ", job.err.error);
                    job.state = FireKue.FAILED;
                    addJobResult(job, body, res);
                    that.clear();
                } else if (res.statusCode === 302) {
                    job.err == null && (job.err = new JsonError("RESTworker.send(HTTP302) HTTP redirect not implemented. location:" + res.headers.location));
                    console.log("WARN\t: ", job.err.error);
                    job.state = FireKue.FAILED;
                    addJobResult(job, body, res);
                    that.clear();
                } else {
                    if (job.err == null) {
                        try {
                            job.err = JSON.parse(body);
                            job.err.statusCode = res.statusCode;
                        } catch (e) {
                            job.err = new JsonError("HTTP" + res.statusCode + " body:" + body);
                        }
                    } else {
                        console.log("WARN\t: TRUNCATED ERROR CASCADE:" + body);
                    }
                    console.log("WARN\t: ", job.err.error);
                    addJobResult(job, body, res);
                    job.state = FireKue.FAILED;
                    that.clear();
                }
                onStep(job.err, that.status());
            });
        });
        req.on('error', function(err) {
            job.err = err;
            job.state = FireKue.FAILED;
            addJobResult(job, null);
            console.log("ERROR\t:RESTworker.step() iData:", that.iData, " job:", job.id, " err:", err);
            onStep(that.err, that.status());
            that.clear();
        })
        if (reqOptions.method === "POST") {
            req.write(postData);
        }
        req.end();
        return true;
    }
    RESTworker.prototype.isIdle = function() {
        var that = this;
        return that.job == null;
    }
    RESTworker.prototype.status = function() {
        var that = this;
        var job = that.job;
        if (job == null) {
            return {
                progress: 1,
                isBusy: false,
                err: null,
            };
        }
        var n = that.jobSize(job);
        job.progress = n ? that.iData / n : 1;
        return {
            progress: job.progress,
            isBusy: job.isBusy,
            err: job.err,
        }
    }
    RESTworker.prototype.startJob = function(job, onStep, options) {
        var that = this;
        options = options || {}
        if (job.type !== "REST") {
            options.strict && should(job.type).equal("REST");
            return false;
        }
        if (that.job != null) {
            return false;
        }
        that.clear();
        that.job = job;
        job.state = FireKue.ACTIVE;
        job.err = null;
        job.result = job.data instanceof Array ? [] : null;
        return that.step(onStep);
    }
    var addJobResult = function(job, data, res) {
        var ct = res && res.headers['content-type'];
        if (ct && ct.search("application/json") >= 0) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.log("WARN\t: could not parse result data as JSON:", data);
            }
        }
        if (job.data instanceof Array) {
            job.result.push(data);
        } else {
            job.result = data;
        }
        job.tEnd = new Date();
        return job;
    }

    module.exports = exports.RESTworker = RESTworker;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("RESTworker", function() {
    var RESTworker = exports.RESTworker;
    var job1 = {
        id: 1,
        type: "REST",
        data: {
            url: "http://www.time.gov/actualtime.cgi?test=url",
        },
    };
    var job3 = {
        id: 123,
        type: "REST",
        data: [{
            hostname: "www.time.gov",
            path: "/actualtime.cgi?test=A",
            method: "GET"
        }, {
            hostname: "www.time.gov",
            path: "/actualtime.cgi?test=B",
            method: "GET"
        }, {
            hostname: "www.time.gov",
            path: "/actualtime.cgi?test=C",
            method: "GET"
        }, ]
    };
    var job4 = {
        id: 1234,
        type: "REST",
        data: [{
            hostname: "www.time.gov",
            path: "/actualtime.cgi?test=1",
        }, {
            hostname: "www.time.gov",
            path: "/actualtime.cgi?test=2",
        }, {
            hostname: "www.time.gov",
            path: "/bad.cgi?test=3",
        }, {
            hostname: "www.time.gov",
            path: "/actualtime.cgi?test=4",
        }, ]
    };
    it("isSteppable should be true", function() {
        var rw = new RESTworker();
        Steppable.isSteppable(rw, true).should.True;
    });
    it("jobSize(job) should return size of given job", function() {
        var rw = new RESTworker();
        rw.jobSize(job1).should.equal(1);
        rw.jobSize(job4).should.equal(4);
        rw.jobSize().should.equal(0);
    });
    it("startJob(job) should process the job and return true or return false if the job is not applicable", function() {
        var options = {
            verbose: false,
        };
        var jobIgnore = {
            type: "OTHER"
        };
        var rw = new RESTworker(options);
        var job = JSON.parse(JSON.stringify(job1));
        var onStep = function(err, status) {
            status.progress.should.equal(1);
            status.isBusy.should.False; // ready for next steps
            should(err == null).True; // no problems
            status.progress.should.equal(1);
            job.state.should.equal(FireKue.COMPLETE); // all done 
        };
        rw.startJob(job, onStep).should.True;
        rw.startJob(jobIgnore).should.false; // worker
        should.deepEqual(rw.status(), {
            err: null,
            isBusy: true,
            progress: 0,
        });
        setTimeout(function() {
            should.deepEqual(rw.status(), {
                err: null,
                isBusy: false,
                progress: 1,
            });
            job.state.should.equal(FireKue.COMPLETE);
            job.result.startsWith("<timestamp").should.True;
        }, 2000);
    })
    it("startJob(job) will process an array of requests sequentially, generating a result array ", function() {
        var options = {
            verbose: false
        };
        var progress = 0;
        var rw = new RESTworker(options);
        var job = JSON.parse(JSON.stringify(job3));
        var onStep = function(err, status) {
            status.progress.should.above(progress); // monotonic increasing
            progress = status.progress; // save for later comparison
            status.isBusy.should.False; // ready for next steps
            should(err == null).True; // no problems
            if (progress < 1) {
                job.state.should.equal(FireKue.ACTIVE); // not done yet
                rw.step(onStep).should.True;
            } else {
                status.progress.should.equal(1);
                job.state.should.equal(FireKue.COMPLETE); // all done 
                rw.step(onStep).should.False;
            }
        };
        rw.startJob(job, onStep).should.True;
        should.deepEqual(rw.status(), {
            err: null,
            isBusy: true,
            progress: 0,
        });
        setTimeout(function() {
            should.deepEqual(rw.status(), {
                err: null,
                isBusy: false,
                progress: 1,
            });
            should.deepEqual(job.state, FireKue.COMPLETE);
            job.result.length.should.equal(3);
            job.result[0].startsWith("<timestamp").should.True;
            job.result[0].should.not.equal(job.result[1]);
            job.result[1].startsWith("<timestamp").should.True;
            job.result[0].should.not.equal(job.result[2]);
            job.result[2].startsWith("<timestamp").should.True;
        }, 3000);
    })
    it("startJob(job) should terminate the job if any http request fails", function() {
        var options = {
            verbose: false
        };
        var progress = 0;
        var rw = new RESTworker(options);
        var job = JSON.parse(JSON.stringify(job4));
        var onStep = function(err, status) {
            status.progress.should.above(progress); // monotonic increasing
            progress = status.progress; // save for later comparison
            status.isBusy.should.False; // ready for next steps
            if (progress < 1) {
                job.state.should.equal(FireKue.ACTIVE); // not done yet
                rw.step(onStep).should.True;
            } else {
                status.progress.should.equal(1);
                err.should.instanceOf(Error);
                job.state.should.equal(FireKue.FAILED); // all done 
                rw.step(onStep).should.False;
            }
        };
        rw.startJob(job, onStep).should.True;
        should.deepEqual(rw.status(), {
            err: null,
            isBusy: true,
            progress: 0,
        });
        setTimeout(function() {
            should.deepEqual(rw.status(), {
                err: null,
                isBusy: false,
                progress: 1,
            });
            job.state.should.equal(FireKue.FAILED);
            job.result.length.should.equal(3);
            job.result[0].startsWith("<timestamp").should.True;
            job.result[1].startsWith("<timestamp").should.True;
            job.err.should.instanceOf(Error);
            JSON.stringify(job.err).should.equal('{"error":"HTTP404 not found:GET http://www.time.gov:80/bad.cgi?test=3"}');
            job.result[2].indexOf("404 Not Found").should.not.below(0);
        }, 2000);
    })
    it("startJob(job) should handle jobs to localhost", function() {
        var options = {
            verbose: false, // change to true to diagnose test failure
            strict: true,
            defaultPort: 8080,
        };
        var rw = new RESTworker(options);
        var job = JSON.parse(JSON.stringify({
            id: 411,
            type: "REST",
            data: {
                path: "/firenodejs/hello",
            }
        }));
        var onStep = function(err, status) {
            should(err == null).True; // no problems
            if (status.progress < 1) {
                job.state.should.equal(FireKue.ACTIVE); // not done yet
                rw.step(onStep).should.True;
            } else {
                job.state.should.equal(FireKue.COMPLETE); // all done 
            }
        };
        options.verbose && console.log("DEBUG\t: if this test fails, make sure firenodejs is running");
        rw.startJob(job, onStep, options);
        setTimeout(function() {
            job.state.should.equal(FireKue.COMPLETE);
            job.result.should.equal("hello");
        }, 2000);
    })
    it("startJob(job) should handle jobs that POST to localhost", function() {
        var options = {
            verbose: false, // change to true to diagnose test failure
            strict: true,
            defaultPort: 8080,
        };
        var rw = new RESTworker(options);
        var job = JSON.parse(JSON.stringify({
            id: 411,
            type: "REST",
            data: {
                path: "/firenodejs/echo",
                method: "POST",
                postData: {
                    msg: "hello"
                },
            }
        }));
        var onStep = function(err, status) {
            should(err == null).True; // no problems
            if (status.progress < 1) {
                job.state.should.equal(FireKue.ACTIVE); // not done yet
                rw.step(onStep).should.True;
            } else {
                job.state.should.equal(FireKue.COMPLETE); // all done 
            }
        };
        options.verbose && console.log("DEBUG\t: if this test fails, make sure firenodejs is running");
        rw.startJob(job, onStep, options);
        setTimeout(function() {
            job.state.should.equal(FireKue.COMPLETE);
            should.deepEqual(job.result, {
                msg: "hello"
            });
        }, 2000);
    })
    it("isIdle() should return true if worker is free to handle jobs", function() {
        var rw = new RESTworker();
        var onStep = function(err, status) {
            status.progress === 1 || rw.step(onStep).should.True;
        };
        rw.isIdle().should.True;
        var job = JSON.parse(JSON.stringify(job1));
        rw.startJob(job, onStep);
        rw.isIdle().should.False;
        setTimeout(function() {
            rw.isIdle().should.True;
            job.state.should.equal(FireKue.COMPLETE);
            job.result.startsWith("<timestamp").should.True;
        }, 2000);
    })
    it("beforeAdd(job) should validate and return the given job", function() {
        var rw = new RESTworker();
        // beforeAdd returns null if type isn't relevant
        should(rw.beforeAdd({
            type:"OTHER"
        })).Null;
        should(rw.beforeAdd({
            type:"REST",
            data:[],
        }).message).match("RESTworker.beforeAdd() job.data cannot be empty");
        should(rw.beforeAdd({
            type:"REST",
            data:[{}],
        }).message).match("RESTworker.beforeAdd() REST request must have path or url:{}");
        should.deepEqual(rw.beforeAdd({
            type:"REST",
            data:[{
                path:"/firestep",
                postData:{
                    "hom":""
                }
            }],
        }),{
            type:"REST",
            data:[{
                path:"/firestep",
                method:"POST",
                port:80,
                postData:{
                    "hom":""
                }
            }]
        });
    })
})

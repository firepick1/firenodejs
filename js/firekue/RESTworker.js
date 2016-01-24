var should = require("should");
var http = require("http");
var FireKue = require("../../www/js/shared/FireKue");
var Logger = require("../../www/js/shared/Logger");
var Steppable = require("./Steppable");
var URL = require("url");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ///////////////////////// private instance variables

    ////////////////// constructor
    function RESTworker(firekue, options) {
        var that = this;
        options = options || {};
        firekue.should.exist;
        that.firekue = firekue;
        that.clear();

        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
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
        var dataReq = that.dataAt(that.iData);
        var url = dataReq.url;
        if (url == null) {
            url = "http://" + dataReq.host + dataReq.path;
        } else {
            var parsed = URL.parse(url);
            if (parsed) {
                dataReq.host = parsed.host;
                dataReq.path = parsed.pathname;
            }
        }
        //that.verbose && verboseLogger.debug("RESTworker.step() ", dataReq.method || "GET", " ", url);
        http.request(that.dataAt(that.iData), function(res) {
            var data = "";
            res.on('data', function(chunk) {
                data += chunk;
            });
            res.on('end', function() {
                job.tEnd = new Date();
                that.verbose && verboseLogger.debug("RESTworker.step() iData:", that.iData, 
                    " job:", job.id, " ", url, " => HTTP" + res.statusCode); //, " data:", data);
                that.job.isBusy = false;
                if (res.statusCode === 200) {
                    that.iData++;
                    if (job.data instanceof Array) {
                        job.result.push(data);
                    } else {
                        job.result = data;
                    }
                    if (that.iData >= that.jobSize()) {
                        job.state = FireKue.COMPLETE;
                        that.clear();
                    }
                } else {
                    var err = new Error("HTTP" + res.statusCode);
                    if (job.data instanceof Array) {
                        job.result.push(err);
                    } else {
                        job.result = err;
                    }
                    job.state = FireKue.FAILED;
                    that.clear();
                }
                onStep(that.status());
            });
        }).on('error', function(err) {
            job.err = err;
            job.state = FireKue.FAILED;
            if (job.data instanceof Array) {
                job.result.push(data);
            } else {
                job.result = data;
            }
            job.tEnd = new Date();
            console.log("ERROR\t:RESTworker.step() iData:", that.iData, " job:", job.id, " err:", err);
            onStep(that.status());
            that.clear();
        }).end();
        return true;
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
        job.progress = n ? that.iData/n : 1;
        return {
            progress: job.progress,
            isBusy: job.isBusy,
            err: job.err,
        }
    }
    RESTworker.prototype.startJob = function(job, onStep) {
        var that = this;
        if (job.type !== "REST") {
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

    module.exports = exports.RESTworker = RESTworker;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("RESTworker", function() {
    var RESTworker = exports.RESTworker;
    var job1 = {
        id:1,
        type:"REST",
        data: {url:"http://www.time.gov/actualtime.cgi?test=url", method:"GET"},
    };
    var job3 = {
        id:123,
        type:"REST",
        data:[
            {host:"www.time.gov", path:"/actualtime.cgi?test=A", method:"GET"},
            {host:"www.time.gov", path:"/actualtime.cgi?test=B", method:"GET"},
            {host:"www.time.gov", path:"/actualtime.cgi?test=C", method:"GET"},
        ]
    };
    var job4 = {
        id:1234,
        type:"REST",
        data:[
            {host:"www.time.gov", path:"/actualtime.cgi?test=1", method:"GET"},
            {host:"www.time.gov", path:"/actualtime.cgi?test=2", method:"GET"},
            {host:"www.time.gov", path:"/bad.cgi?test=3", method:"GET"},
            {host:"www.time.gov", path:"/actualtime.cgi?test=4", method:"GET"},
        ]
    };
    var firekue = new FireKue();
    it("isSteppable should be true", function() {
        var firekue = new FireKue();
        var rw = new RESTworker(firekue);
        Steppable.isSteppable(rw, true).should.True;
    });
    it("jobSize(job) should return size of given job", function() {
        var firekue = new FireKue();
        var rw = new RESTworker(firekue);
        rw.jobSize(job1).should.equal(1);
        rw.jobSize(job4).should.equal(4);
        rw.jobSize().should.equal(0);
    });
    it("startJob(job) should process the job and return true or return false if the job is not applicable", function() {
        var options = {verbose:false};
        var firekue = new FireKue();
        var jobIgnore = {type:"OTHER"};
        var rw = new RESTworker(firekue, options);
        var job = JSON.parse(JSON.stringify(job1));
        var onStep = function(status) {
            status.progress.should.equal(1);
            status.isBusy.should.False; // ready for next steps
            should(status.err).Null; // no problems
            status.progress.should.equal(1);
            job.state.should.equal(FireKue.COMPLETE); // all done 
        };
        rw.startJob(job, onStep).should.True;
        rw.startJob(jobIgnore).should.false; // worker
        should.deepEqual(rw.status(),{
            err:null,
            isBusy: true,
            progress: 0,
        });
        setTimeout(function() {
            should.deepEqual(rw.status(),{
                err:null,
                isBusy: false,
                progress: 1,
            });
            job.state.should.equal(FireKue.COMPLETE);
            job.result.startsWith("<timestamp").should.True;
        },1500);
    })
    it("startJob(job) will process an array of requests sequentially, generating a result array ", function() {
        var options = {verbose:false};
        var firekue = new FireKue();
        var progress = 0;
        var rw = new RESTworker(firekue, options);
        var job = JSON.parse(JSON.stringify(job3));
        var onStep = function(status) {
            status.progress.should.above(progress); // monotonic increasing
            progress = status.progress; // save for later comparison
            status.isBusy.should.False; // ready for next steps
            should(status.err).Null; // no problems
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
        should.deepEqual(rw.status(),{
            err:null,
            isBusy: true,
            progress: 0,
        });
        setTimeout(function() {
            should.deepEqual(rw.status(),{
                err:null,
                isBusy: false,
                progress: 1,
            });
            job.state.should.equal(FireKue.COMPLETE);
            job.result.length.should.equal(3);
            job.result[0].startsWith("<timestamp").should.True;
            job.result[0].should.not.equal(job.result[1]);
            job.result[1].startsWith("<timestamp").should.True;
            job.result[0].should.not.equal(job.result[2]);
            job.result[2].startsWith("<timestamp").should.True;
        },1500);
    })
    it("startJob(job) should terminate the job if any http request fails", function() {
        var options = {verbose:false};
        var progress = 0;
        var rw = new RESTworker(firekue, options);
        var job = JSON.parse(JSON.stringify(job4));
        var onStep = function(status) {
            status.progress.should.above(progress); // monotonic increasing
            progress = status.progress; // save for later comparison
            status.isBusy.should.False; // ready for next steps
            should(status.err).Null; // no problems
            if (progress < 1) {
                job.state.should.equal(FireKue.ACTIVE); // not done yet
                rw.step(onStep).should.True;
            } else {
                status.progress.should.equal(1);
                job.state.should.equal(FireKue.FAILED); // all done 
                rw.step(onStep).should.False;
            }
        };
        rw.startJob(job, onStep).should.True;
        should.deepEqual(rw.status(),{
            err:null,
            isBusy: true,
            progress: 0,
        });
        setTimeout(function() {
            should.deepEqual(rw.status(),{
                err:null,
                isBusy: false,
                progress: 1,
            });
            job.state.should.equal(FireKue.FAILED);
            job.result.length.should.equal(3);
            job.result[0].startsWith("<timestamp").should.True;
            job.result[1].startsWith("<timestamp").should.True;
            job.result[2].should.instanceOf(Error);
        },1500);
    })
})

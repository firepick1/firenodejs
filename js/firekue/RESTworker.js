var should = require("should");
var http = require("http");
var FireKue = require("../../www/js/shared/FireKue");
var Logger = require("../../www/js/shared/Logger");

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

        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    RESTworker.prototype.processJob = function(job) {
        var that = this;
        if (job.type !== "REST") {
            return false;
        }
        return true;
    }

    module.exports = exports.RESTworker = RESTworker;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("RESTworker", function() {
    var RESTworker = exports.RESTworker;
    it("processJob(job) should process the job and return true or return false if the job is not applicable", function() {
        var firekue = new FireKue();
        var jobIgnore = {type:"OTHER"};
        var job = {
            type:"REST",
            data:[
                {url:"http://www.time.gov/actualtime.cgi", method:"GET"},
                {url:"http://www.time.gov/actualtime.cgi", method:"GET"},
                {url:"http://www.time.gov/actualtime.cgi", method:"GET"},
            ]
        }
        var rw = new RESTworker(firekue);
        rw.processJob(job).should.True;
        rw.processJob(jobIgnore).should.false;

        http.request(job.data[0], function() {
            console.log
        }).end();
    })
})

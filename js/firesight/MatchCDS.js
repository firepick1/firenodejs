var child_process = require('child_process');
var path = require("path");
var should = require("should");
var Grid = require("../../www/js/shared/Grid");
var Logger = require("../../www/js/shared/Logger");

(function(exports) {
    var verboseLogger = new Logger({
        level: "debug",
    });

    ////////////////// constructor
    function MatchCDS(firesight, options) {
        var that = this;
        options = options || {};

        should && should.exist(firesight);
        that.verbose = options.verbose;
        that.firesight = firesight;
        that.pipeline = "json/match-cds.json";

        return that;
    }
    MatchCDS.prototype.calculate = function(camName, onSuccess, onFail, options) {
        var that = this;
        options = options || {};
        var firesight = that.firesight;
        var jsonDstPath = firesight.outputJsonPath(camName);
        var onMatchCDS = function(stdout, stderr, fail) {
            var outJson;
            var rects;
            that.verbose && console.log("DEBUG\t: MatchCDS stdout:", stdout);
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                    rects = outJson.match && outJson.match.rects;
                    for (var i = rects.length; 0 < i--;) {
                        delete rects[i].angle;
                        delete rects[i].width;
                        delete rects[i].height;
                    }
                } catch (e) {
                    console.log("ERROR\t: MatchCDS " + jsonDstPath + ") could not parse JSON:", stdout);
                }
            }
            var result = {
                summary: (rects ? "Matched " + rects.length : "No match"),
                matched: rects || [],
            };
            firesight.verbose && console.log("DEBUG\t: " + JSON.stringify(result));
            onSuccess(result);
        };
        var args = "-Dtemplate=www/img/bwwb.jpg";
        return firesight.calcImage(camName, "json/match-cds.json", args, onMatchCDS, onFail);
    }

    module.exports = exports.MatchCDS = MatchCDS;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MatchCDS", function() {
    var MockImages = new require("../mock/MockImages");
    var options = {
        cameraName: "mock-cdscam"
    }
    var mockImages = new MockImages(options);
    var FireSightREST = require("../firesight/FireSightREST");
    var firesight = new FireSightREST(mockImages, {
        verbose: true,
        appDir: "../../",
    });
    var MatchCDS = require("./MatchCDS.js");
    //var firesight = new FireSightREST(mock_images);
    it("MatchCDS() should return poitns matching crash dummy symbol (CDS)", function() {
        var cds = new MatchCDS(firesight, {
            verbose: true
        });
        var mockImagePath = "../../www/img/crash-dummy.png";
        args = "-Dtemplate=../../www/img/bwwb.jpg";
        var cmd = firesight.buildCommand(options.cameraName, cds.pipeline, args, mockImagePath);
        cmd.should.equal("firesight -i " + mockImagePath +
            " -p ../../json/match-cds.json" +
            " -o /var/img/mock-cdscam_x0_y0_z0.jpg" +
            " -Dtemplate=../../www/img/bwwb.jpg" +
            " | tee /var/img/mock-cdscam_x0_y0_z0.json"
        );
        var callbacks = 0;
        var execResult = child_process.exec(cmd, function(error, stdout, stderr) {
            should(error instanceof Error).equal(false);
            should.deepEqual(JSON.parse(stdout), {
                drawMatched: {},
                match: {
                    matches: 1,
                    maxVal: '0.93449',
                    rects: [{
                        angle: -0,
                        corr: '1',
                        height: 32,
                        width: 32,
                        x: 27,
                        y: 27,
                    }]
                }
            });
            stderr.should.equal("");
            callbacks++;
        });
    })
})

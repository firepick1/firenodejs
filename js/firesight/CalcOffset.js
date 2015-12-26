var child_process = require('child_process');
var path = require("path");
var should = require("should");

(function(exports) {
    ////////////////// constructor
    function CalcOffset(firesight, options) {
        var that = this;
        options = options || {};

        should(firesight).exist;
        that.verbose = options.verbose;
        that.firesight = firesight;

        return that;
    }
    CalcOffset.prototype.calcOffset = function(camName, onSuccess, onFail) {
        var that = this;
        var firesight = that.firesight;
        camName = typeof camName == "undefined" ?  firesight.camera.name : camName;
        var loc = firesight.images.location();
        var jpgDstPath = firesight.outputImagePath(camName, false);
        var jsonDstPath = firesight.outputJsonPath(camName, false);
        var savedImage = firesight.images.savedImagePath(camName);
        var onCalcOffset = function(error, stdout, stderr) {
            if (error instanceof Error) {
                var msg = "FireSightREST.calcOffset(" + loc + ") " + error;
                console.log("ERROR\t: " + msg);
                var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                    // don't care
                });
                onFail(new Error(msg));
            } else {
                //console.log(stdout);
                var outJson;
                var offset;
                if (stdout && stdout.length > 0) {
                    try {
                        outJson = JSON.parse(stdout);
                        offset = outJson.model && outJson.model.channels && outJson.model.channels["0"];
                    } catch (e) {
                        console.log("ERROR\t: FireSightREST.calcOffset(" + loc + ") could not parse JSON:", stdout);
                    }
                }
                if (offset && offset.dx != null && offset.dy != null) {
                    var result = {
                        dx: offset.dx,
                        dy: offset.dy
                    }
                    console.log("INFO\t: FireSightREST.calcOffset(" + loc + ") " + JSON.stringify(result));
                    onSuccess(result);
                } else {
                    var msg = "FireSightREST.calcOffset(" + loc + ") no match";
                    console.log("INFO\t: " + msg);
                    var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                        // don't care
                    });
                    onFail(new Error(msg));
                }
            }
        };
        var onCapture = function(imagePath) {
            var cmd = 
                "firesight -p json/calc-offset.json" +
                " -i " + imagePath +
                " -o " + jpgDstPath +
                " -Dsaved=" + savedImage + " | " +
                "tee " + jsonDstPath;
            that.verbose && console.log("EXEC\t: " + cmd);
            var execResult = child_process.exec(cmd, onCalcOffset);
        };
        if (savedImage) {
            setTimeout(function() {
                firesight.camera.capture(camName, onCapture, function(error) {
                    onFail(new Error("FireSightREST.calcOffset() could not capture current image"));
                });
            }, firesight.firestep.model.rest.msSettle);
        } else {
            onFail(new Error("FireSightREST.calcOffset() no saved image"));
        }
    }

    module.exports = exports.CalcOffset = CalcOffset;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("CalCOffset", function() {
    var FireSightREST = require("../firesight/FireSightREST.js");
    var CalcOffset = require("./CalcOffset.js");
    var MockCamera = new require("../mock/MockCamera");
    var MockImages = new require("../mock/MockImages");
    var mock_camera = new MockCamera();
    var mock_images = new MockImages();
    var firesight = new FireSightREST(mock_images);
    it("calcOffset() should calculate offset of current and saved images at current location", function() {
    })
})

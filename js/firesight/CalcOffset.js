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
    CalcOffset.prototype.calculate = function(camName, onSuccess, onFail, options) {
        var that = this;
        options = options || {};
        var firesight = that.firesight;
        camName = typeof camName == "undefined" ? firesight.camera.name : camName;
        var loc = firesight.images.location();
        var savedImage = firesight.images.savedImagePath(camName, options.savedImage);
        if (!savedImage) {
            onFail(new Error("FireSightREST.calcOffset() no saved image"));
            return that;
        }
        var args = "-Dsaved=" + savedImage;
        var result = {
            summary: "No match",
            dx: null,
            dy: null,
        }
        var onCalcOffset = function(stdout, stderr, fail) {
            var outJson;
            var offset;
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                    offset = outJson.model && outJson.model.channels && outJson.model.channels["0"];
                } catch (e) {
                    result.summary = "No match (JSON parse error)";
                    onSuccess(result);
                    return that;
                    //fail("FireSightREST.calcOffset(" + loc + ") could not parse JSON:" + stdout);
                }
            }
            if (offset && offset.dx != null && offset.dy != null) {
                result.summary = "Matched";
                result.dx = offset.dx;
                result.dy = offset.dy;
            } else {
                //fail("FireSightREST.calcOffset(" + loc + ") no match");
            }
            console.log("INFO\t: FireSightREST.calcOffset(" + loc + ") " + JSON.stringify(result));
            onSuccess(result);
            return that;
        };
        return firesight.calcImage(camName, "json/calc-offset.json", args, onCalcOffset, onFail);
    }

    module.exports = exports.CalcOffset = CalcOffset;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("CalCOffset", function() {
    //var CalcOffset = require("./CalcOffset.js");
    //var FireSightREST = require("./FireSightREST");
    var MockImages = new require("../mock/MockImages");
    var mock_images = new MockImages();
    //var firesight = new FireSightREST(mock_images);
    it("calcOffset() should calculate offset of current and saved images at current location", function() {})
})

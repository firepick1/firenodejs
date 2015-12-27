var child_process = require('child_process');
var path = require("path");
var should = require("should");

(function(exports) {
    ////////////////// constructor
    function CalcForeground(firesight, options) {
        var that = this;
        options = options || {};

        should(firesight).exist;
        that.verbose = options.verbose;
        that.firesight = firesight;

        return that;
    }
    CalcForeground.prototype.calculate = function(camName, onSuccess, onFail) {
        var that = this;
        var firesight = that.firesight;
        camName = typeof camName == "undefined" ?  firesight.camera.name : camName;
        var loc = firesight.images.location();
        var savedImage = firesight.images.savedImagePath(camName);
        if (!savedImage) {
            onFail(new Error("FireSightREST.CalcForeground() no saved image"));
            return that;
        }
        var args = "-DbgImg=" + savedImage;
        var onCalcForeground = function(stdout, stderr, fail) {
            var outJson;
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                    console.log(stdout);
                } catch (e) {
                    fail("FireSightREST.CalcForeground(" + loc + ") could not parse JSON:" + stdout);
                }
            }
        };
        return firesight.calcImage(camName, "json/calc-foreground.json", args, onCalcForeground, onFail);
    }

    module.exports = exports.CalcForeground = CalcForeground;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("CalcForeground", function() {
    var FireSightREST = require("../firesight/FireSightREST.js");
    var CalcForeground = require("./CalcForeground.js");
    var MockCamera = new require("../mock/MockCamera");
    var MockImages = new require("../mock/MockImages");
    var mock_camera = new MockCamera();
    var mock_images = new MockImages();
    var firesight = new FireSightREST(mock_images);
    it("CalcForeground() should calculate offset of current and saved images at current location", function() {
    })
})

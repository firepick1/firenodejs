var child_process = require('child_process');
var path = require("path");
var should = require("should");
var Grid = require("../../www/js/shared/Grid");

(function(exports) {
    ////////////////// constructor
    function CalcGrid(firesight, options) {
        var that = this;
        options = options || {};

        should(firesight).exist;
        that.verbose = options.verbose;
        that.firesight = firesight;

        return that;
    }
    CalcGrid.prototype.calculate = function(camName, onSuccess, onFail) {
        var that = this;
        var firesight = that.firesight;
        var jsonDstPath = firesight.outputJsonPath(camName, false);
        var onMeasureGrid = function(stdout, stderr, fail) {
            var outJson;
            var rects;
            that.verbose && console.log("DEBUG\t: measure-grid stdout:", stdout);
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                    rects = outJson.match && outJson.match.rects;
                    for (var i=rects.length; 0 < i--; ) {
                        delete rects[i].angle;
                        delete rects[i].width;
                        delete rects[i].height;
                    }
                } catch (e) {
                    console.log("ERROR\t: FireSightREST.measureGrid(" + jsonDstPath + ") could not parse JSON:", stdout);
                }
            }
            if (rects && rects.length > 0) {
                var grid = (rects && rects.length > 4) ? Grid.createFromPoints(rects) : null;
                if (grid) {
                    var result = {
                        origin: grid.origin,
                        angle: grid.angle,
                        cellSize: grid.cellSize,
                    }
                    console.log("INFO\t: FireSightREST.measureGrid(" + jsonDstPath + ") ");
                    firesight.verbose && console.log("DEBUG\t: " + JSON.stringify(result));
                    onSuccess(result);
                } else {
                    fail("FireSightREST.measureGrid(" + jsonDstPath + ") " + rects.length + " intersections found but no grid");
                }
            } else {
                fail("FireSightREST.measureGrid(" + jsonDstPath + ") no grid intersections matched");
            }
        };
        var args = "-Dtemplate=www/img/cross32.png";
        return firesight.calcImage(camName, "json/measureGrid.json", args, onMeasureGrid, onFail);
    }

    module.exports = exports.CalcGrid = CalcGrid;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("CalcGrid", function() {
    var FireSightREST = require("../firesight/FireSightREST.js");
    var CalcGrid = require("./CalcGrid.js");
    var MockImages = new require("../mock/MockImages");
    var mock_images = new MockImages();
    var firesight = new FireSightREST(mock_images);
    it("CalcGrid() should calculate grid using image at current location", function() {
    })
})

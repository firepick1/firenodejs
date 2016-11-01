var child_process = require('child_process');
var path = require("path");
var should = require("should");
var Grid = require("../../www/js/shared/Grid");

(function(exports) {
    ////////////////// constructor
    function CalcGrid(firesight, options) {
        var that = this;
        options = options || {};

        should && should.exist(firesight);
        that.verbose = options.verbose;
        that.firesight = firesight;

        return that;
    }
    CalcGrid.prototype.calculate = function(camName, onSuccess, onFail, options) {
        var that = this;
        options = options || {};
        var firesight = that.firesight;
        var jsonDstPath = firesight.outputJsonPath(camName);
        var onCalcGrid = function(stdout, stderr, fail) {
            var outJson;
            var rects;
            that.verbose && console.log("DEBUG\t: CalcGrid stdout:", stdout);
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
                    console.log("ERROR\t: CalcGrid " + jsonDstPath + ") could not parse JSON:", stdout);
                }
            }
            var result = {
                origin: null,
                angle: null,
                cellSize: null,
                rmse: null,
            };
            result.points = rects ? rects.length : 0;
            if (rects && rects.length > 0) {
                var grid = (rects && rects.length > 4) ? Grid.createFromPoints(rects) : null;
                if (grid) {
                    var stats = grid.statsFromPoints(rects);
                    result.origin = grid.origin;
                    result.angle = grid.angle;
                    result.cellSize = grid.cellSize;
                    result.rmse = {
                        x: stats.xRMSE,
                        y: stats.yRMSE
                    };
                    result.summary = "grid matched";
                    console.log("INFO\t: CalcGrid " + jsonDstPath + ") ");
                    firesight.verbose && console.log("DEBUG\t: " + JSON.stringify(result));
                    onSuccess(result);
                } else {
                    result.summary = "Too few grid intersections matched";
                    //console.log("INFO\t: CalcGrid " + jsonDstPath + ") ");
                    firesight.verbose && console.log("DEBUG\t: " + JSON.stringify(result));
                    onSuccess(result);
                    //fail("CalcGrid " + jsonDstPath + " " + rects.length + " intersections found but no grid");
                }
            } else {
                result.summary = "No grid intersections matched";
                firesight.verbose && console.log("DEBUG\t: " + JSON.stringify(result));
                onSuccess(result);
                //fail("CalcGrid " + jsonDstPath + " no grid intersections matched");
            }
        };
        var args = "-Dtemplate=www/img/cross32-2.jpg";
        return firesight.calcImage(camName, "json/calc-grid.json", args, onCalcGrid, onFail);
    }

    module.exports = exports.CalcGrid = CalcGrid;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("CalcGrid", function() {
    //var FireSightREST = require("../firesight/FireSightREST.js");
    //var CalcGrid = require("./CalcGrid.js");
    var MockImages = new require("../mock/MockImages");
    var mock_images = new MockImages();
    //var firesight = new FireSightREST(mock_images);
    it("CalcGrid() should calculate grid using image at current location", function() {})
})

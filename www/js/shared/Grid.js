var should = require("should");

(function(exports) {
    ////////////////// constructor
    function Grid(options) {
        var that = this;
        options = options || {};
        if (options.pts instanceof Array) {
            that.pts = pts;
        }
        return that;
    }

    Grid.createFromPoints = function(pts) {
        var xMin = pts[0].x;
        var xMax = xMin;
        var yMin = pts[0].y;
        var yMax = yMin;
        for (var i=pts.length; i-- > 1; ) {
            var pt = pts[i];
            if (pt.x < xMin) {
                xMin = pt.x;
            } else if (xMax < pt.x) {
                xMax = pt.x;
            } 
            if (pt.y < yMin) {
                yMin = pt.y;
            } else if (yMax < pt.y) {
                yMax = pt.y;
            }
        }
        var dx = xMax-xMin;
        var dy = yMax-yMin;
        var snap = Math.round(Math.sqrt(dx*dy/pts.length)/2);
        console.log("pts:", {dx:dx,dy:dy,xMin:xMin, xMax:xMax, yMin:yMin, yMax:yMax, n:pts.length,snap:snap});
        for (var i=pts.length; i-- > 0; ) {
            var pt = pts[i];
            pt.xs = Math.round((pt.x - xMin)/snap);
            pt.ys = Math.round((pt.y - yMin)/snap);
        }
        pts.sort(function(a,b) {
            var cmp = a.xs - b.xs;
            return cmp ? cmp : (a.ys - b.ys);
        });
        //console.log(pts);
        var ptPrev = pts[0];
        var c_dySum = 0;
        var c_dxSum = 0;
        var c_n = 0;
        var maxSnap = snap * 3;
        for (var i=1; i < pts.length; i++) {
            var pt = pts[i];
            if (pt.xs === ptPrev.xs && pt.ys - ptPrev.ys < maxSnap) {
                c_dySum += pt.y - ptPrev.y;
                c_dxSum += pt.x - ptPrev.x;
                c_n++;
            }
            ptPrev = pt;
        }
        pts.sort(function(a,b) {
            var cmp = a.ys - b.ys;
            return cmp ? cmp : (a.xs - b.xs);
        });
        var ptPrev = pts[0];
        var r_dxSum = 0;
        var r_dySum = 0;
        var r_n = 0;
        for (var i=1; i < pts.length; i++) {
            var pt = pts[i];
            if (pt.ys === ptPrev.ys) {
                r_dxSum += pt.x - ptPrev.x;
                r_dySum += pt.y - ptPrev.y;
                r_n++;
            }
            ptPrev = pt;
        }
        var r_dxAvg = Math.round(r_dxSum/r_n*100)/100;
        var r_dyAvg = Math.round(r_dySum/r_n*100)/100;
        var c_dxAvg = Math.round(c_dxSum/c_n*100)/100;
        var c_dyAvg = Math.round(c_dySum/c_n*100)/100;
        console.log({c_n:c_n, c_dxAvg: c_dxAvg, c_dyAvg:c_dyAvg, r_n:r_n, r_dxAvg:r_dxAvg, r_dyAvg:r_dyAvg});
    }

    module.exports = exports.Grid = Grid;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Grid", function() {
    var Grid = exports.Grid;
    var pushxy = function(a, x, y) {
        a.push({
            x: x,
            y: y
        });
    };
    var data1 = [];

    pushxy(data1,  85.0,  25.0);
    pushxy(data1,  87.0,  81.0);
    pushxy(data1,  89.0, 137.0);
    pushxy(data1,  92.0, 194.0);
    pushxy(data1,  94.0, 251.0);
    pushxy(data1,  96.0, 308.0);
    pushxy(data1,  99.0, 365.0);
    pushxy(data1, 141.0,  23.0);
    pushxy(data1, 144.0,  79.0);
    pushxy(data1, 146.0, 135.0);
    pushxy(data1, 149.0, 191.0);
    pushxy(data1, 151.0, 248.0);
    pushxy(data1, 154.0, 305.0);
    pushxy(data1, 156.0, 363.0);
    pushxy(data1, 198.0,  20.0);
    pushxy(data1, 200.0,  76.0);
    pushxy(data1, 203.0, 132.0);
    pushxy(data1, 205.0, 189.0);
    pushxy(data1, 208.0, 245.0);
    pushxy(data1, 211.0, 302.0);
    pushxy(data1, 213.0, 360.0);
    pushxy(data1, 254.0,  18.0);
    pushxy(data1, 256.0,  74.0);
    pushxy(data1, 259.0, 130.0);
    pushxy(data1, 262.0, 186.0);
    pushxy(data1, 264.0, 242.0);
    pushxy(data1, 267.0, 299.0);
    pushxy(data1, 270.0, 357.0);
    pushxy(data1, 310.0,  16.0);
    pushxy(data1, 313.0,  72.0);
    pushxy(data1, 315.0, 128.0);
    pushxy(data1, 318.0, 184.0);
    pushxy(data1, 321.0, 240.0);
    pushxy(data1, 324.0, 297.0);
    pushxy(data1, 327.0, 354.0);
    pushxy(data1, 369.0,  69.0);
    pushxy(data1, 371.0, 125.0);
    pushxy(data1, 374.0, 181.0);
    pushxy(data1, 377.0, 237.0);
    pushxy(data1, 381.0, 294.0);
    pushxy(data1, 383.0, 351.0);

    it("TESTTESTshould calculate a grid from matched poins", function() {
        var grid = Grid.createFromPoints(data1);
    })
})

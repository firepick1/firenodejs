var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Hilbert(order,options) {
        var that = this;

        order = order || 4;
        should && order.should.above(0);
        options = options || {};
        that.n = Math.pow(2,order);
        that.nPts = that.n*that.n;
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    Hilbert.prototype.rot = function(n, result, rx, ry) {
        var that = this;
        if (ry == 0) {
            if (rx == 1) {
                result.x = n - 1 - result.x;
                result.y = n - 1 - result.y;
            }

            //Swap x and y
            var t = result.x;
            result.x = result.y;
            result.y = t;
        }
    }
    Hilbert.prototype.d2xy = function(d) {
        var that = this;
        var t = d;
        var result = {
            x: 0,
            y: 0,
        }
        if (d === 64) {
            console.log("hello");
        }
        for (var s = 1; s < that.n; s *= 2) {
            var rx = 1 & (t >> 1);
            var ry = 1 & (t ^ rx);
            that.rot(s, result, rx, ry);
            result.x += s * rx;
            result.y += s * ry;
            t =  t >> 2;
        }

        return result;
    }
    Hilbert.prototype.points = function(options) {
        var that = this;
        var pts = [];
        options = options || {};
        var scale = options.scale || 1;
        var offset = (that.n-1)*scale/2;
        var dx = options.dx == null ? -offset : options.dx;
        var dy = options.dy == null ? -offset : options.dy;
        for (var i = 0; i < that.nPts; i++) {
            var pt = that.d2xy(i);
            pts.push({
                x: pt.x*scale+dx,
                y: pt.y*scale+dy,
            });
        }
        return pts;
    }

    module.exports = exports.Hilbert = Hilbert;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Hilbert", function() {
    var Hilbert = exports.Hilbert; // require("./Hilbert");
    console.log(typeof Hilbert);
    var options = {
        verbose: true
    };
    it("TESTTESTHilbert(order) creates Hilbert curve of given order > 0", function() {
        var hb = new Hilbert(1);
        hb.should.have.properties({
            n: 2,
            nPts: 4,
        });
    })
    it("TESTTESTd2xy(d) returns vertex d for Hilber curve n", function() {
        var hb = new Hilbert(1);
        should.deepEqual(hb.d2xy(0), {
            x: 0,
            y: 0
        });
        should.deepEqual(hb.d2xy(1), {
            x: 0,
            y: 1
        });
        should.deepEqual(hb.d2xy(2), {
            x: 1,
            y: 1
        });
        should.deepEqual(hb.d2xy(3), {
            x: 1,
            y: 0
        });
    })
    it("TESTTEST points(n)", function() {
        var hb = new Hilbert(1);
        var pts = hb.points();
        should.deepEqual([
            {x:-0.5, y:-0.5},
            {x:-0.5, y:0.5},
            {x:0.5, y:0.5},
            {x:0.5, y:-0.5},
        ], hb.points());
        should.deepEqual([
            {x:0, y:0},
            {x:0, y:1},
            {x:1, y:1},
            {x:1, y:0},
        ], hb.points({dx:0,dy:0}));
        should.deepEqual([
            {x:0, y:0},
            {x:0, y:3},
            {x:3, y:3},
            {x:3, y:0},
        ], hb.points({scale:3, dx:0, dy:0}));
    })
})

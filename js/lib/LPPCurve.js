var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
PHFeed = require("./PHFeed");
PH5Curve = require("./PH5Curve");
PHFactory = require("./PHFactory");
DeltaCalculator = require("./DeltaCalculator");
DataSeries = require("./DataSeries");
math = require("mathjs");

(function(firepick) {
    function LPPCurve(options) {
		var that = this;
		options = options || {};
        that.delta = options.delta || new DeltaCalculator();
        that.pathSize = options.pathSize || 50; // number of path segments
        that.zVertical = options.zVertical || 5; // mm vertical travel
        that.vMax = 200; // 100mm in 1s 
        that.tvMax = 0.5; // 100mm in 1s
        that.deltaSmoothness = 8; // delta path smoothness convergence threshold
        that.zHigh = options.zHigh == null ? 50 : zHigh; // highest point of LPP path
        that.zScale = options.zScale || 1; // DEPRECATED
		that.logger = options.logger || new Logger(options);
		return that;
    };

    ///////////////// INSTANCE ///////////////

    LPPCurve.prototype.zrDeltaPath = function(x,y,z) { // timed path
        var that = this;
        var delta = that.delta;
        var pts = [];
        var pathSize2 = that.pathSize/2;
        var height = that.zHigh - z;
        var dz = height/(that.pathSize-1);
        for (var i=0; i<that.pathSize; i++) {
            if (i < pathSize2) {
                var pulses = delta.calcPulses({x:0,y:0,z:that.zHigh-i*dz});
                pts.push(pulses);
            } else {
                var pulses = delta.calcPulses({x:x,y:y,z:that.zHigh-i*dz});
                pts.push(pulses);
            }
        }
        var start = math.round(that.zVertical/dz);
        var ds = new DataSeries({ start: start, end:-start, round:true });
        var maxIterations = 50;
        var d1Prev;
        var d2Prev;
        var d3Prev;
        for (var i=0; i++ < maxIterations; ) {
            //that.logger.withPlaces(5).debug(i, "\t", pts[start+1]);
            ds.blur(pts, "p1");
            ds.blur(pts, "p2");
            ds.blur(pts, "p3");
            var d1 = ds.diff(pts,"p1");
            if (d1Prev != null) {
                if (math.abs(d1Prev.max-d1.max) < that.deltaSmoothness) {
                    that.logger.debug("deltaSmoothness p1 converged:", i);
                    var d2 = ds.diff(pts,"p2");
                    if (d2Prev != null) {
                        if (math.abs(d2Prev.max-d2.max) < that.deltaSmoothness) {
                            that.logger.debug("deltaSmoothness p2 converged:", i);
                            var d3 = ds.diff(pts,"p3");
                            if (d3Prev != null) {
                                if (math.abs(d3Prev.max-d3.max) < that.deltaSmoothness) {
                                    that.logger.debug("deltaSmoothness p3 converged:", i);
                                    break;
                                }
                            }
                            d3Prev = d3;
                        }
                    }
                    d2Prev = d2;
                }
            }
            //that.logger.debug("zrDeltaPath blur diff:", ds.diff(pts, "p1"));
            d1Prev = d1;
        } 

        // final smoothing pass
        ds.start = 0;
        ds.end = 0;
        ds.blur(pts, "p1");
        ds.blur(pts, "p2");
        ds.blur(pts, "p3");

        for (var i=0; i<that.pathSize; i++) {
            var xyz = delta.calcXYZ(pts[i]);
            pts[i].x = xyz.x;
            pts[i].y = xyz.y;
            pts[i].z = xyz.z;
        }
        return pts;
    }

	///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.LPPCurve");
    module.exports = firepick.LPPCurve = LPPCurve;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.LPPCurve", function() {
	var logger = new Logger({
		nPlaces:3,
		logLevel:"info"
	});
	var LPPCurve = firepick.LPPCurve;
    var eMicrostep = 0.015;
    it("TESTTESTzrDeltaPath(x,y,z) should return timed XYZ path", function() {
        var lppFactory = new LPPCurve();
        var x = -70.7;
        var y = 70.7;
        var z = -10;
        var pts = lppFactory.zrDeltaPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz","\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i=0; i<pts.length; i++) {
            var pt = pts[i];
            logger.debug(i, 
                "\t", pt.p1 - ptPrev.p1,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z
                );
            maxp1 = math.max(maxp1, math.abs(pt.p1-ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2-ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3-ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lppFactory.zHigh-lppFactory.zVertical) {
                math.abs(pt.x).should.below(0.1);
                math.abs(pt.y).should.below(0.1);
            }
            if (z+lppFactory.zVertical > pt.z) {
                math.abs(x-pt.x).should.below(0.1);
                math.abs(y-pt.y).should.below(0.1);
            }
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts,"z");
        diff.max.should.below(0); // z is monotonic decreasing
        diff = ds.diff(pts,"y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts,"x");
        diff.max.should.below(eMicrostep); // x is monotonic decreasing within microstep tolerance
        diff = ds.diff(pts,"p1");
        diff.min.should.above(0); // p1 is monotonic increasing
        diff = ds.diff(pts,"p2");
        diff.min.should.above(0); // p2 is monotonic increasing
        diff = ds.diff(pts,"p3");
        diff.min.should.above(0); // p3 is monotonic increasing
        logger.info("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
    it("TESTTESTzrDeltaPath(x,y,z) should handle central paths", function() {
        var lppFactory = new LPPCurve();
        var x = 1;
        var y = 20;
        var z = 10;
        var pts = lppFactory.zrDeltaPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz","\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i=0; i<pts.length; i++) {
            var pt = pts[i];
            logger.debug(i, 
                "\t", pt.p1 - ptPrev.p1,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z
                );
            maxp1 = math.max(maxp1, math.abs(pt.p1-ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2-ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3-ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lppFactory.zHigh-lppFactory.zVertical) {
                math.abs(pt.x).should.below(0.1);
                math.abs(pt.y).should.below(0.1);
            }
            if (z+lppFactory.zVertical > pt.z) {
                math.abs(x-pt.x).should.below(0.1);
                math.abs(y-pt.y).should.below(0.1);
            }
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts,"z");
        diff.max.should.below(0); // z is monotonic decreasing
        diff = ds.diff(pts,"y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts,"x");
        diff.min.should.above(-eMicrostep); // x is monotonic increasing within microstep tolerance
        diff = ds.diff(pts,"p1");
        diff.min.should.above(0); // p1 is monotonic increasing
        diff = ds.diff(pts,"p2");
        diff.min.should.above(0); // p2 is monotonic increasing
        diff = ds.diff(pts,"p3");
        diff.min.should.above(0); // p3 is monotonic increasing
        logger.info("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
    it("TESTTESTzrDeltaPath(x,y,z) should handle Z-axis paths", function() {
        var lppFactory = new LPPCurve();
        var x = 0;
        var y = 0;
        var z = -10;
        var pts = lppFactory.zrDeltaPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz","\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i=0; i<pts.length; i++) {
            var pt = pts[i];
            logger.debug(i, 
                "\t", pt.p1 - ptPrev.p1,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z
                );
            maxp1 = math.max(maxp1, math.abs(pt.p1-ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2-ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3-ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lppFactory.zHigh-lppFactory.zVertical) {
                math.abs(pt.x).should.below(0.1);
                math.abs(pt.y).should.below(0.1);
            }
            if (z+lppFactory.zVertical > pt.z) {
                math.abs(x-pt.x).should.below(0.1);
                math.abs(y-pt.y).should.below(0.1);
            }
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts,"z");
        diff.max.should.below(0); // z is monotonic decreasing
        diff = ds.diff(pts,"y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts,"x");
        diff.min.should.above(-eMicrostep); // x is monotonic increasing within microstep tolerance
        diff = ds.diff(pts,"p1");
        diff.min.should.above(0); // p1 is monotonic increasing
        diff = ds.diff(pts,"p2");
        diff.min.should.above(0); // p2 is monotonic increasing
        diff = ds.diff(pts,"p3");
        diff.min.should.above(0); // p3 is monotonic increasing
        logger.info("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
})

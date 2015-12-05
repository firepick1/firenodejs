var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Util = require("./Util");
Laplace = require("./Laplace");
Logger = require("./Logger");
PHFeed = require("./PHFeed");
PH5Curve = require("./PH5Curve");
PHFactory = require("./PHFactory");
DeltaCalculator = require("./DeltaCalculator");
DataSeries = require("./DataSeries");
DVSFactory = require("./DVSFactory");
math = require("mathjs");

(function(firepick) {
    function LPPCurve(options) {
        var that = this;
        options = options || {};
        that.laplaceFade = options.laplaceFade || 1;
        that.delta = options.delta || new DeltaCalculator();
        that.pathSize = options.pathSize || 80; // number of path segments
        that.zVertical = options.zVertical || 10; // mm vertical travel
        that.pathSizeVertical = options.pathSizeVertical || 10; // number of vertical path segments
        that.maxVerticalXYError = options.maxVerticalXYError || 0.5; // 500 micron error at top of vertical path
        that.vMax = 18000; // 100mm in 1s 
        that.tvMax = 0.7; // 100mm in 1s
        that.deltaSmoothness = 8; // delta path smoothness convergence threshold
        that.zHigh = options.zHigh == null ? 50 : options.zHigh; // highest point of LPP path
        that.zScale = options.zScale || 1; // DEPRECATED
        that.logger = options.logger || new Logger(options);
        return that;
    };

    ///////////////// INSTANCE ///////////////

    LPPCurve.prototype.zrPath = function(x, y, z) {
        var that = this;
        var dz = that.zHigh - z;
        var dr = math.sqrt(x * x + y * y);
        var N = that.pathSize - 1;
        var N2 = math.floor(that.pathSize / 2);
        var pts = [];
        if (dz) {
            for (var i = 0; i <= N2; i++) {
                var tau = i / N2;
                var pt = {
                    x: 0,
                    y: 0,
                    z: that.zHigh - tau * dz,
                }
                pts.push(pt);
            }
        }
        if (dr) {
            for (var i = 0; i <= N2; i++) {
                var tau = i / N2;
                var pt = {
                    x: tau * x,
                    y: tau * y,
                    z: z,
                }
                pts.push(pt);
            }
            that.calcPulses(pts);
            that.blurSmooth(pts);
            //that.blurMonotonic(pts);
        }
        return pts;
    }
    LPPCurve.prototype.calcPulses = function(pts) {
        var that = this;
        var N = that.pathSize - 1;
        for (var i = 0; i <= N; i++) {
            var pt = pts[i];
            var pulses = that.delta.calcPulses(pt);
            pt.p1 = pulses.p1;
            pt.p2 = pulses.p2;
            pt.p3 = pulses.p3;
        }
    }
    LPPCurve.prototype.laplacePath = function(x, y, z) {
        var that = this;
        var msStart = Util.millis();
        var dz = that.zHigh - z;
        var dr = math.sqrt(x * x + y * y);
        var qxy = dr == 0 ? 0.9 : (1 - that.maxVerticalXYError / dr);
        var N = that.pathSize - 1;
        var pVertical = 1 - that.pathSizeVertical / N; // parametric position of top of vertical path
        that.laplaceZ = that.laplaceZ || Laplace.transitionb(pVertical, 1 - that.zVertical / dz);
        that.laplaceXY = that.laplaceXY || Laplace.transitionb(pVertical, qxy);
        var lapz = new Laplace({
            b: that.laplaceZ
        });
        var lapxy = new Laplace({
            b: that.laplaceXY
        });
        var pts = [];
        dz.should.above(3 * that.zVertical); // vertical + horizontal + vertical
        var pVertical = lapz.transition(0.1625); //that.zVertical/dz;
        var bz = Laplace.cdfb(0.125, pVertical, 0.5);
        for (var i = 0; i <= N; i++) {
            var tau = i / N;
            var kz = lapz.transition(tau);
            var kxy = lapxy.transition(tau);
            var pt = {
                x: x * kxy,
                y: y * kxy,
                z: that.zHigh - kz * dz
            };
            if (i === 0) {
                kz.should.equal(0);
                pt.z.should.equal(that.zHigh);
            }
            pts.push(pt);
        }
        that.calcPulses(pts);
        that.blurSmooth(pts);
        that.blurMonotonic(pts);
        var dsFade = new DataSeries({
            round: true,
            laplaceFade: that.laplaceFade
        });
        var nFade = pts.length / 5;
        dsFade.fadeIn(pts, "p1", pts[0].p1, nFade);
        dsFade.fadeIn(pts, "p2", pts[0].p2, nFade);
        dsFade.fadeIn(pts, "p3", pts[0].p3, nFade);
        dsFade.fadeOut(pts, "p1", pts[N].p1, nFade);
        dsFade.fadeOut(pts, "p2", pts[N].p2, nFade);
        dsFade.fadeOut(pts, "p3", pts[N].p3, nFade);
        that.calcXYZ(pts);
        var msElapsed = Util.millis() - msStart;
        that.logger.debug({
            msElapsed: msElapsed
        });
        return pts;
    }
    LPPCurve.prototype.blurSmooth = function(pts, options) {
        var that = this;
        options = options || {};
        var ds = options.ds || new DataSeries({
            start: 2,
            end: -2,
            round: true
        });
        var maxIterations = options.maxIterations || 50;
        var d1;
        var d2;
        var d3;
        var d1Prev;
        var d2Prev;
        var d3Prev;
        var smooth = false;
        var i = 0;
        while (i++ < maxIterations) {
            ds.blur(pts, "p1");
            ds.blur(pts, "p2");
            ds.blur(pts, "p3");
            d1 = ds.diff(pts, "p1");
            if (d1Prev != null) {
                if (math.abs(d1Prev.max - d1.max) < that.deltaSmoothness) {
                    that.logger.debug("deltaSmoothness p1 converged:", i);
                    d2 = ds.diff(pts, "p2");
                    if (d2Prev != null) {
                        if (math.abs(d2Prev.max - d2.max) < that.deltaSmoothness) {
                            that.logger.debug("deltaSmoothness p2 converged:", i);
                            d3 = ds.diff(pts, "p3");
                            if (d3Prev != null) {
                                if (math.abs(d3Prev.max - d3.max) < that.deltaSmoothness) {
                                    that.logger.debug("deltaSmoothness p3 converged:", i);
                                    smooth = true;
                                    break;
                                }
                            }
                            d3Prev = d3;
                        }
                    }
                    d2Prev = d2;
                }
            }
            d1Prev = d1;
        }
        return {
            d1: d1,
            d2: d2,
            d3: d3,
            smooth: smooth,
            iterations: i
        };
    }
    LPPCurve.prototype.blurStepPath = function(x, y, z) {
        var that = this;
        var delta = that.delta;
        var pts = [];
        var pathSize2 = that.pathSize / 2;
        var height = that.zHigh - z;
        var dz = height / (that.pathSize - 1);
        for (var i = 0; i < that.pathSize; i++) {
            var pulses = (i < pathSize2) ?
                delta.calcPulses({
                    x: 0,
                    y: 0,
                    z: that.zHigh - i * dz
                }) :
                delta.calcPulses({
                    x: x,
                    y: y,
                    z: that.zHigh - i * dz
                });
            pts.push(pulses);
        }
        var start = math.round(that.zVertical / dz);
        var ds = new DataSeries({
            start: start,
            end: -start,
            round: true
        });
        var smooth = that.blurSmooth(pts);
        var monotone = that.blurMonotonic(pts);
        that.calcXYZ(pts);
        return pts;
    }
    LPPCurve.prototype.blurMonotonic = function(pts, options) {
        var that = this;
        options = options || {};
        var ds = options.ds || new DataSeries({
            start: 2,
            end: -2,
            round: true
        });
        var maxIterations = options.maxIterations || 30;
        var isMonotonic = false;
        var i;
        var diff1;
        var diff2;
        var diff3;
        for (i = 0; i < maxIterations; i++) {
            var diff1 = ds.diff(pts, "p1");
            if (diff1.min >= 0) {
                var diff2 = ds.diff(pts, "p2");
                if (diff2.min >= 0) {
                    var diff3 = ds.diff(pts, "p3");
                    if (diff3.min >= 0) {
                        i++;
                        isMonotonic = true;
                        break;
                    }
                }
            }
            ds.blur(pts, "p1");
            ds.blur(pts, "p2");
            ds.blur(pts, "p3");
        }
        return {
            monotonic: isMonotonic,
            iterations: i,
            diff1: diff1,
            diff2: diff2,
            diff3: diff3
        };
    }
    LPPCurve.prototype.calcXYZ = function(pts) {
        var that = this;
        var ptPrev = pts[0];
        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i];
            pt.dp1 = pt.p1 - ptPrev.p1;
            ptPrev = pt;
            var xyz = that.delta.calcXYZ({
                p1: pt.p1,
                p2: pt.p2,
                p3: pt.p3
            });
            pt.x = xyz.x;
            pt.y = xyz.y;
            pt.z = xyz.z;
        }
        return that;
    }
    LPPCurve.prototype.ph5Path = function(x, y, z) {
        var that = this;
        var msStart = Util.millis();
        var geometry = that.blurStepPath(x, y, z);
        var msGeometric = Util.millis() - msStart;
        var zr = [];
        for (var i = 0; i < geometry.length; i++) {
            var pt = geometry[i];
            var r = math.sqrt(pt.x * pt.x + pt.y * pt.y);
            var c = new Complex(pt.z, r);
            zr.push(c);
        }
        zr.reverse();
        var ph = new PHFactory(zr).quintic();
        var msPH = Util.millis() - msStart;
        var xyzHigh = that.delta.calcXYZ({
            p1: 500,
            p2: 500,
            p3: 500
        });
        var xyzLow = that.delta.calcXYZ({
            p1: -500,
            p2: -500,
            p3: -500
        });
        var vMax = math.abs(xyzHigh.z - xyzLow.z) * that.vMax / 1000;
        var phf = new PHFeed(ph, {
            vMax: vMax,
            tvMax: 0.7,
        });
        var pts = phf.interpolate(that.pathSize, {});
        pts.reverse();
        var radius = math.sqrt(x * x + y * y);
        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i];
            var scale = radius ? pt.r.im / radius : 1;
            pt.x = x * scale;
            pt.y = y * scale;
            pt.z = pt.r.re;
            var pulses = that.delta.calcPulses({
                x: pt.x,
                y: pt.y,
                z: pt.z
            });
            pt.p1 = pulses.p1;
            pt.p2 = pulses.p2;
            pt.p3 = pulses.p3;
        }
        var height = that.zHigh - z;
        var dz = height / (that.pathSize - 1);
        var start = 0; //math.round(that.zVertical/dz);
        var ds = new DataSeries({
            start: start,
            end: -start,
            round: true
        });
        var monoResult = that.blurMonotonic(pts);
        that.logger.debug("ph5Path monotonic:", monoResult);
        that.calcXYZ(pts);
        var msTimed = Util.millis() - msStart;
        that.logger.info({
            msGeometric: msGeometric,
            msPH: msPH,
            msTimed: msTimed
        });
        return pts;
    }

    ///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.LPPCurve");
    module.exports = firepick.LPPCurve = LPPCurve;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.LPPCurve", function() {
    var logger = new Logger({
        nPlaces: 3,
        logLevel: "info"
    });
    var xTest = 5;
    var yTest = -50;
    var zTest = -50;
    var zHigh = 50;
    var LPPCurve = firepick.LPPCurve;
    var eMicrostep = 0.025;

    function dumpPts(pts) {
        logger.info("\ttau\tdp1\tdp2\tdp3\tp1\tp2\tp3\tx\ty\tz");
        var ptPrev = pts[0];
        for (var i = 0; i < pts.length; i++) {
            var pt = pts[i];
            logger.info(
                "\t", i / (pts.length - 1),
                "\t", pt.p1 - ptPrev.p1,
                "\t", pt.p2 - ptPrev.p2,
                "\t", pt.p3 - ptPrev.p3,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z,
                ""
            );
            ptPrev = pt;
        }
    }
    it("blurStepPath(x,y,z) should return XYZ path", function() {
        var lpp = new LPPCurve();
        var x = -70.7;
        var y = 70.7;
        var z = -10;
        var pts = lpp.blurStepPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz", "\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i = 0; i < pts.length; i++) {
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
            maxp1 = math.max(maxp1, math.abs(pt.p1 - ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2 - ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3 - ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lpp.zHigh - lpp.zVertical) {
                math.abs(pt.x).should.below(0.2);
                math.abs(pt.y).should.below(0.2);
            }
            if (z + lpp.zVertical > pt.z) {
                math.abs(x - pt.x).should.below(0.2);
                math.abs(y - pt.y).should.below(0.2);
            }
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts, "z");
        diff.max.should.below(0); // z is monotonic decreasing
        diff = ds.diff(pts, "y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "x");
        diff.max.should.below(eMicrostep); // x is monotonic decreasing within microstep tolerance
        logger.debug("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
    it("blurStepPath(x,y,z) should handle central paths", function() {
        var lpp = new LPPCurve();
        var x = 1;
        var y = 20;
        var z = 10;
        var pts = lpp.blurStepPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz", "\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i = 0; i < pts.length; i++) {
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
            maxp1 = math.max(maxp1, math.abs(pt.p1 - ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2 - ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3 - ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lpp.zHigh - lpp.zVertical) {
                math.abs(pt.x).should.below(0.1);
                math.abs(pt.y).should.below(0.1);
            }
            if (z + lpp.zVertical > pt.z) {
                math.abs(x - pt.x).should.below(0.1);
                math.abs(y - pt.y).should.below(0.1);
            }
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts, "z");
        diff.max.should.below(0); // z is monotonic decreasing
        diff = ds.diff(pts, "y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "x");
        diff.min.should.above(-eMicrostep); // x is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "p1");
        diff.min.should.above(0); // p1 is monotonic increasing
        diff = ds.diff(pts, "p2");
        diff.min.should.above(0); // p2 is monotonic increasing
        diff = ds.diff(pts, "p3");
        diff.min.should.above(0); // p3 is monotonic increasing
        logger.debug("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
    it("blurStepPath(x,y,z) should handle Z-axis paths", function() {
        var lpp = new LPPCurve();
        var x = 0;
        var y = 0;
        var z = -10;
        var pts = lpp.blurStepPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz", "\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i = 0; i < pts.length; i++) {
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
            maxp1 = math.max(maxp1, math.abs(pt.p1 - ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2 - ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3 - ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lpp.zHigh - lpp.zVertical) {
                math.abs(pt.x).should.below(0.1);
                math.abs(pt.y).should.below(0.1);
            }
            if (z + lpp.zVertical > pt.z) {
                math.abs(x - pt.x).should.below(0.1);
                math.abs(y - pt.y).should.below(0.1);
            }
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts, "z");
        diff.max.should.below(0); // z is monotonic decreasing
        diff = ds.diff(pts, "y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "x");
        diff.min.should.above(-eMicrostep); // x is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "p1");
        diff.min.should.above(0); // p1 is monotonic increasing
        diff = ds.diff(pts, "p2");
        diff.min.should.above(0); // p2 is monotonic increasing
        diff = ds.diff(pts, "p3");
        diff.min.should.above(0); // p3 is monotonic increasing
        logger.debug("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
    it("blurStepPath(x,y,z) paths should work for DVSFactory", function() {
        var lpp = new LPPCurve({
            zHigh: 40
        });
        var x = 50;
        var y = 0;
        var z = -10;
        var pts = lpp.blurStepPath(x, y, z);
        logger.debug("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz", "\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i = 0; i < pts.length; i++) {
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
            maxp1 = math.max(maxp1, math.abs(pt.p1 - ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2 - ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3 - ptPrev.p3));
            ptPrev = pt;
            if (pt.z > lpp.zHigh - lpp.zVertical) {
                math.abs(pt.x).should.below(0.1);
                math.abs(pt.y).should.below(0.1);
            }
            if (z + lpp.zVertical > pt.z) {
                math.abs(x - pt.x).should.below(0.1);
                math.abs(y - pt.y).should.below(0.1);
            }
        }
        var cmd = new DVSFactory().createDVS(pts);
        logger.debug(JSON.stringify(cmd));
    });
    it("ph5Path(x,y,z) path should accelerate smoothly ", function() {
        var lpp = new LPPCurve();
        var pts = lpp.ph5Path(70, 50, -10);
        var N = pts.length;
        for (var i = 0; i < N; i++) {
            var pt = pts[i];
            logger.debug(
                "\t", pt.t,
                "\t", pt.dp1,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z,
                ""
            );
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts, "z");
        diff.max.should.not.above(0); // z is monotonic decreasing
        diff = ds.diff(pts, "y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "x");
        diff.min.should.above(-eMicrostep); // x is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "p1");
        diff.min.should.not.below(0); // p1 is monotonic increasing
        diff = ds.diff(pts, "p2");
        diff.min.should.not.below(0); // p2 is monotonic increasing
        diff = ds.diff(pts, "p3");
        diff.min.should.not.below(0); // p3 is monotonic increasing

        // gentle start
        //math.abs(pts[1].p1 - pts[0].p1).should.below(35);
        //math.abs(pts[2].p2 - pts[1].p2).should.below(35);
        //math.abs(pts[3].p3 - pts[2].p3).should.below(35);

        // very gentle stop
        //math.abs(pts[N - 1].p1 - pts[N - 2].p1).should.below(10);
        //math.abs(pts[N - 1].p2 - pts[N - 2].p2).should.below(10);
        //math.abs(pts[N - 1].p3 - pts[N - 2].p3).should.below(10);
    });
    it("ph5Path(x,y,z) path should handle X0Y0", function() {
        var lpp = new LPPCurve();
        var pts = lpp.ph5Path(0, 0, -10);
        var N = pts.length;
        for (var i = 0; i < N; i++) {
            var pt = pts[i];
            logger.debug(
                "\t", pt.t,
                "\t", pt.dp1,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z,
                ""
            );
        }
        var ds = new DataSeries();
        var diff = ds.diff(pts, "z");
        diff.max.should.below(eMicrostep); // z is monotonic decreasing
        diff = ds.diff(pts, "y");
        diff.min.should.above(-eMicrostep); // y is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "x");
        diff.min.should.above(-eMicrostep); // x is monotonic increasing within microstep tolerance
        diff = ds.diff(pts, "p1");
        diff.min.should.not.below(0); // p1 is monotonic increasing
        diff = ds.diff(pts, "p2");
        diff.min.should.not.below(0); // p2 is monotonic increasing
        diff = ds.diff(pts, "p3");
        diff.min.should.not.below(0); // p3 is monotonic increasing

    });
    it("ph5Path(x,y,z) paths should work for DVSFactory", function() {
        var lpp = new LPPCurve({
            zHigh: zHigh
        });
        var pts = lpp.ph5Path(xTest, yTest, zTest);
        dumpPts(pts);
        var cmd = new DVSFactory().createDVS(pts);
        cmd.dvs.sc.should.equal(4);
        cmd.dvs.us.should.equal(1451172);
        should.exist(cmd.dvs["1"]);
        should.exist(cmd.dvs["2"]);
        should.exist(cmd.dvs["3"]);
        should.deepEqual(cmd.dvs.dp, [10266, 12998, 13308]);
    });
    it("laplacePath(x,y,z) paths should work for DVSFactory", function() {
        var delta = DeltaCalculator.createLooseCanonRAMPS();
        var lpp = new LPPCurve({
            zHigh: zHigh,
            delta: delta,
            zVertical: 10,
            maxVerticalXYError: 0.5,
        });
        var pts = lpp.laplacePath(xTest, yTest, zTest);
        var N = pts.length-1;
        dumpPts(pts);
        var cmd = new DVSFactory().createDVS(pts);
        cmd.dvs.sc.should.equal(2);
        cmd.dvs.us.should.equal(1022720);
        should.exist(cmd.dvs["1"]);
        should.exist(cmd.dvs["2"]);
        should.exist(cmd.dvs["3"]);
        should.deepEqual(cmd.dvs.dp, [5187, 6567, 6724]);
        var e = 0.001;
        pts[68].z.should.within(-40, -39.5);
        pts[68].y.should.within(-49.5, -49.4);
        
        // gentle start
        math.abs(pts[1].p1 - pts[0].p1).should.below(35);
        math.abs(pts[2].p2 - pts[1].p2).should.below(35);
        math.abs(pts[3].p3 - pts[2].p3).should.below(60);

        // very gentle stop
        math.abs(pts[N-0].p1 - pts[N - 1].p1).should.below(10);
        math.abs(pts[N-1].p2 - pts[N - 2].p2).should.below(20);
        math.abs(pts[N-2].p3 - pts[N - 3].p3).should.below(40);

        logger.info(JSON.stringify(cmd));
        //pts.reverse();
        //var cmd = new DVSFactory().createDVS(pts);
        //logger.info(JSON.stringify(cmd));
    });
    it("TESTTESTzrPath(x,y,z) should traverse to z then to xy", function() {
        var delta = DeltaCalculator.createLooseCanonRAMPS();
        var lpp = new LPPCurve({
            zHigh: zHigh,
            delta: delta,
            zVertical: 10,
            maxVerticalXYError: 0.5,
        });
        var pts = lpp.zrPath(50, yTest, -10);
    });
})

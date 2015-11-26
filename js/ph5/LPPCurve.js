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
        that.zHigh = options.zHigh == null ? 50 : zHigh; // highest point of LPP path
        that.zScale = options.zScale || 1; // DEPRECATED
		that.logger = options.logger || new Logger(options);
		return that;
    };

    ///////////////// INSTANCE ///////////////

	LPPCurve.prototype.zrPath = function(dstZ, dstR) { // geometric path
		var that = this;
        should.exist(dstR, "destination radius");
        should.exist(dstZ, "destination Z-height");
        dstZ.should.below(that.zHigh - 3*that.zVertical);
        var radius = dstR;
        var pts = [];
        var pathSize2 = that.pathSize/2;
        var height = that.zHigh - dstZ;
        var dz = height/(that.pathSize-1);
        for (var i=0; i<that.pathSize; i++) {
            if (i < pathSize2) {
                pts.push(new Complex(that.zHigh-i*dz,0));
            } else {
                pts.push(new Complex(that.zHigh-i*dz,dstR));
            }
        }
        var start = math.round(that.zVertical/dz);
        var ds = new DataSeries({ start: start, end:-start });
        var i = 0;
        do {
            that.logger.withPlaces(5).info(++i, "\t", pts[start+1]);
            ds.blur(pts, "im");
        } while (pts[start+1].im === 0 && i < 50);
        that.logger.info("start:", start, "\t", pts);
        return pts;
    }

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
        var i = 0;
        do {
            that.logger.withPlaces(5).info(++i, "\t", pts[start+1]);
            ds.blur(pts, "p1");
            ds.blur(pts, "p2");
            ds.blur(pts, "p3");
            that.logger.info("zrDeltaPath blur diff:", ds.diff(pts, "p1"));
        } while (i < 50);
        //} while (pts[start+1].p1 === pts[start].p1 && i < 50);
        for (var i=0; i<that.pathSize; i++) {
            var xyz = delta.calcXYZ(pts[i]);
            pts[i].x = xyz.x;
            pts[i].y = xyz.y;
            pts[i].z = xyz.z;
        }
        return pts;
    }
    LPPCurve.prototype.zrDeltaPathPH5 = function(x,y,z) { // timed path
        var that = this;
        var delta = that.delta;
        var radius = math.sqrt(x*x+y*y);
        var complexPath = that.zrPath(z, radius);
        for (var i=complexPath.length; i-- > 0; ) {
            var pt = complexPath[i];
            pt.c = new Complex(pt.z, pt.r);
        }

        complexPath.reverse();
		var ph = new PHFactory(complexPath).quintic();
        var phf = new PHFeed(ph, {
            logLevel: "info",
            vIn:0, vOut:0, vMax:that.vMax, tvMax:that.tvMax7
        });

        var pts = phf.interpolate(that.pathSize);
        pts.reverse();
        for (var i=pts.length; i-- > 0; ) {
            var pt = pts[i];
            var c = pt.r;
            var scale = c.im / radius;
            pt.x = x*scale,
            pt.y = y*scale,
            pt.z = c.re;
            var pulses = delta.calcPulses(pt);
            pt.p1 = pulses.p1;
            pt.p2 = pulses.p2;
            pt.p3 = pulses.p3;
            var xyz = delta.calcXYZ(pulses);
            pt.xa = xyz.x-pt.x;
            pt.ya = xyz.y-pt.y;
            pt.za = xyz.z-pt.z;
        }
        var height = that.zHigh - z;
        var dz = height/(that.pathSize-1);
        var start = 2; //math.round(that.zVertical/dz)/2;
        var ds = new DataSeries({round:true, start:start, end:-start});
        for (var i = 0; i<0; i++) {
            ds.blur(pts, "p1");
            ds.blur(pts, "p2");
            ds.blur(pts, "p3");
            var diff1 = ds.diff(pts, "p1");
            var diff2 = ds.diff(pts, "p2");
            var diff3 = ds.diff(pts, "p3");
            that.logger.info(i, "\tdiff1:", diff1);
            that.logger.info(i, "\tdiff2:", diff2);
            that.logger.info(i, "\tdiff3:", diff3);
            if (diff1.min >= 0 && diff2.min >=0 && diff3.min >= 0) {
                break;
            }
        }

        return pts;
    }

    LPPCurve.prototype.rCot = function(z,radius) {
        var that = this;
        var result = radius*math.acot(z*that.zScale)/math.PI; 
        return result >= 0 ? result : result + radius;
        var result = radius*math.acot(z*that.zScale)/math.PI; 
        return result >= 0 ? result : result + radius;
    }
    LPPCurve.prototype.zCot = function(r,radius) {
        var that = this;
        return math.cot(r*math.PI/radius)/that.zScale;
    }
    LPPCurve.prototype.z = function(r,radius,height) {
        var that = this;
        var rBegin = that.rCot(height/2,radius);
        var rEnd = that.rCot(-height/2,radius);
        var rScale = (rEnd - rBegin)/radius;
        return that.zCot(r*rScale+rBegin,radius) + height/2;
    }
    LPPCurve.prototype.r = function(z,radius,height) {
        var that = this;
        var rBegin = that.rCot(height/2,radius);
        var rEnd = that.rCot(-height/2,radius);
        var rScale = (rEnd - rBegin)/radius;
        return (that.rCot(z - height/2,radius) - rBegin)/rScale;
    }
	LPPCurve.prototype.zrProfile = function(dstZ, dstR) {
		var that = this;
        should.exist(dstR, "destination radius");
        should.exist(dstZ, "destination Z-height");
        var radius = dstR;
        var height = that.zHigh - dstZ;
        var pts = [];
        var z = height;
        var r = radius;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.93;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.87;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.8;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.7;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.6;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        r = radius * 0.16;
        pts.push(new Complex(dstZ+that.z(r, radius, height), r));
        r = radius * 0.4;
        pts.push(new Complex(dstZ+that.z(r, radius, height), r));
        for (var i=pts.length; i-- > 0;) { // symmetric distribution
            var pt = pts[i];
            pts.push(new Complex(that.zHigh-pt.re, radius-pt.im));
        }
        pts.reverse(); // make sure destination starts PH curve for best accuracy
        that.logger.debug("\t#______\tR______\tZ______");
        for (var i = 0; i < pts.length; i++) {
            that.logger.debug("\t", i, "\t", pts[i].im, "\t", pts[i].re);
        }
		var ph = new PHFactory(pts).quintic();
		return ph;
    }

	///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.LPPCurve");
    module.exports = firepick.LPPCurve = LPPCurve;
})(firepick || (firepick = {}));

Logger.logger.info("HELLO A");
(typeof describe === 'function') && describe("firepick.LPPCurve", function() {
	var logger = new Logger({
		nPlaces:4,
		logLevel:"info"
	});
	var LPPCurve = firepick.LPPCurve;
	function shouldEqualT(c1,c2,epsilon) { 
		epsilon = epsilon || 0.001; 
		c1.should.instanceof(Complex);
		c2.should.instanceof(Complex);
		c1.isNear(c2, epsilon).should.equal(true, 
			"expected:" + c2.stringify({nPlaces:3}) +
			" actual:" + c1.stringify({nPlaces:3}));
	};
    function traverse(ph, phf, N) {
        var E = 0;
        var z = ph.r(1).re;
        var r = ph.r(1).im;
        var v = 0;
        logger.debug("#", "\tE", "\tz", "\tr", "\tv", "\tdv");
        for (var i=N; i >= 0; i--) {
            E = phf.Ekt(E, i/N);
            var zOld = z;
            var rOld = r;
            z = ph.r(E).re;
            r = ph.r(E).im;
            var dz = z-zOld;
            var dr = r-rOld;
            var vOld = v;
            v = math.sqrt(dz*dz + dr*dr);
            logger.info(i, "\t", E, 
                "\t", z, "\t", r,
                "\t", v, "\t", (v-vOld));
        }
    }
	it("zrProfile(dstZ, dstR) creates LPP path", function() {
        var lppFactory = new LPPCurve();
        var lpp50 = factory.zrProfile(0, 50);
        var lpp5 = factory.zrProfile(0, 5);
        var N = 25;
        logger.debug("#", ":\t", "R", "\t", "Z", "\tR\tZ");
        for (var i=0; i<=N; i++) {
			var tau = i/N;
			var r50 = lpp50.r(tau);
			var r5 = lpp5.r(tau);
            logger.withPlaces(4).debug(i, ":\t", 
                r50.im, "\t", r50.re, "\t",
                r5.im, "\t", r5.re);
        }
        var e = 0.000001
        shouldEqualT(lpp5.r(1.0), new Complex(50,0));
        shouldEqualT(lpp5.r(0.9), new Complex(44.985,0.016));
        shouldEqualT(lpp5.r(0.5), new Complex(25,2.5));
        shouldEqualT(lpp5.r(0.1), new Complex(5.015,4.984));
        shouldEqualT(lpp5.r(0.0), new Complex(0,5));
        shouldEqualT(lpp50.r(1.0), new Complex(50,0));
        shouldEqualT(lpp50.r(0.9), new Complex(44.985,0.164));
        shouldEqualT(lpp50.r(0.5), new Complex(25,25));
        shouldEqualT(lpp50.r(0.1), new Complex(5.015,49.836));
        shouldEqualT(lpp50.r(0.0), new Complex(0,50));
	});
	it("traverse LPP curve", function() {
        var lppFactory = new LPPCurve();
        var lpp50 = lppFactory.zrProfile(0, 50);
        var lpp5 = lppFactory.zrProfile(0, 5);
        var vMax = 10; // ~18000 sysmv
        var phf = new PHFeed(lpp50, {
            logLevel: "info",
            vIn:0, vOut:0, vMax:vMax, tvMax:0.7
        });
        var N = 11;
        traverse(lpp50, phf, N);
        var pts = phf.interpolate(N);
        for (var i=0; i < N; i++) {
            logger.info(i, "\t", pts[i]);
        }
    });
    it("TESTTESTdelta curve", function() {
        var ds = new DataSeries({round:true});
        var lppFactory = new LPPCurve();
        var lpp50 = lppFactory.zrProfile(-50, 100);
        var vMax = 80; // ~18000 sysmv
        var phf = new PHFeed(lpp50, {
            logLevel: "info",
            vIn:0, vOut:0, vMax:vMax, tvMax:0.7
        });
        lpp50.logger.logLevel = "debug";
        var dc = new DeltaCalculator();
        var N = 101;
        var pt = lpp50.r(1);
        var pts = phf.interpolate(N);
        pts.length.should.equal(N);
        pts.reverse();
        for (var i=0; i<N; i++) {
            var r = pts[i].r;
            var pulses = dc.calcPulses({z:r.re, x:r.im, y:0});
            pts[i].p1 = pulses.p1;
            pts[i].p2 = pulses.p2;
            pts[i].p3 = pulses.p3;
        }
        ds.blur(pts, "p1");
        ds.blur(pts, "p2");
        ds.blur(pts, "p3");
        var maxdp1 = 0;
        var maxdp2 = 0;
        var maxdp3 = 0;
        logger.debug("\t#____\tt____\tZ____\tR____\tp1____\tp2____\tp3____\tdp1___\tdp2___\tdp3");
        var prevpt = pts[0];
        for (var i=0; i<N; i++) {
            var pt = pts[i];
            maxdp1 = math.max(maxdp1, math.abs(pt.p1-prevpt.p1));
            maxdp2 = math.max(maxdp2, math.abs(pt.p2-prevpt.p2));
            maxdp3 = math.max(maxdp3, math.abs(pt.p3-prevpt.p3));
            logger.debug("\t", i, 
                "\t", pt.t, 
                "\t", r.re, "\t", r.im,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.p1-prevpt.p1,
                "\t", pt.p2-prevpt.p2,
                "\t", pt.p3-prevpt.p3
                );
            prevpt = pt;
        }
        logger.info("maximum speeds p1:", maxdp1, "\tp2:", maxdp2, "\tp3:", maxdp3);
    });
    it("TESTTESTzrPath(dstZ, radius) should return LPP radial path profile", function() {
        var lppFactory = new LPPCurve();
        var pts = lppFactory.zrPath(-10, 50);
        logger.info("#", "\tZ", "\tR");
        for (var i=0; i<pts.length; i++) {
            logger.info(i, "\t",pts[i].re, "\t",pts[i].im);
        }
    });
    it("zrDeltaPathPH5(x,y,z) should return timed XYZ path", function() {
        var lppFactory = new LPPCurve();
        var pts = lppFactory.zrDeltaPathPH5(-70.7, 70.7, -10);
        logger.info("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz","\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i=0; i<pts.length; i++) {
            var pt = pts[i];
            logger.withPlaces(3).info(i, 
                "\t", pt.p1 - ptPrev.p1,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.x,
                "\t", pt.y,
                "\t", pt.z,
                "\t", pt.xa,
                "\t", pt.ya,
                "\t", pt.za
                );
            maxp1 = math.max(maxp1, math.abs(pt.p1-ptPrev.p1));
            maxp2 = math.max(maxp2, math.abs(pt.p2-ptPrev.p2));
            maxp3 = math.max(maxp3, math.abs(pt.p3-ptPrev.p3));
            ptPrev = pt;
        }
        logger.info("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
    it("TESTTESTzrDeltaPath(x,y,z) should return timed XYZ path", function() {
        var lppFactory = new LPPCurve();
        var pts = lppFactory.zrDeltaPath(-70.7, 70.7, -10);
        logger.info("#", "\tdp1\tp1\tp2\tp3", "\tx\ty\tz","\txa\tya\tza");
        var ptPrev = pts[0];
        var maxp1 = 0;
        var maxp2 = 0;
        var maxp3 = 0;
        for (var i=0; i<pts.length; i++) {
            var pt = pts[i];
            logger.withPlaces(3).info(i, 
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
        }
        logger.info("max(abs()) p1:", maxp1, "\tp2:", maxp2, "\tp3:", maxp3);
    });
})

var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
PHFeed = require("./PHFeed");
PH5Curve = require("./PH5Curve");
PHFactory = require("./PHFactory");
DeltaCalculator = require("./DeltaCalculator");
math = require("mathjs");

(function(firepick) {
    function LPPCurve(options) {
		var that = this;
		options = options || {};
        that.zHigh = options.zHigh == null ? 50 : zHigh;
        that.zScale = options.zScale || 1;
		that.logger = options.logger || new Logger(options);
		return that;
    };

    ///////////////// INSTANCE ///////////////
    LPPCurve.prototype.blur = function(pts, key, options) {
        var that = this;
        options = options || {};
        var round = options.round || false;
        var start = options.start || 0;
        var end = options.end || 0;
        if (end <= 0) {
            end = pts.length + end;
        }
        should(end).within(1, pts.length);
        should(start).within(0,end-1);
        var v0 = pts[pts.length-1][key];
        var v1 = v0;
        var v2 = v1;
        var v3 = v2;
        var v4 = v3;
        var start3 = start3;
        for (var i=end; i-- > start; ) {
            var pt = pts[i];
            v4 = v3;
            v3 = v2;
            v2 = v1;
            v1 = v0;
            v0 = pt[key];
            if (3 < i && i < pts.length-4) {
                pt[key] = (
                    pts[i-4][key] +
                    8*pts[i-3][key] +
                    28*pts[i-2][key] +
                    56*pts[i-1][key] +
                    70*v0 +
                    56*v1 +
                    28*v2 +
                    8*v3 +
                    v4
                    )/256;
            } else if (0 === i || i === pts.length-1) {
                // do nothing
            } else {
                var vm1 = 0 < i ? pts[i-1][key] : v0;
                var vm2 = 1 < i ? pts[i-2][key] : vm1;
                var vm3 = 2 < i ? pts[i-3][key] : vm2;
                var vm4 = 3 < i ? pts[i-4][key] : vm3;
                pt[key] = (
                    vm4 +
                    7*vm3 +
                    21*vm2 +
                    35*vm1 +
                    35*v1 +
                    21*v2 +
                    7*v3 +
                    v4)/128;
            }
            if (round) {
                pt[key] = math.round(pt[key]);
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
    it("delta curve", function() {
        var lppFactory = new LPPCurve();
        var lpp50 = lppFactory.zrProfile(0, 50);
        var vMax = 80; // ~18000 sysmv
        var phf = new PHFeed(lpp50, {
            logLevel: "debug",
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
        lppFactory.blur(pts, "p1");
        lppFactory.blur(pts, "p2");
        lppFactory.blur(pts, "p3");
        logger.info("\t#____\tt____\tZ____\tR____\tp1____\tp2____\tp3____\tdp1___\tdp2___\tdp3");
        var prevpt = pts[0];
        for (var i=0; i<N; i++) {
            var pt = pts[i];
            if (2 < i && i+3 < N) {
                pt.p1Avg = math.round((
                    pts[i-3].p1 +
                    6*pts[i-2].p1 +
                    15*pts[i-1].p1 +
                    20*pts[i].p1 +
                    15*pts[i+1].p1 +
                    6*pts[i+2].p1 +
                    pts[i+3].p1)/64);
            } else if (1 < i && i+2 < N) {
                pt.p1Avg = math.round((
                    pts[i-2].p1 +
                    4*pts[i-1].p1 +
                    4*pts[i+1].p1 +
                    pts[i+2].p1)/10);
            } else if (i == 1) {
                pt.p1Avg = math.round((
                    5*pts[i-1].p1 +
                    4*pts[i+1].p1 +
                    pts[i+2].p1)/10);
            } else if (1+2 == N) {
                pt.p1Avg = math.round((
                    pts[i-2].p1 +
                    4*pts[i-1].p1 +
                    5*pts[i+1].p1)/10);
            } else {
                pt.p1Avg = pt.p1;
            }
            logger.info("\t", i, 
                "\t", pt.t, 
                "\t", r.re, "\t", r.im,
                "\t", pt.p1,
                "\t", pt.p2,
                "\t", pt.p3,
                "\t", pt.p1-prevpt.p1,
                "\t", pt.p2-prevpt.p2,
                "\t", pt.p3-prevpt.p3,
                "\t", pt.p1Avg,
                "\t", pt.p1Avg-prevpt.p1Avg
                );
            prevpt = pt;
        }
    });
    it("TESTTESTblur delta curve", function() {
        var lppFactory = new LPPCurve();
        var pts = [];
        var N = 25;
        for (var i = 0; i<N; i++) {
            if (i < N/2) {
                pts.push({r0:0, r1:0, r2:0, r3:0, r4:0, r5:0});
            } else {
                pts.push({r0:50, r1:50, r2:50, r3:50, r4:50, r5:50});
            }
        }
        var options = {start:3, end:-3};
        lppFactory.blur(pts,"r1");
        for (var i=0; i<4; i++) {
            lppFactory.blur(pts,"r2", options);
        }
        for (var i=0; i<8; i++) {
            lppFactory.blur(pts,"r3", options);
        }
        for (var i=0; i<16; i++) {
            lppFactory.blur(pts,"r4", options);
        }
        for (var i=0; i<32; i++) {
            lppFactory.blur(pts,"r5", options);
        }
        for (var i=0; i<N; i++) {
            logger.info(i, pts[i]);
        }
    });
})

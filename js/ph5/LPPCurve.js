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
    LPPCurve.prototype.rCot = function(z,radius) {
        var that = this;
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
        var factory = new LPPCurve();
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
	it("TESTTESTtraverse LPP curve", function() {
        var factory = new LPPCurve();
        var lpp50 = factory.zrProfile(0, 50);
        var lpp5 = factory.zrProfile(0, 5);
        var vMax = 10; // ~18000 sysmv
        var phf = new PHFeed(lpp50, {
            logLevel: "info",
            vIn:0, vOut:0, vMax:vMax, tvMax:0.7
        });
        var N = 10;
        traverse(lpp50, phf, N);
        var pts = phf.interpolate({n:N});
        for (var i=0; i < N; i++) {
            logger.info(i, "\t", pts[i]);
        }
    });
    it("TESTTESTdelta curve", function() {
        var delta = new DeltaCalculator();
        var factory = new LPPCurve();
        var lpp50 = factory.zrProfile(0, 50);
    });
})
Logger.logger.info("HELLO B");

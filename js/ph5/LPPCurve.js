var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
Bernstein = require("./PH5Curve");
PHFactory = require("./PHFactory");
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
        z = height * 0.9;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.8;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.7;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.6;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        r = radius * 0.2;
        pts.push(new Complex(dstZ+that.z(r, radius, height), r));
        r = radius * 0.4;
        pts.push(new Complex(dstZ+that.z(r, radius, height), r));
        r = radius * 0.6;
        pts.push(new Complex(dstZ+that.z(r, radius, height), r));
        r = radius * 0.8;
        pts.push(new Complex(dstZ+that.z(r, radius, height), r));
        z = height * 0.4;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.3;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.2;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        z = height * 0.1;
        pts.push(new Complex(dstZ+z, that.r(z, radius, height)));
        pts.push(new Complex(dstZ, radius));
        for (var i = 0; i < pts.length; i++) {
            that.logger.withPlaces(4).debug(i, ":\t", pts[i].im, "\t", pts[i].re);
        }
		var ph = new PHFactory(pts).quintic();
		return ph;
    }

	///////////////// CLASS //////////

    Logger.logger.info("loaded firepick.LPPCurve");
    module.exports = firepick.LPPCurve = LPPCurve;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.LPPCurve", function() {
	var logger = new Logger({
		nPlaces:1,
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
	it("TESTTESTcreate LPP path", function() {
        var factory = new LPPCurve();
        var lpp50 = factory.zrProfile(0, 50);
        var lpp5 = factory.zrProfile(0, 5);
        var N = 25;
        logger.info("#", ":\t", "R", "\t", "Z", "\tR\tZ");
        for (var i=0; i<=N; i++) {
			var tau = i/N;
			var r50 = lpp50.r(tau);
			var r5 = lpp5.r(tau);
            logger.withPlaces(4).info(i, ":\t", 
                r50.im, "\t", r50.re, "\t",
                r5.im, "\t", r5.re);
        }
        var e = 0.000001
        shouldEqualT(lpp5.r(0.0), new Complex(50,0));
        shouldEqualT(lpp5.r(0.1), new Complex(43.498,0.022));
        shouldEqualT(lpp5.r(0.5), new Complex(25,2.5));
        shouldEqualT(lpp5.r(0.9), new Complex(6.502,4.978));
        shouldEqualT(lpp5.r(1.0), new Complex(0,5));
        shouldEqualT(lpp50.r(0.0), new Complex(50,0));
        shouldEqualT(lpp50.r(0.1), new Complex(43.502,0.22));
        shouldEqualT(lpp50.r(0.5), new Complex(25,25));
        shouldEqualT(lpp50.r(0.9), new Complex(6.498,49.78));
        shouldEqualT(lpp50.r(1.0), new Complex(0,50));
	});
	it("curve fit acot", function() {
        var height = 50;
        var radius = 50;
        var places = 4;
        var L = 10;
        var lpp = new LPPCurve(height, radius, {
            zScale:1
        });
        var N = 25;
        for (i = 0; i <= N; i++) {
            var tau = i/N;
            var rTau = i * radius / N;
            var zTau = (N-i) * height / N;
            logger.withPlaces(places).info(zTau, "\t" ,
                lpp.r(zTau,radius,height), "\t", 
                rTau, "\t", 
                lpp.z(rTau,radius,height));
        }
	});
	it("curve fit acot", function() {
        var phfK = new PHFeed(ph_lineK, {
            logLevel: "info",
            vIn:0, vOut:0, vMax:vMax, tvMax:0.5
        });
    });
})

var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
Bernstein = require("./PH5Curve");
PHFactory = require("./PHFactory");

(function(firepick) {
    function LPPCurve(options) {
		var that = this;
		options = options || {};
		that.logger = options.logger || new Logger(options);
		return that;
    };

    ///////////////// INSTANCE ///////////////
	LPPCurve.prototype.build = function(pt1,pt2) { 
		var that = this;
        var z1 = pt1.re;
        var r1 = pt1.im;
        var z2 = pt2.re;
        var r2 = pt2.im;
        var kz = [
            1.00, 
            0.80, 
            0.55, 
            0.50, 
            0.45, 
            0.20, 
            0.00,
        ];
        var kr = [
            1.00, 
            0.99, 
            0.894187, 
            0.50, 
            0.105813, 
            0.01, 
            0.00,
        ];
        var pts = [];
        var i = 0;
        pts.push(pt1);
        i++; pts.push(new Complex(z1*(kz[i]) + z2*(1-kz[i]), r1*kr[i] + r2*(1-kr[i])));
        i++; pts.push(new Complex(z1*(kz[i]) + z2*(1-kz[i]), r1*kr[i] + r2*(1-kr[i])));
        i++; pts.push(new Complex(z1*(kz[i]) + z2*(1-kz[i]), r1*kr[i] + r2*(1-kr[i])));
        i++; pts.push(new Complex(z1*(kz[i]) + z2*(1-kz[i]), r1*kr[i] + r2*(1-kr[i])));
        i++; pts.push(new Complex(z1*(kz[i]) + z2*(1-kz[i]), r1*kr[i] + r2*(1-kr[i])));
        pts.push(pt2);
		var ph = new PHFactory(pts).quintic();
		return ph;
	};

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
        var pt1 = new Complex(50, 0);
        var pt2 = new Complex(-00, 100);
        var lpp = factory.build(pt1, pt2);
        var N = 30;
        logger.info("#", ":\t", "Z", "\t", "R");
        for (var i=0; i<=N; i++) {
			var tau = i/N;
			var r = lpp.r(tau);
            logger.withPlaces(4).info(i, ":\t", r.re, "\t", r.im);
        }
	});
})

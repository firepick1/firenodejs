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
	LPPCurve.prototype.profile = function(pt1,pt2) { 
        // y(x) = .02*cot(10/50*(x*50/52+0.65)/PI) + 0.5
		var that = this;
        var z1 = pt1.re;
        var r1 = pt1.im;
        var z2 = pt2.re;
        var r2 = pt2.im;
        var kz = [
            1.00000, 
            0.93000,
            0.85000,
            0.77735, 
            0.69426, 
            0.60157, 
            0.55036, 
            0.53178,
            0.51495,
            0.50, 
        ];
        var R0 = 1/50.0;
        var R = R0*r2/50;
        var kr = [
            1-0.000*R0, 
            1-0.007*R0,
            1-0.060*R0,
            1-0.300*R0,
            1-1.0*R, 
            1-2.5*R, 
            1-5.5*R, 
            1-8.5*R, 
            1-14.5*R,
            0.5
        ];
        for (var i=kz.length-1; i-->0; ) {
            kz.push(1-kz[i]);
            kr.push(1-kr[i]);
        }
        var pts = [];
        for (var i=0; i<kz.length; i++) {
            console.log(kz[i] + "\t" +  kr[i]);
            pts.push(new Complex(z1*(kz[i]) + z2*(1-kz[i]), r1*kr[i] + r2*(1-kr[i])));
        }
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
        var pt1 = new Complex(55, 0);
        var pt2 = new Complex(-0, -40);
        var lpp = factory.profile(pt1, pt2);
        var N = 50;
        logger.info("#", ":\t", "R", "\t", "Z");
        for (var i=0; i<=N; i++) {
			var tau = i/N;
			var r = lpp.r(tau);
            logger.withPlaces(4).info(i, ":\t", r.im, "\t", r.re);
        }
	});
})

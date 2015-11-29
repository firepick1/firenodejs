var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
Bernstein = require("./Bernstein");
Tridiagonal = require("./Tridiagonal");
PHFactory = require("./PHFactory");
PH5Curve = require("./PH5Curve");


(function(firepick) {
    var degree = 5;
    var bn = new Bernstein(5);
    var bn1 = new Bernstein(6);

    function PHFeed(ph5, options) {
        var that = this;

        should.exist(ph5, "expected PH5Curve");
        that.ph = ph5;
        that.S = that.ph.s(1);

        options = options || {};
        that.logger = options.logger || new Logger(options);
        that.vMax = options.vMax || 100; // maximum velocity
        that.tvMax = options.tvMax || 0.01; // time to reach maximum velocity
        that.vIn = options.vIn || 0; // input velocity
        that.vCruise = options.vCruise || that.vMax; // cruising velocity	
        that.vOut = options.vOut == null ? that.vIn : options.vOut; // output velocity
        that.vIn.should.not.below(0);
        that.vOut.should.not.below(0);
        that.vCruise.should.not.below(0);
        that.vCruise.should.not.above(that.vMax);
        that.epsilon = options.epsilon || 0.0000001;
        that.iterations = options.iterations || 10;

        var sMax = 0.5 * (that.vMax * that.tvMax); // distance required to reach vMax
        that.uc = "?";
        that.sRatio = 1;
        if (that.vIn === that.vCruise && that.vCruise === that.vOut) {
            that.uc = "A";
            that.sAccel = 0;
            that.tAccel = 0;
            that.sDecel = 0;
            that.tDecel = 0;
        } else if (that.vIn !== that.vCruise && that.vCruise === that.vOut) {
            if (sMax > that.S) {
                that.uc = "B1";
                that.sRatio = Math.sqrt(that.S / sMax);
                that.sAccel = that.S;
                that.tAccel = that.tvMax * that.sRatio;
                that.vCruise = that.vCruise * that.sRatio;
            } else {
                that.uc = "B2";
                that.sAccel = sMax;
                that.tAccel = that.tvMax;
            }
            that.sDecel = 0;
            that.tDecel = 0;
        } else if (that.vIn === that.vCruise && that.vCruise !== that.vOut) {
            if (sMax > that.S) {
                that.uc = "C1";
                that.sRatio = Math.sqrt(that.S / sMax);
                that.vCruise = that.vCruise * that.sRatio;
                that.sDecel = that.S;
                that.tDecel = that.tvMax * that.sRatio;
            } else {
                that.uc = "C2";
                that.sDecel = sMax;
                that.tDecel = that.tvMax;
            }
            that.sAccel = 0;
            that.tAccel = 0;
        } else if (true) { // accelerate, cruise, decelerate
            var S2 = that.S / 2;
            that.vIn.should.equal(that.vOut); // speed differential not supported
            if (sMax > S2) {
                that.uc = "D1";
                that.sAccel = S2;
                that.sRatio = Math.sqrt(S2 / sMax);
                that.vCruise = that.vCruise * that.sRatio;
                that.tAccel = that.tvMax * that.sRatio;
            } else {
                that.uc = "D2";
                that.sAccel = sMax;
                that.tAccel = that.tvMax;
            }
            that.sDecel = that.sAccel;
            that.tDecel = that.tAccel;
            //} else if (that.vIn !== that.vCruise && that.vCruise !== that.vOut) {
            //	that.vIn.should.equal(that.vOut); // speed differential not supported
            //	if (sMax > that.S/2) { // vCruise < vMax
            //		that.uc = "D1";
            //		that.sAccel = that.S/2;
            //		that.sRatio = Math.sqrt(that.sAccel / sMax);
            //		that.tAccel = that.tvMax * that.sRatio;
            //		that.vCruise = 2 * that.sAccel / that.tAccel;
            //	} else { // vCruise == vMax
            //		that.uc = "D2";
            //		that.vCruise = that.vMax;
            //		that.sAccel = sMax;
            //		that.tAccel = that.tvMax;
            //	}
            //	that.sDecel = that.sAccel;
            //	that.tDecel = that.tAccel;
        }
        that.sCruise = that.S - that.sAccel - that.sDecel;
        that.tCruise = that.sCruise / that.vCruise;
        that.tS = that.tAccel + that.tCruise + that.tDecel;
        that.tauCruise = that.tAccel / that.tS;
        that.tauDecel = 1 - that.tDecel / that.tS;
        that.Faccel = [
            PHFeed.Fk(that.vIn, that.vCruise, 0),
            PHFeed.Fk(that.vIn, that.vCruise, 1),
            PHFeed.Fk(that.vIn, that.vCruise, 2),
            PHFeed.Fk(that.vIn, that.vCruise, 3),
            PHFeed.Fk(that.vIn, that.vCruise, 4),
            PHFeed.Fk(that.vIn, that.vCruise, 5),
            PHFeed.Fk(that.vIn, that.vCruise, 6),
        ];
        that.Fcruise = [
            PHFeed.Fk(that.vCruise, that.vCruise, 0),
            PHFeed.Fk(that.vCruise, that.vCruise, 1),
            PHFeed.Fk(that.vCruise, that.vCruise, 2),
            PHFeed.Fk(that.vCruise, that.vCruise, 3),
            PHFeed.Fk(that.vCruise, that.vCruise, 4),
            PHFeed.Fk(that.vCruise, that.vCruise, 5),
            PHFeed.Fk(that.vCruise, that.vCruise, 6),
        ];
        that.Fdecel = [
            PHFeed.Fk(that.vCruise, that.vOut, 0),
            PHFeed.Fk(that.vCruise, that.vOut, 1),
            PHFeed.Fk(that.vCruise, that.vOut, 2),
            PHFeed.Fk(that.vCruise, that.vOut, 3),
            PHFeed.Fk(that.vCruise, that.vOut, 4),
            PHFeed.Fk(that.vCruise, that.vOut, 5),
            PHFeed.Fk(that.vCruise, that.vOut, 6),
        ];

        that.logger.debug("PHFeed()",
            " uc:", that.uc,
            " S:", that.S,
            " sRatio:", that.sRatio,
            " vMax:", that.vMax,
            " tvMax:", "" + that.tvMax,
            " sAccel:", that.sAccel,
            " sDecel:", that.sDecel,
            " sCruise:", that.sCruise,
            " tAccel:", that.tAccel,
            " tCruise:", that.tCruise,
            " tDecel:", that.tDecel,
            " tS:", that.tS,
            " vIn:", that.vIn,
            " vCruise:", that.vCruise,
            " vOut:", that.vOut,
            "");

        return that;
    };

    /////////////// PRIVATE ////////////////
    PHFeed.prototype.Vaccel = function(k) {
        var that = this;
        return k < 3 ? that.vIn : that.vCruise;
    }
    PHFeed.prototype.Vdecel = function(k) {
        var that = this;
        return k < 3 ? that.vCruise : that.vOut;
    }

    ///////////////// INSTANCE API ///////////////
    PHFeed.prototype.interpolate = function(n, options) {
        var that = this;
        options = options || {};
        var epsilon = options.epsilon || 0.001;
        n = n || 5;
        n.should.be.above(1);
        var n1 = n - 1;
        var result = [];
        var Eprev = 0;
        var sprev = 0;
        var dt = that.tS / n;
        for (var i = 0; i <= n1; i++) {
            var tau = i / n1;
            var E = that.Ekt(Eprev, tau);
            var s = that.ph.s(E);
            var dsdt = (s - sprev) / dt;
            var row = {
                tau: tau,
                E: E,
                t: tau * that.tS,
                r: that.ph.r(E),
                dsdt: dsdt,
                V: that.V(tau),
                s: s,
            };
            that.logger.debug("row:", row);
            result.push(row);
            Eprev = E;
            sprev = s;
        }
        return result;
    };
    PHFeed.prototype.Ekt = function(Ekprevt, tau) {
        var that = this;
        if (tau >= 1) {
            return 1; // weird but necessary 
        }
        var dE;
        var Ekr = Ekprevt;
        var ph = that.ph;
        var F = that.F(tau);
        var places = 6;

        for (var r = 0; r < that.iterations; r++) {
            var s = ph.s(Ekr);
            var sigma = ph.sigma(Ekr);
            var fs = F - s;
            dE = (F - s) / sigma;
            Ekr = Math.min(1, Math.max(0, Ekr + dE));
            //that.logger.debug("Ekt() r:", r, " tau:", tau, 
            //" F:", ""+Util.roundN(F,places), 
            //" fs:", fs,
            //" dE:", ""+dE,
            //" Ekr:", ""+Ekr,
            //" s:", ""+Util.roundN(s,places),
            //" sigma:", sigma);
            if (Math.abs(dE) < that.epsilon) {
                break;
            }
        }

        return Ekr;
    };
    PHFeed.prototype.V = function(tau) {
        var that = this;
        if (tau < that.tauCruise) {
            var t = tau ? (tau * that.tS) / that.tAccel : 0;
            return PHFeed.Vtvv(t, that.vIn, that.vCruise);
        } else if (tau < that.tauDecel) {
            var t = (tau * that.tS - that.tAccel) / that.tCruise;
            return PHFeed.Vtvv(t, that.vCruise, that.vCruise);
        } else {
            var t = tau === 1 ? 1 : (tau * that.tS - that.tAccel - that.tCruise) / that.tDecel;
            return PHFeed.Vtvv(t, that.vCruise, that.vOut);
        }
    };
    PHFeed.prototype.F = function(tau) {
        var that = this;
        var sum = 0;
        if (tau < that.tauCruise) {
            var t = tau ? (tau * that.tS) / that.tAccel : 0;
            for (var k = 0; k <= 6; k++) {
                sum += that.Faccel[k] * Bernstein.coefficient(6, k, t);
            }
            return sum = sum * that.tAccel / 6;
        } else if (tau < that.tauDecel) {
            var t = (tau * that.tS - that.tAccel) / that.tCruise;
            for (var k = 0; k <= 6; k++) {
                sum += that.Fcruise[k] * Bernstein.coefficient(6, k, t);
            }
            return sum * that.tCruise / 6 + that.sAccel;
        } else {
            var t = tau === 1 ? 1 : (tau * that.tS - that.tAccel - that.tCruise) / that.tDecel;
            for (var k = 0; k <= 6; k++) {
                sum += that.Fdecel[k] * Bernstein.coefficient(6, k, t);
            }
            return sum * that.tDecel / 6 + that.sAccel + that.sCruise;
        }
    };

    ///////////////// CLASS //////////
    PHFeed.Vtvv = function(tau, vIn, vOut) { // feed rate (scalar)
        vIn.should.not.be.below(0);
        vOut.should.not.be.below(0);
        var sum = 0;
        for (var k = 0; k <= degree; k++) {
            sum += (k < 3 ? vIn : vOut) * Bernstein.coefficient(5, k, tau);
        }
        return sum;
    };
    PHFeed.Fk = function(vIn, vOut, k) {
        var sum = 0;
        for (var j = 0; j < k; j++) {
            sum += j < 3 ? vIn : vOut;
        }
        return sum;
    };


    Logger.logger.debug("loaded firepick.PHFeed");
    module.exports = firepick.PHFeed = PHFeed;
})(firepick || (firepick = {}));


(typeof describe === 'function') && describe("firepick.PHFeed", function() {
    var logger = new Logger({
        nPlaces: 1,
        logLevel: "info"
    });
    var epsilon = 0.000001;
    var PHFeed = firepick.PHFeed;
    var phstep = new PHFactory([{
        x: 0,
        y: 0
    }, {
        x: 1,
        y: 0
    }, {
        x: 2,
        y: 1
    }, {
        x: 3,
        y: 1
    }, {
        x: 4,
        y: 1
    }, ]).quintic();
    var phline = new PHFactory([{
        x: 1,
        y: 1
    }, {
        x: 5,
        y: 4
    }, ]).quintic();

    function shouldEqualT(c1, c2, epsilon) {
        epsilon = epsilon || 0.001;
        c1.should.instanceof(Complex);
        c2.should.instanceof(Complex);
        c1.isNear(c2, epsilon).should.equal(true,
            "expected:" + c2.stringify({
                nPlaces: 3
            }) +
            " actual:" + c1.stringify({
                nPlaces: 3
            }));
    };
    it("PHFeed(ph,{vIn:v,vCruise:v}) should maintain constant feedrate", function() {
        var phf = new PHFeed(phline, {
            vIn: 5,
            vCruise: 5
        });
        phf.should.have.properties({
            vMax: 100, // OPTION: maximum velocity (default: 100)
            tvMax: 0.01, // OPTION: time to reach vMax (default: 0.01)
            vIn: 5, // OPTION: input velocity  (default: 0)
            vCruise: 5, // OPTION: cruise velocity (default: vMax)
            vOut: 5, // OPTION: output velocity (default: vIn)
            tAccel: 0, // OUTPUT: initial acceleration time
            sAccel: 0, // OUTPUT: initial acceleration distance
            tCruise: 1, // OUTPUT: cruise time
            sCruise: 5, // OUTPUT: cruise distance
            tDecel: 0, // OUTPUT: ending deceleration time
            sDecel: 0, // OUTPUT: ending deceleration distance
            tS: 1, // OUTPUT: total traversal time
        });
    });
    it("PHFeed(ph,{vOut:vMax}) should accelerate maximally", function() {
        var vMax = 200; // maximum velocity mm/s
        var tvMax = 0.01; // seconds from rest to vMax
        var S = phline.s(1);
        var phf = new PHFeed(phline, {
            vOut: vMax,
            vMax: vMax,
            tvMax: tvMax
        });
        var tCruise = (S - 1) / vMax;
        phf.should.have.properties({
            vMax: vMax, // OPTION: maximum velocity (default: 100)
            tvMax: tvMax, // OPTION: time to reach vMax (default: 0.01)
            vIn: 0, // OPTION: input velocity  (default: 0)
            vCruise: vMax, // OPTION: cruise velocity (default: vMax)
            vOut: vMax, // OPTION: output velocity (default: vIn)
            tAccel: tvMax, // OUTPUT: initial acceleration time
            sAccel: 1, // OUTPUT: initial acceleration distance
            tCruise: tCruise, // OUTPUT: cruise time
            sCruise: 4, // OUTPUT: cruise distance
            tDecel: 0, // OUTPUT: ending deceleration time
            sDecel: 0, // OUTPUT: ending deceleration distance
            tS: 0.03, // OUTPUT: total traversal time
        });
    });
    it("PHFeed(ph,{vMax:v,tvMax:t}) should from rest to rest ASAP", function() {
        var vMax = 200; // maximum velocity mm/s
        var tvMax = 0.01; // seconds from rest to vMax
        var S = phline.s(1);
        var sAccel = 1;
        var sCruise = S - 2 * sAccel;
        var tCruise = sCruise / vMax;
        var tS = tvMax + tCruise + tvMax;
        var phf = new PHFeed(phline, {
            vMax: vMax,
            tvMax: tvMax
        });
        phf.tauCruise.should.be.within(0.285, 0.286);
        phf.tauDecel.should.be.within(0.714, 0.715);
        phf.should.have.properties({
            vMax: vMax, // OPTION: maximum velocity (default: 100)
            tvMax: tvMax, // OPTION: time to reach vMax (default: 0.01)
            vIn: 0, // OPTION: input velocity  (default: 0)
            vCruise: vMax, // OPTION: cruise velocity (default: vMax)
            vOut: 0, // OPTION: output velocity (default: vIn)
            tAccel: tvMax, // OUTPUT: initial acceleration time
            sAccel: sAccel, // OUTPUT: initial acceleration distance
            tCruise: tCruise, // OUTPUT: cruise time
            sCruise: sCruise, // OUTPUT: cruise distance
            tDecel: tvMax, // OUTPUT: ending deceleration time
            sDecel: sAccel, // OUTPUT: ending deceleration distance
            tS: tS // OUTPUT: total traversal time
        });
    });
    it("PHFeed(ph,{vMax:v,tvMax:t}) should clip vMax", function() {
        var vMax = 100;
        var tvMax = 1; // seconds from rest to vMax
        var S = phline.s(1);
        S.should.equal(5);
        var sAccel = 2.5;
        var sMax = tvMax * vMax * 0.5;
        sMax.should.equal(50);
        var sRatio = Math.sqrt(sAccel / sMax);
        var e = 0.0005;
        sRatio.should.within(0.224 - e, 0.224 + e);
        var tAccel = tvMax * sRatio;
        tAccel.should.within(0.224 - e, 0.224 + e);
        var vCruise = 2 * sAccel / tAccel;
        vCruise.should.equal(vMax * sRatio);
        var sCruise = 0;
        var tCruise = 0;
        var tS = tAccel + tCruise + tAccel;
        var phf = new PHFeed(phline, {
            logLevel: "info",
            vMax: vMax,
            tvMax: tvMax
        });
        phf.tauCruise.should.equal(0.5);
        phf.tauDecel.should.equal(0.5);
        phf.sAccel.should.equal(sAccel);
        phf.S.should.equal(S);
        phf.tAccel.should.equal(tAccel);
        phf.vMax.should.equal(vMax); // OPTION: maximum velocity
        phf.tvMax.should.equal(tvMax); // OPTION: time to reach vMax (default: 0.01)
        phf.vIn.should.equal(0); // OPTION: input velocity  (default: 0)
        phf.vOut.should.equal(0); // OPTION: output velocity (default: vIn)
        phf.tCruise.should.equal(tCruise); // OUTPUT: cruise time
        phf.sCruise.should.equal(sCruise); // OUTPUT: cruise distance
        phf.vCruise.should.equal(vCruise); // OUTPUT: velocity at end of acceleration phase
        phf.tDecel.should.equal(tAccel); // OUTPUT: ending deceleration time
        phf.sDecel.should.equal(sAccel); // OUTPUT: ending deceleration distance
        phf.tS.should.equal(tS); // OUTPUT: total traversal time
    });
    it("PHFeed(ph,{vIn:vMax,vOut:0}) should decelerate maximally", function() {
        var vMax = 200; // maximum velocity mm/s
        var tvMax = 0.01; // seconds from rest to vMax
        var S = phline.s(1);
        var sCruise = S - 1;
        var tCruise = sCruise / vMax;
        var phf = new PHFeed(phline, {
            vIn: vMax,
            vOut: 0,
            vMax: vMax,
            tvMax: 0.01
        });
        var tS = phf.tDecel + tCruise;
        phf.sCruise.should.equal(4);
        phf.tauCruise.should.equal(0);
        phf.tauDecel.should.within(0.666, 0.667);
        phf.should.have.properties({
            vMax: vMax, // OPTION: maximum velocity (default: 100)
            tvMax: tvMax, // OPTION: time to reach vMax (default: 0.01)
            vIn: vMax, // OPTION: input velocity  (default: 0)
            vCruise: vMax, // OPTION: cruise velocity (default: vMax)
            vOut: 0, // OPTION: output velocity (default: vIn)
            tAccel: 0, // OUTPUT: initial acceleration time
            sAccel: 0, // OUTPUT: initial acceleration distance
            tCruise: tCruise, // OUTPUT: cruise time
            sCruise: 4, // OUTPUT: cruise distance
            tDecel: tvMax, // OUTPUT: ending deceleration time
            sDecel: 1, // OUTPUT: ending deceleration distance
            tS: tS, // OUTPUT: total traversal time
        });
    });
    it("Vtvv(vIn,vOut,tau) should interpolate takeoff velocity for tau:[0,1]", function() {
        PHFeed.Vtvv(0.0, 0, 100).should.equal(0);
        PHFeed.Vtvv(0.1, 0, 100).should.within(0.85, 0.86);
        PHFeed.Vtvv(0.2, 0, 100).should.within(5.79, 5.80);
        PHFeed.Vtvv(0.3, 0, 100).should.within(16.30, 16.31);
        PHFeed.Vtvv(0.4, 0, 100).should.within(31.74, 31.75);
        PHFeed.Vtvv(0.5, 0, 100).should.within(50, 50);
        PHFeed.Vtvv(0.6, 0, 100).should.within(68.25, 68.26);
        PHFeed.Vtvv(0.7, 0, 100).should.within(83.69, 83.70);
        PHFeed.Vtvv(0.8, 0, 100).should.within(94.20, 94.21);
        PHFeed.Vtvv(0.9, 0, 100).should.within(99.14, 99.15);
        PHFeed.Vtvv(1.0, 0, 100).should.equal(100);
    });
    it("Vtvv(vIn,vOut,tau) should interpolate stopping velocity for tau:[0,1]", function() {
        PHFeed.Vtvv(0.0, 100, 0).should.equal(100);
        PHFeed.Vtvv(0.1, 100, 0).should.within(99.14, 99.15);
        PHFeed.Vtvv(0.9, 100, 0).should.within(0.85, 0.86);
        PHFeed.Vtvv(1.0, 100, 0).should.equal(0);
    });
    it("Vtvv(vIn,vOut,tau) should interpolate constant velocity for tau:[0,1]", function() {
        PHFeed.Vtvv(0.0, 100, 100).should.equal(100);
        PHFeed.Vtvv(0.5, 100, 100).should.equal(100);
        PHFeed.Vtvv(1.0, 100, 100).should.equal(100);
    });
    it("Vtvv(vIn,vOut,tau) should interpolate velocity change for tau:[0,1]", function() {
        PHFeed.Vtvv(0.0, 50, 100).should.equal(50);
        PHFeed.Vtvv(0.5, 50, 100).should.equal(75);
        PHFeed.Vtvv(1.0, 50, 100).should.equal(100);
        PHFeed.Vtvv(0.0, 100, 50).should.equal(100);
        PHFeed.Vtvv(0.5, 100, 50).should.equal(75);
        PHFeed.Vtvv(1.0, 100, 50).should.equal(50);
    });
    it("F(tau) should return arc length traversed for tau:[0,1]", function() {
        var phfVV0 = new PHFeed(phline, {
            vIn: 100,
            vCruise: 100,
            vOut: 0,
            vMax: 100,
            tvMax: 0.01
        });
        phfVV0.F(0).should.equal(0);
        phfVV0.F(0.1).should.within(0.55 - epsilon, 0.55 + epsilon);
        phfVV0.F(0.4).should.within(2.20 - epsilon, 2.20 + epsilon);
        phfVV0.F(0.5).should.within(2.75 - epsilon, 2.75 + epsilon);
        phfVV0.F(0.6).should.within(3.30 - epsilon, 3.30 + epsilon);
        phfVV0.F(0.9).should.within(4.894, 4.895);
        phfVV0.F(1).should.equal(5);
        var phf0VV = new PHFeed(phline, {
            vIn: 0,
            vCruise: 100,
            vOut: 100,
            vMax: 100,
            tvMax: 0.01
        });
        phf0VV.F(0).should.equal(0);
        phf0VV.F(0.4).should.within(1.70 - epsilon, 1.70 + epsilon);
        phf0VV.F(0.5).should.within(2.25 - epsilon, 2.25 + epsilon);
        phf0VV.F(0.6).should.within(2.80 - epsilon, 2.80 + epsilon);
        phf0VV.F(1).should.equal(5);
        var phf0V0 = new PHFeed(phline, {
            vIn: 0,
            vCruise: 100,
            vOut: 0,
            vMax: 100,
            tvMax: 0.01
        });
        phf0V0.F(0).should.equal(0);
        phf0V0.F(0.1).should.within(0.137, 0.138);
        phf0V0.F(0.2).should.within(0.700, 0.701);
        phf0V0.F(0.3).should.within(1.299, 1.300);
        phf0V0.F(0.4).should.within(1.900, 1.901);
        phf0V0.F(0.5).should.within(2.500 - epsilon, 2.500 + epsilon);
        phf0V0.F(0.6).should.within(3.100, 3.101);
        phf0V0.F(0.7).should.within(3.699, 3.700);
        phf0V0.F(0.8).should.within(4.300, 4.301);
        phf0V0.F(0.9).should.within(4.862, 4.863);
        phf0V0.F(1).should.equal(5);
    });
    it("V(tau) should return feedrate for tau:[0,1]", function() {
        var phfVV0 = new PHFeed(phline, {
            vIn: 200,
            vCruise: 200,
            vOut: 0,
            vMax: 200,
            tvMax: 0.01
        });
        phfVV0.V(0).should.equal(200);
        phfVV0.V(0.1).should.equal(200);
        phfVV0.V(0.4).should.equal(200);
        phfVV0.V(0.5).should.equal(200);
        phfVV0.V(0.6).should.equal(200);
        phfVV0.V(0.9).should.within(32.61, 32.62);
        phfVV0.V(0.95).should.within(5.32, 5.33);
        phfVV0.V(1).should.equal(0);
        var phf0VV = new PHFeed(phline, {
            vIn: 0,
            vCruise: 200,
            vOut: 200,
            vMax: 200,
            tvMax: 0.01
        });
        phf0VV.V(0).should.equal(0);
        phf0VV.V(0.1).should.within(32.61, 32.62);
        phf0VV.V(0.2).should.within(136.51, 136.52);
        phf0VV.V(0.3).should.within(198.28, 198.29);
        phf0VV.V(0.4).should.within(200 - epsilon, 200 + epsilon);
        phf0VV.V(0.5).should.within(200 - epsilon, 200 + epsilon);
        phf0VV.V(0.6).should.equal(200);
        phf0VV.V(1).should.equal(200);
        var phf0V0 = new PHFeed(phline, {
            vIn: 0,
            vCruise: 200,
            vOut: 0,
            vMax: 200,
            tvMax: 0.01
        });
        phf0V0.V(0).should.equal(0);
        phf0V0.V(0.1).should.within(47.03, 47.04);
        phf0V0.V(0.4).should.within(200 - epsilon, 200 + epsilon);
        phf0V0.V(0.5).should.equal(200);
        phf0V0.V(0.6).should.within(200 - epsilon, 200 + epsilon);
        phf0V0.V(0.9).should.within(47.03, 47.04);
        phf0V0.V(1).should.equal(0);
    });
    it("Ekt(Eprev,tau) should iteratively compute parametric Epsilon for normalized time tau", function() {
        var phf = new PHFeed(phline, {
            vIn: 0,
            vCruise: 200,
            vOut: 0,
            vMax: 200,
            tvMax: 0.01
        });
        var E0 = 0;
        var E1 = phf.Ekt(E0, 0.1);
        E1.should.within(0.0, 0.1);
        var E2 = phf.Ekt(E1, 0.2);
        E2.should.within(0.0854, 0.0855);
        var E3 = phf.Ekt(E2, 0.3);
        E3.should.within(0.2200, 0.2201);
        var E4 = phf.Ekt(E3, 0.4);
        E4.should.within(0.3600, 0.3601);
        var E5 = phf.Ekt(E4, 0.5);
        E5.should.within(0.5000, 0.5001);
        var E6 = phf.Ekt(E5, 0.6);
        E6.should.within(0.6399, 0.6400);
        var E7 = phf.Ekt(E6, 0.7);
        E7.should.within(0.7800, 0.7801);
        var E8 = phf.Ekt(E7, 0.8);
        E8.should.within(0.9145, 0.9146);
        var E9 = phf.Ekt(E8, 0.9);
        E9.should.within(0.9905, 0.9906);
        var E10 = phf.Ekt(E9, 1.0);
        E10.should.within(1 - epsilon, 1);
        phf.Ekt(E0, 0).should.equal(0);
    });
    it("interpolate(n,options) should interpolate {t,tau,E,s,V,F,r} for n time intervals", function() {
        var vMax = 100;
        var phf = new PHFeed(phline, {
            vIn: 0,
            vCruise: vMax,
            vOut: 0,
            vMax: vMax,
            tvMax: 0.04
        });
        var N = 9;
        var rows = phf.interpolate(N);
        rows.length.should.equal(N);
        logger.debug(0, " ", rows[0]);
        for (var i = 1; i < N; i++) {
            var r0 = rows[i - 1];
            var r1 = rows[i];
            logger.withPlaces(4).debug(i, " ", r1);
            r1.t.should.be.above(r0.t); // monotonic
            r1.r.modulus().should.be.above(r0.r.modulus()); // monotonic
            r1.s.should.be.above(r0.s); // monotonic
            //r1.dsdt.should.be.within(0,vMax+epsilon);
        }
        // termination
        rows[N - 1].s.should.equal(5);
        rows[N - 1].t.should.equal(phf.tS);
        shouldEqualT(rows[N - 1].r, new Complex(5, 4), epsilon);
        // acceleration
        rows[0].dsdt.should.below(rows[1].dsdt);
        rows[1].dsdt.should.below(rows[2].dsdt); // symmetric acceleration/deceleration
        var places = 4;
        Util.roundN(rows[1].dsdt, places).should.equal(
            Util.roundN(rows[N - 1].dsdt, places));
        Util.roundN(rows[2].dsdt, places).should.equal(
            Util.roundN(rows[N - 2].dsdt, places));
    });
    it("should have propertires giving traversal information", function() {
        var phf1 = new PHFeed(phline, {
            vIn: 0,
            vCruise: 200,
            vOut: 0,
            vMax: 200,
            tvMax: 0.01
        });
        phf1.tAccel.should.equal(0.01); // acceleration time (seconds)
        phf1.tCruise.should.equal(0.015); // constant velocity cruise time (seconds)
        phf1.tDecel.should.equal(0.01); // deceleration time (seconds)
        phf1.sAccel.should.equal(1); // acceleration distance
        phf1.sCruise.should.equal(3); // cruise distance
        phf1.sDecel.should.equal(1); // deceleration distance
        phf1.S.should.equal(5); // total distance
        phf1.vIn.should.equal(0); // entry velocity
        phf1.vCruise.should.equal(200); // cruise velocity
        phf1.vOut.should.equal(0); // exit velocity
    });
    it("should traverse an arc", function() {
        var ph_arc = new PHFactory([{
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 2
        }, {
            x: 1,
            y: 1
        }, ]).quintic();
        var phf = new PHFeed(ph_arc, {
            logLevel: "info",
        });
        var E = 0;
        ph_arc.s(E).should.equal(0);
        ph_arc.r(E).shouldEqualT(new Complex(-1, 1));
        E = phf.Ekt(E, 0.1);
        ph_arc.s(E).should.within(0.039, 0.040);
        ph_arc.r(E).shouldEqualT(new Complex(-0.990, 1.038), 0.001);
        E = phf.Ekt(E, 0.2);
        ph_arc.s(E).should.within(0.313, 0.314);
        ph_arc.r(E).shouldEqualT(new Complex(-0.904, 1.298), 0.001);
        E = phf.Ekt(E, 0.3);
        ph_arc.s(E).should.within(0.716, 0.717);
        ph_arc.r(E).shouldEqualT(new Complex(-0.699, 1.643), 0.001);
        E = phf.Ekt(E, 0.4);
        ph_arc.s(E).should.within(1.122, 1.123);
        ph_arc.r(E).shouldEqualT(new Complex(-0.389, 1.901), 0.001);
        E = phf.Ekt(E, 0.5);
        ph_arc.s(E).should.within(1.527, 1.528);
        ph_arc.r(E).shouldEqualT(new Complex(-0.000, 2.000), 0.001);
        E = phf.Ekt(E, 0.6);
        ph_arc.s(E).should.within(1.933, 1.934);
        ph_arc.r(E).shouldEqualT(new Complex(0.389, 1.901), 0.001);
        E = phf.Ekt(E, 0.7);
        ph_arc.s(E).should.within(2.338, 2.339);
        ph_arc.r(E).shouldEqualT(new Complex(0.699, 1.643), 0.001);
        E = phf.Ekt(E, 0.8);
        ph_arc.s(E).should.within(2.741, 2.742);
        ph_arc.r(E).shouldEqualT(new Complex(0.904, 1.298), 0.001);
        E = phf.Ekt(E, 0.9);
        ph_arc.s(E).should.within(3.015, 3.016);
        ph_arc.r(E).shouldEqualT(new Complex(0.990, 1.038), 0.001);
        E = phf.Ekt(E, 1.0);
        ph_arc.s(E).should.within(3.055, 3.056);
        ph_arc.r(E).shouldEqualT(new Complex(1.000, 1.000), 0.001);
    });
    it("coefficients scale in proportion to the sqrt of the distance ratio", function() {
        var xMax = 6400; // 400 steps * 16 microsteps
        var yMax = 0;
        var ph_line = new PHFactory([{
            x: 0,
            y: 0
        }, {
            x: xMax,
            y: yMax
        }, ]).quintic();
        var phf = new PHFeed(ph_line, {
            logLevel: "info",
            vIn: 0,
            vOut: 0,
            vMax: xMax * 2,
            tvMax: 0.5
        });

        function traverse(ph_lineK, phfK, N) {
            var E = 0;
            var x = 0;
            var v = 0;
            var W = 5;
            for (var i = 0; i <= N; i++) {
                E = phfK.Ekt(E, i / N);
                xNew = ph_lineK.r(E).re;
                vNew = xNew - x;
                if (i < W || N - W < i || N / 2 - W < i && i < N / 2 + W) {
                    logger.withPlaces(3).debug(i, " E:", E, " xNew:", xNew, " vNew:", vNew, " dv:", (vNew - v));
                }
                x = xNew;
                v = vNew;
            }
        }

        function testScale(K, uc) {
            var N = 50;
            logger.debug("testScale(N:", N, ",K:", K, ",uc:", uc, ")");
            var sgnK = K < 0 ? -1 : 1;
            var sK = Math.sqrt(Math.abs(K));
            var xMaxK = xMax / K;
            var e = 0.000001;
            var ph_lineK = new PHFactory([{
                x: 0,
                y: 0
            }, {
                x: xMaxK,
                y: yMax / K
            }, ]).quintic();
            logger.withPlaces(9).debug("ph_lineK z:", ph_lineK.z, " q:", ph_lineK.q);
            if (K > 0) {
                ph_lineK.z[1].re.should.within(ph_line.z[1].re / sK - e, ph_line.z[1].re / sK + e);
                ph_lineK.z[1].im.should.equal(0);
                ph_lineK.z[2].re.should.within(ph_line.z[2].re / sK - e, ph_line.z[2].re / sK + e);
                ph_lineK.z[2].im.should.equal(0);
            } else {
                ph_lineK.z[1].re.should.equal(0);
                ph_lineK.z[1].im.should.within(ph_line.z[1].re / sK - e, ph_line.z[1].re / sK + e);
                ph_lineK.z[2].re.should.equal(0);
                ph_lineK.z[2].im.should.within(ph_line.z[2].re / sK - e, ph_line.z[2].re / sK + e);
            }
            var vMax = xMax * 2;
            var tvMax = 0.5;
            var sMax = vMax * tvMax / 2;
            var phfK = new PHFeed(ph_lineK, {
                logLevel: "info",
                vIn: 0,
                vOut: 0,
                vMax: vMax,
                tvMax: 0.5
            });
            logger.withPlaces(9).debug("phfK", phfK);
            phfK.uc.should.equal(uc);
            traverse(ph_lineK, phfK, N);
            var sAccel = Math.abs(xMaxK) / 2;
            var sRatio = Math.sqrt(Math.min(sAccel, sMax) / sMax);
            var vCruise = vMax * sRatio;
            var tAccel = tvMax * sRatio;
            logger.debug("vCruise:", phfK.vCruise, " sAccel:", phfK.sAccel, " tAccel:", phfK.tAccel,
                " sRatio:", phfK.sRatio, " sMax:", sMax);
            if (Math.abs(K) > 1) {
                phfK.vCruise.should.within(vCruise - e, vCruise + e);
                phfK.sCruise.should.equal(0);
                phfK.tCruise.should.equal(0);
            } else if (Math.abs(K) == 1) {
                phfK.vCruise.should.within(vCruise - e, vCruise + e);
                phfK.vCruise.should.within(xMax * 2 - e, vMax * 2 + e);
                phfK.sCruise.should.equal(0);
                phfK.tCruise.should.equal(0);
            } else if (0 < Math.abs(K) && Math.abs(K) < 1) {
                phfK.vCruise.should.equal(vCruise);
                phfK.sCruise.should.above(0);
                phfK.tCruise.should.above(0);
            }
            (phfK.tAccel + phfK.tDecel).should.equal(phfK.tS - phfK.tCruise);
        }
        testScale(-0.5, "D2");
        testScale(0.5, "D2");
        testScale(-1, "D1"); // D1 or D2 acceptable
        testScale(1, "D1"); // D1 or D2 acceptable
        testScale(-2, "D1");
        testScale(2, "D1");
    });
    it("lines can go in all directions ", function() {
        function testxy(x, y) {
            var ph = new PHFactory([{
                x: 0,
                y: 0
            }, {
                x: x,
                y: y
            }, ]).quintic();
            logger.withPlaces(5).debug("x:", x, " y:", y, " z:", ph.z);
            shouldEqualT(ph.r(0), new Complex(), 0.00000001);
            shouldEqualT(ph.r(0.5), new Complex(x / 2, y / 2), 0.00000001);
            shouldEqualT(ph.r(1), new Complex(x, y), 0.00000001);
            var phf = new PHFeed(ph, {
                vMax: Math.max(Math.abs(x), Math.abs(y)),
                tvMax: 1,
            });
            var e = 0.00000001;
            phf.tS.should.within(2 - e, 2 + e);
        }
        testxy(-6400, 0);
        testxy(6400, 0);
        testxy(0, 6400);
        testxy(0, -6400);
    });
})

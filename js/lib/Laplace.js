var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
math = require("mathjs");

(function(firepick) {
    var logger = new Logger();
    function Laplace(options) {
        var that = this;
        options = options || {};
        that.b = options.b || 1;
        that.u = options.u == null ? 0 : options.u;
        that.unitLow = that.cdf(-0.5);
        that.unitHigh = that.cdf(0.5);
        that.logger = options.logger || new Logger(options);
        return that;
    };

    ///////////////// INSTANCE ///////////////
    Laplace.prototype.cdf = function(x) {
        var that = this;
        if (x < that.u) {
            return 1 / 2 * math.exp((x - that.u) / that.b);
        } else {
            return 1 - 1 / 2 * math.exp(-(x - that.u) / that.b);
        }
    }
    Laplace.prototype.cdfi = function(y) {
        var that = this;
        if (y < 0.5) {
            return that.u - that.b * math.log(1 / (2 * y));
        } else {
            return that.u - that.b * math.log(2 - 2 * y);
        }
    }
    Laplace.cdfb = function(x,y,u) {
        u = u==null ? 0 : u;
        if (y < 0.5) {
            return (u - x) / math.log(1 / (2 * y));
        } else {
            return (u - x) / math.log(2 - 2*y);
        }
    }
    Laplace.transitionb = function(p,q,options) {
        // Newton-Raphson would be faster but this is good enough
        options = options || {};
        var bMax = options.bMax || 100;
        var bMin = options.bMin || 0.01;
        var iterations = options.iterations || 16;
        var qb;
        var b = 1;
        
        for (var i=0; i < iterations; i++) {
            var lap = new Laplace({b:b});
            var qb = lap.transition(p);
            if (p < 0.5) {
                if (q < qb) {
                    bMax = b;
                } else {
                    bMin = b;
                }
            } else {
                if (q < qb) {
                    bMin = b;
                } else {
                    bMax = b;
                }
            }
            b = (bMin+bMax)/2;
        }

        return b;
    }
    Laplace.prototype.transition = function(tau) {
        var that = this;
        var c = that.cdf(tau - 0.5);
        return (c - that.unitLow) / (that.unitHigh - that.unitLow);
    }

    ///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.Laplace");
    module.exports = firepick.Laplace = Laplace;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.Laplace", function() {
    var logger = new Logger({
        nPlaces: 4,
        logLevel: "info"
    });
    var e = 0.0000001;
    var Laplace = firepick.Laplace;
    it("cdf(tau) should calculate cumulative distribution (b:1, u:0)", function() {
        var lap = new Laplace();
        lap.cdf(-10).should.within(0.0000227 - e, 0.0000227 + e);
        lap.cdf(0).should.equal(0.5);
        lap.cdf(10).should.within(0.9999773 - e, 0.9999773 + e);
    });
    it("cdf(tau) should calculate cumulative distribution (b:4, u:4)", function() {
        var lap = new Laplace({
            b: 4,
            u: 4
        });
        lap.cdf(-10).should.within(0.0150987 - e, 0.0150987 + e);
        lap.cdf(0).should.within(0.1839397 - e, 0.1839397 + e);
        lap.cdf(10).should.within(0.8884349 - e, 0.8884349 + e);
    });
    it("cdfi(tau) should calculate inverse cumulative distribution (b:1, u:0)", function() {
        var lap = new Laplace();
        var e = 0.000002;
        lap.cdfi(0.0000227).should.within(-10 - e, -10 + e);
        lap.cdfi(0.5).should.within(-e, +e);
        lap.cdfi(0.9999773).should.within(10 - e, 10 + e);

        lap.cdfi(0.1).should.within(-1.609438 - e, -1.609438 + e);
        lap.cdfi(0.01).should.within(-3.912023 - e, -3.912023 + e);
        lap.cdfi(0.001).should.within(-6.214608 - e, -6.214608 + e);
        lap.cdfi(0.0001).should.within(-8.517193 - e, -8.517193 + e);
        lap.cdfi(0.00001).should.within(-10.819778 - e, -10.819778 + e);
        lap.cdfi(0.99999).should.within(10.819778 - e, 10.819778 + e);
    });
    it("transition(tau) should map [0,1] to [0,1]", function() {
        var lap1 = new Laplace();
        lap1.unitHigh.should.within(0.6967347 - e, 0.6967347 + e);
        lap1.unitLow.should.within(0.3032653 - e, 0.3032653 + e);
        lap1.transition(0).should.equal(0);
        lap1.transition(0.1).should.within(0.08106017 - e, 0.08106017 + e);
        lap1.transition(0.25).should.within(0.21891175 - e, 0.21891175 + e);
        lap1.transition(0.5).should.equal(0.5);
        lap1.transition(0.75).should.within(0.78108825 - e, 0.78108825 + e);
        lap1.transition(0.9).should.within(0.91893983 - e, 0.91893983 + e);
        lap1.transition(1).should.equal(1);

        var lap05 = new Laplace({
            b: 0.5
        });
        lap05.transition(0).should.equal(0);
        lap05.transition(0.01).should.within(0.00587835 - e, 0.00587835 + e);
        lap05.transition(0.1).should.within(0.06442562 - e, 0.64425627 + e);
        lap05.transition(0.5).should.equal(0.5);
        lap05.transition(1).should.equal(1);

        var lap02 = new Laplace({
            b: 0.2
        });
        lap02.transition(0).should.equal(0);
        lap02.transition(0.01).should.within(0.00229247 - e, 0.00229247 + e);
        lap02.transition(0.02).should.within(0.00470248 - e, 0.00470248 + e);
        lap02.transition(0.1).should.within(0.02900611 - e, 0.02900611 + e);
        lap02.transition(0.2).should.within(0.07682910 - e, 0.07682910 + e);
        lap02.transition(0.5).should.within(0.5 - e, 0.5 + e);

        var lap01 = new Laplace({
            b: 0.1
        });
        lap01.transition(0).should.equal(0);
        lap01.transition(0.01).should.within(0.00035672 - e, 0.00035672 + e);
        lap01.transition(0.02).should.within(0.00075096 - e, 0.00075096 + e);
        lap01.transition(0.1).should.within(0.00582811 - e, 0.00582811 + e);
        lap01.transition(0.2).should.within(0.02167058 - e, 0.02167058 + e);
        lap01.transition(0.5).should.within(0.5 - e, 0.5 + e);
        lap01.transition(1).should.equal(1);

    });
    it("TESTTESTcdfb(x,y,u) should calculate b coefficient", function() {
        var e = 0.000001;
        Laplace.cdfb(-10, 0.0000227).should.within(1-e, 1+e);
        Laplace.cdfb(10, 0.9999773).should.within(1-e, 1+e);
        Laplace.cdfb(-10, 0.0150987,4).should.within(4-e, 4+e);
        Laplace.cdfb(0, 0.1839397,4).should.within(4-e, 4+e);
        Laplace.cdfb(-5, 0.0000227,5).should.within(1-e, 1+e);
        Laplace.cdfb(15, 0.9999773,5).should.within(1-e, 1+e);
    });
    it("TESTTESTtransitionb(p,q) should calculate b coefficient", function() {
        var bTarget = 0.25;
        var lappq = new Laplace({b:bTarget});
        var p = 0.125;
        var q = lappq.transition(p);
        var b = Laplace.transitionb(p,q);
        var e = 0.00001;
        b.should.within(bTarget-e, bTarget+e);
        var e = 0.0000001;
        b.should.not.within(bTarget-e, bTarget+e);
        b = Laplace.transitionb(p,q,{iterations:22});
        b.should.within(bTarget-e, bTarget+e);

        p = 0.9;
        q = lappq.transition(p);
        b = Laplace.transitionb(p,q);
        var e = 0.00001;
        b.should.within(bTarget-e, bTarget+e);
    });
})

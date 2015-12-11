var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("../../www/js/shared/Logger.js");
Bernstein = require("./Bernstein");
PHFactory = require("./PHFactory");

(function(firepick) {
    var DEGREE = 5;
    var b4 = new Bernstein(4);
    var b5 = new Bernstein(5);
    var tk_cache = [];
    var t1k_cache = [];

    function PH5Curve(phz, phq, options) {
        var that = this;
        phq.length.should.equal(phz.length);
        options = options || {};
        that.logger = options.logger || new Logger(options);
        for (var i = 1; i < phz.length; i++) {
            that.logger.trace("phz[", i, "]:", phz[i]);
            phz[i].re.should.be.Number;
            phz[i].im.should.be.Number;
            phq[i].re.should.be.Number;
            phq[i].im.should.be.Number;
        }
        that.N = phz.length - 1;
        that.z = phz;
        that.q = phq;
        that.pik_cache = [];
        that.wij_cache = [];
        that.sigma_cache = [];
        that.sit1_cache = [];
        that.sigmaij_cache = [];
        that.sik_cache = [];
        return that;
    };

    /////////////// PRIVATE ////////////////
    function powertk(p, K) {
        var p1 = 1 - p;
        var tk = [];
        tk.push(1);
        for (var k = 1; k <= K; k++) {
            tk.push(p * tk[k - 1]);
        }
        return tk;
    };

    function powert1k(p, K) {
        var p1 = 1 - p;
        var t1k = [];
        t1k.push(1);
        for (var k = 1; k <= K; k++) {
            t1k.splice(0, 0, p1 * t1k[0]);
        }
        return t1k;
    };

    ///////////////// INSTANCE ///////////////
    PH5Curve.prototype.r = function(p) { // position
        var that = this;
        p.should.not.be.below(0);
        p.should.not.be.above(1);
        var PN = p * that.N;
        var i = Math.ceil(PN) || 1;
        return that.rit(i, PN - i + 1);
    };
    PH5Curve.prototype.s = function(p) { // arc length 
        var that = this;
        var PN = p * that.N;
        var iPN = Math.ceil(PN) || 1;
        var sum = that.sit1_cache[iPN];
        if (sum == null) {
            p.should.not.be.below(0);
            p.should.not.be.above(1);
            sum = 0;
            for (var iSeg = 1; iSeg < iPN; iSeg++) {
                sum += that.sit(iSeg, 1);
            }
            that.sit1_cache[iPN] = sum;
        }
        sum += that.sit(iPN, PN - iPN + 1);
        return sum;
    };
    PH5Curve.prototype.sit = function(i, p) { // arc length 
        var that = this;
        var sum = 0;
        for (var k = 0; k <= DEGREE; k++) {
            var b5c = Bernstein.coefficient_nocheck(5, k, p);
            sum += that.sik(i, k) * b5c;
            //that.logger.trace("sit k:", k, " sum:", sum, " b5c:", b5c, " p:", p);
        }
        return sum;
    };
    PH5Curve.prototype.sik = function(i, k) { // arc length 
        var that = this;
        var key = k * 10 + i;
        var result = that.sik_cache[key];
        if (result != null) {
            return result;
        }
        var sum = 0;
        for (var j = 0; j <= k - 1; j++) {
            sum += that.sigmaij(i, j);
        }
        result = sum / DEGREE;
        that.sik_cache[key] = result;
        return result;
    };
    PH5Curve.prototype.sigmaij = function(i, j) {
        var that = this;
        var key = j * 10 + i;
        var result = that.sigmaij_cache[key];
        if (result != null) {
            return result;
        };
        var wi0 = that.wij(i, 0);
        var wi1 = that.wij(i, 1);
        var wi2 = that.wij(i, 2);
        var u0 = wi0.re;
        var v0 = wi0.im;
        var u1 = wi1.re;
        var v1 = wi1.im;
        var u2 = wi2.re;
        var v2 = wi2.im;
        switch (j) {
            case 0:
                result = u0 * u0 + v0 * v0;
                break;
            case 1:
                result = u0 * u1 + v0 * v1;
                break;
            case 2:
                result = (2 / 3) * (u1 * u1 + v1 * v1) + (1 / 3) * (u0 * u2 + v0 * v2);
                break;
            case 3:
                result = u1 * u2 + v1 * v2;
                break;
            case 4:
                result = u2 * u2 + v2 * v2;
                break;
            default:
                should.fail("invalid j:" + j);
                break;
        }
        that.sigmaij_cache[key] = result;
        return result;
    };
    PH5Curve.prototype.sigma = function(p) { // curve parametric speed
        var that = this;
        result = that.rprime(p).modulus();
        return result;
    };
    PH5Curve.prototype.rprime = function(p) { // hodograph
        var that = this;
        p.should.not.be.below(0);
        p.should.not.be.above(1);
        var PN = p * that.N;
        var i = Math.ceil(PN) || 1;
        return Complex.times(that.N, that.ritprime(i, PN - i + 1));
    };
    PH5Curve.prototype.ritprime = function(i, p) { // segment hodograph
        var that = this;
        var sum = new Complex();
        var p1 = 1 - p;
        var z = that.z;
        var N = that.N;
        if (i === 1) {
            var z1 = z[1];
            var z2 = z[2];
            sum.add(Complex.times(1 / 2 * p1 * p1, Complex.times(3, z1).minus(z2)));
            sum.add(Complex.times(2 * p1 * p, z1));
            sum.add(Complex.times(1 / 2 * p * p, z1.plus(z2)));
        } else if (i === N) {
            var zN = z[N];
            var zN1 = z[N - 1];
            sum.add(Complex.times(1 / 2 * p1 * p1, zN.plus(zN1)));
            sum.add(Complex.times(2 * p1 * p, zN));
            sum.add(Complex.times(1 / 2 * p * p, Complex.times(3, zN).minus(zN1)));
        } else {
            sum.add(Complex.times(1 / 2 * p1 * p1, z[i - 1].plus(z[i])));
            sum.add(Complex.times(2 * p1 * p, z[i]));
            sum.add(Complex.times(1 / 2 * p * p, z[i].plus(z[i + 1])));
        }
        return sum.times(sum);
    };
    PH5Curve.prototype.rit = function(i, p) {
        var that = this;
        i.should.not.be.below(0);
        i.should.not.be.above(that.N);
        p.should.not.be.below(0);
        p.should.not.be.above(1);
        var sum = new Complex();
        var tk = tk_cache[p];
        var t1k;
        if (tk == null) {
            tk = powertk(p, 5);
            t1k = powert1k(p, 5);
            tk_cache[p] = tk;
            t1k_cache[p] = t1k;
        } else {
            t1k = t1k_cache[p];
        }
        for (var k = 0; k <= 5; k++) {
            var re = Util.choose(5, k) * t1k[k] * tk[k];
            var c = Complex.times(that.pik(i, k), re);
            sum.add(c);
            //that.logger.trace("rit k:", k, " re:", re, " c:", c, " sum:", sum, 
            //" pik:", that.pik(i,k), " choose:", Util.choose(5,k));
        }
        return sum;
    };
    PH5Curve.prototype.w1j = function(j) {
        var that = this;
        var z1 = that.z[1];
        var z2 = that.z[2];
        switch (j) {
            case 0:
                return Complex.times(1 / 2, Complex.times(3, z1).minus(z2));
            case 1:
                return z1;
            case 2:
                return Complex.times(1 / 2, z1.plus(z2));
            default:
                should.fail("w1j j:" + j);
        }
    };
    PH5Curve.prototype.wNj = function(j) {
        var that = this;
        var zN = that.z[that.N];
        var zN1 = that.z[that.N - 1];
        switch (j) {
            case 0:
                return Complex.times(1 / 2, zN1.plus(zN));
            case 1:
                return zN;
            case 2:
                return Complex.times(1 / 2, Complex.times(3, zN).minus(zN1));
            default:
                should.fail("wNj j:" + j);
        }
    };
    PH5Curve.prototype.wij = function(i, j) {
        var that = this;
        var key = i * 10 + j;
        var result = that.wij_cache[key];
        if (result) {
            return result;
        }
        if (i === 1) {
            return that.w1j(j);
        }
        if (i === that.N) {
            return that.wNj(j);
        }
        var zi = that.z[i];
        i.should.not.be.below(1);
        i.should.not.be.above(that.N);
        zi.should.instanceOf(Complex);
        that.z[i - 1].should.instanceOf(Complex);
        switch (j) {
            case 0:
                result = Complex.times(1 / 2, that.z[i - 1].plus(zi));
                break;
            case 1:
                result = zi;
                break;
            case 2:
                result = Complex.times(1 / 2, zi.plus(that.z[i + 1]));
                break;
            default:
                should.fail("wij j:" + j);
                break;
        }
        that.wij_cache[key] = result;
        return result;
    };
    PH5Curve.prototype.pik = function(i, k) {
        var that = this;
        var key = i * 10 + k;
        var result = that.pik_cache[key];
        if (result) {
            return result;
        }
        i.should.be.above(0);
        i.should.not.be.above(that.N);

        switch (k) {
            case 0:
                result = that.q[i - 1];
                break;
            case 1:
                result = that.pik(i, 0)
                    .plus(Complex.times(1 / 5, that.wij(i, 0).times(that.wij(i, 0))));
                break;
            case 2:
                result = that.pik(i, 1)
                    .plus(Complex.times(1 / 5, that.wij(i, 0).times(that.wij(i, 1))));
                break;
            case 3:
                result = that.pik(i, 2)
                    .plus(Complex.times(2 / 15, that.wij(i, 1).times(that.wij(i, 1))))
                    .plus(Complex.times(1 / 15, that.wij(i, 0).times(that.wij(i, 2))));
                break;
            case 4:
                result = that.pik(i, 3)
                    .plus(Complex.times(1 / 5, that.wij(i, 1).times(that.wij(i, 2))));
                break;
            case 5:
                result = that.pik(i, 4)
                    .plus(Complex.times(1 / 5, that.wij(i, 2).times(that.wij(i, 2))));
                break;
            default:
                should.fail("invalid k:" + k);
                break;
        }
        that.pik_cache[key] = result;
        return result;
    };

    ///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.PH5Curve");
    module.exports = firepick.PH5Curve = PH5Curve;
})(firepick || (firepick = {}));


(typeof describe === 'function') && describe("firepick.PH5Curve", function() {
    var logger = new Logger({
        nPlaces: 1,
        logLevel: "info"
    });
    var PH5Curve = firepick.PH5Curve;

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
    it("s(p) should be monotone returning arc length for p:[0,1] ", function() {
        var ph = new PHFactory([{
            x: 1,
            y: 1
        }, {
            x: 5,
            y: 4
        }, ], {
            logger: logger
        });
        should.exist(ph.solvez());
        var phi = new PH5Curve(ph.z, ph.q);
        var epsilon = 0.0000000001;
        phi.s(0 + epsilon).should.above(phi.s(0));
        phi.s(0.1 + epsilon).should.above(phi.s(0.1));
        phi.s(0.2 + epsilon).should.above(phi.s(0.2));
        phi.s(0.3 + epsilon).should.above(phi.s(0.3));
        phi.s(0.4 + epsilon).should.above(phi.s(0.4));
        phi.s(0.5 + epsilon).should.above(phi.s(0.5));
        phi.s(0.6 + epsilon).should.above(phi.s(0.6));
        phi.s(0.7 + epsilon).should.above(phi.s(0.7));
        phi.s(0.8 + epsilon).should.above(phi.s(0.8));
        phi.s(0.9 + epsilon).should.above(phi.s(0.9));
        phi.s(1 - epsilon).should.above(phi.s(1 - 2 * epsilon));
        phi.s(0).should.equal(0);
        phi.s(0.1).should.within(0.499, 0.500);
        phi.s(0.5).should.within(2.5, 2.5);
        phi.s(0.9).should.within(4.499, 4.500);
        phi.s(1).should.within(5, 5);
        var ph2 = new PHFactory([{
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 2
        }, {
            x: 1,
            y: 1
        }, ], {
            logger: logger
        }).quintic();
        ph2.s(0).should.within(0, 0);
        ph2.s(0.5).should.within(1.527, 1.528);
        ph2.s(1).should.within(3.055, 3.056);
    });
    it("rprime(p) should return velocity vector for p:[0,1]", function() {
        var ph = new PHFactory([{
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 2
        }, {
            x: 1,
            y: 1
        }, ], {
            logger: logger
        });
        should.exist(ph.solvez());
        var phi = new PH5Curve(ph.z, ph.q);
        var epsilon = 0.001;
        shouldEqualT(phi.rprime(0), new Complex(0.945, 4.000), epsilon);
        shouldEqualT(phi.rprime(0.25), new Complex(2.132, 2.000), epsilon);
        shouldEqualT(phi.rprime(0.5), new Complex(2.528, 0.000), epsilon);
        shouldEqualT(phi.rprime(0.75), new Complex(2.132, -2.000), epsilon);
        shouldEqualT(phi.rprime(1), new Complex(0.945, -4.000), epsilon);
    });
    it("sigma(p) should return parametric speed for p:[0,1]", function() {
        var ph = new PHFactory([{
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 2
        }, {
            x: 1,
            y: 1
        }, ], {
            logger: logger
        });
        ph.solvez();
        var phi = new PH5Curve(ph.z, ph.q);
        var epsilon = 0.001;
        phi.sigma(0).should.within(4.110, 4.111);
        phi.sigma(0.3).should.within(2.780, 2.781);
        phi.sigma(0.5).should.within(2.527, 2.528);
        phi.sigma(0.7).should.within(2.780, 2.781);
        phi.sigma(1.0).should.within(4.110, 4.111);
    });
    it("attributes z and p should completely determine a PH curve", function() {
        var ph = new PHFactory([{
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 2
        }, {
            x: 1,
            y: 1
        }, ]).quintic();
        ph.q.length.should.equal(3);
        ph.z.length.should.equal(3);
        logger.withPlaces(15).debug("q:", ph.q);
        logger.withPlaces(15).debug("z:", ph.z);
        var ph2 = new PH5Curve(ph.z, ph.q);
        for (var i = 0; i <= 10; i++) {
            var p = i / 10;
            shouldEqualT(ph.r(p), ph2.r(p), 0.0000000000000000001);
        }
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
        }
        testxy(6400, 0);
        testxy(6400, 1600);
        testxy(6400, 6400);
        testxy(1600, 6400);
        testxy(0, 6400);
        testxy(-1600, 6400);
        testxy(-6400, 6400);
        testxy(-6400, 1600);
        testxy(-6400, 0);
        testxy(-6400, -1600);
        testxy(-6400, -6400);
        testxy(-1600, -6400);
        testxy(0, -6400);
        testxy(1600, -6400);
        testxy(6400, -6400);
        testxy(6400, -1600);
    });
    it("should compute quickly", function() {
        var values = [9563, 8839, 7879, 6822, 6039,
            5486, 5145, 5007, 5070, 5335, 5808,
            6504, 7455, 8735, 9996, 11119,
        ];
        var pts = [];
        for (var i = 0; i < values.length; i++) {
            pts.push(new Complex(values[i], i * 1000));
        }
        var ph = new PHFactory(pts).quintic();
        var N = 150;
        var e = 0.00000001;
        for (var i = 1; i <= N; i++) {
            var tau = i / N;
            var v = ph.r(tau);
            if (i % 10 === 0) {
                v.re.should.within(values[i / 10] - e, values[i / 10] + e);
                v.im.should.within(i * 100 - e, i * 100 + e);
                logger.debug("i:", i, " ", ph.r(tau));
            }
        }

    });
    it("complex path should be smooth", function() {
        var pts = [
            new Complex(10656, 0),
            new Complex(9282, 1000),
            new Complex(7714, 2000),
            new Complex(7404, 3000),
            new Complex(8426, 4000),
            new Complex(10303, 5000),
            new Complex(12477, 6000),
        ];
        var ph = new PHFactory(pts).quintic();
        var N = 100;
        var rPrev = ph.r(0);
        for (var i = 1; i <= N; i++) {
            var tau = i / N;
            var r = ph.r(tau);
            var dr = Math.abs(r.re - rPrev.re);
            logger.withPlaces(5).debug(", ", tau, ", ", r.re, ", ", r.im, ", ", dr);
            dr.should.below(136);
            rPrev = r;
        }
        logger.debug("done");
    });
})

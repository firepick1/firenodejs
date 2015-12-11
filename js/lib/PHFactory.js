var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("../../www/js/shared/Logger.js");
Tridiagonal = require("./Tridiagonal");
PH5Curve = require("./PH5Curve");

(function(firepick) {
    function PHFactory(pts, options) {
        var that = this;
        options = options || {};
        that.logger = options.logger || new Logger(options);
        that.degree = 5; // only support quintics
        that.degree2 = Math.ceil(that.degree / 2);
        that.dzMax = options.dzMax || 0.00001;
        that.iterationsMax = options.iterationsMax || 50;
        pts.should.be.Array;
        pts.length.should.be.above(1);
        initz(that, pts);
        that.N = that.q.length - 1;
        that.Mij_cache = [];
        that.zz_cache = [];
        return that;
    };

    function initz(that, pts) {
        var z = ["z0"];
        var q = [];
        if (pts.length === 2) { // interpolate
            pts = [
                pts[0],
                Complex.times(1 / 2,
                    Complex.plus(pts[0], pts[1])),
                pts[1],
            ];
        }
        for (var i = 0; i < pts.length; i++) {
            q.push(Complex.from(pts[i]));
            if (i > 0) {
                z.push(q[i].minus(q[i - 1]).sqrt()); // linear starting condition
            }
        }
        that.logger.trace("z:", z);
        that.logger.trace("q:", q);
        for (var i = 2; i < q.length; i++) {
            var modq1 = q[i].minus(q[i - 1]).modulus();
            var modq2 = q[i - 1].minus(q[i - 2]).modulus();
            var ratio = modq1 / modq2;
            if (ratio < 1 / 2 || 2 < ratio) {
                that.logger.warn("uneven point spacing ratio:", ratio,
                    " q[", i, "]:", q[i], " q:", q);
            }
        }
        that.z = z;
        that.q = q;
    };

    ///////////////// INSTANCE ///////////////
    PHFactory.prototype.quintic = function() {
        var that = this;
        that.solvez();
        return new PH5Curve(that.z, that.q);
    };
    PHFactory.prototype.solvez = function(options) {
        var that = this;
        var loop = true;
        var iteration = 1;
        options = options || {};
        var iterationsMax = options.iterationMax || that.iterationsMax;
        var logLevel = that.logger.logLevel;
        that.logger.setLevel(options.logLevel || logLevel);
        for (; loop && iteration <= iterationsMax; iteration++) {
            // Newton-Raphson
            that.zz_cache = [];
            var a = [];
            var b = [];
            var c = [];
            var d = [];
            var N = that.N;
            var c0 = new Complex();
            for (var i = 1; i <= N; i++) {
                a.push(i === 1 ? c0 : that.Mij(i, i - 1));
                b.push(that.Mij(i, i));
                c.push(i === N ? c0 : that.Mij(i, i + 1));
                d.push(Complex.minus(that.fi(i)));
            }
            that.logger.trace("a:", a);
            that.logger.trace("b:", b);
            that.logger.trace("c:", c);
            that.logger.trace("d:", d);
            var tri = new Tridiagonal(that.N);
            var dz = tri.solveComplex(a, b, c, d);
            that.logger.trace("dz:", dz);
            loop = false;
            for (var i = 0; i < dz.length; i++) {
                loop = loop || dz[i].modulus() > that.dzMax;
                that.z[i + 1].add(dz[i]);
            }
        }
        var result = null;
        if (loop) {
            that.logger.warn("solvez exceeded iterationsMax:", that.iterationsMax);
        } else {
            that.logger.debug("solvez converged iterations:", iteration - 1);
            result = iteration - 1;
        }
        that.logger.debug("z:", that.z);
        that.dumpJacobian();
        that.logger.setLevel(logLevel);
        return result;
    };
    PHFactory.prototype.zz = function(i, j) {
        var that = this;
        var key = 1000 * i + j;
        var result = that.zz_cache[key];
        if (result == null) {
            result = that.z[i].times(that.z[j]);
            that.zz_cache[key] = result;
        }
        return result;
    };
    PHFactory.prototype.fi = function(i) {
        var that = this;
        var N = that.N;
        i.should.be.above(0);
        i.should.not.be.above(N);
        var sum = new Complex();
        var q = that.q;
        var z = that.z;
        if (i === 1) {
            var z1 = z[1];
            var z2 = z[2];
            sum.add(Complex.times(13, that.zz(1, 1)));
            sum.add(that.zz(2, 2));
            sum.add(Complex.times(-2, that.zz(1, 2)));
            sum.add(Complex.times(-12, q[1].minus(q[0])));
        } else if (i === N) {
            var N1 = N - 1;
            var zN = z[N];
            var zN1 = z[N1];
            sum.add(Complex.times(13, that.zz(N, N)));
            sum.add(that.zz(N1, N1));
            sum.add(Complex.times(-2, that.zz(N, N1)));
            sum.add(Complex.times(-12, q[N].minus(q[N1])));
        } else {
            sum.add(Complex.times(3, that.zz(i - 1, i - 1)));
            sum.add(Complex.times(27, that.zz(i, i)));
            sum.add(Complex.times(3, that.zz(i + 1, i + 1)));
            sum.add(that.zz(i - 1, i + 1));
            sum.add(Complex.times(13, that.zz(i - 1, i)));
            sum.add(Complex.times(13, that.zz(i, i + 1)));
            sum.add(Complex.times(-60, q[i].minus(q[i - 1])));
        }
        /*
        if (i === 1) {
        	var z1 = z[1];
        	var z2 = z[2];
        	sum.add(Complex.times(13, z1, z1));
        	sum.add(Complex.times(    z2, z2));
        	sum.add(Complex.times(-2, z1, z2));
        	sum.add(Complex.times(-12,q[1].minus(q[0])));
        } else if (i === N) {
        	var N1 = N - 1;
        	var zN = z[N];
        	var zN1 = z[N1];
        	sum.add(Complex.times(13, zN, zN));
        	sum.add(Complex.times(    zN1,zN1));
        	sum.add(Complex.times(-2, zN, zN1));
        	sum.add(Complex.times(-12,q[N].minus(q[N1])));
        } else {
        	sum.add(Complex.times(3,  z[i-1],z[i-1]));
        	sum.add(Complex.times(27, z[i],  z[i]));
        	sum.add(Complex.times(3,  z[i+1],z[i+1]));
        	sum.add(Complex.times(	  z[i-1],z[i+1]));
        	sum.add(Complex.times(13, z[i-1],z[i]));
        	sum.add(Complex.times(13, z[i],  z[i+1]));

        	sum.add(Complex.times(-60,q[i].minus(q[i-1])));
        }
        */
        return sum;
    };
    PHFactory.prototype.Mij = function(i, j) {
        var that = this;
        var key = i * 1000 + j;
        //var result = that.Mij_cache[key];
        //if (result != null) {
        //return result;
        //}
        var N = that.N;
        var N1 = N - 1;
        i.should.be.above(0);
        j.should.be.above(0);
        i.should.not.be.above(N);
        j.should.not.be.above(N);
        var sum = new Complex();
        var z = that.z;
        if (j === i - 1) {
            if (i === 1) {
                should.fail();
            } else if (i === N) {
                sum.add(Complex.times(2, z[N1]));
                sum.add(Complex.times(-2, z[N]));
            } else {
                sum.add(Complex.times(6, z[i - 1]));
                sum.add(Complex.times(13, z[i]));
                sum.add(z[i + 1]);
            }
        } else if (j === i) {
            if (i === 1) {
                sum.add(Complex.times(26, z[1]));
                sum.add(Complex.times(-2, z[2]));
            } else if (i === N) {
                sum.add(Complex.times(26, z[N]));
                sum.add(Complex.times(-2, z[N1]));
            } else {
                sum.add(Complex.times(13, z[i - 1]));
                sum.add(Complex.times(54, z[i]));
                sum.add(Complex.times(13, z[i + 1]));
            }
        } else if (j === i + 1) {
            if (i === 1) {
                sum.add(Complex.times(2, z[2]));
                sum.add(Complex.times(-2, z[1]));
            } else if (i === N) {
                should.fail();
            } else {
                sum.add(z[i - 1]);
                sum.add(Complex.times(13, z[i]));
                sum.add(Complex.times(6, z[i + 1]));
            }
        } else {
            // zero
        }
        //that.Mij_cache[key] = sum; // cannot cache => Mij changes with each Newton-Raphson iteration
        return sum;
    };
    PHFactory.prototype.dumpJacobian = function(nPlaces) {
        var that = this;
        var N = that.N;
        nPlaces = nPlaces || 0;
        for (var i = 1; i <= N; i++) {
            var row = "|\t";
            for (var j = 1; j <= N; j++) {
                var mij = that.Mij(i, j);
                row += mij.stringify(nPlaces);
                row += "\t";
            }
            row += "| = - | ";
            row += that.fi(i).stringify(nPlaces);
            row += "\t|";
            that.logger.debug(row);
        }
    };

    ///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.PHFactory");
    module.exports = firepick.PHFactory = PHFactory;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.PHFactory", function() {
    var logger = new Logger({
        nPlaces: 1,
        logLevel: "info"
    });
    var PHFactory = firepick.PHFactory;
    var pts = [{
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
    }, ];

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
    it("new PHFactory(5,[pts]) should create a 5-degree PHFactory instance", function() {
        var ph5 = new PHFactory(pts);
        ph5.should.have.properties({
            degree: 5,
            degree2: 3
        });
    });
    it("new PHFactory([p1,p2]).quintic().r(p) should interpolate a 2-point straight line", function() {
        var ph = new PHFactory([{
            x: 1,
            y: 1
        }, {
            x: 5,
            y: 3
        }, ], {
            logger: logger
        }).quintic();
        var z1N = new Complex(2, 1).sqrt();
        var epsilon = 0.00000001;
        shouldEqualT(ph.z[1], z1N);
        shouldEqualT(ph.z[2], z1N);
        should.deepEqual(ph.r(0), new Complex(1, 1));

        shouldEqualT(ph.r(0.1), new Complex(1.4, 1.2));
        shouldEqualT(ph.r(0.5), new Complex(3, 2));
        shouldEqualT(ph.r(0.6), new Complex(3.4, 2.2));
        shouldEqualT(ph.r(0.9), new Complex(4.6, 2.8));
        shouldEqualT(ph.r(1), new Complex(5, 3));
        ph.s(0).should.equal(0);
        ph.s(0.5).should.within(2.23606, 2.23607);
        var sqrt20 = Math.sqrt(20);
        ph.s(1).should.within(sqrt20 - epsilon, sqrt20 + epsilon);
    });
    it("new PHFactory([p1,p2]).quintic() should return the PHCurve for a 5-point straight line", function() {
        var ph = new PHFactory([{
            x: 1,
            y: 1
        }, {
            x: 2,
            y: 1.5
        }, {
            x: 3,
            y: 2
        }, {
            x: 4,
            y: 2.5
        }, {
            x: 5,
            y: 3
        }, ], {
            logger: logger
        }).quintic();
        var z1N = new Complex(1, 0.5).sqrt();
        shouldEqualT(ph.z[1], z1N);
        shouldEqualT(ph.z[2], z1N);
        shouldEqualT(ph.z[3], z1N);
        shouldEqualT(ph.z[4], z1N);
        should.deepEqual(ph.r(0), new Complex(1, 1));

        shouldEqualT(ph.r(0.1), new Complex(1.4, 1.2));
        shouldEqualT(ph.r(0.5), new Complex(3, 2));
        shouldEqualT(ph.r(0.6), new Complex(3.4, 2.2));
        shouldEqualT(ph.r(0.9), new Complex(4.6, 2.8));
        shouldEqualT(ph.r(1), new Complex(5, 3));

        ph.s(0).should.equal(0);
        ph.s(0.5).should.equal(Math.sqrt(20) / 2);
        ph.s(1).should.equal(Math.sqrt(20));
    });
    it("solvez(options) should calculate PHFactory z coefficients", function() {
        var ph = new PHFactory([{
                x: 1,
                y: 1
            }, {
                x: 2,
                y: 1.5
            }, // irregular spacing
            {
                x: 4,
                y: 2.5
            }, // irregular spacing
            {
                x: 5,
                y: 3
            },
        ], {
            logger: logger
        }).quintic();
        shouldEqualT(ph.r(0), new Complex(1, 1));
        shouldEqualT(ph.r(0.1), new Complex(1.172, 1.086));
        shouldEqualT(ph.r(0.5), new Complex(3, 2));
        shouldEqualT(ph.r(0.6), new Complex(3.629, 2.314));
        shouldEqualT(ph.r(0.9), new Complex(4.828, 2.914));
        shouldEqualT(ph.r(1), new Complex(5, 3));

        ph.s(0).should.equal(0);
        var e = 0.000000001;
        var sqrt20 = Math.sqrt(20);
        ph.s(0.5).should.within(sqrt20 / 2 - e, sqrt20 / 2 + e);
        ph.s(1).should.within(sqrt20 - e, sqrt20 + e);
    });
    it("solvez() should solve interpolate a 3-point curve", function() {
        var phf = new PHFactory([{
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
        phf.solvez().should.equal(3);
        var ph = phf.quintic();
        logger.debug("ph.z:", ph.z);
        shouldEqualT(ph.r(0), new Complex(-1, 1));
        shouldEqualT(ph.r(0.01), new Complex(-0.99, 1.04));
        shouldEqualT(ph.r(0.02), new Complex(-0.98, 1.078));
        shouldEqualT(ph.r(0.05), new Complex(-0.945, 1.19));
        shouldEqualT(ph.r(0.1), new Complex(-0.876, 1.36));
        shouldEqualT(ph.r(0.2), new Complex(-0.701, 1.64));
        shouldEqualT(ph.r(0.3), new Complex(-0.489, 1.84));
        shouldEqualT(ph.r(0.4), new Complex(-0.25, 1.96));
        shouldEqualT(ph.r(0.5), new Complex(0, 2));
        shouldEqualT(ph.r(0.6), new Complex(0.25, 1.96));
        shouldEqualT(ph.r(0.7), new Complex(0.489, 1.84));
        shouldEqualT(ph.r(0.8), new Complex(0.701, 1.64));
        shouldEqualT(ph.r(0.9), new Complex(0.876, 1.36));
        shouldEqualT(ph.r(0.95), new Complex(0.945, 1.19));
        shouldEqualT(ph.r(0.98), new Complex(0.98, 1.078));
        shouldEqualT(ph.r(0.99), new Complex(0.99, 1.04));
        shouldEqualT(ph.r(1), new Complex(1, 1));
    });
    it("sigma(p) should be independent of the number of points", function() {
        var ph2 = new PHFactory([{
            x: 1,
            y: 1
        }, {
            x: 5,
            y: 4
        }, ], {
            logger: logger
        }).quintic();
        var epsilon = 0.0000001;
        ph2.sigma(0).should.within(5 - epsilon, 5 + epsilon);
        var ph3 = new PHFactory([{
            x: 1,
            y: 1
        }, {
            x: 1 + 4 / 3,
            y: 2
        }, {
            x: 1 + 8 / 3,
            y: 3
        }, {
            x: 5,
            y: 4
        }, ], {
            logger: logger
        }).quintic();
        ph3.sigma(0).should.within(5 - epsilon, 5 + epsilon);
    });
})

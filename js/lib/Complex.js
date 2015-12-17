var should = require("should");
Logger = require("../../www/js/shared/Logger");

(function(exports) {
    var that = {};

    function Complex(re, im) {
        var that = this;
        that.re = re || 0;
        that.im = im || 0;
        return that;
    };

    ///////////////// INSTANCE ///////////////
    Complex.prototype.modulus = function() {
        var that = this;
        return Math.sqrt(that.re * that.re + that.im * that.im);
    };
    Complex.prototype.add = function(c2) {
        var that = this;
        that.re += c2.re;
        that.im += c2.im;
        return that;
    };
    Complex.prototype.sqrt = function() {
        var that = this;
        var modulus = that.modulus();
        var p = Math.sqrt((modulus + that.re) / 2);
        var q = Math.sqrt((modulus - that.re) / 2);
        if (that.im >= 0) {
            return new Complex(p, q);
        } else {
            return new Complex(p, -q);
        }
    };
    Complex.prototype.plus = function(c2) {
        var that = this;
        return new Complex(that.re + c2.re, that.im + c2.im);
    };
    Complex.prototype.minus = function(c2) {
        var that = this;
        if (c2 == null) {
            return new Complex(-that.re, -that.im);
        }
        return new Complex(that.re - c2.re, that.im - c2.im);
    };
    Complex.prototype.times = function(c2) {
        var that = this;
        return new Complex(that.re * c2.re - that.im * c2.im,
            that.re * c2.im + that.im * c2.re);
    };
    Complex.prototype.conj = function() {
        var that = this;
        return new Complex(that.re, -that.im);
    };
    Complex.prototype.div = function(c2) {
        var that = this;
        var denom = c2.re * c2.re + c2.im * c2.im;
        return new Complex(
            (that.re * c2.re + that.im * c2.im) / denom, (that.im * c2.re - that.re * c2.im) / denom);
    };
    Complex.prototype.recip = function() {
        var that = this;
        var denom = that.re * that.re + that.im * that.im;
        return new Complex(that.re / denom, -that.im / denom);
    };
    Complex.prototype.isNear = function(c2, epsilon) {
        var that = this;
        var dRe = that.re - c2.re;
        var dIm = that.im - c2.im;
        var modulus = Math.sqrt(dRe * dRe + dIm * dIm);
        epsilon.should.be.Number;
        return modulus <= epsilon;
    };
    Complex.prototype.stringify = function(options) {
        var that = this;
        var s = "";
        options = options || {};
        nPlaces = options.nPlaces == null ? 0 : options.nPlaces;
        var re = Util.roundN(that.re, nPlaces);
        var im = Util.roundN(that.im, nPlaces);
        if (im) {
            if (im < 0) {
                if (re !== 0) {
                    s += re;
                }
                if (im === -1) {
                    s += "-";
                } else {
                    s += im;
                }
            } else {
                if (re !== 0) {
                    s += re;
                    s += "+";
                }
                if (im !== 1) {
                    s += im;
                }
            }
            s += "i";
        } else {
            s += re;
        }
        return s;
    };
    Complex.prototype.shouldEqualT = function(expected, tolerance) {
        var that = this;
        tolerance = tolerance || 0.0000001;
        that.re.should.within(expected.re - tolerance, expected.re + tolerance);
        that.im.should.within(expected.im - tolerance, expected.im + tolerance);
    }

    //////////////// CLASS ////////////
    Complex.from = function(xy) {
        if (xy instanceof Complex) {
            return xy;
        }
        if (xy.hasOwnProperty("x")) {
            return new Complex(xy.x, xy.y);
        }
        if (xy.hasOwnProperty("re")) {
            return new Complex(xy.re, xy.im);
        }
        return new Complex(xy);
    };
    Complex.times = function(a, b) {
        var result = Complex.from(a).times(Complex.from(b));
        for (var i = 2; i < arguments.length; i++) {
            result = result.times(Complex.from(arguments[i]));
        }
        return result;
    };
    Complex.minus = function(a, b) {
        if (b == null) {
            return Complex.from(a).minus();
        }
        var result = Complex.from(a).minus(Complex.from(b));
        for (var i = 2; i < arguments.length; i++) {
            result = result.minus(Complex.from(arguments[i]));
        }
        return result;
    };
    Complex.plus = function(a, b) {
        var result = Complex.from(a).plus(Complex.from(b));
        for (var i = 2; i < arguments.length; i++) {
            result = result.plus(Complex.from(arguments[i]));
        }
        return result;
    };
    Complex.div = function(a, b) {
        var result = Complex.from(a).div(Complex.from(b));
        for (var i = 2; i < arguments.length; i++) {
            result = result.div(Complex.from(arguments[i]));
        }
        return result;
    };

    module.exports = exports.Complex = Complex;
})(typeof exports === "object" ? exports : (exports={}));

(typeof describe === 'function') && describe("Complex", function() {
    var Complex = exports.Complex;
    it("new Complex(re,im) should create a complex number", function() {
        var c1 = new Complex(1, 2);
        c1.should.have.properties({
            re: 1,
            im: 2
        });
    });
    it("c.modulus() should return the modulus of a complex number", function() {
        var c1 = new Complex(3, 4);
        c1.modulus().should.equal(5);
        new Complex(4, 3).modulus().should.equal(5);
    });
    it("c1.plus(c2) should return the complex sum", function() {
        var c13 = new Complex(1, 3);
        var c24 = new Complex(2, 4);
        should.deepEqual(c13.plus(c24), new Complex(3, 7));
        should.deepEqual(c24.plus(c13), new Complex(3, 7));
    });
    it("c1.minus(c2) should return the complex difference", function() {
        var c13 = new Complex(1, 3);
        var c24 = new Complex(2, 4);
        should.deepEqual(c13.minus(c24), new Complex(-1, -1));
        should.deepEqual(c24.minus(c13), new Complex(1, 1));
        should.deepEqual(c13.minus(), new Complex(-1, -3));
    });
    it("c1.times(c2) should return the complex product", function() {
        var c13 = new Complex(1, 3);
        var c24 = new Complex(2, 4);
        should.deepEqual(c13.times(c24), new Complex(1 * 2 - 3 * 4, 1 * 4 + 3 * 2));
        should.deepEqual(c24.times(c13), new Complex(1 * 2 - 3 * 4, 1 * 4 + 3 * 2));
    });
    it("c.conj() should return the complex conjugate", function() {
        should.deepEqual(new Complex(1, 2).conj(), new Complex(1, -2));
    });
    it("c.recip() should return the reciprocal", function() {
        var c13 = new Complex(1, 3);
        var cr = c13.recip();
        cr.re.should.be.within(0.1, 0.1);
        cr.im.should.be.within(-0.3, -0.3);
        var crr = cr.recip();
        crr.re.should.be.within(1, 1);
        crr.im.should.be.within(2.999999999999999, 3);
    });
    it("c1.div(c2) should return the complex quotient", function() {
        var c13 = new Complex(1, 3);
        var c24 = new Complex(2, 4);
        var result = c13.div(c24);
        result.re.should.be.within(0.7, 0.7);
        result.im.should.be.within(0.1, 0.1);
    });
    it("Complex.plus(a,b,...) should handle real and complex numbers", function() {
        var c = [
            Complex.plus(3, new Complex(1, 2)),
            Complex.plus(new Complex(1, 2), 3),
            Complex.plus(new Complex(3), new Complex(1, 2)),
            Complex.plus(new Complex(1, 2), new Complex(3)),
            Complex.plus(1, -1, new Complex(1, 2), new Complex(3)),
        ];
        for (var i = 0; i < c.length; i++) {
            c[i].re.should.equal(4, i);
            c[i].im.should.equal(2, i);
        }
    });
    it("Complex.minus(a,b,...) should handle real and complex numbers", function() {
        var c = [
            Complex.minus(3, new Complex(1, 2)),
            Complex.minus(new Complex(3, -2), 1),
            Complex.minus(new Complex(3), new Complex(1, 2)),
            Complex.minus(new Complex(3, -2), new Complex(1)),
            Complex.minus(1, 1, new Complex(-3, 2), new Complex(1)),
        ];
        for (var i = 0; i < c.length; i++) {
            var msg = JSON.stringify(c[i]) + " i:" + i;
            should.equal(c[i].re, 2, msg);
            should.equal(c[i].im, -2, msg);
        }
        Complex.minus(3).stringify().should.equal("-3");
        Complex.minus(new Complex(3)).stringify().should.equal("-3");
        Complex.minus(new Complex(0, 3)).stringify().should.equal("-3i");
        Complex.minus(new Complex(2, 3)).stringify().should.equal("-2-3i");
    });
    it("Complex.times(a,b,...) should handle real and complex numbers", function() {
        var c = [
            Complex.times(3, new Complex(1, 2)),
            Complex.times(new Complex(1, 2), 3),
            Complex.times(new Complex(3), new Complex(1, 2)),
            Complex.times(new Complex(1, 2), new Complex(3)),
            Complex.times(2, .5, new Complex(1, 2), new Complex(3)),
        ];
        for (var i = 0; i < c.length; i++) {
            c[i].re.should.equal(3, i);
            c[i].im.should.equal(6, i);
        }
    });
    it("Complex.div(a,b,...) should handle real and complex numbers", function() {
        var c = [
            Complex.div(32, new Complex(4)),
            Complex.div(new Complex(32), 4),
            Complex.div(new Complex(32), new Complex(4, 0)),
            Complex.div(new Complex(32, 0), new Complex(4)),
            Complex.div(32, 1, 2, 2),
        ];
        for (var i = 0; i < c.length; i++) {
            c[i].re.should.equal(8, i);
            c[i].im.should.equal(0, i);
        }
    });
    it("c1.add(c2) should increment a complex number", function() {
        var sum = new Complex();
        var c12 = new Complex(1, 2);
        should.deepEqual(sum.add(c12), new Complex(1, 2));
        should.deepEqual(sum.add(c12), new Complex(2, 4));
        should.deepEqual(sum.add(c12), new Complex(3, 6));
    });
    it("c.sqrt() should return the complex square root", function() {
        should.deepEqual(new Complex(25).sqrt(), new Complex(5));
        should.deepEqual(new Complex(-1).sqrt(), new Complex(0, 1));
        should.deepEqual(new Complex(3, 4).sqrt(), new Complex(2, 1));
        var c21 = new Complex(2, 1);
        should.deepEqual(Complex.times(c21, c21), new Complex(3, 4));
    });
    it("from(xy) should convert to a complex number", function() {
        should.deepEqual(Complex.from(new Complex(1, 2)), new Complex(1, 2));
        should.deepEqual(Complex.from({
            x: 1,
            y: 2
        }), new Complex(1, 2));
    });
    it("c1.isNear(c2,e) should return true if c1 is in neighborhood of c2", function() {
        var c11 = new Complex(1, 1);
        new Complex(1.07, 1.07).isNear(c11, 0.1).should.equal(true);
        new Complex(1.08, 1.08).isNear(c11, 0.1).should.equal(false);
    });
    it("c1.stringify({nPlaces:2}) should return a terse string", function() {
        new Complex().stringify().should.equal("0");
        new Complex(1).stringify().should.equal("1");
        new Complex(0, 1).stringify().should.equal("i");
        new Complex(0, -1).stringify().should.equal("-i");
        new Complex(0, 2).stringify().should.equal("2i");
        new Complex(0, -2).stringify().should.equal("-2i");
        new Complex(1, 1).stringify().should.equal("1+i");
        new Complex(1, -1).stringify().should.equal("1-i");
        new Complex(1, 2).stringify().should.equal("1+2i");
        new Complex(1, -2).stringify().should.equal("1-2i");
        new Complex(1.2345, -5.6789).stringify({
            nPlaces: 1
        }).should.equal("1.2-5.7i");
        new Complex(0.99, 0.99).stringify({
            nPlaces: 1
        }).should.equal("1+i");
        new Complex(0.99, -0.99).stringify({
            nPlaces: 1
        }).should.equal("1-i");
        new Complex(0.99, -0.99).stringify({
            nPlaces: 2
        }).should.equal("0.99-0.99i");
        new Complex().should.have.properties(["stringify"]);
        should(1.).not.have.properties(["stringify"]);
    });
})

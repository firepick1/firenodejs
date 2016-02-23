var should = require("should");

(function(exports) {

    ////////////////// constructor
    function Barycentric3(b1, b2, b3, options) {
        var that = this;

        if (typeof b1 === "number") {
            that.b1 = b1;
            should &&
                b2.should.Number &&
                b3.should.Number;
            that.b2 = b2;
            that.b3 = b3;
        } else {
            var bbb = b1;
            should &&
                bbb.b1.should.Number &&
                bbb.b2.should.Number &&
                bbb.b3.should.Number;
            that.b1 = bbb.b1;
            that.b2 = bbb.b2;
            that.b3 = bbb.b3;
            if (bbb.b4 != null) {
                should && should(bbb.b1 + bbb.b2 + bbb.b3 + bbb.b4).equal(1);
                that.b4 = bbb.b4;
            }
            if (options == null) {
                options = b2;
            }
        }
        that.b4 = 1 - that.b1 - that.b2 - that.b3;
        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    Barycentric3.prototype.minus = function(value) {
        var that = this;
        should &&
            value.b1.should.Number &&
            value.b2.should.Number &&
            value.b3.should.Number &&
            value.b4.should.Number;
        return new Barycentric3(that.b1 - value.b1, that.b2 - value.b2, that.b3 - value.b3, that);
    }
    Barycentric3.prototype.plus = function(value) {
        var that = this;
        should &&
            value.b1.should.Number &&
            value.b2.should.Number &&
            value.b3.should.Number &&
            value.b4.should.Number;
        return new Barycentric3(that.b1 + value.b1, that.b2 + value.b2, that.b3 + value.b3, that);
    }
    Barycentric3.prototype.equal = function(value, tolerance) {
        var that = this;
        if (value == null) {
            that.verbose && console.log("Barycentric3.equal(null) => false");
            return false;
        }
        if (value.b1 == null) {
            that.verbose && console.log("Barycentric3.equal(value.b1 is null) => false");
            return false;
        }
        if (value.b2 == null) {
            that.verbose && console.log("Barycentric3.equal(value.b2 is null) => false");
            return false;
        }
        if (value.b3 == null) {
            that.verbose && console.log("Barycentric3.equal(value.b3 is null) => false");
            return false;
        }
        var valueb4 = value.b4 == null ? (1 - value.b1 - value.b2 - value.b3) : value.b4;
        tolerance = tolerance || 0;
        var result = value.b1 - tolerance <= that.b1 && that.b1 <= value.b1 + tolerance &&
            value.b2 - tolerance <= that.b2 && that.b2 <= value.b2 + tolerance &&
            value.b3 - tolerance <= that.b3 && that.b3 <= value.b3 + tolerance &&
            valueb4 - tolerance <= that.b4 && that.b4 <= valueb4 + tolerance;
        that.verbose && !result && console.log("Barycentric3" + JSON.stringify(that) + ".equal(" + JSON.stringify(value) + ") => false");
        return result;
    }

    module.exports = exports.Barycentric3 = Barycentric3;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Barycentric3", function() {
    var Barycentric3 = require("./Barycentric3");
    it("Barycentric3(1,2,3) should create an Barycentric3 coordinate", function() {
        var bbb = new Barycentric3(1, 2, 3);
        bbb.should.instanceOf(Barycentric3);
        bbb.b1.should.equal(1);
        bbb.b2.should.equal(2);
        bbb.b3.should.equal(3);
        bbb.b4.should.equal(-5);
    })
    it("Barycentric3({b1:1,b2:2,b3:3) should create an Barycentric3 coordinate", function() {
        var bbb = new Barycentric3(1, 2, 3);
        var bbb2 = new Barycentric3(bbb);
        bbb2.should.instanceOf(Barycentric3);
        bbb2.b1.should.equal(1);
        bbb2.b2.should.equal(2);
        bbb2.b3.should.equal(3);
        bbb2.b4.should.equal(-5);
        var bbb3 = new Barycentric3({
            b1: 1,
            b2: 2,
            b3: 3
        });
        bbb2.should.instanceOf(Barycentric3);
        bbb2.b1.should.equal(1);
        bbb2.b2.should.equal(2);
        bbb2.b3.should.equal(3);
    })
    it("equal(value, tolerance) should return true if coordinates are same within tolerance", function() {
        var bbb = new Barycentric3(1, 2, 3);
        var bbb2 = new Barycentric3(bbb);
        bbb.equal(bbb2).should.True;
        bbb2.b1 = bbb.b1 - 0.00001;
        bbb.equal(bbb2).should.False;
        bbb.equal(bbb2, 0.00001).should.True;
        bbb.equal(bbb2, 0.000001).should.False;
        bbb2.b1 = bbb.b1 + 0.00001;
        bbb.equal(bbb2).should.False;
        bbb.equal(bbb2, 0.00001).should.True;
        bbb.equal(bbb2, 0.000001).should.False;
    })
    it("minus(value) should return vector difference", function() {
        var bbb1 = new Barycentric3(1, 2, 3);
        var bbb2 = new Barycentric3(10, 20, 30);
        var bbb3 = bbb1.minus(bbb2);
        bbb3.equal({
            b1: -9,
            b2: -18,
            b3: -27
        }).should.True;
    })
    it("plus(value) should return vector sum", function() {
        var bbb1 = new Barycentric3(1, 2, 3);
        var bbb2 = new Barycentric3(10, 20, 30);
        var bbb3 = bbb1.plus(bbb2);
        bbb3.equal({
            b1: 11,
            b2: 22,
            b3: 33
        }).should.True;
    })
})

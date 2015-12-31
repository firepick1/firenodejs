var should = require("should");
var Mat3x3 = require("./Mat3x3");
var Barycentric3 = require("./Barycentric3");

(function(exports) {

    ////////////////// constructor
    function XYZ(x, y, z, options) {
        var that = this;

        if (typeof x === "number") {
            that.x = x;
            y.should.Number;
            that.y = y;
            z.should.Number;
            that.z = z;
        } else {
            var xyz = x;
            xyz.x.should.Number;
            xyz.y.should.Number;
            xyz.z.should.Number;
            that.x = xyz.x;
            that.y = xyz.y;
            that.z = xyz.z;
            if (options == null) {
                options = y;
            }
        }
        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    XYZ.prototype.normSquared = function() {
        var that = this;
        return that.x * that.x + that.y * that.y + that.z * that.z;
    }
    XYZ.prototype.norm = function() {
        var that = this;
        return Math.sqrt(that.normSquared());
    }
    XYZ.prototype.minus = function(value) {
        var that = this;
        value.x.should.Number;
        value.y.should.Number;
        value.z.should.Number;
        return new XYZ(that.x - value.x, that.y - value.y, that.z - value.z, that);
    }
    XYZ.prototype.plus = function(value) {
        var that = this;
        value.x.should.Number;
        value.y.should.Number;
        value.z.should.Number;
        return new XYZ(that.x + value.x, that.y + value.y, that.z + value.z, that);
    }
    XYZ.prototype.equal = function(value, tolerance) {
        var that = this;
        if (value == null) {
            that.verbose && console.log("XYZ.equal(null) => false");
            return false;
        }
        if (value.x == null) {
            that.verbose && console.log("XYZ.equal(value.x is null) => false");
            return false;
        }
        if (value.y == null) {
            that.verbose && console.log("XYZ.equal(value.y is null) => false");
            return false;
        }
        if (value.z == null) {
            that.verbose && console.log("XYZ.equal(value.z is null) => false");
            return false;
        }
        tolerance = tolerance || 0;
        var result = value.x - tolerance <= that.x && that.x <= value.x + tolerance &&
            value.y - tolerance <= that.y && that.y <= value.y + tolerance &&
            value.z - tolerance <= that.z && that.z <= value.z + tolerance;
        that.verbose && !result && console.log("XYZ"+JSON.stringify(that) + ".equal(" + JSON.stringify(value) + ") => false");
        return result;
    }
    XYZ.prototype.multiply = function(m) {
        var that = this;
        m.should.instanceOf(Mat3x3);
        return new XYZ(
            m.get(0,0)*that.x + m.get(0,1)*that.y + m.get(0,2)*that.z,
            m.get(1,0)*that.x + m.get(1,1)*that.y + m.get(1,2)*that.z,
            m.get(2,0)*that.x + m.get(2,1)*that.y + m.get(2,2)*that.z, that);
    }

    module.exports = exports.XYZ = XYZ;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("XYZ", function() {
    var XYZ = require("./XYZ");
    it("XYZ(1,2,3) should create an XYZ coordinate", function() {
        var xyz = new XYZ(1, 2, 3);
        xyz.should.instanceOf(XYZ);
        xyz.x.should.equal(1);
        xyz.y.should.equal(2);
        xyz.z.should.equal(3);
    })
    it("XYZ({x:1,y:2,z:3) should create an XYZ coordinate", function() {
        var xyz = new XYZ(1, 2, 3);
        var xyz2 = new XYZ(xyz);
        xyz2.should.instanceOf(XYZ);
        xyz2.x.should.equal(1);
        xyz2.y.should.equal(2);
        xyz2.z.should.equal(3);
        var xyz3 = new XYZ({
            x: 1,
            y: 2,
            z: 3
        });
        xyz2.should.instanceOf(XYZ);
        xyz2.x.should.equal(1);
        xyz2.y.should.equal(2);
        xyz2.z.should.equal(3);
    })
    it("equal(value, tolerance) should return true if coordinates are same within tolerance", function() {
        var xyz = new XYZ(1, 2, 3);
        var xyz2 = new XYZ(xyz);
        xyz.equal(xyz2).should.True;
        xyz2.x = xyz.x-0.00001;
        xyz.equal(xyz2).should.False;
        xyz.equal(xyz2,0.00001).should.True;
        xyz.equal(xyz2,0.000001).should.False;
        xyz2.x = xyz.x+0.00001;
        xyz.equal(xyz2).should.False;
        xyz.equal(xyz2,0.00001).should.True;
        xyz.equal(xyz2,0.000001).should.False;
    })
    it("norm() should return true the vector length", function() {
        var e = 0.000001;
        new XYZ(1,2,3).norm().should.within(3.741657-e, 3.741657+e);
        new XYZ(-1,2,3).norm().should.within(3.741657-e, 3.741657+e);
        new XYZ(1,-2,3).norm().should.within(3.741657-e, 3.741657+e);
        new XYZ(1,-2,-3).norm().should.within(3.741657-e, 3.741657+e);
        new XYZ(1,0,1).norm().should.within(1.414213-e, 1.414213+e);
        new XYZ(0,1,1).norm().should.within(1.414213-e, 1.414213+e);
        new XYZ(1,1,0).norm().should.within(1.414213-e, 1.414213+e);
    })
    it("normSquared() should return norm squared", function() {
        var xyz = new XYZ(1,2,3);
        xyz.norm().should.equal(Math.sqrt(xyz.normSquared()));
    })
    it("minus(value) should return vector difference", function() {
        var xyz1 = new XYZ(1,2,3);
        var xyz2 = new XYZ(10,20,30);
        var xyz3 = xyz1.minus(xyz2);
        xyz3.equal({x:-9,y:-18,z:-27}).should.True;
    })
    it("plus(value) should return vector sum", function() {
        var xyz1 = new XYZ(1,2,3);
        var xyz2 = new XYZ(10,20,30);
        var xyz3 = xyz1.plus(xyz2);
        xyz3.equal({x:11,y:22,z:33}).should.True;
    })
})

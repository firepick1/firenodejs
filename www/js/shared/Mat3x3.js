var should = require("should");

(function(exports) {
    function pointDistance2(p1, p2) {
        var dx = p1.x - p2.x;
        var dy = p1.y - p2.y;
        return dx * dx + dy * dy;
    }

    function norm(p) {
        return Math.sqrt(p.x * p.x + p.y * p.y);
    }

    function round(v, scale) {
        return Math.round(v * scale) / scale;
    }

    ////////////////// constructor
    function Mat3x3(array9, options) {
        var that = this;

        options = options || {};
        that.minDeterminant = options.minDeterminant || 1e-10;
        that.verbose = options.verbose;

        that.cells = [];
        if (array9 == null) {
            that.cells = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        } else {
            array9.should.instanceOf(Array);
            array9.length.should.equal(9);
            for (var i = 0; i < 9; i++) {
                that.cells.push(array9[i]).should.instanceOf.Number;
            }
        }

        return that;
    }
    Mat3x3.prototype.get = function(r, c) {
        var that = this;
        r.should.within(0, 2);
        c.should.within(0, 2);
        return that.cells[r * 3 + c];
    }
    Mat3x3.prototype.set = function(r, c, value) {
        var that = this;
        r.should.within(0, 2);
        c.should.within(0, 2);
        return that.cells[r * 3 + c] = value;
    }
    Mat3x3.prototype.clear = function() {
        var that = this;
        for (var i = 9; i-- > 0;) {
            that.cells[i] = 0;
        }
        return that;
    }
    Mat3x3.prototype.det2x2 = function(r, c) {
        var that = this;
        var c1 = c == 0 ? 1 : 0;
        var c2 = c == 2 ? 1 : 2;
        var r1 = r == 0 ? 1 : 0;
        var r2 = r == 2 ? 1 : 2;

        return that.get(r1, c1) * that.get(r2, c2) - that.get(r1, c2) * that.get(r2, c1);
    }
    Mat3x3.prototype.det = function() {
        var that = this;
        return that.get(0, 0) * that.det2x2(0, 0) -
            that.get(0, 1) * that.det2x2(0, 1) +
            that.get(0, 2) * that.det2x2(0, 2);
    }
    Mat3x3.prototype.inverse = function() {
        var that = this;
        var det = that.det();

        if (-that.minDeterminant < det && det < that.minDeterminant) {
            that.verbose && console.log("WARN\t: cannot compute inverse of matrix with determinant:" + det);
            return null;
        }

        var detReciprocal = 1.0 / det;
        var result = new Mat3x3(that.cells);

        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
                if (1 == ((c + r) % 2)) {
                    result.set(r, c, that.det2x2(c, r) * detReciprocal);
                } else {
                    result.set(r, c, -that.det2x2(c, r) * detReciprocal);
                }
            }
        }

        return result;
    }
    Mat3x3.prototype.equal = function(value, tolerance) {
        var that = this;
        if (!(value instanceof(Mat3x3))) {
            return false;
        }
        tolerance = tolerance || 0;
        for (var i=9; i-- > 0; ) {
            if (that.cells[i] < value.cells[i] - tolerance) {
                return false;
            } else if (value.cells[i] + tolerance < that.cells[i] ) {
                return false;
            }
        }
        return true;
    }

    module.exports = exports.Mat3x3 = Mat3x3;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Mat3x3", function() {
    var Mat3x3 = require("./Mat3x3");
    it("Mat3x3(array9) should create a 3x3 matrix", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        mat.should.instanceOf(Mat3x3);
    })
    it("get(row,col) should return matrix value at row and column with given 0-based index", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        mat.get(0, 0).should.equal(1);
        mat.get(0, 1).should.equal(2);
        mat.get(0, 2).should.equal(3);
        mat.get(1, 0).should.equal(4);
        mat.get(1, 1).should.equal(5);
        mat.get(1, 2).should.equal(6);
        mat.get(2, 0).should.equal(7);
        mat.get(2, 1).should.equal(8);
        mat.get(2, 2).should.equal(9);
    })
    it("set(row,col,value) should set matrix value at row and column with given 0-based index", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        mat.set(0, 0, 1).should.equal(1);
        mat.set(0, 1, 2).should.equal(2);
        mat.set(0, 2, 3).should.equal(3);
        mat.set(1, 0, 4).should.equal(4);
        mat.set(1, 1, 5).should.equal(5);
        mat.set(1, 2, 6).should.equal(6);
        mat.set(2, 0, 7).should.equal(7);
        mat.set(2, 1, 8).should.equal(8);
        mat.set(2, 2, 9).should.equal(9);
    })
    it("clear() should zero matrix", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        mat.clear().should.equal(mat);
        mat.get(0, 0).should.equal(0);
        mat.get(0, 1).should.equal(0);
        mat.get(2, 1).should.equal(0);
        mat.get(2, 2).should.equal(0);
    })
    it("det2x2(r,c) should 2x2 sub matrix determinant", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        mat.det2x2(0, 0).should.equal(-3);
        mat.det2x2(0, 1).should.equal(-6);
        mat.det2x2(0, 2).should.equal(-3);
        mat.det2x2(1, 0).should.equal(-6);
        mat.det2x2(1, 1).should.equal(-12);
    })
    it("det() should calculate determinant", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        mat.det().should.equal(0);
    })
    it("equal(value, tolerance) should return true if matrix and value are equal to given tolerance", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        var mat2 = new Mat3x3(mat.cells);
        mat.equal(mat2).should.True;
        mat2.set(0,0, mat.get(0,0)-0.00001);
        mat.equal(mat2).should.False;
        mat.equal(mat2,0.00001).should.True;
        mat.equal(mat2,0.000001).should.False;
        mat2.set(0,0, mat.get(0,0)+0.00001);
        mat.equal(mat2).should.False;
        mat.equal(mat2,0.00001).should.True;
        mat.equal(mat2,0.000001).should.False;
    });
    it("inverse() should return a new inverse matrix or null", function() {
        var mat = new Mat3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        should(mat.inverse()).be.Null; // zero determinant
        mat.set(0,0,0);
        var matInv = mat.inverse();
        matInv.should.instanceOf(Mat3x3);
        matInv.equal(mat,0.0000000000001).should.False;
        var matInvInv = matInv.inverse();
        matInvInv.equal(mat,0.0000000000001).should.True;
    })
})


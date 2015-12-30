
var should = require("should");

(function(exports) {
    function pointDistance2(p1, p2) {
        var dx = p1.x - p2.x;
        var dy = p1.y - p2.y;
        return dx * dx + dy * dy;
    }
    function norm(p) {
        return Math.sqrt(p.x*p.x+p.y*p.y);
    }
    function round(v,scale) {
        return Math.round(v*scale)/scale;
    }

    ////////////////// constructor
    function Mat3x3(array9) {
        var that = this;

        array9.should.instanceOf(Array);
        array9.length.should.equal(9);
        that.cells = [];
        for (var i=0; i<9; i++) {
            that.cells.push(array9[i]).should.instanceOf.Number;
        }

        return that;
    }
    Mat3x3.prototype.at = function(r,c) {
        var that = this;
        r.should.within(0,2);
        c.should.within(0,2);
        return that.cells[r*3 + c];
    }
    Mat3x3.prototype.clear = function() {
        var that = this;
        for (var i=9; i-- > 0; ) {
            that.cells[i] = 0;
        }
        return that;
    }
    Mat3x3.prototype.det2x2 = function(r,c) {
        var that = this;
        var c1 = c == 0 ? 1 : 0;
        var c2 = c == 2 ? 1 : 2;
        var r1 = r == 0 ? 1 : 0;
        var r2 = r == 2 ? 1 : 2;

        return that.at(r1,c1) * that.at(r2,c2) - that.at(r1,c2) * that.at(r2,c1);
    }
    Mat3x3.prototype.det = function() {
        var that = this;
        return that.at(0,0) * that.det2x2(0,0) -
            that.at(0,1) * that.det2x2(0,1) +
            that.at(0,2) * that.det2x2(0,2);
    }

    module.exports = exports.Mat3x3 = Mat3x3;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Mat3x3", function() {
    var Mat3x3 = require("./Mat3x3");
    it("Mat3x3(array9) should create a 3x3 matrix", function() {
        var mat = new Mat3x3([1,2,3,4,5,6,7,8,9]);
        mat.should.instanceOf(Mat3x3);
    })
    it("at(row,col) should return matrix value at row and column with given 0-based index", function() {
        var mat = new Mat3x3([1,2,3,4,5,6,7,8,9]);
        mat.at(0,0).should.equal(1);
        mat.at(0,1).should.equal(2);
        mat.at(0,2).should.equal(3);
        mat.at(1,0).should.equal(4);
        mat.at(1,1).should.equal(5);
        mat.at(1,2).should.equal(6);
        mat.at(2,0).should.equal(7);
        mat.at(2,1).should.equal(8);
        mat.at(2,2).should.equal(9);
    })
    it("clear() should zero matrix", function() {
        var mat = new Mat3x3([1,2,3,4,5,6,7,8,9]);
        mat.clear().should.equal(mat);
        mat.at(0,0).should.equal(0);
        mat.at(0,1).should.equal(0);
        mat.at(2,1).should.equal(0);
        mat.at(2,2).should.equal(0);
   })
    it("det2x2(r,c) should 2x2 sub matrix determinant", function() {
        var mat = new Mat3x3([1,2,3,4,5,6,7,8,9]);
        mat.det2x2(0,0).should.equal(-3);
        mat.det2x2(0,1).should.equal(-6);
        mat.det2x2(0,2).should.equal(-3);
        mat.det2x2(1,0).should.equal(-6);
        mat.det2x2(1,1).should.equal(-12);
   })
    it("det() should calculate determinant", function() {
        var mat = new Mat3x3([1,2,3,4,5,6,7,8,9]);
        mat.det().should.equal(0);
    })
})

/*
typedef class Mat3x3 {
    private:
        double mat[3][3];

    public:
                   -  ( mat[y1][x2] * mat[y2][x1] );
        }
        inline double det3x3() {
            return mat[0][0] * det2x2(0,0) - mat[0][1] * det2x2(0,1) + mat[0][2] * det2x2(0,2);
        }
        bool inverse(Mat3x3 &matInv);
        friend bool operator==(const Mat3x3& lhs, const Mat3x3& rhs);
        friend ostream& operator<<(ostream& os, const Mat3x3& that);
} Mat3x3;
*/

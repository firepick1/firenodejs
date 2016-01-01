var should = require("should");
var Logger = require("./Logger");
var Mat3x3 = require("./Mat3x3");
var XYZ = require("./XYZ");
var Barycentric3 = require("./Barycentric3");

(function(exports) {
    ////////////////// constructor
    function Tetrahedron(t1, t2, t3, t4, options) {
        var that = this;

        if (t1 instanceof Array) {
            t1.length.should.equal(4);
            that.t = [t1[0], t1[1], t1[2], t1[3]];
            options = t2;
            should(t3 == null).True;
        } else {
            t1 = XYZ.of(t1, true);
            t2 = XYZ.of(t2, true);
            t3 = XYZ.of(t3, true);
            t4 = XYZ.of(t4, true);
            that.t = [t1, t2, t3, t4];
        }
        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    Tetrahedron.prototype.contains = function(xyz) {
        var that = this;
        var b = that.toBarycentric(xyz);
        return 0<=b.b1 && b.b1<=1 && 0<=b.b2 && b.b2<=1 && 0<=b.b3 && b.b3<=1;
    }
    Tetrahedron.prototype.toBarycentric = function(xyz) {
        var that = this;
        var t = that.t;
        var matInv = that.matInv;
        if (that.mat == null) {
            mat = new Mat3x3([
                t[0].x - t[3].x, t[1].x - t[3].x, t[2].x - t[3].x,
                t[0].y - t[3].y, t[1].y - t[3].y, t[2].y - t[3].y,
                t[0].z - t[3].z, t[1].z - t[3].z, t[2].z - t[3].z
            ]);
            that.mat = mat;
            that.matInv = matInv = mat.inverse();
            that.matInv = matInv;
        }
        if (matInv == null) {
            return null;
        }
        var diff = xyz.minus(t[3]);
        var b = diff.multiply(matInv);
        return new Barycentric3(b.x, b.y, b.z, that);
    }
    Tetrahedron.prototype.toXYZ = function(bbb) {
        var that = this;
        var t = that.t;
        var b4 = 1 - bbb.b1 - bbb.b2 - bbb.b3;
        var x = bbb.b1 * t[0].x + bbb.b2 * t[1].x + bbb.b3 * t[2].x + b4 * t[3].x;
        var y = bbb.b1 * t[0].y + bbb.b2 * t[1].y + bbb.b3 * t[2].y + b4 * t[3].y;
        var z = bbb.b1 * t[0].z + bbb.b2 * t[1].z + bbb.b3 * t[2].z + b4 * t[3].z;
        return new XYZ(x, y, z, that);
    }
    Tetrahedron.prototype.bounds = function() {
        var that = this;
        var t = that.t;
        return {
            min: new XYZ(
                Math.min(Math.min(t[0].x,t[1].x), Math.min(t[2].x,t[3].x)),
                Math.min(Math.min(t[0].y,t[1].y), Math.min(t[2].y,t[3].y)),
                Math.min(Math.min(t[0].z,t[1].z), Math.min(t[2].z,t[3].z))
            ),
            max: new XYZ(
                Math.max(Math.max(t[0].x,t[1].x), Math.max(t[2].x,t[3].x)),
                Math.max(Math.max(t[0].y,t[1].y), Math.max(t[2].y,t[3].y)),
                Math.max(Math.max(t[0].z,t[1].z), Math.max(t[2].z,t[3].z))
            )
        };
    }

    module.exports = exports.Tetrahedron = Tetrahedron;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Tetrahedron", function() {
    var Tetrahedron = require("./Tetrahedron");
    var logger = new Logger({logLevel:"info"});
    var t1 = new XYZ(1, 1, 1);
    var t2 = new XYZ(2, 1, 1);
    var t3 = new XYZ(1, 2, 1);
    var t4 = new XYZ(1, 1, 2);
    it("Tetrahedron(t1,t2,t3,t4) should create a Tetrahedron", function() {
        var tetra = new Tetrahedron(t1, t2, t3, t4);
        tetra.should.instanceOf(Tetrahedron);
        tetra.t[0].equal(t1).should.True;
        tetra.t[1].equal(t2).should.True;
        tetra.t[2].equal(t3).should.True;
        tetra.t[3].equal(t4).should.True;
    })
    it("toBarycentric(xyz,options) should return the barycentric coordinates of given cartesian point", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4]);
        var opts = {
            verbose: true
        };
        var pts = [
            new XYZ(1, 1, 1, opts),
            new XYZ(1, 1, 1, opts),
            new XYZ(2, 1, 1, opts),
            new XYZ(1, 2, 1, opts),
            new XYZ(1, 1, 2, opts),
            new XYZ(1.1, 1, 1, opts),
            new XYZ(.9, 1, 1, opts),
            new XYZ(1, .9, 1, opts),
            new XYZ(1, 1, .9, opts),
        ];
        var e = 0.000000000000001;
        tetra.toXYZ(tetra.toBarycentric(pts[0])).equal(pts[0], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[1])).equal(pts[1], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[2])).equal(pts[2], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[3])).equal(pts[3], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[4])).equal(pts[4], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[5])).equal(pts[5], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[6])).equal(pts[6], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[7])).equal(pts[7], e).should.True;
        tetra.toXYZ(tetra.toBarycentric(pts[8])).equal(pts[8], e).should.True;
    });
    it("contains(xyz) returns true if xyz is within tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4]);
        tetra.contains(t1).should.True;
        tetra.contains(t2).should.True;
        tetra.contains(t3).should.True;
        tetra.contains(t4).should.True;
        tetra.contains(new XYZ(0.9999999999999999,1,1)).should.False;
        tetra.contains(new XYZ(1.1,1.1,1.1)).should.True;
        tetra.contains(new XYZ(1,1,2.000000000000001)).should.False;
    });
    it("bounds() returns xyz bounding box of tetrahedron", function() {
        var tetra = new Tetrahedron([
            new XYZ(1.01,1.02,1.03),
            new XYZ(2.11,1.12,1.13), 
            new XYZ(1.21,2.22,1.23), 
            new XYZ(1.31,1.32,2.33)
        ]);
        var bounds = tetra.bounds();
        logger.debug(bounds);
        bounds.min.equal(new XYZ(1.01,1.02,1.03)).should.True;
        bounds.max.equal(new XYZ(2.11,2.22,2.33)).should.True;
    });
})

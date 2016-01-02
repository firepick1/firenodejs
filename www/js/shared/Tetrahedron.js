var should = require("should");
var Logger = require("./Logger");
var Mat3x3 = require("./Mat3x3");
var XYZ = require("./XYZ");
var Barycentric3 = require("./Barycentric3");
    

(function(exports) {
    var verboseLogger = new Logger({logLevel:"debug"});

    ////////////////// constructor
    function Tetrahedron(t1, t2, t3, t4, options) {
        var that = this;

        if (t1 instanceof Array) {
            t1.length.should.equal(4);
            that.t = [t1[0], t1[1], t1[2], t1[3]];
            options = t2 || {};
            should(t3 == null).True;
        } else {
            options = options || {};
            that.t = [t1, t2, t3, t4];
        }
        var strict = {
            strict: true,
            verbose: options.verbose
        }
        for (var i = 0; i < 4; i++) {
            that.t[i] = XYZ.of(that.t[i], strict);
        }
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    Tetrahedron.prototype.contains = function(xyz) {
        var that = this;
        var b = that.toBarycentric(xyz);
        return 0 <= b.b1 && b.b1 <= 1 && 0 <= b.b2 && b.b2 <= 1 && 0 <= b.b3 && b.b3 <= 1;
    }
    Tetrahedron.prototype.baseInRadius = function() {
        var that = this;
        var t = that.t;
        var a = t[0].minus(t[1]).norm();
        var b = t[1].minus(t[2]).norm();
        var c = t[2].minus(t[0]).norm();
        return 2*that.baseArea()/(a+b+c);
    }
    Tetrahedron.prototype.baseArea = function() {
        var that = this;
        var t = that.t;
        var a = t[0].minus(t[1]).norm();
        var b = t[1].minus(t[2]).norm();
        var c = t[2].minus(t[0]).norm();
        var s = (a+b+c)/2;
        return Math.sqrt(s*(s-a)*(s-b)*(s-c));
    }
    Tetrahedron.prototype.height = function() {
        var that = this;
        return that.volume() * 3 / that.baseArea();
    }
    Tetrahedron.prototype.skewness = function() {
        var that = this;
        var t = that.t;
        var d30 = t[3].minus(t[0]).norm();
        var d31 = t[3].minus(t[1]).norm();
        var d32 = t[3].minus(t[2]).norm();
        var dmax = Math.max(d30, Math.max(d31,d32));
        var davg = (d30+d31+d32)/3;
        var v = that.volume();
        var rin = that.baseInRadius();
        var ba = that.baseArea();
        var optimalVolume = Math.sqrt(dmax * dmax - rin*rin) * ba / 3; 
        verboseLogger.info("skewnewss: ", {d30:d30,d31:d31,d32:d32,davg:davg,v:v,dmax,rin:rin,ba:ba,ov:optimalVolume});
        return (optimalVolume - v)/optimalVolume;
    }
    Tetrahedron.prototype.volume = function() {
        var that = this;
        var t = that.t;
        var t03 = t[0].minus(t[3]);
        var t13 = t[1].minus(t[3]);
        var t23 = t[2].minus(t[3]);
        var tcross = t13.cross(t23);
        var tdot = t03.dot(tcross);
        verboseLogger.info("volume t03:",t03," t13:",t13," tdot:",tdot," tcross:",tcross);
        return Math.abs(tdot) / 6;
    }
    Tetrahedron.prototype.centroid = function() {
        var that = this;
        var t = that.t;
        if (that._centroid == null) {
            var x = (t[0].x + t[1].x + t[2].x + t[3].x) / 4;
            var y = (t[0].y + t[1].y + t[2].y + t[3].y) / 4;
            var z = (t[0].z + t[1].z + t[2].z + t[3].z) / 4;
            that._centroid = new XYZ(x, y, z, that);
        }
        return that._centroid;
    }
    Tetrahedron.prototype.toBarycentric = function(xyz) {
        var that = this;
        var t = that.t;
        var matInv = that.matInv;
        if (matInv == null) {
            mat = new Mat3x3([
                t[0].x - t[3].x, t[1].x - t[3].x, t[2].x - t[3].x,
                t[0].y - t[3].y, t[1].y - t[3].y, t[2].y - t[3].y,
                t[0].z - t[3].z, t[1].z - t[3].z, t[2].z - t[3].z
            ]);
            that.matInv = matInv = mat.inverse();
        }
        if (matInv == null) {
            return null;
        }
        var diff = XYZ.of(xyz, that).minus(t[3]);
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
                Math.min(Math.min(t[0].x, t[1].x), Math.min(t[2].x, t[3].x)),
                Math.min(Math.min(t[0].y, t[1].y), Math.min(t[2].y, t[3].y)),
                Math.min(Math.min(t[0].z, t[1].z), Math.min(t[2].z, t[3].z))
            ),
            max: new XYZ(
                Math.max(Math.max(t[0].x, t[1].x), Math.max(t[2].x, t[3].x)),
                Math.max(Math.max(t[0].y, t[1].y), Math.max(t[2].y, t[3].y)),
                Math.max(Math.max(t[0].z, t[1].z), Math.max(t[2].z, t[3].z))
            )
        };
    }

    module.exports = exports.Tetrahedron = Tetrahedron;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Tetrahedron", function() {
    var Tetrahedron = require("./Tetrahedron");
    var logger = new Logger({
        logLevel: "info"
    });
    var t1 = new XYZ(1, 1, 1);
    var t2 = new XYZ(2, 1, 1);
    var t3 = new XYZ(1, 2, 1);
    var t4 = new XYZ(1, 1, 2);
    var t5 = new XYZ(1.5, 1.5, 2);
    var options = {
        verbose: true
    };
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
        var bary = [
            tetra.toBarycentric(pts[0]),
            tetra.toBarycentric(pts[1]),
            tetra.toBarycentric(pts[2]),
            tetra.toBarycentric(pts[3]),
            tetra.toBarycentric(pts[4]),
            tetra.toBarycentric(pts[5]),
            tetra.toBarycentric(pts[6]),
            tetra.toBarycentric(pts[7]),
            tetra.toBarycentric(pts[8]),
        ];
        logger.info(bary);
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
        tetra.contains(new XYZ(0.9999999999999999, 1, 1)).should.False;
        tetra.contains(new XYZ(1.1, 1.1, 1.1)).should.True;
        tetra.contains(new XYZ(1, 1, 2.000000000000001)).should.False;
        var tetra2 = new Tetrahedron([t3, t2, t1, t4]);
        tetra2.contains(t1).should.True;
        tetra2.contains(t2).should.True;
        tetra2.contains(t3).should.True;
        tetra2.contains(t4).should.True;
        tetra2.contains(new XYZ(0.9999999999999999, 1, 1)).should.False;
        tetra2.contains(new XYZ(1.1, 1.1, 1.1)).should.True;
        tetra2.contains(new XYZ(1, 1, 2.000000000000001)).should.False;
        var tetra3 = new Tetrahedron([t4, t2, t1, t3]);
        tetra3.contains(t1).should.True;
        tetra3.contains(t2).should.True;
        tetra3.contains(t3).should.True;
        tetra3.contains(t4).should.True;
        tetra3.contains(new XYZ(0.9999999999999999, 1, 1)).should.False;
        tetra3.contains(new XYZ(1.1, 1.1, 1.1)).should.True;
        tetra3.contains(new XYZ(1, 1, 2.000000000000001)).should.False;
    });
    it("bounds() returns xyz bounding box of tetrahedron", function() {
        var tetra = new Tetrahedron([
            new XYZ(1.01, 1.02, 1.03),
            new XYZ(1.21, 2.22, 1.23),
            new XYZ(1.31, 1.32, 2.33),
            new XYZ(2.11, 1.12, 1.13),
        ]);
        var bounds = tetra.bounds();
        logger.debug(bounds);
        bounds.min.equal(new XYZ(1.01, 1.02, 1.03)).should.True;
        bounds.max.equal(new XYZ(2.11, 2.22, 2.33)).should.True;

        var ta = [
            //new XYZ(43.3, 0, -25, options),
            //new XYZ(54.13, 6.25, -37.5, options),
            //new XYZ(54.13, -6.26, -37.5, options),
            //new XYZ(54.13, -6.25, -25, options),
            new XYZ(54.13, -6.26, -37.5, options),
            new XYZ(54.13, -6.25, -25, options),
            new XYZ(43.3, 0, -25, options),
            new XYZ(54.13, 6.25, -37.5, options),
        ];
        logger.info("norm03:",ta[0].minus(ta[3]).norm());
        logger.info("norm13:",ta[1].minus(ta[3]).norm());
        logger.info("norm23:",ta[2].minus(ta[3]).norm());
        var tetra_ta = new Tetrahedron(ta, options);
        var bounds_ta = tetra_ta.bounds();
        logger.info("ta bounds:", bounds_ta);
        logger.info("ta t:", tetra_ta.t);
        var xyz = new XYZ(50, 5, -40, options);
        var bary = tetra_ta.toBarycentric(xyz);
        logger.info("ta barycentric:", bary);
        tetra_ta.toXYZ(bary).equal(xyz).should.True;
        xyz.x.should.within(bounds_ta.min.x, bounds_ta.max.x);
        xyz.y.should.within(bounds_ta.min.y, bounds_ta.max.y);
        xyz.z.should.not.within(bounds_ta.min.z, bounds_ta.max.z);
        tetra_ta.contains(xyz).should.False;
    });
    it("volume() returns the volume tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.volume().should.within(0.1666-e,0.1666+e);
    });
    it("height() returns height of tetrahedron from base", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.height().should.within(1-e,1+e);
    });
    it("baseArea() returns area of tetrahedron base", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.baseArea().should.within(0.5-e,0.5+e);
    });
    it("centroid() returns the XYZ centroid of the tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        tetra.centroid().equal({
            x: 1.25,
            y: 1.25,
            z: 1.25
        }).should.True;
        logger.info(tetra.toBarycentric({
            x: 1.5,
            y: 1.5,
            z: 1.5
        }));
    });
    it("skewness() returns skewness of tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.skewness().should.within(0.2772-e,0.2772+e);
        var bad = [
            new XYZ(43.3, 0, -25, options),
            new XYZ(54.13, 6.25, -37.5, options),
            new XYZ(54.13, -6.26, -37.5, options),
            new XYZ(54.13, -6.25, -25, options),
        ];
        var tetra_bad = new Tetrahedron(bad, options);
        tetra_bad.skewness().should.within(0.5225-e,0.5225+e);

        var nottoobad = [
            new XYZ(54.13, -6.26, -37.5, options),
            new XYZ(54.13, -6.25, -25, options),
            new XYZ(43.3, 0, -25, options),
            new XYZ(54.13, 6.25, -37.5, options),
        ];
        var tetra_nottoobad = new Tetrahedron(nottoobad, options);
        tetra_nottoobad.skewness().should.within(0.3736-e,0.3736+e);
    });
})

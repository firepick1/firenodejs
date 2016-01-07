var should = require("should");
var Logger = require("./Logger");
var Mat3x3 = require("./Mat3x3");
var XYZ = require("./XYZ");
var Barycentric3 = require("./Barycentric3");


(function(exports) {
    var SQRT2 = Math.sqrt(2);
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

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
        if (options.maxSkewness != null) {
            that.maxSkewness = options.maxSkewness;
            var minskew = that.skewness();
            if (minskew > that.maxSkewness) {
                var perm0 = that.t;
                var tmin = that.t;
                for (var p = 1; p < 24; p++) {
                    that.t = permute4(perm0, p);
                    that.invalidate();
                    var skew = that.skewness();
                    if (0 <= skew && skew <= 1 && skew < minskew) {
                        tmin = that.t;
                        minskew = skew;
                    }
                    if (skew < that.maxSkewness) {
                        break;
                    }
                }
                that.t = tmin;
                that.invalidate();
            }
        }

        return that;
    }
    Tetrahedron.prototype.vertices = function() {
        var that = this;
        var t = that.t;
        var scale = 10;
        return [
            [
                Math.round(t[0].x * scale) / scale,
                Math.round(t[0].y * scale) / scale,
                Math.round(t[0].z * scale) / scale,
            ],
            [
                Math.round(t[1].x * scale) / scale,
                Math.round(t[1].y * scale) / scale,
                Math.round(t[1].z * scale) / scale,
            ],
            [
                Math.round(t[2].x * scale) / scale,
                Math.round(t[2].y * scale) / scale,
                Math.round(t[2].z * scale) / scale,
            ],
            [
                Math.round(t[3].x * scale) / scale,
                Math.round(t[3].y * scale) / scale,
                Math.round(t[3].z * scale) / scale,
            ]
        ];
    }
    Tetrahedron.prototype.interpolate = function(x, y, z, propName, vertexValue) {
        var that = this;
        var t = that.t;
        var xyz;
        if (typeof x === "number") {
            xyz = {
                x: x,
                y: y,
                z: z
            };
            y.should.Number;
            z.should.Number;
        } else {
            x.should.Object;
            xyz = x;
            xyz.x.should.Number;
            xyz.y.should.Number;
            xyz.z.should.Number;
            propName = propName || y;
            vertexValue = vertexValue || z;
        }
        var b = that.toBarycentric(xyz);
        vertexValue = vertexValue || function(xyz, propName) {
            return xyz.hasOwnProperty(propName) ? xyz[propName] : 0;
        }
        return b.b1 * vertexValue(t[0], propName) +
            b.b2 * vertexValue(t[1], propName) +
            b.b3 * vertexValue(t[2], propName) +
            b.b4 * vertexValue(t[3], propName);
    }
    Tetrahedron.prototype.contains = function(xyz) {
        var that = this;
        var b = that.toBarycentric(xyz);
        if (b.b1 < 0 || 1 < b.b1) {
            return false;
        }
        if (b.b2 < 0 || 1 < b.b2) {
            return false;
        }
        if (b.b3 < 0 || 1 < b.b3) {
            return false;
        }
        if (b.b4 < 0 || 1 < b.b4) {
            return false;
        }
        return true;
    }
    Tetrahedron.prototype.baseInRadius = function() {
        var that = this;
        if (that._baseInRadius == null) {
            var t = that.t;
            var a = t[0].minus(t[1]).norm();
            var b = t[1].minus(t[2]).norm();
            var c = t[2].minus(t[0]).norm();
            that._baseInRadius = 2 * that.baseArea() / (a + b + c);
        }
        return that._baseInRadius;
    }
    Tetrahedron.prototype.invalidate = function() {
        var that = this;
        delete that._baseInRadius;
        delete that._baseArea;
        delete that._skewness;
        delete that._volume;
        delete that._centroid;
        delete that._bounds;
    }
    Tetrahedron.prototype.baseArea = function() {
        var that = this;
        if (that._baseArea == null) {
            var t = that.t;
            var a = t[0].minus(t[1]).norm();
            var b = t[1].minus(t[2]).norm();
            var c = t[2].minus(t[0]).norm();
            var s = (a + b + c) / 2;
            that._baseArea = Math.sqrt(s * (s - a) * (s - b) * (s - c));
        }
        return that._baseArea;
    }
    Tetrahedron.prototype.height = function() {
        var that = this;
        return that.volume() * 3 / that.baseArea();
    }
    Tetrahedron.prototype.skewness = function() {
        var that = this;
        if (that._skewness == null) {
            var t = that.t;
            var d30 = t[3].minus(t[0]).norm();
            var d31 = t[3].minus(t[1]).norm();
            var d32 = t[3].minus(t[2]).norm();
            var d01 = t[0].minus(t[1]).norm();
            var d12 = t[1].minus(t[2]).norm();
            var d20 = t[2].minus(t[0]).norm();
            var davg = (d30 + d31 + d32 + d01 + d12 + d20) / 6;
            var v = that.volume();
            var rin = that.baseInRadius();
            var ba = that.baseArea();
            var optimalVolume = Math.sqrt(davg * davg - rin * rin) * ba / 3;
            //that.verbose && verboseLogger.debug("skewness: ", {d30:d30,d31:d31,d32:d32,davg:davg,v:v,dmax,rin:rin,ba:ba,ov:optimalVolume});
            that._skewness = (optimalVolume - v) / optimalVolume;
        }
        return that._skewness;
    }
    Tetrahedron.prototype.volume = function() {
        var that = this;
        if (that._volume == null) {
            var t = that.t;
            var t03 = t[0].minus(t[3]);
            var t13 = t[1].minus(t[3]);
            var t23 = t[2].minus(t[3]);
            var tcross = t13.cross(t23);
            var tdot = t03.dot(tcross);
            //that.verbose && verboseLogger.info("volume t03:",t03," t13:",t13," tdot:",tdot," tcross:",tcross);
            that._volume = Math.abs(tdot) / 6;
        }
        return that._volume;
    }
    Tetrahedron.prototype.centroid = function() {
        var that = this;
        if (that._centroid == null) {
            var t = that.t;
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
        if (!matInv) {
            that.matInv = false;
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
    Tetrahedron.prototype.zMin = function() {
        var that = this;
        var t = that.t;
        return Math.min(Math.min(t[0].z, t[1].z), Math.min(t[2].z, t[3].z));
    }
    Tetrahedron.prototype.zMax = function() {
        var that = this;
        var t = that.t;
        return Math.max(Math.max(t[0].z, t[1].z), Math.max(t[2].z, t[3].z));
    }
    Tetrahedron.prototype.bounds = function() {
            var that = this;
            if (that._bounds == null) {
                var t = that.t;
                that._bounds = {
                    min: new XYZ(
                        Math.min(Math.min(t[0].x, t[1].x), Math.min(t[2].x, t[3].x)),
                        Math.min(Math.min(t[0].y, t[1].y), Math.min(t[2].y, t[3].y)),
                        that.zMin()
                    ),
                    max: new XYZ(
                        Math.max(Math.max(t[0].x, t[1].x), Math.max(t[2].x, t[3].x)),
                        Math.max(Math.max(t[0].y, t[1].y), Math.max(t[2].y, t[3].y)),
                        that.zMax()
                    )
                };
            }
            return that._bounds;
        }
        ////////////// CLASS

    Tetrahedron.baseInRadiusToHeight = function(rIn) {
        return 2 * rIn * SQRT2; // regular tetrahedron
    }
    Tetrahedron.baseOutRadiusToHeight = function(rOut) {
        return rOut * SQRT2; // regular tetrahedron
    }
    Tetrahedron.heightToBaseOutRadius = function(h) {
        return h / SQRT2; // regular tetrahedron
    }
    Tetrahedron.heightToBaseInRadius = function(h) {
        return h / SQRT2 / 2; // regular tetrahedron
    }

    ////////////// PRIVATE
    function permute4(t, p) {
        switch (p) {
            default:
                case 0:
                return t;
            case 1:
                    return [t[0], t[1], t[3], t[2]];
            case 2:
                    return [t[0], t[2], t[1], t[3]];
            case 3:
                    return [t[0], t[2], t[3], t[1]];
            case 4:
                    return [t[0], t[3], t[1], t[2]];
            case 5:
                    return [t[0], t[3], t[2], t[1]];

            case 6:
                    return [t[1], t[0], t[2], t[3]];
            case 7:
                    return [t[1], t[0], t[3], t[2]];
            case 8:
                    return [t[1], t[2], t[0], t[3]];
            case 9:
                    return [t[1], t[2], t[3], t[0]];
            case 10:
                    return [t[1], t[3], t[0], t[2]];
            case 11:
                    return [t[1], t[3], t[2], t[0]];

            case 12:
                    return [t[2], t[0], t[1], t[3]];
            case 13:
                    return [t[2], t[0], t[3], t[1]];
            case 14:
                    return [t[2], t[1], t[2], t[3]];
            case 15:
                    return [t[2], t[1], t[3], t[2]];
            case 16:
                    return [t[2], t[2], t[1], t[3]];
            case 17:
                    return [t[2], t[2], t[3], t[1]];

            case 18:
                    return [t[3], t[0], t[1], t[2]];
            case 19:
                    return [t[3], t[0], t[2], t[1]];
            case 20:
                    return [t[3], t[1], t[0], t[2]];
            case 21:
                    return [t[3], t[1], t[2], t[0]];
            case 22:
                    return [t[3], t[2], t[0], t[1]];
            case 23:
                    return [t[3], t[2], t[1], t[0]];
        }
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
        logger.trace(bary);
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

        var tricky = [
            new XYZ({
                x: 54.13,
                y: -6.25,
                z: -37.5
            }, options),
            new XYZ({
                x: 43.3,
                y: 12.5,
                z: -37.5,
                verbose: true
            }, options),
            new XYZ({
                x: 54.13,
                y: 6.25,
                z: -37.5,
                verbose: true
            }, options),
            new XYZ({
                x: 43.3,
                y: 0,
                z: -25,
                verbose: true
            }, options),
        ];
        var tetra_tricky = new Tetrahedron(tricky, options);
        var bounds_tricky = tetra_tricky.bounds();
        var xyz = new XYZ(50, 5, -40, options);
        var bary = tetra_tricky.toBarycentric(xyz);
        tetra_tricky.toXYZ(bary).equal(xyz).should.True;
        xyz.x.should.within(bounds_tricky.min.x, bounds_tricky.max.x);
        xyz.y.should.within(bounds_tricky.min.y, bounds_tricky.max.y);
        xyz.z.should.not.within(bounds_tricky.min.z, bounds_tricky.max.z);
        tetra_tricky.contains(xyz).should.False;
    });
    it("volume() returns the volume tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.volume().should.within(0.1666 - e, 0.1666 + e);
    });
    it("height() returns height of tetrahedron from base", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.height().should.within(1 - e, 1 + e);
    });
    it("baseArea() returns area of tetrahedron base", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.baseArea().should.within(0.5 - e, 0.5 + e);
    });
    it("centroid() returns the XYZ centroid of the tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        tetra.centroid().equal({
            x: 1.25,
            y: 1.25,
            z: 1.25
        }).should.True;
        logger.trace(tetra.toBarycentric({
            x: 1.5,
            y: 1.5,
            z: 1.5
        }));
    });
    it("skewness() returns skewness of tetrahedron", function() {
        var tetra = new Tetrahedron([t1, t2, t3, t4], options);
        var e = 0.0001;
        tetra.skewness().should.within(0.1461 - e, 0.1461 + e);
        var bad = [
            new XYZ(43.3, 0, -25, options),
            new XYZ(54.13, 6.25, -37.5, options),
            new XYZ(54.13, -6.26, -37.5, options),
            new XYZ(54.13, -6.25, -25, options),
        ];
        var tetra_bad = new Tetrahedron(bad, options);
        tetra_bad.skewness().should.within(0.4340 - e, 0.4340 + e);

        var nottoobad = [
            new XYZ(54.13, -6.26, -37.5, options),
            new XYZ(54.13, -6.25, -25, options),
            new XYZ(43.3, 0, -25, options),
            new XYZ(54.13, 6.25, -37.5, options),
        ];
        var tetra_nottoobad = new Tetrahedron(nottoobad, options);
        tetra_nottoobad.skewness().should.within(0.2600 - e, 0.2600 + e);
    });
    it("Tetrahedron(...,{maxSkewness:0.3}) orients tetrahedron vertices for reducing skewness", function() {
        var bad = [
            new XYZ(43.3, 0, -25, options),
            new XYZ(54.13, 6.25, -37.5, options),
            new XYZ(54.13, -6.26, -37.5, options),
            new XYZ(54.13, -6.25, -25, options),
        ];
        var e = 0.0001;
        var maxSkewness = 0.1;
        var tetra_bad = new Tetrahedron(bad, {
            verbose: true,
            maxSkewness: maxSkewness,
        });
        tetra_bad.skewness().should.within(0.2600 - e, 0.2600 + e);
        tetra_bad.maxSkewness.should.equal(maxSkewness);
    });
    it("Tetrahedron.heightToBaseOutRadius(h) returns base circumcircle radius of regular tetrahedron with given height", function() {
        var e = 0.0001;
        var rbase = Tetrahedron.heightToBaseOutRadius(1);
        rbase.should.within(0.7071 - e, 0.7071 + e);
        var xbase = rbase * Math.sin(Math.PI / 3);
        var ybase = rbase * Math.cos(Math.PI / 3);
        var t0 = new XYZ(0, rbase, 0, options);
        var t1 = new XYZ(xbase, -ybase, 0, options);
        var t2 = new XYZ(-xbase, -ybase, 0, options);
        var t3 = new XYZ(0, 0, 1, options);
        var side = 1.2247;
        // regular tetrahedron of height 1
        t0.minus(t1).norm().should.within(side - e, side + e);
        t0.minus(t2).norm().should.within(side - e, side + e);
        t1.minus(t2).norm().should.within(side - e, side + e);
        t0.minus(t3).norm().should.within(side - e, side + e);
        t1.minus(t3).norm().should.within(side - e, side + e);
        t2.minus(t3).norm().should.within(side - e, side + e);
        Tetrahedron.heightToBaseInRadius(1).should.equal(rbase / 2);
        Tetrahedron.baseInRadiusToHeight(rbase / 2).should.equal(1);
        Tetrahedron.baseOutRadiusToHeight(rbase).should.equal(1);
    });
    it("Tetrahedron.interpolate(xyz,propName,vertexValue) interpolates vertex property values", function() {
        var v1 = new XYZ(1, 1, 1);
        var v2 = new XYZ(2, 1, 1);
        var v3 = new XYZ(1, 2, 1);
        var v4 = new XYZ(1, 1, 2);
        v1.temp = 61;
        v2.temp = 62;
        v3.temp = 63;
        v4.temp = 64;
        var tetra = new Tetrahedron(v1, v2, v3, v4, options);
        var x1y1z1 = new XYZ(1, 1, 1, options);

        // default callback assumes vertex is decorated with desired properties
        tetra.interpolate(x1y1z1, "temp").should.equal(v1.temp);
        tetra.interpolate(2, 1, 1, "temp").should.equal(v2.temp);
        tetra.interpolate(1, 2, 1, "temp").should.equal(v3.temp);
        tetra.interpolate(1, 1, 2, "temp").should.equal(v4.temp);
        tetra.interpolate(1.25, 1.25, 1.25, "temp").should.equal(62.5);
        tetra.interpolate(1.25, 1.25, 1, "temp").should.equal(61.75);
        tetra.interpolate(1.4, 1.4, 1.4, "temp").should.equal(63.4);
        tetra.interpolate(3, 1, 1, "temp").should.equal(63);
        tetra.interpolate(1, 3, 1, "temp").should.equal(65);
        tetra.interpolate(1, 1, 3, "temp").should.equal(67);

        // default vertex value is zero
        v1.humidity = 50;
        tetra.interpolate(1, 1, 1, "humidity").should.equal(50);
        tetra.interpolate(2, 1, 1, "humidity").should.equal(0);
        tetra.interpolate(1, 2, 1, "humidity").should.equal(0);
        tetra.interpolate(1, 1, 2, "humidity").should.equal(0);

        // custom callback
        function vertexValue64(xyz, propName) {
            return xyz.hasOwnProperty(propName) ? xyz[propName] : 64;
        }
        tetra.interpolate(1, 1, 2, "humidity", vertexValue64).should.equal(64);
        tetra.interpolate(1, 1, 3, "humidity", vertexValue64).should.equal(78);
    });
})

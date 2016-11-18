/*
 * KinematicC3 
 * ===========
 * Kinematic model for 3-axis cartesian robot handles:
 * 1) skewed y-axis 
 * 2) non-level bed plane relative coordinates 
 */
(function(exports) {
    ////////////////// constructor
    function KinematicC3(options = {}) {
        var that = this;

        that.mmMicrosteps = options.mmMicrosteps || {
            x: KinematicC3.pulleyMmMicrosteps(),
            y: KinematicC3.pulleyMmMicrosteps(),
            z: KinematicC3.pulleyMmMicrosteps(),
        };
        that.bedPlane(options.bedPlane || new Plane());
        that.ySkew(options.ySkew || [{
            x: 0,
            y: 1
        }, {
            x: 0,
            y: 0
        }]);

        return that;
    }

    ///////////////// KinematicC3 instance
    KinematicC3.prototype.ySkew = function(p1, p2) {
        var that = this;
        if (p1 instanceof Array) {
            p2 = p1[1];
            p1 = p1[0];
        }
        if (p1 && typeof p1.x === "number") {
            var dx = p2.x - p1.x;
            var dy = p2.y - p1.y;
            var c = dy * p1.x - dx * p1.y;
            that.$ySkew = {
                a: dy,
                b: -dx,
                c: c,
                x0: c / dy,
                ky: Math.sqrt(dx * dx + dy * dy) / Math.abs(dy),
            }
            if (1 / that.$ySkew.b < 0) {
                that.$ySkew.a = -that.$ySkew.a;
                that.$ySkew.b = -that.$ySkew.b;
                that.$ySkew.c = -that.$ySkew.c;
            }
        }
        return that.$ySkew;
    }
    KinematicC3.prototype.bedPlane = function(plane) {
        var that = this;
        if (plane instanceof Array) {
            that.$bedPlane = new Plane(plane);
        } else if (plane instanceof Plane) {
            that.$bedPlane = plane;
        }

        return that.$bedPlane;
    }
    KinematicC3.prototype.xyzBedToMicrosteps = function(xyzBed) {
        var that = this;
        var bedZ = that.$bedPlane.zOfXY(xyzBed.x, xyzBed.y);
        return that.xyzToMicrosteps({
            x: xyzBed.x,
            y: xyzBed.y,
            z: xyzBed.z + bedZ,
        });
    }
    KinematicC3.prototype.xyzBedFromMicrosteps = function(msteps) {
        var that = this;
        var xyz = that.xyzFromMicrosteps(msteps);
        xyz.z -= that.$bedPlane.zOfXY(xyz.x, xyz.y);
        return xyz;
    }
    KinematicC3.prototype.xyzToMicrosteps = function(xyz) {
        var that = this;
        var skewXofY = that.$ySkew.x0 - that.$ySkew.b * xyz.y / that.$ySkew.a;
        var skewX = xyz.x - skewXofY;
        var skewY = that.$ySkew.ky * xyz.y;
        var xyzMicrosteps = {
            x: skewX * that.mmMicrosteps.x,
            y: skewY * that.mmMicrosteps.y,
            z: xyz.z * that.mmMicrosteps.z,
        };
        return xyzMicrosteps;
    }
    KinematicC3.prototype.xyzFromMicrosteps = function(xyzMicrosteps) {
        var that = this;
        var xyz = {
            x: xyzMicrosteps.x / that.mmMicrosteps.x,
            y: xyzMicrosteps.y / that.mmMicrosteps.y,
            z: xyzMicrosteps.z / that.mmMicrosteps.z,
        }
        xyz.y = xyz.y / that.$ySkew.ky;
        xyz.x += that.$ySkew.x0 - that.$ySkew.b * xyz.y / that.$ySkew.a;
        return xyz;
    }

    ///////////////// KinematicC3 class
    function Plane(p1, p2, p3) {
        var that = this;
        if (p1 == null) {
            p1 = {
                x: 0,
                y: 0,
                z: 0
            };
            p2 = {
                x: 1,
                y: 0,
                z: 0
            };
            p3 = {
                x: 0,
                y: 1,
                z: 0
            };
        }
        if (p1 instanceof Array) { // Plane(ptArray)
            p2 = p1[1];
            p3 = p1[2];
            p1 = p1[0];
        }
        var v12 = {
            x: p2.x - p1.x,
            y: p2.y - p1.y,
            z: p2.z - p1.z,
        };
        var v13 = {
            x: p3.x - p1.x,
            y: p3.y - p1.y,
            z: p3.z - p1.z,
        };

        that.a = v12.y * v13.z - v12.z * v13.y;
        that.b = v12.z * v13.x - v12.x * v13.z;
        that.c = v12.x * v13.y - v12.y * v13.x;
        that.d = that.a * p1.x + that.b * p1.y + that.c * p1.z;

        if (that.c < 0) { // normalize kinematic bed plane
            that.a = -that.a;
            that.b = -that.b;
            that.c = -that.c;
            that.d = -that.d;
        }

        return that;
    }
    Plane.prototype.zOfXY = function(x, y) {
        var that = this;
        return (that.d - that.a * x - that.b * y) / that.c;
    }

    KinematicC3.pulleyMmMicrosteps = function(pitch = 2, pulleyTeeth = 20, stepsPerRev = 200, microsteps = 16) {
        return stepsPerRev * microsteps / (pulleyTeeth * pitch);
    }

    KinematicC3.Plane = Plane;

    module.exports = exports.KinematicC3 = KinematicC3;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("KinematicC3", function() {
    var should = require("should");
    var KinematicC3 = exports.KinematicC3; // require("./KinematicC3");
    console.log(typeof KinematicC3);
    var xyz111 = {
        x: 1,
        y: 1,
        z: 1
    };

    it("pulleyMmMicrosteps(pitch, pulleyTeeth, stepsPerRev, microsteps) returns microsteps required to travel 1 mm", function() {
        KinematicC3.pulleyMmMicrosteps(2, 20, 200, 16).should.equal(80);
    })
    it("KinematicC3.Plane(p1,p2,p3) creates a 3D plane", function() {
        var p1 = {
            x: 1,
            y: -2,
            z: 0
        };
        var p2 = {
            x: 3,
            y: 1,
            z: 4
        };
        var p3 = {
            x: 0,
            y: -1,
            z: 2
        };
        var plane1 = new KinematicC3.Plane(p1, p2, p3);
        plane1.should.properties({
            a: 2,
            b: -8,
            c: 5,
            d: 18,
        });
        should(plane1.a * p1.x + plane1.b * p1.y + plane1.c * p1.z).equal(plane1.d);
        should(plane1.a * p2.x + plane1.b * p2.y + plane1.c * p2.z).equal(plane1.d);
        should(plane1.a * p3.x + plane1.b * p3.y + plane1.c * p3.z).equal(plane1.d);

        var plane2 = new KinematicC3.Plane(p2, p1, p3);
        should.deepEqual(plane1, plane2); // point order is irrelevant

        var flatPlane = new KinematicC3.Plane([{
            x: 0,
            y: -11,
            z: 1
        }, {
            x: 19,
            y: 7,
            z: 1
        }, {
            x: 2,
            y: 3,
            z: 1
        }]);
        flatPlane.a.should.equal(0);
        flatPlane.b.should.equal(0);
        flatPlane.c.should.equal(flatPlane.d);
        flatPlane.c.should.above(0);
        var defaultPlane = new KinematicC3.Plane();
        defaultPlane.a.should.equal(0);
        defaultPlane.b.should.equal(0);
        defaultPlane.c.should.equal(1);
        defaultPlane.d.should.equal(0);
    })
    it("KinematicC3.Plane.zOfXY(x,y) returns z-coordinate of (x,y)", function() {
        var p1 = {
            x: 1,
            y: -2,
            z: 0
        };
        var p2 = {
            x: 3,
            y: 1,
            z: 4
        };
        var p3 = {
            x: 0,
            y: -1,
            z: 2
        };
        var plane1 = new KinematicC3.Plane(p1, p2, p3);
        plane1.zOfXY(1, -2).should.equal(0);
        plane1.zOfXY(3, 1).should.equal(4);
        plane1.zOfXY(0, -1).should.equal(2);
    })
    it("xyzToMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc3 = new KinematicC3();
        var pt123 = {
            x: 1,
            y: 2,
            z: 3
        };
        should.deepEqual(kc3.xyzToMicrosteps(pt123), {
            x: 80,
            y: 160,
            z: 240,
        });
        var mmMicrosteps = {
            x: 1,
            y: 10,
            z: 100,
        }
        var kc3 = new KinematicC3({
            mmMicrosteps: mmMicrosteps
        });
        should.deepEqual(kc3.xyzToMicrosteps({
            x: 1,
            y: 1,
            z: 1
        }), mmMicrosteps);
    })
    it("xyzFromMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc3 = new KinematicC3();
        var pt123Microsteps = {
            x: 80,
            y: 160,
            z: 240
        };
        should.deepEqual(kc3.xyzFromMicrosteps(pt123Microsteps), {
            x: 1,
            y: 2,
            z: 3,
        });
    })
    it("bedPlane(plane) sets/returns bed plane", function() {
        var kc3 = new KinematicC3();
        var planeDefault = kc3.bedPlane();
        var p1 = {
            x: 1,
            y: -2,
            z: 0
        };
        var p2 = {
            x: 3,
            y: 1,
            z: 4
        };
        var p3 = {
            x: 0,
            y: -1,
            z: 2
        };
        var plane1 = new KinematicC3.Plane(p1, p2, p3);
        should.deepEqual(kc3.bedPlane([p1, p2, p3]), plane1);
        should.deepEqual(kc3.bedPlane(), plane1);
    })
    it("ySkew(p1,p2) sets/returns skewed and/or offset y-axis specified by two points", function() {
        var kc3 = new KinematicC3({
            mmMicrosteps: xyz111,
        });
        should.deepEqual(kc3.ySkew(), {
            a: 1,
            b: 0,
            c: 0,
            x0: 0,
            ky: 1,
        }); // standard y-axis
        should
        var p1 = {
            x: 1,
            y: 2,
            z: 10
        };
        var p2 = {
            x: 2,
            y: 3,
            z: 10
        };
        var ySkew = {
            a: -1,
            b: 1,
            c: 1,
            x0: -1,
            ky: Math.sqrt(2),
        };
        should.deepEqual(kc3.ySkew(p1, p2), ySkew);
        should.deepEqual(kc3.ySkew(), ySkew);
        should.deepEqual(kc3.ySkew([p1, p2]), ySkew); // alternate form
        should.deepEqual(kc3.ySkew(), ySkew);
        should.deepEqual(kc3.xyzToMicrosteps({
            x: 0,
            y: 0,
            z: 0
        }), {
            x: 1,
            y: 0,
            z: 0,
        });
        var p012 = {
            x: 0,
            y: 1,
            z: 2
        };
        var msteps = kc3.xyzToMicrosteps(p012);
        msteps.x.should.equal(0);
        msteps.y.should.equal(Math.sqrt(2));
        msteps.z.should.equal(2);
        should.deepEqual(kc3.xyzFromMicrosteps(msteps), p012);
        var p112 = {
            x: -1,
            y: 1,
            z: 2
        };
        var msteps = kc3.xyzToMicrosteps(p112);
        msteps.x.should.equal(-1);
        msteps.y.should.equal(Math.sqrt(2));
        msteps.z.should.equal(2);
        should.deepEqual(kc3.xyzFromMicrosteps(msteps), p112);
    })
    it("xyzBedToMicrosteps(xyzBed) returns microstep coordinate of bed-relative coordinate", function() {
        var kc3 = new KinematicC3({
            mmMicrosteps: xyz111,
        });
        var p1 = {
            x: 0,
            y: 0,
            z: -10
        };
        var p2 = {
            x: 0,
            y: 100,
            z: -12
        };
        var p3 = {
            x: 100,
            y: 0,
            z: -11
        };
        var bed1 = {
            x: 0,
            y: 0,
            z: 1
        };
        var bed2 = {
            x: 0,
            y: 100,
            z: 1
        };
        var bed3 = {
            x: 100,
            y: 0,
            z: 1
        };

        // default bed plane is z=0
        var msteps = kc3.xyzBedToMicrosteps(bed1);
        should.deepEqual(msteps, bed1);
        should.deepEqual(kc3.xyzBedFromMicrosteps(msteps), bed1);

        // non-orthogonal bed plane
        kc3.bedPlane([p1, p2, p3]);
        var msteps = kc3.xyzBedToMicrosteps(bed1);
        should.deepEqual(msteps, {
            x: 0,
            y: 0,
            z: -9,
        });
        should.deepEqual(kc3.xyzBedFromMicrosteps(msteps), bed1);
        var msteps = kc3.xyzBedToMicrosteps(bed2);
        should.deepEqual(msteps, {
            x: 0,
            y: 100,
            z: -11,
        });
        should.deepEqual(kc3.xyzBedFromMicrosteps(msteps), bed2);

        // y-skew combined with non-orthogonal bed plane
        var skew1 = {
            x: 0,
            y: 0,
            z: 123
        };
        var skew2 = {
            x: 1,
            y: 100,
            z: 123
        };
        kc3.ySkew(skew1, skew2);
        var msteps = kc3.xyzBedToMicrosteps(bed1);
        should.deepEqual(msteps, {
            x: 0,
            y: 0,
            z: -9,
        });
        should.deepEqual(kc3.xyzBedFromMicrosteps(msteps), bed1);
        var msteps = kc3.xyzBedToMicrosteps(bed2);
        msteps.x.should.equal(-1);
        msteps.y.should.approximately(100.005, 0.001);
        msteps.z.should.equal(-11);
        should.deepEqual(kc3.xyzBedFromMicrosteps(msteps), bed2);
    })
})

var JsonUtil = require("./JsonUtil");
var MTO_Base = require("./MTO_Base");

/*
 * MTO_C4 
 * ===========
 * Kinematic model for 4-axis cartesian robot handles:
 * 1) skewed y-axis 
 * 2) non-level bed plane relative coordinates 
 */
(function(exports) {
    ////////////////// constructor
    function MTO_C4(options = {}) {
        var that = this;
        that.super = Object.getPrototypeOf(Object.getPrototypeOf(that)); // TODO: use ECMAScript 2015 super 
        that.super.constructor.call(that, options);
        that.model.type = "MTO_C4";
        that.$xyz = point(0,0,0);
        that.bedPlane(options.bedPlane || new Plane());
        that.ySkew(options.ySkew || [point(0,1),point(0,0)]);

        return that;
    }
    MTO_C4.prototype = Object.create(MTO_Base.prototype);

    ///////////////// MTO_C4 instance
    MTO_C4.prototype.calcPulses = function(xyz) {
        var that = this;
        var axes = that.model.axes;
        var result = {};
        xyz.x != null && (result.p1 = Math.round(xyz.x / axes[0].unitTravel));
        xyz.y != null && (result.p2 = Math.round(xyz.y / axes[1].unitTravel));
        xyz.z != null && (result.p3 = Math.round(xyz.z / axes[2].unitTravel));
        xyz.a != null && (result.p4 = Math.round(xyz.a / axes[3].unitTravel));
        return result;
    }
    MTO_C4.prototype.calcXYZ = function(pulses) {
        var that = this;
        var result = {};
        pulses.p1 != null && (result.x = pulses.p1 * that.model.axes[0].unitTravel);
        pulses.p2 != null && (result.y = pulses.p2 * that.model.axes[1].unitTravel);
        pulses.p3 != null && (result.z = pulses.p3 * that.model.axes[2].unitTravel);
        pulses.p4 != null && (result.a = pulses.p4 * that.model.axes[3].unitTravel);
        return result;
    }
    MTO_C4.prototype.getModel = function() {
        var that = this;
        return JSON.parse(JSON.stringify(that.model));
    }
    MTO_C4.prototype.moveTo = function(xyz) {
        var that = this;
        xyz = point(xyz);
        var mstepCur = that.xyzToMicrosteps(that.$xyz, true);
        var mstepNew = that.xyzToMicrosteps(xyz, true);
        that.$xyz = JSON.parse(JSON.stringify(xyz));
        return [
            mstepNew.x - mstepCur.x,
            mstepNew.y - mstepCur.y,
            mstepNew.z - mstepCur.z,
        ];
    }
    MTO_C4.prototype.moveToBed = function(xyz) {
        var that = this;
        xyz = point(xyz);
        return that.moveTo([
            xyz.x,
            xyz.y,
            xyz.z + that.$bedPlane.zOfXY(xyz.x, xyz.y),
        ]);
    }
    MTO_C4.prototype.position = function() {
        var that = this;
        return [that.$xyz.x, that.$xyz.y, that.$xyz.z];
    }
    MTO_C4.prototype.ySkew = function(p1, p2) {
        var that = this;
        if (p2 == null && p1 instanceof Array) {
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
    MTO_C4.prototype.bedPlane = function(p1, p2, p3) {
        var that = this;
        if (p1 instanceof Plane) {
            that.$bedPlane = p1;
        } else if (p1 != null) {
            that.$bedPlane = new Plane(p1, p2, p3);
        }

        return that.$bedPlane;
    }
    MTO_C4.prototype.xyzBedToMicrosteps = function(xyzBed) {
        var that = this;
        xyzBed = point(xyzBed);
        var bedZ = that.$bedPlane.zOfXY(xyzBed.x, xyzBed.y);
        return that.xyzToMicrosteps(point(xyzBed.x, xyzBed.y, xyzBed.z+bedZ, xyzBed.a));
    }
    MTO_C4.prototype.xyzBedFromMicrosteps = function(msteps, round = false) {
        var that = this;
        var xyz = that.xyzFromMicrosteps(msteps);
        xyz.z -= that.$bedPlane.zOfXY(xyz.x, xyz.y);
        if (round) {
            xyz.x != null && (xyz.x = Math.round(xyz.x));
            xyz.y != null && (xyz.y = Math.round(xyz.y));
            xyz.z != null && (xyz.z = Math.round(xyz.z));
            xyz.a != null && (xyz.a = Math.round(xyz.a));
        }
        return xyz;
    }
    MTO_C4.prototype.xyzToMicrosteps = function(xyz, round = false) {
        var that = this;
        var kinematics = that.model;
        var msteps = {};
        xyz = point(xyz);
        var skewX = null;
        var skewY = null;
        if (xyz.x != null && xyz.y != null) {
            var skewXofY = that.$ySkew.x0 - that.$ySkew.b * xyz.y / that.$ySkew.a;
            var skewX = xyz.x - skewXofY;
            var skewY = that.$ySkew.ky * xyz.y;
            msteps.x = skewX / kinematics.axes[0].unitTravel;
            msteps.y = skewY / kinematics.axes[1].unitTravel;
        }
        xyz.z != null && (msteps.z = xyz.z / kinematics.axes[2].unitTravel);
        xyz.a != null && (msteps.a = xyz.a / kinematics.axes[3].unitTravel);
        if (round) {
            skewX != null && (msteps.x = Math.round(msteps.x));
            skewY != null && (msteps.y = Math.round(msteps.y));
            msteps.z != null && (msteps.z = Math.round(msteps.z));
            msteps.a != null && (msteps.a = Math.round(msteps.a));
        }
        return msteps;
    }
    MTO_C4.prototype.xyzFromMicrosteps = function(msteps) {
        var that = this;
        var kinematics = that.model;
        var xyz = {};
        msteps.x != null && (xyz.x = msteps.x * kinematics.axes[0].unitTravel);
        msteps.y != null && (xyz.y = msteps.y * kinematics.axes[1].unitTravel);
        msteps.z != null && (xyz.z = msteps.z * kinematics.axes[2].unitTravel);
        msteps.a != null && (xyz.a = msteps.a * kinematics.axes[3].unitTravel);
        xyz.y = xyz.y / that.$ySkew.ky;
        xyz.x += that.$ySkew.x0 - that.$ySkew.b * xyz.y / that.$ySkew.a;
        return xyz;
    }
    MTO_C4.prototype.resolve = function() {
        var that = this;
        that.super.resolve.call(that); 

        var model = that.model;
        model.version = model.version || 1;
        model.bedPlane = model.bedPlane || [point(0,0,0), point(1,0,0), point(0,1,0)];
        model.yAngle == null && (model.yAngle = 90);
        return that;
    }

    ///////////////// MTO_C4 class
    function Plane(p1, p2, p3) {
        var that = this;
        if (p1 == null) {
            p1 = point(0,0,0);
            p2 = point(1,0,0);
            p3 = point(0,1,0);
        }
        if (p2 == null && p1 instanceof Array) { // Plane(ptArray)
            p2 = p1[1];
            p3 = p1[2];
            p1 = p1[0];
        }
        p1 = point(p1);
        p2 = point(p2);
        p3 = point(p3);
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

    MTO_C4.Plane = Plane;
    MTO_C4.point = point;

    // private
    function point(x,y,z,a) {
        if (x instanceof Array) {
            return point(x[0], x[1], x[2], x[3]);
        }
        if (x.x != null || x.y != null || x.z != null || x.a != null) {
            return x;
        }
        var pt = {};
        x != null && (pt.x = Number(x));
        y != null && (pt.y = Number(y));
        z != null && (pt.z = Number(z));
        a != null && (pt.a = Number(a));
        return pt;
    }

    module.exports = exports.MTO_C4 = MTO_C4;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MTO_C4", function() {
    var should = require("should");
    var MTO_C4 = exports.MTO_C4; // require("./MTO_C4");
    var xyz111 = {
        x: 1,
        y: 1,
        z: 1,
    };
    var model111 = {
        xAxis: {
            drive: 'other',
            unitTravel: 1,
        },
        yAxis: {
            drive: 'other',
            unitTravel: 1,
        },
        zAxis: {
            drive: 'other',
            unitTravel: 1,
        },
    };
    var model100 = {
        zAxis: {
            drive: 'other',
            unitTravel: 1/100,
        },
        aAxis: {
            drive: 'other',
            unitTravel: 1/100,
        },
    };

    it("MTO_C4.Plane(p1,p2,p3) creates a 3D plane", function() {
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
        var plane1 = new MTO_C4.Plane(p1, p2, p3);
        plane1.should.properties({
            a: 2,
            b: -8,
            c: 5,
            d: 18,
        });
        should(plane1.a * p1.x + plane1.b * p1.y + plane1.c * p1.z).equal(plane1.d);
        should(plane1.a * p2.x + plane1.b * p2.y + plane1.c * p2.z).equal(plane1.d);
        should(plane1.a * p3.x + plane1.b * p3.y + plane1.c * p3.z).equal(plane1.d);

        var plane2 = new MTO_C4.Plane(p2, p1, p3);
        should.deepEqual(plane1, plane2); // point order is irrelevant

        var flatPlane = new MTO_C4.Plane([{
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
        var defaultPlane = new MTO_C4.Plane();
        defaultPlane.a.should.equal(0);
        defaultPlane.b.should.equal(0);
        defaultPlane.c.should.equal(1);
        defaultPlane.d.should.equal(0);
    })
    it("MTO_C4.Plane.zOfXY(x,y) returns z-coordinate of (x,y)", function() {
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
        var plane1 = new MTO_C4.Plane(p1, p2, p3);
        plane1.zOfXY(1, -2).should.equal(0);
        plane1.zOfXY(3, 1).should.equal(4);
        plane1.zOfXY(0, -1).should.equal(2);
    })
    it("xyzToMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc4 = new MTO_C4(model100);
        var pt123 = {
            x: 1,
            y: 2,
            z: 3
        };
        should.deepEqual(kc4.xyzToMicrosteps(pt123), {
            x: 100,
            y: 200,
            z: 300,
        });
        var ptya = {
            a: 4,
        };
        should.deepEqual(MTO_C4.point(ptya), ptya);
        should.deepEqual(kc4.xyzToMicrosteps(ptya), {
            a: 400,
        });
        var posUnits = {
            x: 1,
            y: 10,
            z: 100,
        }
        var kc4 = new MTO_C4({
            xAxis: {
                drive: 'other',
                unitTravel: 1,
            },
            yAxis: {
                drive: 'other',
                unitTravel: 1/10,
            },
            zAxis: {
                drive: 'other',
                unitTravel: 1/100,
            },
        });
        should.deepEqual(kc4.xyzToMicrosteps(xyz111), posUnits);
        var xyzFraction = {
            x: 1.01,
            y: 1.05,
            z: 1.01
        };

        // fractional microsteps and rounding
        should.deepEqual(kc4.xyzToMicrosteps(xyzFraction), {
            x: 1.01,
            y: 10.5,
            z: 101,
        });
        should.deepEqual(kc4.xyzToMicrosteps(xyzFraction, true), {
            x: 1,
            y: 11,
            z: 101,
        });
    })
    it("xyzFromMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc4 = new MTO_C4(model100);
        var pt123Microsteps = {
            x: 100,
            y: 200,
            z: 300
        };
        should.deepEqual(kc4.xyzFromMicrosteps(pt123Microsteps), {
            x: 1,
            y: 2,
            z: 3,
        });
    })
    it("bedPlane(plane) sets/returns bed plane", function() {
        var kc4 = new MTO_C4();
        var planeDefault = kc4.bedPlane();
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
        var plane1 = new MTO_C4.Plane(p1, p2, p3);
        should.deepEqual(kc4.bedPlane([p1, p2, p3]), plane1);
        should.deepEqual(kc4.bedPlane(), plane1);
    })
    it("ySkew(p1,p2) sets/returns skewed and/or offset y-axis specified by two points", function() {
        var kc4 = new MTO_C4(model111);
        should.deepEqual(kc4.ySkew(), {
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
        should.deepEqual(kc4.ySkew(p1, p2), ySkew);
        should.deepEqual(kc4.ySkew(), ySkew);
        should.deepEqual(kc4.ySkew([p1, p2]), ySkew); // alternate form
        should.deepEqual(kc4.ySkew(), ySkew);
        should.deepEqual(kc4.xyzToMicrosteps({
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
        var msteps = kc4.xyzToMicrosteps(p012);
        msteps.x.should.equal(0);
        msteps.y.should.equal(Math.sqrt(2));
        msteps.z.should.equal(2);
        should.deepEqual(kc4.xyzFromMicrosteps(msteps), p012);
        var p112 = {
            x: -1,
            y: 1,
            z: 2
        };
        var msteps = kc4.xyzToMicrosteps(p112);
        msteps.x.should.equal(-1);
        msteps.y.should.equal(Math.sqrt(2));
        msteps.z.should.equal(2);
        should.deepEqual(kc4.xyzFromMicrosteps(msteps), p112);
    })
    it("TESTTESTxyzBedToMicrosteps(xyzBed) returns microstep coordinate of bed-relative coordinate", function() {
        var kc4 = new MTO_C4(model111);
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
        var msteps = kc4.xyzBedToMicrosteps(bed1);
        should.deepEqual(msteps, {
            x: 0,
            y: 0,
            z: 1,
        });
        should.deepEqual(kc4.xyzBedFromMicrosteps(msteps), bed1);

        // non-orthogonal bed plane
        kc4.bedPlane([p1, p2, p3]);
        var msteps = kc4.xyzBedToMicrosteps([0, 0, 1]); // alternate XYZ representation for bed1
        should.deepEqual(msteps, {
            x: 0,
            y: 0,
            z: -9,
        });
        should.deepEqual(kc4.xyzBedFromMicrosteps(msteps), bed1);
        var msteps = kc4.xyzBedToMicrosteps(bed2);
        should.deepEqual(msteps, {
            x: 0,
            y: 100,
            z: -11,
        });
        should.deepEqual(kc4.xyzBedFromMicrosteps(msteps), bed2);

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
        kc4.ySkew(skew1, skew2);
        var msteps = kc4.xyzBedToMicrosteps(bed1);
        should.deepEqual(msteps, {
            x: 0,
            y: 0,
            z: -9,
        });
        should.deepEqual(kc4.xyzBedFromMicrosteps(msteps), bed1);
        var msteps = kc4.xyzBedToMicrosteps(bed2);
        msteps.x.should.equal(-1);
        msteps.y.should.approximately(100.005, 0.001);
        msteps.z.should.equal(-11);
        should.deepEqual(kc4.xyzBedFromMicrosteps(msteps), bed2);
    })
    it("moveTo(xyz) updates position and returns incremental microstep delta vector", function() {
        var kc4 = new MTO_C4(model100);
        should.deepEqual(kc4.position(), [0, 0, 0]);
        var msteps = kc4.moveTo([1, 2, 3]);
        should.deepEqual(msteps, [100, 200, 300]);
        should.deepEqual(kc4.position(), [1, 2, 3]);
        var msteps = kc4.moveTo([1.01, 2.2, 3.3]);
        should.deepEqual(msteps, [1, 20, 30]);
        var msteps = kc4.moveTo([1.015, 2.2, 3.3]);
        should.deepEqual(msteps, [0, 0, 0]);
        var msteps = kc4.moveTo([1.02, 2.2, 3.3]);
        should.deepEqual(msteps, [1, 0, 0]); // microstep rounding
        var msteps = kc4.moveTo([1.025, 2.2, 3.3]);
        should.deepEqual(msteps, [0, 0, 0]);
        var msteps = kc4.moveTo([1, 2, 3]);
        should.deepEqual(msteps, [-2, -20, -30]);
    })
    it("moveToBed(xyz) updates position to bed-relative point and returns incremental microstep delta vector", function() {
        var kc4 = new MTO_C4(model111);
        kc4.bedPlane([0, 0, -10], [1, 0, -11], [0, 1, -12]);
        should.deepEqual(kc4.position(), [0, 0, 0]);
        var msteps = kc4.moveToBed([0, 0, 0]);
        should.deepEqual(kc4.position(), [0, 0, -10]);
        should.deepEqual(msteps, [0, 0, -10]);
        var msteps = kc4.moveToBed([0, 1, 0]);
        should.deepEqual(kc4.position(), [0, 1, -12]);
        should.deepEqual(msteps, [0, 1, -2]);
        var msteps = kc4.moveToBed([0, 2, 0]);
        should.deepEqual(kc4.position(), [0, 2, -14]);
        should.deepEqual(msteps, [0, 1, -2]);
    })
    it("getModel() return serializable model", function() {
        var kc4 = new MTO_C4();
        var json = kc4.getModel();
        should.deepEqual(json, kc4.model);
    })
    it("calcXYZ() returns XYZ position for given microstep position", function() {
        var mto = new MTO_C4({
            xAxis: {
                drive: 'other',
                unitTravel: 1/100,
            },
            yAxis: {
                drive: 'other',
                unitTravel: 1/200,
            },
            zAxis: {
                drive: 'other',
                unitTravel: 1/300,
            },
        });
        var pulses = {
            p1: 100,
            p2: 200,
            p3: 349
        };
        should.deepEqual(mto.calcXYZ(pulses), {
            x: 1,
            y: 200 / 200,
            z: 349 / 300,
        });
    })
    it("calcPulses() returns microstep position for given XYZ position", function() {
        var mto = new MTO_C4({
            xAxis: {
                drive: 'other',
                unitTravel: 1,
            },
            yAxis: {
                drive: 'other',
                unitTravel: 2,
            },
            zAxis: {
                drive: 'other',
                unitTravel: 3,
            },
        });
        var xyz = {
            x: 10,
            y: 100,
            z: 1000,
        };
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 10,
            p2: 50,
            p3: 333,
        });
        var mto = new MTO_C4({
            xAxis: {
                drive: 'other',
                unitTravel: 1,
                mstepPulses: 1,
            },
            yAxis: {
                drive: 'other',
                unitTravel: 1,
                mstepPulses: 3,
            },
            zAxis: {
                drive: 'other',
                unitTravel: 1,
                mstepPulses: 7,
            },
        });
        var xyz = {
            x: 100,
            y: 100,
            z: 100,
        };
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 100,
            p2: 100,
            p3: 100,
        });
    })

    it("calcPulses() returns microstep position of given XYZ position", function() {
        var mto = new MTO_C4();
        var xyz = {
            x: 1,
            y: 2,
            z: 3,
        };
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 100,
            p2: 200,
            p3: Math.round(xyz.z * 0.8 * 200 * 16 * 21 / 17),
        });
        var xyza = {
            x: 1,
            y: 2,
            z: 3,
            a: 4,
        };
        should.deepEqual(mto.calcPulses(xyza), {
            p1: 100,
            p2: 200,
            p3: Math.round(xyza.z * 0.8 * 200 * 16 * 21 / 17),
            p4: Math.round(xyza.a * 0.8 * 200 * 16 * 21 / 17),
        });
    })
    it("calcXYZ({x:1,y:2,z:3.485}", function() {
        var mto = new MTO_C4();
        var pulses = {
            p1: 100,
            p2: 200,
            p3: 349,
            // p4 can be omitted
        };
        should.deepEqual(mto.calcXYZ(pulses), {
            x: 1,
            y: 2,
            z: 349 / (0.8 * 200 * 16 * 21 / 17),
        });
        var pulses = {
            p1: 100,
            p2: 200,
            p3: 300,
            p4: 400,
        };
        var xyza = mto.calcXYZ(pulses);
        var e = 0.0000000001;
        xyza.x.should.approximately(1, e);
        xyza.y.should.approximately(2, e);
        xyza.z.should.approximately((17/21) * 300 / (0.8 * 200 * 16), e);
        xyza.a.should.approximately((17/21) * 400 / (0.8 * 200 * 16), e);
    })
    it("mstepPulses scales the position range", function() {
        var mto = new MTO_C4({
            xAxis:{
                mstepPulses: 1,
            },
            yAxis:{
                mstepPulses: 2,
            },
            zAxis:{
                mstepPulses: 3,
                drive: "belt",
                pitch: 2,
                teeth: 16,
                steps: 200,
                microsteps: 16,
            },
        })
        var msteps = {
            p1:100,
            p2:50,
            p3:33,
        }
        should.deepEqual(mto.calcPulses(xyz111), msteps);
        var xyz = mto.calcXYZ(msteps);
        xyz.x.should.equal(1);
        xyz.y.should.equal(1);
        xyz.z.should.approximately(0.99, 0.001); // rounding error
    })
})

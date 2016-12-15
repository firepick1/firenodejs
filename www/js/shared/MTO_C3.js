var JsonUtil = require("./JsonUtil");

/*
 * MTO_C3 
 * ===========
 * Kinematic model for 3-axis cartesian robot handles:
 * 1) skewed y-axis 
 * 2) non-level bed plane relative coordinates 
 */
(function(exports) {
    ////////////////// constructor
    function MTO_C3(options = {}) {
        var that = this;

        that.$xyz = {
            x: 0,
            y: 0,
            z: 0,
        };
        that.bedPlane(options.bedPlane || new Plane());
        that.ySkew(options.ySkew || [{
            x: 0,
            y: 1
        }, {
            x: 0,
            y: 0
        }]);
        that.model = {
            type: that.constructor.name,
            version: 1,
            xAxis: {
                name: "X-axis",
                drive: "belt",
                pitch: 2,
                teeth: 16,
                steps: 200,
                microsteps: 16,
                mmMicrosteps: null, // calculated
                minPos: 0,
                maxPos: 200,
                maxHz: 18000,
                tAccel: 0.4,
                minLimit: true,
                maxLimit: false,
            },
            yAxis: {
                name: "Y-axis",
                drive: "belt",
                pitch: 2,
                teeth: 16,
                steps: 200,
                microsteps: 16,
                mmMicrosteps: null, // calculated
                minPos: 0,
                maxPos: 200,
                maxHz: 18000,
                tAccel: 0.4,
                minLimit: true,
                maxLimit: false,
            },
            zAxis: {
                name: "Z-axis",
                drive: "screw",
                steps: 200,
                microsteps: 16,
                lead: 0.8, // mm advance per revolution (default is for M5 screw)
                gearOut: 21,
                gearIn: 17,
                mmMicrosteps: null, // calculated
                minPos: -200,
                maxPos: 0,
                maxHz: 18000,
                tAccel: 0.4,
                minLimit: false,
                maxLimit: true,
            },
            bedPlane: [{
                x: 0,
                y: 0,
                z: 0,
            }, {
                x: 1,
                y: 0,
                z: 0,
            }, {
                x: 0,
                y: 1,
                z: 0,
            }],
            yAngle: 90,
        };
        JsonUtil.applyJson(that.model, options);
        updateAxes(that);

        return that;
    }

    ///////////////// MTO_C3 instance
    MTO_C3.prototype.calcPulses = function(xyz) {
        var that = this;
        return {
            p1: Math.round(xyz.x * that.model.xAxis.mmMicrosteps),
            p2: Math.round(xyz.y * that.model.yAxis.mmMicrosteps),
            p3: Math.round(xyz.z * that.model.zAxis.mmMicrosteps),
        }
    }
    MTO_C3.prototype.calcXYZ = function(pulses) {
        var that = this;
        return {
            x: pulses.p1 / that.model.xAxis.mmMicrosteps,
            y: pulses.p2 / that.model.yAxis.mmMicrosteps,
            z: pulses.p3 / that.model.zAxis.mmMicrosteps,
        }
    }
    MTO_C3.prototype.deserialize = function(s) {
        var that = this;
        var delta = JSON.parse(s);
        if (delta.type !== that.model.type) {
            throw new Error("MTO_C3 deserialize() unexpected type:" + delta.type);
        }
        if (delta.version !== that.model.version) {
            throw new Error("MTO_C3 deserialize() unsupported version:" + delta.version);
        }
        JsonUtil.applyJson(that.model, JSON.parse(s));
    }
    MTO_C3.prototype.serialize = function() {
        var that = this;
        return JSON.stringify(that.model);
    }
    MTO_C3.prototype.getModel = function() {
        var that = this;
        return JSON.parse(JSON.stringify(that.model));
    }
    MTO_C3.prototype.moveTo = function(xyz) {
        var that = this;
        xyz = normalizePoint(xyz);
        var mstepCur = that.xyzToMicrosteps(that.$xyz, true);
        var mstepNew = that.xyzToMicrosteps(xyz, true);
        that.$xyz = JSON.parse(JSON.stringify(xyz));
        return [
            mstepNew.x - mstepCur.x,
            mstepNew.y - mstepCur.y,
            mstepNew.z - mstepCur.z,
        ];
    }
    MTO_C3.prototype.moveToBed = function(xyz) {
        var that = this;
        xyz = normalizePoint(xyz);
        return that.moveTo([
            xyz.x,
            xyz.y,
            xyz.z + that.$bedPlane.zOfXY(xyz.x, xyz.y),
        ]);
    }
    MTO_C3.prototype.position = function() {
        var that = this;
        return [that.$xyz.x, that.$xyz.y, that.$xyz.z];
    }
    MTO_C3.prototype.ySkew = function(p1, p2) {
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
    MTO_C3.prototype.bedPlane = function(p1, p2, p3) {
        var that = this;
        if (p1 instanceof Plane) {
            that.$bedPlane = p1;
        } else if (p1 != null) {
            that.$bedPlane = new Plane(p1, p2, p3);
        }

        return that.$bedPlane;
    }
    MTO_C3.prototype.xyzBedToMicrosteps = function(xyzBed) {
        var that = this;
        xyzBed = normalizePoint(xyzBed);
        var bedZ = that.$bedPlane.zOfXY(xyzBed.x, xyzBed.y);
        return that.xyzToMicrosteps({
            x: xyzBed.x,
            y: xyzBed.y,
            z: xyzBed.z + bedZ,
        });
    }
    MTO_C3.prototype.xyzBedFromMicrosteps = function(msteps, round = false) {
        var that = this;
        var xyz = that.xyzFromMicrosteps(msteps);
        xyz.z -= that.$bedPlane.zOfXY(xyz.x, xyz.y);
        if (round) {
            xyz.x = Math.round(xyz.x);
            xyz.y = Math.round(xyz.y);
            xyz.z = Math.round(xyz.z);
        }
        return xyz;
    }
    MTO_C3.prototype.xyzToMicrosteps = function(xyz, round = false) {
        var that = this;
        xyz = normalizePoint(xyz);
        var skewXofY = that.$ySkew.x0 - that.$ySkew.b * xyz.y / that.$ySkew.a;
        var skewX = xyz.x - skewXofY;
        var skewY = that.$ySkew.ky * xyz.y;
        var kinematics = that.model;
        var msteps = {
            x: skewX * kinematics.xAxis.mmMicrosteps,
            y: skewY * kinematics.yAxis.mmMicrosteps,
            z: xyz.z * kinematics.zAxis.mmMicrosteps,
        };
        if (round) {
            msteps.x = Math.round(msteps.x);
            msteps.y = Math.round(msteps.y);
            msteps.z = Math.round(msteps.z);
        }
        return msteps;
    }
    MTO_C3.prototype.xyzFromMicrosteps = function(msteps) {
        var that = this;
        var kinematics = that.model;
        var xyz = {
            x: msteps.x / kinematics.xAxis.mmMicrosteps,
            y: msteps.y / kinematics.yAxis.mmMicrosteps,
            z: msteps.z / kinematics.zAxis.mmMicrosteps,
        }
        xyz.y = xyz.y / that.$ySkew.ky;
        xyz.x += that.$ySkew.x0 - that.$ySkew.b * xyz.y / that.$ySkew.a;
        return xyz;
    }

    ///////////////// MTO_C3 class
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
        if (p2 == null && p1 instanceof Array) { // Plane(ptArray)
            p2 = p1[1];
            p3 = p1[2];
            p1 = p1[0];
        }
        p1 = normalizePoint(p1);
        p2 = normalizePoint(p2);
        p3 = normalizePoint(p3);
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

    MTO_C3.pulleyMmMicrosteps = function(pitch = 2, pulleyTeeth = 20, stepsPerRev = 200, microsteps = 16) {
        return stepsPerRev * microsteps / (pulleyTeeth * pitch);
    }

    MTO_C3.Plane = Plane;

    // private
    function updateAxes(that) {
        updateAxisMmMicrosteps(that.model.xAxis);
        updateAxisMmMicrosteps(that.model.yAxis);
        updateAxisMmMicrosteps(that.model.zAxis);
    }

    function updateAxisMmMicrosteps(axis) {
        if (axis.drive === 'belt') {
            axis.mmMicrosteps = MTO_C3.pulleyMmMicrosteps(axis.pitch, axis.teeth, axis.steps, axis.microsteps);
        } else if (axis.drive === 'screw') {
            axis.mmMicrosteps = axis.steps * axis.microsteps * axis.lead;
            axis.mmMicrosteps *= axis.gearOut / axis.gearIn;
        }
    }

    function normalizePoint(xyz) {
        if (xyz instanceof Array) {
            return {
                x: xyz[0],
                y: xyz[1],
                z: xyz[2],
            }
        }
        return xyz;
    }

    module.exports = exports.MTO_C3 = MTO_C3;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MTO_C3", function() {
    var should = require("should");
    var MTO_C3 = exports.MTO_C3; // require("./MTO_C3");
    console.log(typeof MTO_C3);
    var xyz111 = {
        x: 1,
        y: 1,
        z: 1,
    };
    var model111 = {
        xAxis: {
            drive: 'other',
            mmMicrosteps: 1,
        },
        yAxis: {
            drive: 'other',
            mmMicrosteps: 1,
        },
        zAxis: {
            drive: 'other',
            mmMicrosteps: 1,
        },
    };
    var model100 = {
        zAxis: {
            drive: 'other',
            mmMicrosteps: 100,
        }
    };

    it("pulleyMmMicrosteps(pitch, pulleyTeeth, stepsPerRev, microsteps) returns microsteps required to travel 1 mm", function() {
        MTO_C3.pulleyMmMicrosteps(2, 20, 200, 16).should.equal(80);
    })
    it("MTO_C3.Plane(p1,p2,p3) creates a 3D plane", function() {
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
        var plane1 = new MTO_C3.Plane(p1, p2, p3);
        plane1.should.properties({
            a: 2,
            b: -8,
            c: 5,
            d: 18,
        });
        should(plane1.a * p1.x + plane1.b * p1.y + plane1.c * p1.z).equal(plane1.d);
        should(plane1.a * p2.x + plane1.b * p2.y + plane1.c * p2.z).equal(plane1.d);
        should(plane1.a * p3.x + plane1.b * p3.y + plane1.c * p3.z).equal(plane1.d);

        var plane2 = new MTO_C3.Plane(p2, p1, p3);
        should.deepEqual(plane1, plane2); // point order is irrelevant

        var flatPlane = new MTO_C3.Plane([{
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
        var defaultPlane = new MTO_C3.Plane();
        defaultPlane.a.should.equal(0);
        defaultPlane.b.should.equal(0);
        defaultPlane.c.should.equal(1);
        defaultPlane.d.should.equal(0);
    })
    it("MTO_C3.Plane.zOfXY(x,y) returns z-coordinate of (x,y)", function() {
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
        var plane1 = new MTO_C3.Plane(p1, p2, p3);
        plane1.zOfXY(1, -2).should.equal(0);
        plane1.zOfXY(3, 1).should.equal(4);
        plane1.zOfXY(0, -1).should.equal(2);
    })
    it("xyzToMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc3 = new MTO_C3(model100);
        var pt123 = {
            x: 1,
            y: 2,
            z: 3
        };
        should.deepEqual(kc3.xyzToMicrosteps(pt123), {
            x: 100,
            y: 200,
            z: 300,
        });
        var mmMicrosteps = {
            x: 1,
            y: 10,
            z: 100,
        }
        var kc3 = new MTO_C3({
            xAxis: {
                drive: 'other',
                mmMicrosteps: 1,
            },
            yAxis: {
                drive: 'other',
                mmMicrosteps: 10,
            },
            zAxis: {
                drive: 'other',
                mmMicrosteps: 100,
            },
        });
        should.deepEqual(kc3.xyzToMicrosteps(xyz111), mmMicrosteps);
        var xyzFraction = {
            x: 1.01,
            y: 1.05,
            z: 1.01
        };

        // fractional microsteps and rounding
        should.deepEqual(kc3.xyzToMicrosteps(xyzFraction), {
            x: 1.01,
            y: 10.5,
            z: 101,
        });
        should.deepEqual(kc3.xyzToMicrosteps(xyzFraction, true), {
            x: 1,
            y: 11,
            z: 101,
        });
    })
    it("xyzFromMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc3 = new MTO_C3(model100);
        var pt123Microsteps = {
            x: 100,
            y: 200,
            z: 300
        };
        should.deepEqual(kc3.xyzFromMicrosteps(pt123Microsteps), {
            x: 1,
            y: 2,
            z: 3,
        });
    })
    it("bedPlane(plane) sets/returns bed plane", function() {
        var kc3 = new MTO_C3();
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
        var plane1 = new MTO_C3.Plane(p1, p2, p3);
        should.deepEqual(kc3.bedPlane([p1, p2, p3]), plane1);
        should.deepEqual(kc3.bedPlane(), plane1);
    })
    it("ySkew(p1,p2) sets/returns skewed and/or offset y-axis specified by two points", function() {
        var kc3 = new MTO_C3(model111);
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
        var kc3 = new MTO_C3(model111);
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
        should.deepEqual(msteps, {
            x: 0,
            y: 0,
            z: 1,
        });
        should.deepEqual(kc3.xyzBedFromMicrosteps(msteps), bed1);

        // non-orthogonal bed plane
        kc3.bedPlane([p1, p2, p3]);
        var msteps = kc3.xyzBedToMicrosteps([0, 0, 1]); // alternate XYZ representation for bed1
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
    it("moveTo(xyz) updates position and returns incremental microstep delta vector", function() {
        var kc3 = new MTO_C3(model100);
        should.deepEqual(kc3.position(), [0, 0, 0]);
        var msteps = kc3.moveTo([1, 2, 3]);
        should.deepEqual(msteps, [100, 200, 300]);
        should.deepEqual(kc3.position(), [1, 2, 3]);
        var msteps = kc3.moveTo([1.01, 2.2, 3.3]);
        should.deepEqual(msteps, [1, 20, 30]);
        var msteps = kc3.moveTo([1.015, 2.2, 3.3]);
        should.deepEqual(msteps, [0, 0, 0]);
        var msteps = kc3.moveTo([1.02, 2.2, 3.3]);
        should.deepEqual(msteps, [1, 0, 0]); // microstep rounding
        var msteps = kc3.moveTo([1.025, 2.2, 3.3]);
        should.deepEqual(msteps, [0, 0, 0]);
        var msteps = kc3.moveTo([1, 2, 3]);
        should.deepEqual(msteps, [-2, -20, -30]);
    })
    it("moveToBed(xyz) updates position to bed-relative point and returns incremental microstep delta vector", function() {
        var kc3 = new MTO_C3(model111);
        kc3.bedPlane([0, 0, -10], [1, 0, -11], [0, 1, -12]);
        should.deepEqual(kc3.position(), [0, 0, 0]);
        var msteps = kc3.moveToBed([0, 0, 0]);
        should.deepEqual(kc3.position(), [0, 0, -10]);
        should.deepEqual(msteps, [0, 0, -10]);
        var msteps = kc3.moveToBed([0, 1, 0]);
        should.deepEqual(kc3.position(), [0, 1, -12]);
        should.deepEqual(msteps, [0, 1, -2]);
        var msteps = kc3.moveToBed([0, 2, 0]);
        should.deepEqual(kc3.position(), [0, 2, -14]);
        should.deepEqual(msteps, [0, 1, -2]);
    })
    it("getModel() return serializable model", function() {
        var kc3 = new MTO_C3();
        var json = kc3.getModel();
        should.deepEqual(json, kc3.model);
    })
    it("calcXYZ() returns XYZ position for given microstep position", function() {
        var mto = new MTO_C3({
            xAxis: {
                drive: 'other',
                mmMicrosteps: 100,
            },
            yAxis: {
                drive: 'other',
                mmMicrosteps: 200,
            },
            zAxis: {
                drive: 'other',
                mmMicrosteps: 300,
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
        var mto = new MTO_C3({
            xAxis: {
                drive: 'other',
                mmMicrosteps: 100,
            },
            yAxis: {
                drive: 'other',
                mmMicrosteps: 200,
            },
            zAxis: {
                drive: 'other',
                mmMicrosteps: 300,
            },
        });
        var xyz = {
            x: 1,
            y: 2,
            z: 3,
        };
        should.deepEqual(mto.calcPulses(xyz), {
            p1: xyz.x * 100,
            p2: xyz.y * 200,
            p3: xyz.z * 300,
        });
    })

    // MTO_XYZ tests
    false && it("getModel() should return data model", function() {
        var mto = new MTO_C3();
        mto.getModel().should.properties({
            name: "MTO_C3",
            dim: {
                tr: 32,
            },
            sys: {
                to: 2, // system topology FireStep MTO_C3
                mv: 16000,
                tv: 0.7,
            },
            x: {},
            y: {},
            z: {},

        });
    })
    it("calcPulses() returns microstep position of given XYZ position", function() {
        var mto = new MTO_C3();
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
    })
    it("calcXYZ({x:1,y:2,z:3.485}", function() {
        var mto = new MTO_C3();
        var pulses = {
            p1: 100,
            p2: 200,
            p3: 349
        };
        should.deepEqual(mto.calcXYZ(pulses), {
            x: 1,
            y: 2,
            z: 349 / (0.8 * 200 * 16 * 21 / 17),
        });
    })
    it("serialize/deserialize() save and restore model state", function() {
        var mto1 = new MTO_C3(model100);
        var mto2 = new MTO_C3(model111);
        var s = mto2.serialize();
        console.log(s);
        mto1.deserialize(s);
        should.deepEqual(mto1.model, mto2.model);
    })
})

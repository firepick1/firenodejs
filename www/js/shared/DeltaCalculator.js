var should = require("should");
var module = module || {},
    firepick = firepick || {};
var Logger = require("./Logger");

(function(firepick) {
    var logger = new Logger();
    var sqrt3 = Math.sqrt(3.0);
    var pi = Math.PI;
    var sin120 = sqrt3 / 2.0;
    var cos120 = -0.5;
    var tan60 = sqrt3;
    var sin30 = 0.5;
    var tan30 = 1 / sqrt3;
    var tan30_half = tan30 / 2.0;
    var dtr = pi / 180.0;

    function DeltaCalculator(options) {
        var that = this;
        options = options || {};
        that.e = options.e || 131.636; // effector equilateral triangle side
        that.f = options.f || 190.526; // base equilateral triangle side
        that.re = options.re || 270.000; // effector arm length
        that.rf = options.rf || 90.000; // base arm length
        that.steps360 = options.steps360 == null ? 400 : options.steps360;
        that.microsteps = options.microsteps == null ? 16 : options.microsteps;
        that.gearRatio = options.gearRatio == null ? 150 / 16 : options.gearRatio;
        that.spAngle = options.spAngle || -54.617;
        that.spRatio = options.spRatio || -0.383;
        if (options.homePulses) {
            options.homePulses.p1.should.be.Number;
            options.homePulses.p2.should.be.Number;
            options.homePulses.p3.should.be.Number;
            that.homePulses = options.homePulses;
            that.homeAngles = {
                theta1: that.homePulses.p1 / that.degreePulses(),
                theta2: that.homePulses.p2 / that.degreePulses(),
                theta3: that.homePulses.p3 / that.degreePulses(),
            };
        } else {
            that.homeAngles = options.homeAngles || {
                theta1: -67.2,
                theta2: -67.2,
                theta3: -67.2
            };
            that.homeAngles.theta1.should.be.Number;
            that.homeAngles.theta2.should.be.Number;
            that.homeAngles.theta3.should.be.Number;
            that.homePulses = options.homePulses || {
                p1: that.homeAngles.theta1 * that.degreePulses(),
                p2: that.homeAngles.theta2 * that.degreePulses(),
                p3: that.homeAngles.theta3 * that.degreePulses(),
            };
        }
        that.dz = 0;
        that.eTheta1 = 0;
        that.eTheta2 = 0;
        that.eTheta3 = 0;
        var xyz = that.calcXYZ({
            theta1: 0,
            theta2: 0,
            theta3: 0,
        });
        that.dz = options.dz || -xyz.z;
        logger.trace("dz:", xyz);

        that.eTheta1 = options.eTheta1 == null ? 0 : options.eTheta1;
        that.eTheta2 = options.eTheta2 == null ? 0 : options.eTheta2;
        that.eTheta3 = options.eTheta3 == null ? 0 : options.eTheta3;
        that.eTheta1.should.be.Number;
        that.eTheta2.should.be.Number;
        that.eTheta3.should.be.Number;

        return that;
    };
    DeltaCalculator.prototype.homeAngle = function() {
        var that = this;
        return (that.homeAngles.theta1 + that.homeAngles.theta2 + that.homeAngles.theta3) /3;
    }
    DeltaCalculator.prototype.zBowlError = function(pulsesCenter, pulsesRadius, eTheta) {
        var that = this;
        var eThetaSave = that.eTheta;
        that.eTheta1 = that.eTheta2 = that.eTheta3 = eTheta;
        var zr = that.calcXYZ(pulsesRadius).z
        var zc = that.calcXYZ(pulsesCenter).z;
        that.eTheta = eThetaSave;
        return zr - zc;
    };
    DeltaCalculator.prototype.getMinDegrees = function() {
        var that = this;
        var crf = that.f / sqrt3; // base circumcircle radius
        var degrees = 180 * Math.asin(crf / (that.re - that.rf)) / pi - 90;
        return degrees;
    }
    DeltaCalculator.prototype.degreePulses = function() {
        var that = this;
        return that.steps360 * that.microsteps * that.gearRatio / 360;
    }
    DeltaCalculator.prototype.calcXYZ = function(angles) {
        var that = this;
        if (angles.theta1 == null && angles.p1 != null) {
            angles.p1.should.be.Number;
            var degreePulses = that.degreePulses();
            return that.calcXYZ({
                theta1: angles.p1 / degreePulses,
                theta2: angles.p2 / degreePulses,
                theta3: angles.p3 / degreePulses,
            });
        }
        angles.theta1.should.be.Number;

        var t = (that.f - that.e) * tan30 / 2;
        var theta1 = (angles.theta1 - that.eTheta1) * dtr;
        var theta2 = (angles.theta2 - that.eTheta2) * dtr;
        var theta3 = (angles.theta3 - that.eTheta3) * dtr;
        var y1 = -(t + that.rf * Math.cos(theta1));
        var z1 = -that.rf * Math.sin(theta1);
        var y2 = (t + that.rf * Math.cos(theta2)) * sin30;
        var x2 = y2 * tan60;
        var z2 = -that.rf * Math.sin(theta2);
        var y3 = (t + that.rf * Math.cos(theta3)) * sin30;
        var x3 = -y3 * tan60;
        var z3 = -that.rf * Math.sin(theta3);
        var dnm = (y2 - y1) * x3 - (y3 - y1) * x2;
        var w1 = y1 * y1 + z1 * z1;
        var w2 = x2 * x2 + y2 * y2 + z2 * z2;
        var w3 = x3 * x3 + y3 * y3 + z3 * z3;
        // x = (a1*z + b1)/dnm
        var a1 = (z2 - z1) * (y3 - y1) - (z3 - z1) * (y2 - y1);
        var b1 = -((w2 - w1) * (y3 - y1) - (w3 - w1) * (y2 - y1)) / 2.0;
        // y = (a2*z + b2)/dnm
        var a2 = -(z2 - z1) * x3 + (z3 - z1) * x2;
        var b2 = ((w2 - w1) * x3 - (w3 - w1) * x2) / 2.0;
        // a*z^2 + b*z + c = 0
        var a = a1 * a1 + a2 * a2 + dnm * dnm;
        var b = 2.0 * (a1 * b1 + a2 * (b2 - y1 * dnm) - z1 * dnm * dnm);
        var c = (b2 - y1 * dnm) * (b2 - y1 * dnm) + b1 * b1 + dnm * dnm * (z1 * z1 - that.re * that.re);
        // discriminant
        var d = b * b - 4.0 * a * c;
        if (d < 0) { // point exists
            logger.error("DeltaCalculator calcXYZ(", angles, ") point exists");
            return null;
        }
        var z = -0.5 * (b + Math.sqrt(d)) / a;
        return {
            x: (a1 * z + b1) / dnm,
            y: (a2 * z + b2) / dnm,
            z: z + that.dz,
        }
    };
    DeltaCalculator.prototype.calcAngleYZ = function(X, Y, Z) {
        var that = this;
        var y1 = -tan30_half * that.f; // f/2 * tg 30
        Y -= tan30_half * that.e; // shift center to edge
        // z = a + b*y
        var a = (X * X + Y * Y + Z * Z + that.rf * that.rf - that.re * that.re - y1 * y1) / (2.0 * Z);
        var b = (y1 - Y) / Z;
        // discriminant
        var d = -(a + b * y1) * (a + b * y1) + that.rf * (b * b * that.rf + that.rf);
        if (d < 0) {
            logger.error("DeltaCalculator calcAngleYZ(", X, ",", Y, ",", Z, ") discriminant");
            return null;
        }
        var yj = (y1 - a * b - Math.sqrt(d)) / (b * b + 1.0); // choosing outer point
        var zj = a + b * yj;
        return 180.0 * Math.atan(-zj / (y1 - yj)) / pi + ((yj > y1) ? 180.0 : 0.0);
    };
    DeltaCalculator.prototype.calcPulses = function(xyz) {
        var that = this;
        var angles = that.calcAngles(xyz);
        if (angles == null) { // no solution
            return null;
        }
        var degreePulses = that.degreePulses();
        return {
            p1: Math.round(angles.theta1 * degreePulses),
            p2: Math.round(angles.theta2 * degreePulses),
            p3: Math.round(angles.theta3 * degreePulses),
        }
    }
    DeltaCalculator.prototype.calcAngles = function(xyz) {
        var that = this;
        var x = xyz.x;
        var y = xyz.y;
        var z = xyz.z - that.dz;
        x.should.be.Number;
        y.should.be.Number;
        z.should.be.Number;
        var theta1 = that.calcAngleYZ(x, y, z);
        if (theta1 == null) {
            logger.error("calcAngles(", xyz, ") theta1 is null");
            return null;
        }
        var theta2 = that.calcAngleYZ(x * cos120 + y * sin120, y * cos120 - x * sin120, z);
        if (theta2 == null) {
            logger.error("calcAngles(", xyz, ") theta2 is null");
            return null;
        }
        var theta3 = that.calcAngleYZ(x * cos120 - y * sin120, y * cos120 + x * sin120, z);
        if (theta3 == null) {
            logger.error("calcAngles(", xyz, ") theta3 is null");
            return null;
        }
        return {
            theta1: theta1 + that.eTheta1,
            theta2: theta2 + that.eTheta2,
            theta3: theta3 + that.eTheta3,
        }
    };

    ///////////// CLASS ////////////
    DeltaCalculator.setLogger = function(value) {
        logger = value;
    }
    DeltaCalculator.getLogger = function() {
        return logger || new Logger();
    }
    DeltaCalculator.createLooseCanonRAMPS = function() {
        return new DeltaCalculator({
            e: 131.640,
            f: 190.530,
            gearRatio: 9.47375,
            re: 270.000,
            rf: 90.000,
            spa: 51.581,
            spr: -0.196,
            steps360: 200,
            microsteps: 16,
            homeAngles: {
                theta1: 60.330,
                theta2: 60.330,
                theta3: 60.330,
            }
        });
    }

    logger.debug("loaded firepick.DeltaCalculator");
    module.exports = firepick.DeltaCalculator = DeltaCalculator;
})(firepick || (firepick = {}));

(should && typeof describe === 'function') && describe("firepick.DeltaCalculator", function() {
    var logger = new Logger();
    DeltaCalculator = firepick.DeltaCalculator;
    var epsilon = 0.0000001;

    function shouldEqualT(a, b, tolerance) {
        tolerance = tolerance || 0.001;
        for (var k in a) {
            var msg = "shouldEqualT({" + k + ":" + a[k] + "}, {" + k + ":" + b[k] + "} FAIL";
            a[k].should.within(b[k] - tolerance, b[k] + tolerance, msg);
        }
    }
    it("has home angle option", function() {
        shouldEqualT(new DeltaCalculator().homeAngles, {
            theta1: -67.2,
            theta2: -67.2,
            theta3: -67.2
        });
        shouldEqualT(
            new DeltaCalculator({
                homeAngles: {
                    theta1: -67,
                    theta2: -67,
                    theta3: -67
                }
            }).homeAngles, {
                theta1: -67,
                theta2: -67,
                theta3: -67
            }
        );
    });
    it("has home pulses option that overrides home angle option", function() {
        shouldEqualT(new DeltaCalculator().homePulses, {
            p1: -11200,
            p2: -11200,
            p3: -11200
        });
        shouldEqualT(
            new DeltaCalculator({
                homeAngles: {
                    theta1: -67,
                    theta2: -67,
                    theta3: -67
                }
            }).homePulses, {
                p1: -11166.667,
                p2: -11166.667,
                p3: -11166.667
            }
        );
        shouldEqualT(
            new DeltaCalculator({
                homePulses: {
                    p1: -11166.667,
                    p2: -11166.667,
                    p3: -11166.667
                },
            }).homeAngles, {
                theta1: -67,
                theta2: -67,
                theta3: -67
            }
        );
    });
    it("has effector equilateral triangle side length option", function() {
        new DeltaCalculator().e.should.equal(131.636);
        new DeltaCalculator({
            e: 120
        }).e.should.equal(120);
    });
    it("has upper base equilateral triangle side length option", function() {
        new DeltaCalculator().f.should.equal(190.526);
        new DeltaCalculator({
            f: 120
        }).f.should.equal(120);
    });
    it("has effector arm length option", function() {
        new DeltaCalculator().re.should.equal(270.000);
        new DeltaCalculator({
            re: 230
        }).re.should.equal(230);
    });
    it("has effector arm length option", function() {
        new DeltaCalculator().rf.should.equal(90.000);
        new DeltaCalculator({
            rf: 114
        }).rf.should.equal(114);
    });
    it("has steps per revolution option", function() {
        new DeltaCalculator().steps360.should.equal(400);
        new DeltaCalculator({
            steps360: 200
        }).steps360.should.equal(200);
    });
    it("has microsteps option", function() {
        new DeltaCalculator().microsteps.should.equal(16);
        new DeltaCalculator({
            microsteps: 8
        }).microsteps.should.equal(8);
    });
    it("has pulley gear ratio option", function() {
        new DeltaCalculator().gearRatio.should.equal(150 / 16);
        new DeltaCalculator({
            gearRatio: 100 / 16
        }).gearRatio.should.equal(100 / 16);
    });
    it("has home origin offset option", function() {
        new DeltaCalculator().dz.should.within(247.893, 247.894);
        new DeltaCalculator({
            dz: 100
        }).dz.should.equal(100);
    });
    it("has homing error options", function() {
        new DeltaCalculator().eTheta1.should.equal(0);
        new DeltaCalculator({
            eTheta1: 3.1
        }).eTheta1.should.equal(3.1);
        new DeltaCalculator().eTheta2.should.equal(0);
        new DeltaCalculator({
            eTheta2: 3.1
        }).eTheta2.should.equal(3.1);
        new DeltaCalculator().eTheta3.should.equal(0);
        new DeltaCalculator({
            eTheta3: 3.1
        }).eTheta3.should.equal(3.1);
    });
    it("homeAngle() should return average home angle", function() {
        var e = 0.0001;
        DeltaCalculator.createLooseCanonRAMPS().homeAngle().should
        .within(60.33-e,60.33+e);
    });
    it("calcXYZ() should compute XYZ from angles ", function() {
        var dc = new DeltaCalculator();
        shouldEqualT(dc.calcXYZ({
            theta1: 0,
            theta2: 0,
            theta3: 0
        }), {
            x: 0,
            y: 0,
            z: 0
        });
    });
    it("angles increase downwards as Z decreases", function() {
        var dc = new DeltaCalculator();
        shouldEqualT(dc.calcXYZ({
            theta1: 1,
            theta2: 1,
            theta3: 1
        }), {
            x: 0,
            y: 0,
            z: -1.5766
        });
    });
    it("calcAngles() should compute angles from XYZ", function() {
        var dc = new DeltaCalculator();
        shouldEqualT(dc.calcAngles({
            x: 0,
            y: 0,
            z: 0
        }), {
            theta1: 0,
            theta2: 0,
            theta3: 0
        });
        shouldEqualT(dc.calcAngles({
            x: 0,
            y: 0,
            z: -1.5766
        }), {
            theta1: 1,
            theta2: 1,
            theta3: 1
        });
    });
    it("xyz(0,0,0) should be at theta(0,0,0)", function() {
        var dc = new firepick.DeltaCalculator();
        shouldEqualT(dc.calcXYZ({
            theta1: 0,
            theta2: 0,
            theta3: 0
        }), {
            x: 0,
            y: 0,
            z: 0
        });
        shouldEqualT(dc.calcAngles({
            x: 0,
            y: 0,
            z: 0
        }), {
            theta1: 0,
            theta2: 0,
            theta3: 0
        });
    });
    it("calcPulses() should compute stepper pulse coordinate from XYZ ", function() {
        var dc = new DeltaCalculator();
        shouldEqualT(dc.calcPulses({
            x: 0,
            y: 0,
            z: 0
        }), {
            p1: 0,
            p2: 0,
            p3: 0
        });
        shouldEqualT(dc.calcPulses(dc.calcXYZ(dc.homeAngles)), dc.homePulses);
        shouldEqualT(dc.calcPulses({
            x: 1,
            y: 2,
            z: 3
        }), {
            p1: -227,
            p2: -406,
            p3: -326
        });
        shouldEqualT(dc.calcPulses({
            x: 1,
            y: 2,
            z: -3
        }), {
            p1: 407,
            p2: 233,
            p3: 311
        });
        shouldEqualT(dc.calcPulses({
            x: 1,
            y: 2,
            z: -90
        }), {
            p1: 9658,
            p2: 9521,
            p3: 9582
        });
    });
    it("calcXYZ() should compute XYZ from stepper pulse coordinates", function() {
        var dc = new DeltaCalculator();
        shouldEqualT(dc.calcXYZ({
            p1: 0,
            p2: 0,
            p3: 0
        }), {
            x: 0,
            y: 0,
            z: 0
        });
        shouldEqualT(dc.calcXYZ({
            p1: -227,
            p2: -406,
            p3: -326
        }), {
            x: 1,
            y: 2,
            z: 3
        }, 0.007);
        shouldEqualT(dc.calcXYZ({
            p1: 407,
            p2: 233,
            p3: 311
        }), {
            x: 1,
            y: 2,
            z: -3
        }, 0.007);
        shouldEqualT(dc.calcXYZ({
            p1: 9658,
            p2: 9521,
            p3: 9582
        }), {
            x: 1,
            y: 2,
            z: -90
        }, 0.009);
    });
    it("should generate thetaerr.csv", function() {
        var dc = new firepick.DeltaCalculator();

        function testData(xyz) {
            var v = [];
            for (var dtheta = -2; dtheta <= 2; dtheta++) {
                var angles = dc.calcAngles(xyz);
                var theta_dtheta = {
                    theta1: angles.theta1 + dtheta,
                    theta2: angles.theta2 + dtheta,
                    theta3: angles.theta3 + dtheta
                };
                var xyz_dtheta = dc.calcXYZ(theta_dtheta);
                v.push(xyz_dtheta.x - xyz.x);
                v.push(xyz_dtheta.y - xyz.y);
                v.push(xyz_dtheta.z - xyz.z);
            }
            logger.debug(",", xyz.x,
                ", ", v[0], ", ", v[1], ", ", v[2], ", ", v[3], ", ", v[4],
                ", ", v[5], ", ", v[6], ", ", v[7], ", ", v[8], ", ", v[9],
                ", ", v[10], ", ", v[11], ", ", v[12], ", ", v[13], ", ", v[14]);
        }
        var line = ", x";
        for (var dtheta = -2; dtheta <= 2; dtheta++) {
            line += ", xErr(" + dtheta + ")" +
                ", yErr(" + dtheta + ")" +
                ", zErr(" + dtheta + ")";
        }
        logger.debug(line);
        for (var i = -10; i <= 10; i++) {
            testData({
                x: i * 10,
                y: 0,
                z: -70
            });
        }
    });
    it("should generate gearerror.csv", function() {
        var dc = [
            new DeltaCalculator({
                gearRatio: 149 / 16
            }), // smaller
            new DeltaCalculator({
                gearRatio: 150 / 16
            }), // normal
            new DeltaCalculator({
                gearRatio: 151 / 16
            }), // larger
        ];

        function testData(xyz) {
            var v = [];
            for (var i = 0; i < 3; i++) {
                var angles = dc[1].calcAngles(xyz);
                var xyz_gear = dc[i].calcXYZ(angles);
                v.push(xyz_gear.x - xyz.x);
                v.push(xyz_gear.y - xyz.y);
                v.push(xyz_gear.z - xyz.z);
            }
            logger.debug(",", xyz.x,
                ", ", v[0], ", ", v[1], ", ", v[2], ", ", v[3], ", ", v[4],
                ", ", v[5], ", ", v[6], ", ", v[7], ", ", v[8]);
        }
        var line = ", x";
        for (var dtheta = -2; dtheta <= 2; dtheta++) {
            line += ", xErr(" + dtheta + ")" +
                ", yErr(" + dtheta + ")" +
                ", zErr(" + dtheta + ")";
        }
        logger.debug(line);
        for (var i = -10; i <= 10; i++) {
            testData({
                x: i * 10,
                y: 0,
                z: -70
            });
        }
    });
    it("homing error should affect Y and Z", function() {
        var dc = new DeltaCalculator();
        var angles = [
            dc.calcAngles({
                x: -100,
                y: 0,
                z: -70
            }),
            dc.calcAngles({
                x: 0,
                y: 0,
                z: -70
            }),
            dc.calcAngles({
                x: 100,
                y: 0,
                z: -70
            })
        ];
        var dc_minus1 = new DeltaCalculator({
            eTheta1: -1,
            eTheta2: -1,
            eTheta3: -1
        });
        var dc_plus1 = new DeltaCalculator({
            eTheta1: 1,
            eTheta2: 1,
            eTheta3: 1
        });

        shouldEqualT(dc_plus1.calcXYZ(angles[0]), {
            x: -99.947,
            y: 0.213,
            z: -68.745
        });
        shouldEqualT(dc_plus1.calcXYZ(angles[1]), {
            x: 0,
            y: 0,
            z: -68.492
        });
        shouldEqualT(dc_plus1.calcXYZ(angles[2]), {
            x: 99.947,
            y: 0.213,
            z: -68.745
        });

        shouldEqualT(dc_minus1.calcXYZ(angles[0]), {
            x: -100.025,
            y: -0.218,
            z: -71.238
        });
        shouldEqualT(dc_minus1.calcXYZ(angles[1]), {
            x: 0,
            y: 0,
            z: -71.491
        });
        shouldEqualT(dc_minus1.calcXYZ(angles[2]), {
            x: 100.025,
            y: -0.218,
            z: -71.238
        });
    });
    it("homing error affects perspective", function() {
        var dc = new DeltaCalculator();
        for (var z = 0; z >= -100; z -= 10) {
            var row = [];
            var angles = dc.calcAngles({
                x: 0,
                y: 0,
                z: z
            });
            for (var a = -5; a <= 5; a++) {
                var xyz = dc.calcXYZ({
                    theta1: angles.theta1 + a,
                    theta2: angles.theta2 + a,
                    theta3: angles.theta3 + a,
                });
                row.push(xyz.z);
            }
            logger.debug(z, row);
        }
    });
    it("eTheta1..3 should compensate for homing error", function() {
        var dc0 = new DeltaCalculator({
            eTheta1: 0,
            eTheta2: 0,
            eTheta3: 0
        });
        var angles_x100 = {
            theta1: 42.859,
            theta2: 21.470,
            theta3: 60.082
        };
        var xyz = {
            x: 100,
            y: 0,
            z: -50
        };
        shouldEqualT(dc0.calcAngles(xyz), angles_x100);
        var dc1 = new DeltaCalculator({
            eTheta1: 1,
            eTheta2: 1,
            eTheta3: 1
        });
        dc1.eTheta1.should.equal(1);
        dc1.dz.should.equal(dc0.dz);
        shouldEqualT(dc1.calcAngles(xyz), {
            theta1: angles_x100.theta1 + 1,
            theta2: angles_x100.theta2 + 1,
            theta3: angles_x100.theta3 + 1,
        });
        shouldEqualT(dc1.calcXYZ(dc1.calcAngles(xyz)), xyz);
    });
    it("gradient", function() {
        var dc1 = new DeltaCalculator({
            steps360: 200
        });
        var dc2 = new DeltaCalculator({
            steps360: 200
        });

        var em = 0.05;
        var dp = 200;
        var dim = 1;
        var epulse = 800; // 0.510
        dc2.gearRatio *= 1 - dim * 1 * em; // 0.053
        dc2.f *= 1 - dim * 1 * em; // 0.045
        dc2.re *= 1 + dim * 1 * em; // 0.04
        dc2.e *= 1 + dim * 1 * em; // 0.029
        dc2.rf *= 1 - dim * 1 * em; // 0.023
        logger.debug("p\tz\tdx\tdy\tdz\tdz_x50\tzbowl");
        for (var p = -600; p <= 2200; p += dp) {
            var pulses = {
                p1: p,
                p2: p,
                p3: p
            };
            var xyz0 = dc1.calcXYZ(pulses);
            var pulses_x50 = dc1.calcPulses({
                x: 50,
                y: 0,
                z: xyz0.z
            });
            var exyz50 = dc2.calcXYZ({
                p1: pulses_x50.p1 + epulse,
                p2: pulses_x50.p2 + epulse,
                p3: pulses_x50.p3 + epulse,
            });
            var exyz0 = dc2.calcXYZ({
                p1: pulses.p1 + epulse,
                p2: pulses.p2 + epulse,
                p3: pulses.p3 + epulse,
            });
            logger.withPlaces(3).debug(p, "\t", xyz0.z,
                "\t", exyz50.x - 50, "\t", exyz50.y, "\t", exyz0.z - xyz0.z, "\t", exyz50.z - xyz0.z,
                "\t", exyz50.z - exyz0.z);
            pulses_x50.p1 += dp;
            pulses_x50.p2 += dp;
            pulses_x50.p3 += dp;
        }
    });
    it("getMinDegrees() should return minimum homing angle", function() {
        var dc = new DeltaCalculator();
        dc.getMinDegrees().should.within(-52.33002, -52.33001);
    });
    it("should process hex probe data", function() {
        // data: ctr, 0, 60, 120, 180, 240, 300, ctr
        var data = [-62.259, -61.664, -61.525, -61.453, -61.531, -61.683, -61.743, -62.278];
        var ctrAvg = (data[0] + data[7]) / 2;
        logger.debug("ctrAvg:", ctrAvg);
        var rimAvg = (data[1] + data[2] + data[3] + data[4] + data[5] + data[6]) / 6;
        logger.debug("rimAvg:", rimAvg);
        var error = rimAvg - ctrAvg;
        logger.debug("error:", error);

        var radius = 50;
        var dc = new DeltaCalculator();
        var pulsesRadius = dc.calcPulses({
            x: radius,
            y: 0,
            z: ctrAvg
        });
        var pulsesCenter = dc.calcPulses({
            x: 0,
            y: 0,
            z: ctrAvg
        });
        for (var eTheta = -15; eTheta <= 15; eTheta++) {
            var zError = dc.zBowlError(pulsesCenter, pulsesRadius, eTheta);
            logger.debug("eTheta:", eTheta, " zErr:", zError);
        }

        var homeAngle = -52.329;

        //rimAvg is accurate. Individual angles differ by only +/- 0.004
        //var deg0Avg = (data[1]+data[4])/2;
        //logger.debug("deg0Avg:", deg0Avg);
        //var deg60Avg = (data[2]+data[5])/2;
        //logger.debug("deg60Avg:", deg60Avg);
        //var deg120Avg = (data[3]+data[6])/2;
        //logger.debug("deg120Avg:", deg120Avg);
    });
    it("TESTTESTshould match C++ FireStep kinematics", function() {
        var delta = DeltaCalculator.createLooseCanonRAMPS();
        should.deepEqual(delta.calcPulses({
            x: 0,
            y: 0,
            z: 50
        }), {
            p1: -3389,
            p2: -3389,
            p3: -3389,
        });
        should.deepEqual(delta.calcPulses({
            x: 0,
            y: 0,
            z: 10
        }), {
            p1: -551,
            p2: -551,
            p3: -551,
        });
        should.deepEqual(delta.calcPulses({
            x: 20,
            y: 50,
            z: -10
        }), {
            p1: 1892,
            p2: -114,
            p3: 657,
        });
        should.deepEqual(delta.calcPulses({
            x: 5,
            y: -50,
            z: -50
        }), {
            p1: 1798,
            p2: 3178,
            p3: 3335,
        });
    });
    it("TESTTESTcalcPulses()/calcXYZ() should round trip", function() {
        var delta = DeltaCalculator.createLooseCanonRAMPS();
        var xyz0 = {x:-10,y:0,z:-50};
        var pulses1 = delta.calcPulses(xyz0);
        var xyz2 = delta.calcXYZ(pulses1);
        xyz2.x = Math.round(xyz2.x,3);
        xyz2.y = Math.round(xyz2.y,3);
        xyz2.z = Math.round(xyz2.z,3);
        var pulses2 = delta.calcPulses(xyz2);
        should.deepEqual(pulses1, pulses2);
        logger.withPlaces(5).info({xyz0:xyz0,xyz2:xyz2});

        var xyz0 = {x:0,y:90,z:-50};
        var pulses0 = delta.calcPulses(xyz0);
        var xyz1 = delta.calcXYZ(pulses0);
        xyz1.x = Math.round(xyz1.x,3);
        xyz1.y = Math.round(xyz1.y,3);
        xyz1.z = Math.round(xyz1.z,3);
        var pulses1 = delta.calcPulses(xyz1);
        var xyz2 = delta.calcXYZ(pulses1);
        xyz2.x = Math.round(xyz2.x,3);
        xyz2.y = Math.round(xyz2.y,3);
        xyz2.z = Math.round(xyz2.z,3);
        var pulses2 = delta.calcPulses(xyz2);
        should.deepEqual(pulses0, pulses1);
        should.deepEqual(pulses1, pulses2);
        logger.withPlaces(5).info({xyz0:xyz0,xyz2:xyz2,pulses1:pulses1});
    });
});

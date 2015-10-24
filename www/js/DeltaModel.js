// Derived from: http://forums.trossenrobotics.com/tutorials/introduction-129/delta-robot-kinematics-3276/
// Modifications: (c) Karl Lew 2014

var firepick;
(function(firepick) {
    var sqrt3 = Math.sqrt(3.0);
    var pi = Math.PI;
    var sin120 = sqrt3 / 2.0;
    var cos120 = -0.5;
    var tan60 = sqrt3;
    var sin30 = 0.5;
    var tan30 = 1 / sqrt3;
    var tan30_half = tan30 / 2.0;
    var dtr = pi / 180.0;

    var DeltaModel = (function() {
        function DeltaModel() {
            this.e = 115; // effector equilateral triangle side
            this.f = 457.3; // base equilateral triangle side
            this.re = 232; // effector arm length
            this.rf = 112; // base arm length
            this.setPrecision(3);
            this.theta1 = 0;
            this.theta2 = 0;
            this.theta3 = 0;
            this.setAngles(this.getAngles());
            return this;
        };
        DeltaModel.prototype.getPrecision = function() {
            return this.precision;
        };
        DeltaModel.prototype.setPrecision = function(value) {
            assert.ok(0 <= value && value <= 9);
            this.precisionFactor = Math.pow(10, value);
            this.precision = value;
            return this;
        };
        DeltaModel.prototype.getXYZ = function() {
            return {
                x: this.X,
                y: this.Y,
                z: this.Z
            };
        };
        DeltaModel.prototype.setXYZ = function(value) {
            this.X = value.x;
            this.Y = value.y;
            this.Z = value.z;
            return this;
        };
        DeltaModel.prototype.getAngles = function() {
            return {
                theta1: this.theta1,
                theta2: this.theta2,
                theta3: this.theta3
            };
        };
        DeltaModel.prototype.setAngles = function(value) {
            this.theta1 = value.theta1;
            this.theta2 = value.theta2;
            this.theta3 = value.theta3;
            return this;
        };
        DeltaModel.prototype.isValid = function() {
            return this.ok;
        };
        DeltaModel.prototype.round = function(value) {
            if (isNaN(value)) {
                assert.ok(value);
                assert.ok(value.hasOwnProperty("x"));
                assert.ok(value.hasOwnProperty("y"));
                assert.ok(value.hasOwnProperty("z"));
                return {
                    x: this.round(value.x),
                    y: this.round(value.y),
                    z: this.round(value.z)
                };
            }
            return Math.round(value * this.precisionFactor) / this.precisionFactor;
        };
        DeltaModel.prototype.getDimensions = function() {
            return {
                e: [this.e, this.e, this.e],
                f: [this.f, this.f, this.f],
                re: [this.re, this.re, this.re],
                rf: [this.rf, this.rf, this.rf]
            };
        };
        DeltaModel.prototype.validateXYZ = function(xyz) {
            assert.ok(xyz != null);
            assert.ok(xyz.hasOwnProperty("x"));
            assert.ok(xyz.hasOwnProperty("y"));
            assert.ok(xyz.hasOwnProperty("z"));
            return this;
        };
        DeltaModel.prototype.validateAngles = function(angles) {
            assert.ok(angles != null);
            assert.ok(angles.hasOwnProperty("theta1"));
            assert.ok(angles.hasOwnProperty("theta2"));
            assert.ok(angles.hasOwnProperty("theta3"));
            return this;
        };
        DeltaModel.prototype.calcXYZ = function(angles) {
            this.validateAngles(angles);
            var t = (this.f - this.e) * tan30 / 2;
            var theta1 = angles.theta1 * dtr;
            var theta2 = angles.theta2 * dtr;
            var theta3 = angles.theta3 * dtr;
            var y1 = -(t + this.rf * Math.cos(theta1));
            var z1 = -this.rf * Math.sin(theta1);
            var y2 = (t + this.rf * Math.cos(theta2)) * sin30;
            var x2 = y2 * tan60;
            var z2 = -this.rf * Math.sin(theta2);
            var y3 = (t + this.rf * Math.cos(theta3)) * sin30;
            var x3 = -y3 * tan60;
            var z3 = -this.rf * Math.sin(theta3);
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
            var c = (b2 - y1 * dnm) * (b2 - y1 * dnm) + b1 * b1 + dnm * dnm * (z1 * z1 - this.re * this.re);
            // discriminant
            var d = b * b - 4.0 * a * c;
            var result;
            if (d < 0) { // point exists
                result = null;
            } else {
                result = {};
                result.z = -0.5 * (b + Math.sqrt(d)) / a;
                result.x = (a1 * result.z + b1) / dnm;
                result.y = (a2 * result.z + b2) / dnm;
            }
            return result;
        };
        DeltaModel.prototype.setAngles = function(angles) {
            this.validateAngles(angles);
            this.theta1 = angles.theta1;
            this.theta2 = angles.theta2;
            this.theta3 = angles.theta3;
            var xyz = this.calcXYZ(angles);
            if (xyz) {
                this.X = xyz.x;
                this.Y = xyz.y;
                this.Z = xyz.z;
                this.ok = true;
            } else {
                this.ok = false;
            }
            return this;
        };
        return DeltaModel;
    })();
    firepick.DeltaModel = DeltaModel;
})(firepick || (firepick = {}));

<!-- @ifdef TEST -->
(function(firepick) {
    firepick.DeltaModelTest = function() {
        var ok = true;
        try {
            console.log("DeltaModelTest() BEGIN");
            var fpd = new firepick.DeltaModel();

            // Accessors
            assert.ok(fpd.isValid());
            assert.equal(1.234, fpd.round(1.2341));
            assert.equal(-1.234, fpd.round(-1.2341));
            assert.deepEqual({
                x: 1.234,
                y: 2.345,
                z: 3.456
            }, fpd.round({
                x: 1.2335,
                y: 2.3454,
                z: 3.4559
            }));
            assert.deepEqual({
                x: 0,
                y: 0,
                z: -96.859
            }, fpd.round(fpd.getXYZ()));
            assert.deepEqual({
                theta1: 0,
                theta2: 0,
                theta3: 0
            }, fpd.getAngles());
            assert.equal(3, fpd.getPrecision());
            assert.equal(fpd, fpd.setPrecision(5));
            assert.equal(5, fpd.getPrecision());
            assert.deepEqual({
                    e: [115, 115, 115],
                    f: [457.3, 457.3, 457.3],
                    re: [232, 232, 232],
                    rf: [112, 112, 112]
                },
                fpd.getDimensions());

            // Forward kinematics
            assert.deepEqual({
                    x: 0,
                    y: 0,
                    z: -96.85902
                },
                fpd.round(fpd.calcXYZ({
                    theta1: 0,
                    theta2: 0,
                    theta3: 0
                })));
            assert.deepEqual({
                    x: 0,
                    y: 0,
                    z: -96.85902
                },
                fpd.round(fpd.calcXYZ({
                    theta1: 0,
                    theta2: 0,
                    theta3: 0
                })));
            fpd.setPrecision(6);
            fpd.setAngles({
                theta1: 0,
                theta2: 0,
                theta3: 0
            });
            assert.deepEqual({
                x: 0,
                y: 0,
                z: -96.859015
            }, fpd.round(fpd.calcXYZ(fpd.getAngles())));
            assert.ok(fpd.isValid());

            console.log("DeltaModelTest() PASS");
        } catch (ex) {
            console.log("ERROR	: " + ex);
            console.log(ex.stack);
            ok = false;
        }
        return {
            name: "DeltaModelTest",
            outcome: ok,
            description: "Delta model forward/inverse kinematics"
        };
    }

})(firepick || (firepick = {}));
<!-- @endif -->

/*
'use strict';

var services = angular.module('FireREST.services');

// http://forums.trossenrobotics.com/tutorials/introduction-129/delta-robot-kinematics-3276/
services.factory('DeltaCalculator', ['$http', 
function($http) {
  console.log("INFO	: Initializing DeltaCalculator");
  var sqrt3 = Math.sqrt(3.0);
  var pi = Math.PI;
  var sin120 = sqrt3/2.0;   
  var cos120 = -0.5;        
  var tan60 = sqrt3;
  var sin30 = 0.5;
  var tan30 = 1/sqrt3;
  var tan30_half = tan30/2.0;
  var dtr = pi/180.0;
  var delta = {
    e: 115.0,     // end effector
    f: 457.3,     // base
    re: 232.0,
    rf: 112.0,
    ok: true,
    X:0,
    Y:0,
    Z:-100,
    theta1:0,
    theta2:0,
    theta3:0,
    orbit_camera:false,

 
    // inverse kinematics
    // helper functions, calculates angle theta1 (for YZ-pane)
    calcAngleYZ: function(X,Y,Z) {
      var y1 = -tan30_half * delta.f; // f/2 * tg 30
      Y -= tan30_half * delta.e;    // shift center to edge
      // z = a + b*y
      var a = (X*X + Y*Y + Z*Z +delta.rf*delta.rf - delta.re*delta.re - y1*y1)/(2.0*Z);
      var b = (y1-Y)/Z;
      // discriminant
      var d = -(a+b*y1)*(a+b*y1)+delta.rf*(b*b*delta.rf+delta.rf); 
      if (d < 0) {
	delta.ok = false;
      } else {
	delta.ok = true;
	var yj = (y1 - a*b - Math.sqrt(d))/(b*b + 1.0); // choosing outer point
	var zj = a + b*yj;
	return 180.0*Math.atan(-zj/(y1 - yj))/pi + ((yj>y1) ? 180.0 : 0.0);
      }
      return -1;
    },
 
    // inverse kinematics: (X, Y, Z) -> (theta1, theta2, theta3)
    // returned status: 0=OK, -1=non-existing position
    calcInverse: function() {
      var theta1 = delta.calcAngleYZ(delta.X, delta.Y, delta.Z);
      var theta2 = delta.theta2;
      var theta3 = delta.theta3;
      if (delta.ok) {
	theta2 = delta.calcAngleYZ(delta.X*cos120 + delta.Y*sin120, delta.Y*cos120-delta.X*sin120, delta.Z);  // rotate coords to +120 deg
      }
      if (delta.ok) {
	theta3 = delta.calcAngleYZ(delta.X*cos120 - delta.Y*sin120, delta.Y*cos120+delta.X*sin120, delta.Z);  // rotate coords to -120 deg
      }
      if (delta.ok) {
	delta.theta1 = theta1;
	delta.theta2 = theta2;
	delta.theta3 = theta3;
      }
      return delta.ok;
    },

    testInverse: function() {
      var X = delta.X;
      var Y = delta.Y;
      var Z = delta.Z;
      delta.calcInverse();
      if (delta.ok) {
	delta.calcForward();
	delta.errX = delta.X-X;
	delta.errY = delta.Y-Y;
	delta.errZ = delta.Z-Z;
	delta.X = X;
	delta.Y = Y;
	delta.Z = Z;
      }
    },
    testForward: function() {
      var theta1 = delta.theta1;
      var theta2 = delta.theta2;
      var theta3 = delta.theta3;
      delta.calcForward();
      if (delta.ok) {
	delta.calcInverse();
	delta.errTheta1 = delta.theta1-theta1;
	delta.errTheta2 = delta.theta2-theta2;
	delta.errTheta3 = delta.theta3-theta3;
	delta.theta1 = theta1;
	delta.theta2 = theta2;
	delta.theta3 = theta3;
      }
    }

  };

  return delta;
}]);
*/

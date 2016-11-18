
var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");
var mathjs = require("mathjs").create();

/*
 * KinematicC3: Kinematic model for 3-axis cartesian robot
 */
(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function KinematicC3(options={}) {
        var that = this;

        var mmMicrosteps = options.mmMicrosteps || {
            x: Axis.pulleyMmMicrosteps(),
            y: Axis.pulleyMmMicrosteps(),
            z: Axis.pulleyMmMicrosteps(),
        };
        that.x = new Axis({mmMicrosteps: mmMicrosteps.x});
        that.y = new Axis({mmMicrosteps: mmMicrosteps.y});
        that.z = new Axis({mmMicrosteps: mmMicrosteps.z});
        that.bedPlane(options.bed || new Plane());
        that.ySkew({x:0,y:1},{x:0,y:0});

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
            that.$ySkew = {
                a: dy,
                b: -dx,
                c: dy * p1.x - dx * p1.y,
            }
            if (1/that.$ySkew.b < 0) {
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
    KinematicC3.prototype.toMicrosteps = function(xyz) {
        var that = this;
        var x0 = that.$ySkew.c / that.$ySkew.a;
        var skewXofY = x0-that.$ySkew.b * xyz.y / that.$ySkew.a;
        var skewX = xyz.x - skewXofY;
        var dx = skewXofY - x0;
        var dy = xyz.y;
        var skewY = Math.sqrt(dx*dx + dy*dy);
        var xyzMicrosteps = {
            x: skewX * that.x.mmMicrosteps,
            y: skewY * that.y.mmMicrosteps,
            z: xyz.z * that.z.mmMicrosteps,
        };
        return xyzMicrosteps;
    }
    KinematicC3.prototype.fromMicrosteps = function(xyzMicrosteps) {
        var that = this;
        var xyz = {
            x: xyzMicrosteps.x / that.x.mmMicrosteps,
            y: xyzMicrosteps.y / that.y.mmMicrosteps,
            z: xyzMicrosteps.z / that.z.mmMicrosteps,
        }
        return xyz;
    }
    
    ///////////////// KinematicC3 class
    function Plane(p1, p2, p3) {
        var that = this;
        if (p1 == null) {
            p1 = { x: 0, y: 0, z: 0};
            p2 = { x: 1, y: 0, z: 0};
            p3 = { x: 0, y: 1, z: 0};
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

        that.a =  v12.y * v13.z - v12.z * v13.y;
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
    Plane.prototype.zOfXY = function (x, y) {
        var that = this;
        return (that.d - that.a * x - that.b * y) / that.c;
    }

    function Axis(options={}) {
        var that = this;

        that.mmMicrosteps = options.mmMicrosteps || Axis.pulleyMmMicrosteps();
        that.position = 0;
        that.invertDirection = options.invertDirection || false;

        return that;
    }

    Axis.pulleyMmMicrosteps = function(pitch = 2, pulleyTeeth = 20, stepsPerRev = 200, microsteps = 16) {
        return stepsPerRev * microsteps / (pulleyTeeth * pitch);
    }

    KinematicC3.Axis = Axis;
    KinematicC3.Plane = Plane;

    module.exports = exports.KinematicC3 = KinematicC3;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("KinematicC3", function() {
    var KinematicC3 = exports.KinematicC3; // require("./KinematicC3");
    console.log(typeof KinematicC3);

    it("pulleyMmMicrosteps(pitch, pulleyTeeth, stepsPerRev, microsteps) returns microsteps required to travel 1 mm", function() {
        KinematicC3.Axis.pulleyMmMicrosteps(2, 20, 200, 16).should.equal(80);
    })
    it("KinematicC3.Axis(options) creates a stepper axis", function() {
        var axis = new KinematicC3.Axis();
        axis.position.should.equal(0);
        axis.invertDirection.should.equal(false);
        axis.mmMicrosteps.should.equal(80);
        var axis = new KinematicC3.Axis({
            mmMicrosteps: 12.34,
        });
        axis.position.should.equal(0);
        axis.invertDirection.should.equal(false);
        axis.mmMicrosteps.should.equal(12.34);
    })
    it("KinematicC3.Plane(p1,p2,p3) creates a 3D plane", function() {
        var p1 = {x: 1, y: -2, z: 0};
        var p2 = {x: 3, y: 1, z: 4};
        var p3 = {x: 0, y: -1, z: 2};
        var plane1 = new KinematicC3.Plane(p1, p2, p3);
        plane1.should.properties({
            a: 2,
            b: -8,
            c: 5,
            d: 18,
        });
        should(plane1.a*p1.x + plane1.b*p1.y + plane1.c*p1.z).equal(plane1.d);
        should(plane1.a*p2.x + plane1.b*p2.y + plane1.c*p2.z).equal(plane1.d);
        should(plane1.a*p3.x + plane1.b*p3.y + plane1.c*p3.z).equal(plane1.d);

        var plane2 = new KinematicC3.Plane(p2, p1, p3);
        should.deepEqual(plane1, plane2); // point order is irrelevant

        var flatPlane = new KinematicC3.Plane([
            {x:0, y: -11, z:1}, 
            {x:19, y: 7, z:1}, 
            {x:2, y: 3, z:1}
        ]);
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
        var p1 = {x: 1, y: -2, z: 0};
        var p2 = {x: 3, y: 1, z: 4};
        var p3 = {x: 0, y: -1, z: 2};
        var plane1 = new KinematicC3.Plane(p1, p2, p3);
        plane1.zOfXY(1,-2).should.equal(0);
        plane1.zOfXY(3,1).should.equal(4);
        plane1.zOfXY(0,-1).should.equal(2);
    })
    it("TESTTESTtoMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc3 = new KinematicC3();
        var pt123 = { x: 1, y:2, z: 3};
        should.deepEqual(kc3.toMicrosteps(pt123), {
            x: 80,
            y: 160,
            z: 240,
        });
        var mmMicrosteps = {
            x: 1,
            y: 10,
            z: 100,
        }
        var kc3 = new KinematicC3({mmMicrosteps: mmMicrosteps});
        should.deepEqual(kc3.toMicrosteps({x:1,y:1,z:1}), mmMicrosteps);
    })
    it("TESTTESTfromMicrosteps(xyz) returns microstep coordinates for given point", function() {
        var kc3 = new KinematicC3();
        var pt123Microsteps = { x: 80, y:160, z: 240};
        should.deepEqual(kc3.fromMicrosteps(pt123Microsteps), {
            x: 1,
            y: 2,
            z: 3,
        });
    })
    it("bedPlane(plane) sets/returns bed plane", function() {
        var kc3 = new KinematicC3();
        var planeDefault = kc3.bedPlane();
        var p1 = {x: 1, y: -2, z: 0};
        var p2 = {x: 3, y: 1, z: 4};
        var p3 = {x: 0, y: -1, z: 2};
        var plane1 = new KinematicC3.Plane(p1, p2, p3);
        should.deepEqual(kc3.bedPlane([p1,p2,p3]), plane1);
        should.deepEqual(kc3.bedPlane(), plane1);
    })
    it("TESTTESTySkew(p1,p2) sets/returns skewed and/or offset y-axis specified by two points", function() {
        var kc3 = new KinematicC3({
            mmMicrosteps: {
                x: 1,
                y: 1,
                z: 1,
            }
        });
        should.deepEqual(kc3.ySkew(), {
            a: 1,
            b: 0,
            c: 0,
        }); // standard y-axis
        should
        var p1 = {x: 1, y: 2, z: 10};
        var p2 = {x: 2, y: 3, z: 10};
        var ySkew = {
            a: -1,
            b: 1,
            c: 1,
        };
        should.deepEqual(kc3.ySkew(p1, p2), ySkew);
        should.deepEqual(kc3.ySkew(), ySkew);
        should.deepEqual(kc3.ySkew([p1, p2]), ySkew); // alternate form
        should.deepEqual(kc3.ySkew(), ySkew);
        should.deepEqual(kc3.toMicrosteps({x:0,y:0,z:0}), {
            x: 1,
            y: 0,
            z: 0,
        });
        var mSteps = kc3.toMicrosteps({x:0,y:1,z:2});
        mSteps.x.should.equal(0);
        mSteps.y.should.equal(Math.sqrt(2));
        mSteps.z.should.equal(2);
        var mSteps = kc3.toMicrosteps({x:-1,y:1,z:2});
        mSteps.x.should.equal(-1);
        mSteps.y.should.equal(Math.sqrt(2));
        mSteps.z.should.equal(2);
    })
})

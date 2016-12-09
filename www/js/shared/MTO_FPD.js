var should = require("should");
var math = require("mathjs");
var JsonUtil = require("./JsonUtil");
DeltaCalculator = require("./DeltaCalculator");

(function(exports) {
    ////////////////// constructor
    function MTO_FPD(options) {
        var that = this;
        options = options || {};
        that.verbose = options.verbose;
        that.delta = options.delta || DeltaCalculator.createLooseCanonRAMPS();
        that.kinematicModel = "Rotary delta";
        that.model = {
            type: that.constructor.name,
            dim: {
                e: that.delta.e,
                f: that.delta.f,
                gr: that.delta.gearRatio,
                re: that.delta.re,
                rf: that.delta.rf,
                st: that.delta.steps360,
                mi: that.delta.microsteps,
                spa: that.delta.spAngle,
                spr: that.delta.spRatio,
                ha: Math.round(that.delta.homeAngle() * 1000) / 1000,
            },
            sys: {
                to: 1,
            }
        }
        return that;
    }
    MTO_FPD.prototype.serialize = function() {
        var that = this;
        return JSON.stringify(that.model);
    }
    MTO_FPD.prototype.deserialize = function(s) {
        var that = this;
        var model = JSON.parse(s);
        JsonUtil.applyJson(that.model, model);
        that.delta = that.createDeltaCalculator();
        return that;
    }
    MTO_FPD.prototype.createDeltaCalculator = function() {
        var that = this;
        var options = {
            e: that.model.dim.e,
            f: that.model.dim.f,
            re: that.model.dim.re,
            rf: that.model.dim.rf,
            gearRatio: that.model.dim.gr,
            spAngle: that.model.dim.spa,
            spRatio: that.model.dim.spr,
            steps360: that.model.dim.st,
            microsteps: that.model.dim.mi,
            homeAngles: {
                theta1: that.model.dim.ha,
                theta2: that.model.dim.ha,
                theta3: that.model.dim.ha,
            }
        };
        return new DeltaCalculator(options);
    }
    MTO_FPD.prototype.getModel = function() {
        var that = this;
        return JSON.parse(JSON.stringify(that.model));
    }
    MTO_FPD.prototype.updateDimensions = function(dim) {
        var that = this;
        that.model.dim.e = dim.e || that.model.dim.e;
        that.model.dim.f = dim.f || that.model.dim.f;
        that.model.dim.re = dim.re || that.model.dim.re;
        that.model.dim.rf = dim.rf || that.model.dim.rf;
        that.model.dim.gr = dim.gr || that.model.dim.gr;
        that.model.dim.spa = dim.spa == null ? that.model.dim.spa : dim.spa;
        that.model.dim.spr = dim.spr == null ? that.model.dim.spr : dim.spr;
        that.model.dim.st = dim.st || that.model.dim.st;
        that.model.dim.mi = dim.mi || that.model.dim.mi;
        that.model.dim.ha = dim.ha || that.model.dim.ha;
        that.delta = that.createDeltaCalculator();
        that.verbose && console.log("TTY\t: MTO_FPD.updateDimensions(" + JSON.stringify(that.model.dim) + ")");
    }
    MTO_FPD.prototype.calcPulses = function(xyz) {
        var that = this;
        return that.delta.calcPulses(xyz);
    }
    MTO_FPD.prototype.calcXYZ = function(pulses) {
        var that = this;
        var xyz = that.delta.calcXYZ(pulses);
        return {
            x: Math.round(xyz.x * 1000) / 1000,
            y: Math.round(xyz.y * 1000) / 1000,
            z: Math.round(xyz.z * 1000) / 1000,
        };
    }

    module.exports = exports.MTO_FPD = MTO_FPD;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MTO_FPD", function() {
    var MTO_FPD = exports.MTO_FPD;
    it("getModel() should return data model", function() {
        var mto = new MTO_FPD();
        should.deepEqual(mto.getModel(), {
            name: "MTO_FPD",
            dim: {
                e: 131.64,
                f: 190.53,
                gr: 9.47375,
                ha: 60.33,
                mi: 16,
                re: 270,
                rf: 90,
                spa: -54.617,
                spr: -0.383,
                st: 200,
            },
            sys: {
                to: 1, // system topology FireStep MTO_XYZ
            }
        });
    })
    it("MTO_FPD should calcPulses({x:1,y:2,z:3.485}", function() {
        var mto = new MTO_FPD();
        var xyz = {
            x: 1,
            y: 2,
            z: 3.485
        };
        should.deepEqual(mto.calcPulses(xyz), {
            p1: -141,
            p2: -232,
            p3: -191,
        });
    })
    it("MTO_FPD should calcXYZ({x:1,y:2,z:3.485}", function() {
        var mto = new MTO_FPD();
        var pulses = {
            p1: -141,
            p2: -232,
            p3: -191
        };
        should.deepEqual(mto.calcXYZ(pulses), {
            x: 1.006,
            y: 1.997,
            z: 3.486,
        });
    })
    it("serialize/deserialize() save and restore model state", function() {
        var mto1 = new MTO_FPD();
        mto1.updateDimensions({
            re: 260,
            rf: 99,
        });
        var mto2 = new MTO_FPD();
        var s = mto1.serialize();
        console.log(s);
        mto2.deserialize(s);
        should.deepEqual(mto1.model, mto2.model);
    })
})

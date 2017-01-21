var JsonUtil = require("./JsonUtil");

/*
 * MTO_Base 
 * ===========
 * Kinematic base model for up to 9 axes
 */
(function(exports) {
    var AXIS_IDS = "xyzabc";

    ////////////////// constructor
    function MTO_Base(options = {}) {
        var that = this;

        that.model = options.model || {};
        that.model.type = "MTO_Base";
        that.nAxes = options.nAxes || 4;
        if (that.nAxes < 1 || AXIS_IDS.length < that.nAxes) {
            throw  new Error("Invalid nAxes:"+that.nAxes);
        }
        that.resolve(); // apply default options
        for (var iAxis = 0; iAxis < that.model.axes.length; iAxis++) {
            var axis = that.model.axes[iAxis];
            var optionKey = axis.id + "Axis";
            options[optionKey] && JsonUtil.applyJson(axis, options[optionKey]);
        }
        that.resolve(); // resolve updated options

        return that;
    }

    ///////////////// MTO_Base instance
    MTO_Base.prototype.calcMotor = function(world) {
        console.log("Abstract method calcMotor("+world+")");
        return null;
    }
    MTO_Base.prototype.calcWorld = function(motor) {
        console.log("Abstract method calcWorld("+motor+")");
        return null;
    }
    MTO_Base.prototype.resolve = function() {
        var that = this;
        that.axisMap = that.axisMap || {};
        var axes = that.model.axes = that.model.axes || [];
        that.model.axes = that.model.axes || [];
        while (axes[that.nAxes-1] == null) {
            axes.push({});
        }
        for (var iAxis = 0; iAxis < that.model.axes.length; iAxis++) {
            var axis = that.model.axes[iAxis];
            axis.id = axis.id || AXIS_IDS[iAxis];
            that.axisMap[axis.id] = axis;
        }
        that.model.version = that.model.version || 1;

        for (var iAxis = 0; iAxis < 4; iAxis++) {
            var axis = axes[iAxis] = axes[iAxis] || {};
            axis.id = "xyza"[iAxis];
            axis.motor = iAxis;
            that.resolveAxis(axis);
        }

        return that;
    }
    MTO_Base.prototype.resolveAxis = function(axis, reset=false) {
        var that = this;
        axis.name = !reset && axis.name || (axis.id.toUpperCase() + "-axis");
        var homeMin = axis.id === "z" ? false : true;
        var steps = axis.steps = !reset && axis.steps || 200;
        var microsteps = axis.microsteps = !reset && axis.microsteps || 16;
        var mstepPulses = axis.mstepPulses = !reset && axis.mstepPulses || 1;
        axis.drive = !reset && axis.drive || (axis.id === "x" || axis.id === "y" ? "belt" : "screw");
        axis.maxHz = !reset && axis.maxHz || 18000;
        axis.tAccel = !reset && axis.tAccel || 0.4;
        !reset && axis.enabled != null || (axis.enabled = false);
        if (axis.homeMin == null) {
            axis.homeMin = homeMin;
            axis.homeMax = !homeMin;
        }
        if (axis.drive === 'belt') {
            var pitch = axis.pitch = !reset && axis.pitch || 2;
            var teeth = axis.teeth = !reset && axis.teeth || 16;
            var unitTravel = axis.unitTravel = (mstepPulses * teeth * pitch)/(steps * microsteps);
            axis.minPos = (reset || axis.minPos == null) ? 0 : axis.minPos;
            axis.maxPos = (reset || axis.maxPos == null) ? 200 : axis.maxPos;
        } else if (axis.drive === 'screw') {
            var lead = axis.lead = !reset && axis.lead || 0.8;
            var gearOut = axis.gearOut = !reset && axis.gearOut || 21;
            var gearIn = axis.gearIn = !reset && axis.gearIn || 17;
            var unitTravel = axis.unitTravel = 1/(steps * (microsteps/mstepPulses) * lead * (gearOut/gearIn));
            if (axis.id === 'z') {
                axis.minPos = (reset || axis.minPos == null) ? -10 : axis.minPos;
                axis.maxPos = (reset || axis.maxPos == null) ? 0 : axis.maxPos;
            } else {
                axis.minPos = (reset || axis.minPos == null) ? 0 : axis.minPos;
                axis.maxPos = (reset || axis.maxPos == null) ? 10 : axis.maxPos;
            }
        } else {
            var unitTravel = axis.unitTravel = !reset && axis.unitTravel || 1/100;
            axis.minPos = (reset || axis.minPos == null) ? 0 : axis.minPos;
            axis.maxPos = (reset || axis.maxPos == null) ? 10 : axis.maxPos;
        }
        return axis;
    }
    MTO_Base.prototype.deserialize = function(s) {
        var that = this;
        var delta = JSON.parse(s);
        if (delta.type && delta.type !== that.model.type) {
            throw new Error("MTO_Base deserialize() unexpected type:" + delta.type);
        }
        if (delta.version && delta.version !== that.model.version) {
            throw new Error("deserialize() unsupported version:" + delta.version);
        }
        JsonUtil.applyJson(that.model, JSON.parse(s));
    }
    MTO_Base.prototype.serialize = function() {
        var that = this;
        return JSON.stringify(that.model);
    }

    ///////////////// MTO_Base class

    module.exports = exports.MTO_Base = MTO_Base;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MTO_Base", function() {
    var should = require("should");
    var MTO_Base = exports.MTO_Base; // require("./MTO_Base");
    function MTO_Sub(options={}) {
        var that = this;
        that.resolved = 0;
        that.super = Object.getPrototypeOf(Object.getPrototypeOf(that)); // TODO: use ECMAScript 2015 super 
        that.super.constructor.call(that, options);
        that.model.type = "MTO_Sub";
    }
    MTO_Sub.prototype = Object.create(MTO_Base.prototype);
    MTO_Sub.prototype.resolve = function() {
        var that = this;
        that.super.resolve.call(that); 
        that.resolved++;
        return that;
    }
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

    it("resolveAxis(axis,reset) resolves inconsistencies in axis model", function() {
        MTO_Base.prototype.resolveAxis.call(null,{
            id: "x",
            pitch: 2, 
            teeth: 20, 
            steps: 200, 
            microsteps: 16,
        }).unitTravel.should.equal(1/80);
        MTO_Base.prototype.resolveAxis.call(null,{
            id: "x",
            pitch: 2, 
            teeth: 20, 
            steps: 200, 
            microsteps: 16,
            mstepPulses: 2,
        }).unitTravel.should.equal(1/40);

        // resolveAxis can reset default values
        var mtoNew = new MTO_Base();
        var newModel = mtoNew.model;
        newModel.axes[0].maxPos = 201;
        newModel.axes[1].maxPos = 202;
        mtoNew.resolveAxis.call(null, newModel.axes[0], true);
        newModel.axes[0].maxPos.should.equal(200);
        newModel.axes[1].maxPos.should.equal(202);
    })

    it("serialize/deserialize() save and restore model state", function() {
        var mto1 = new MTO_Sub(model100);
        var mto2 = new MTO_Sub(model111);
        var s = mto2.serialize();
        mto1.deserialize(s);
        mto1.model.type.should.equal("MTO_Sub");
        should.deepEqual(mto1.model, mto2.model);
    })
    it("axisMap[axisId] return axis with given id", function() {
        var mto = new MTO_Sub();
        var axes = mto.model.axes;
        axes[0].should.equal(mto.axisMap.x);
        axes[1].should.equal(mto.axisMap.y);
        axes[2].should.equal(mto.axisMap.z);
        axes[3].should.equal(mto.axisMap.a);
        should.equal(true, null == mto.axisMap["?"]);
    })
    it("resolve(model) resolves model changes and inconsistencies", function() {
        var mto = new MTO_Sub();
        mto.model.axes[0].mstepPulses.should.equal(1);
        mto.model.axes[0].unitTravel.should.equal(0.01);
        mto.model.axes[0].mstepPulses = 3;
        mto.model.axes[0].unitTravel.should.equal(0.01);
        mto.resolve().should.equal(mto); // instance resolve()
        mto.model.axes[0].unitTravel.should.equal(0.03);
        mto.model.axes[0].mstepPulses = 4;
    })
    it("MTO_Sub({model:model}) binds and resolves given model", function() {
        var mto1 = new MTO_Sub();
        var mto2 = new MTO_Sub({model:mto1.model});
        mto1.model.should.equal(mto2.model);
        var model = {};
        var mto3 = new MTO_Sub({model:model});
        should.deepEqual(mto1.model, model);
        should.deepEqual(mto3.model, model);
        model.axes[0].enabled.should.equal(false);
        model.axes[1].enabled.should.equal(false);
        model.axes[2].enabled.should.equal(false);
        model.axes[3].enabled.should.equal(false);
    })
    it("MTO_Sub is subclass of MTO_Base", function() {
        var mto = new MTO_Sub();
        mto.model.type.should.equal("MTO_Sub");
        mto.resolved.should.equal(2);
        MTO_Sub.prototype.should.equal(Object.getPrototypeOf(mto));
        MTO_Base.prototype.should.equal(Object.getPrototypeOf(Object.getPrototypeOf(mto)));
    });
})

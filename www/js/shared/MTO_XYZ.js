var should = require("should");
var Logger = require("./Logger");

(function(exports) {
    ////////////////// constructor
    function MTO_XYZ(options) {
        var that = this;
        options = options || {};
        that.microsteps = options.microsteps || 16;
        that.steps360 = options.steps360 || 200;
        that.drivePD = options.drivePD || 16 * 2;
        var travel = that.drivePD;
        that.kinematicModel = "Cartesian";
        that.logger = options.logger || new Logger(options);
        if (options.verbose) {
            that.verbose = options.verbose;
        }
        that.travel = options.travel || {
            x: travel,
            y: travel,
            z: travel,
        };
        that.model = {
            type: that.constructor.name,
            dim: {
                tr: travel
            },
            sys: {
                to: 2,
                mv: 16000,
                tv: 0.7,
            },
            x: {},
            y: {},
            z: {},
        }
        return that;
    }
    MTO_XYZ.prototype.serialize = function() {
        var that = this;
        return JSON.stringify(that.model);
    }
    MTO_XYZ.prototype.deserialize = function(s) {
        var that = this;
        var model = JSON.parse(s);
        that.updateDimensions(model.dim);
    }
    MTO_XYZ.prototype.getModel = function() {
        var that = this;
        return JSON.parse(JSON.stringify(that.model));
    }
    MTO_XYZ.prototype.updateDimensions = function(dim) {
        var that = this;
        that.model.dim.travel = dim.travel || that.model.dim.travel;
        if (typeof dim.tr === "number") {
            that.travel = {
                x: dim.tr,
                y: dim.tr,
                z: dim.tr,
            };
        } else if (typeof dim.tr === "object") {
            that.travel = {
                x: dim.tr.x || that.travel.x,
                y: dim.tr.y || that.travel.y,
                z: dim.tr.z || that.travel.z,
            };
        }
        that.microsteps = dim.mi || that.microsteps;
        that.steps360 = dim.st || that.steps360;
        that.verbose && logger.debug("TTY\t: MTO_XYZ.updateDimensions(" + JSON.stringify(dim) + ")");
    }
    MTO_XYZ.prototype.calcPulses = function(xyz) {
        var that = this;
        var revPulses = that.microsteps * that.steps360;
        return {
            p1: Math.round(revPulses * xyz.x / that.travel.x),
            p2: Math.round(revPulses * xyz.y / that.travel.y),
            p3: Math.round(revPulses * xyz.z / that.travel.z),
        };
    }
    MTO_XYZ.prototype.calcXYZ = function(pulses) {
        var that = this;
        var revPulses = that.microsteps * that.steps360;
        return {
            x: pulses.p1 * that.travel.x / revPulses,
            y: pulses.p2 * that.travel.y / revPulses,
            z: pulses.p3 * that.travel.z / revPulses,
        };
    }

    module.exports = exports.MTO_XYZ = MTO_XYZ;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MTO_XYZ", function() {
    var MTO_XYZ = exports.MTO_XYZ;
    it("getModel() should return data model", function() {
        var mto = new MTO_XYZ();
        should.deepEqual(mto.getModel(), {
            type: "MTO_XYZ",
            dim: {
                tr: 32,
            },
            sys: {
                to: 2, // system topology FireStep MTO_XYZ
                mv: 16000,
                tv: 0.7,
            },
            x: {},
            y: {},
            z: {},

        });
    })
    it("MTO_XYZ should calcPulses({x:1,y:2,z:3.485}", function() {
        var mto = new MTO_XYZ();
        var xyz = {
            x: 1,
            y: 2,
            z: 3.485
        };
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 100,
            p2: 200,
            p3: 349,
        });
    })
    it("updateDimensions({tr,mi,st}) should update pitch diameer, microsteps and steps/revolution", function() {
        var mto = new MTO_XYZ();
        var xyz = {
            x: 1,
            y: 2,
            z: 3.485
        };
        mto.updateDimensions({
            tr: 40,
            mi: 16,
            st: 400
        });
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 160,
            p2: 320,
            p3: 558,
        });
        mto.updateDimensions({
            tr: 32,
            mi: 16,
            st: 400
        });
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 200,
            p2: 400,
            p3: 697,
        });
        mto.updateDimensions({
            tr: 32,
            mi: 16,
            st: 200
        });
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 100,
            p2: 200,
            p3: 349,
        });
        mto.updateDimensions({
            tr: 32,
            mi: 32,
            st: 200
        });
        should.deepEqual(mto.calcPulses(xyz), {
            p1: 200,
            p2: 400,
            p3: 697,
        });
    })
    it("MTO_XYZ should calcXYZ({x:1,y:2,z:3.485}", function() {
        var mto = new MTO_XYZ();
        var pulses = {
            p1: 100,
            p2: 200,
            p3: 349
        };
        should.deepEqual(mto.calcXYZ(pulses), {
            x: 1,
            y: 2,
            z: 3.49,
        });
    })
    it("serialize/deserialize() save and restore model state", function() {
        var mto1 = new MTO_XYZ();
        mto1.updateDimensions({
            travel: {
                x: 1,
                y: 2,
                z: 3,
            }
        });
        var mto2 = new MTO_XYZ();
        var s = mto1.serialize();
        //console.log(s);
        mto2.deserialize(s);
        should.deepEqual(mto1.model, mto2.model);
    })
})

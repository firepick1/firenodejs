var should = require("should");

module.exports.MTO_XYZ = (function() {
    ////////////////// constructor
    function MTO_XYZ(options) {
        var that = this;
        options = options || {};
        var microsteps = 16;
        var revolution = 200;
        var teeth = 16;
        var travel = teeth * 2 / (microsteps * revolution);
        that.travel = options.travel || {
            x: travel,
            y: travel,
            z: travel,
        };
        that.model = {
            name: "MTO_XYZ",
            dim: {
                tr: travel
            },
            sys: {
                to: 2
            }
        }
        return that;
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
        console.log("TTY\t: MTO_XYZ.updateDimensions(" + JSON.stringify(dim) + ")");
    }
    MTO_XYZ.prototype.calcPulses = function(xyz) {
        var that = this;
        return {
            p1: Math.round(xyz.x / that.travel.x),
            p2: Math.round(xyz.y / that.travel.y),
            p3: Math.round(xyz.z / that.travel.z),
        };
    }
    MTO_XYZ.prototype.calcXYZ = function(pulses) {
        var that = this;
        return {
            x: pulses.p1 * that.travel.x,
            y: pulses.p2 * that.travel.y,
            z: pulses.p3 * that.travel.z,
        };
    }

    return MTO_XYZ;
})();

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MTO_XYZ", function() {
    var MTO_XYZ = exports.MTO_XYZ;
    it("getModel() should return data model", function() {
        var mto = new MTO_XYZ();
        should.deepEqual(mto.getModel(), {
            name: "MTO_XYZ",
            dim: {
                tr: 0.01
            },
            sys: {
                to: 2, // system topology FireStep MTO_XYZ
            }
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
})

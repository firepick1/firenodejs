var child_process = require('child_process');
var should = require("should");
var JsonUtil = require("../../www/js/shared/JsonUtil");
var Logger = require("../../www/js/shared/Logger");
var FireStepDriver = require("./firestep-driver");

function millis() {
    var hrt = process.hrtime();
    var ms = hrt[0] * 1000 + hrt[1] / 1000000;
    return ms;
}

(function(exports) {
    ////////////////// constructor
    function PositionService(options) {
        var that = this;
        options = options || {};

        that.logger = options.logger = options.logger || new Logger({
            nPlaces: 3
        });
        var marks = [];
        for (var i = 0; i < 6; i++) {
            marks.push({
                name: "Goto " + (i + 1),
                x: 0,
                y: 0,
                z: 0
            });
        }
        that.serviceBus = options.serviceBus;
        that.restSync = options.restSync;
        that.model = {
            available: null, // is REST service available?
            initialized: false, // is serial driver initialized?
            writes: 0, // number of serial writes
            reads: 0, // number of serial reads
            home: { // user coordinates when homed
                x: 0,
                y: 0,
                z: 0,
            },
            rest: {
                homeLPP: 5, // auto-home every N LPP moves (TODO: move to kinematics.MTO_FPD)
                lppSpeed: 0.8, // slow and safe (TODO: move to kinematics.MTO_FPD)
                lppZ: 50, // (TODO: move to kinematics.MTO_FPD)
                msSettle: 600, // millisecond settle time for mpo command
                marks: marks,
                displayLevel: 32,
                jog: 10,
                serialPath: "/dev/ttyACM0",
            },
            kinematics: {},
        };
        if (options.mtoName === "MTO_XYZ") {
            var MTO_XYZ = require("../../www/js/shared/MTO_XYZ");
            var default_mto = new MTO_XYZ(options);
        } else if (options.mtoName === "MTO_C3") {
            var MTO_C3 = require("../../www/js/shared/MTO_C3");
            var default_mto = new MTO_C3(options);
        } else {
            var MTO_FPD = require("../../www/js/shared/MTO_FPD");
            var default_mto = new MTO_FPD(options);
        }
        if (options.driver === "mock") {
            that.mto = default_mto;
            if (options.mtoName === "MTO_XYZ") {
                var MockCartesian = require("./mock-cartesian.js");
                that.driver = new MockCartesian(that.model, that.mto, options);
            } else if (options.mtoName === "MTO_C3") {
                var MockCartesian = require("./mock-cartesian.js");
                that.driver = new MockCartesian(that.model, that.mto, options);
            } else {
                var MockFPD = require("./mock-fpd");
                that.driver = new MockFPD(that.model, options);
            }
        } else if (options.driver === "TINYG") {
            var TinyG = require("./tinyg-driver.js");
            that.driver = new TinyG(that.model, options);
        } else {
            that.driver = new FireStepDriver(that.model, options);
        }
        that.mto = that.driver.mto || default_mto;
        var kinematics = JSON.parse(that.mto.serialize());
        that.model.kinematics.currentType = that.mto.constructor.name;
        that.model.kinematics[that.model.kinematics.currentType] = kinematics;
        if (that.model.kinematics.currentType === "MTO_C3") {
            var C3Planner = require("./c3-planner");
            that.planner = new C3Planner(that.model, that.mto, that.driver, options);
        } else {
            var FpdPlanner = require("./fpd-planner");
            that.planner = new FpdPlanner(that.model, that.mto, that.driver, options);
        }
        console.log("INFO\t: PositionService kinematics:" + that.mto.constructor.name, "planner:" + that.planner.constructor.name);
        that.serviceBus && that.serviceBus.onBeforeRestore(function(savedModels) {
            var savedModel = savedModels.position || savedModels.firestep;
            if (savedModel) {
                delete savedModel.available;
                delete savedModel.initialized;
                delete savedModel.reads;
                delete savedModel.writes;
                delete savedModel.driver;
            }
        });
        that.serviceBus && that.serviceBus.onAfterRestore(function(savedModels) {
            // Position service kinematic definition is driven by firenodejs command line,
            // which overrides any previously saved value.
            that.model.kinematics.currentType = that.mto.constructor.name;
        });
        that.serviceBus && that.serviceBus.onBeforeRebase(function() {
            that.planner.beforeRebase();
        });
        return that;
    }

    PositionService.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }
    PositionService.prototype.applyKinematics = function( ){
        var that = this;
        var mtoKey = that.model.kinematics.currentType;
        that.planner.applyKinematics(that.model.kinematics[mtoKey]);
    }
    PositionService.prototype.syncResponse = function(request, resultPromise, resolve, reject) {
        var that = this;
        resultPromise.then( data => {
            resolve({
                data: data,
                sync: request.sync && that.restSync.synchronizer.sync(request.sync),
            });
        }, err => {
            reject({
                error: err,
                sync: request.sync && that.restSync.synchronizer.sync(request.sync),
            });
        });
        return resultPromise;
    }
    PositionService.prototype.homeAll = function(reqBody) {
        var that = this;
        that.applyKinematics();
        return new Promise((resolve, reject) => {
            that.restSync.syncResponse(reqBody, that.planner.homeAll(), resolve, reject);
        });
    }
    PositionService.prototype.homeAxis = function(reqBody, axisId) {
        var that = this;
        that.applyKinematics();
        return that.restSync.syncResponse(reqBody, that.planner.homeAxis(axisId));
    }
    PositionService.prototype.move = function(xyz) {
        var that = this;
        return that.restSync.syncResponse(xyz, that.planner.move(xyz));
    }
    PositionService.prototype.resetKinematics = function(kinematics, onDone) {
        var that = this;
        var cmds = [];
        if (kinematics.type === 'cartesian') {
            // HACK: FireStep currently cannot handle different axis speeds, so we take the slowest
            cmds.push({
                sys: {
                    to: 0,
                    mv: Math.min(Math.min(kinematics.xAxis.maxHz, kinematics.yAxis.maxHz), kinematics.zAxis.maxHz),
                    tv: Math.max(Math.max(kinematics.xAxis.tAccel, kinematics.yAxis.tAccel), kinematics.zAxis.tAccel),
                }
            });
            cmds.push({
                homz: ""
            });
            cmds.push({
                hom: {
                    x: "",
                    y: ""
                }
            });
            cmds.push({
                mpo: ""
            });
        }
        that.send(cmds, onDone);
        return that;
    }
    PositionService.prototype.home = function(axes, onDone) {
        var that = this;
        axes = axes || "xyz";
        cmds = [];
        var hom = {};
        for (var iAxis = 0; iAxis < axes.length; iAxis++) {
            hom[axes[iAxis]] = "";
        }
        cmds.push({
            hom: hom
        });
        cmds.push({
            mpo: ""
        });

        console.log("HOME\t:" + JSON.stringify(cmds), "axes:" + JSON.stringify(axes));
        that.send(cmds, onDone);
        return that;
    }
    PositionService.prototype.reset = function(cmd, onDone) {
        var that = this;

        if (that.model.kinematics.type === 'cartesian') {
            return that.resetKinematics(that.model.kinematics, onDone);
        }
        if (cmd == null || Object.keys(cmd).length === 0) {
            cmd = that.model.rest.beforeReset;
        } else if (typeof cmd != "object") {
            console.logger.log("WARN\t: PositionService: reset() ignoring invalid command:", cmd);
            cmd = that.model.rest.beforeReset;
        } else if (Object.keys(cmd).length === 0) {
            cmd = that.model.rest.beforeReset;
        } else {
            that.model.rest.beforeReset = cmd;
        }
        if (!JsonUtil.isEmpty(cmd)) {
            that.send(cmd);
        }
        that.send([{
            hom: ""
        }, {
            mpo: ""
        }, ], onDone);
        return that;
    }
    PositionService.prototype.getLocation = function() {
        var that = this;
        that.send(that.cmd_mpo());
        return that.model.mpo;
    }
    PositionService.prototype.test = function(res, options) {
        // arbitrary test code
        var that = this;
        var msStart = millis();
        var zHigh = options.zHigh || that.model.rest.lppZ || 50;
        var lpp = new LPPCurve({
            zHigh: zHigh,
            delta: that.delta,
        });
        var x = options.x == null ? 50 : options.x;
        var y = options.y == null ? 0 : options.y;
        var z = options.z == null ? -50 : options.z;
        that.send({
            mov: {
                x: 0,
                y: 0,
                z: zHigh
            }
        });
        var pts = lpp.laplacePath(x, y, z);
        console.log("DEBUG\t: PositionService: lpp.timedPath() msElapsed:", millis() - msStart);
        var cmd = new DVSFactory().createDVS(pts);
        console.log("DEBUG\t: PositionService: lpp.createDVS() msElapsed:", millis() - msStart);
        if (options.usScale > 0) {
            cmd.dvs.us = Math.round(cmd.dvs.us * options.usScale);
        }
        that.send(cmd, function(data) {
            var msElapsed = millis() - msStart;
            console.log("TTY \t: PositionService.test(dvs) msElapsed:", msElapsed);
        });
        that.send(that.cmd_mpo(), function(data) {
            var msElapsed = millis() - msStart;
            console.log("INFO\t: PositionService.test(", JSON.stringify(options), ") complete msElapsed:", msElapsed);
            data.mpo = that.model.mpo;
            res.send(data);
            console.log("HTTP\t: PositionService: POST " + Math.round(msElapsed) + 'ms => ' + JSON.stringify(data));
        });
    }
    PositionService.prototype.send = function(jobj, onDone) {
        var that = this;
        return that.planner.send(jobj, onDone);
    }
    PositionService.prototype.syncModel = function(data) {
        var that = this;
        return that.planner.syncModel(data);
    }
    PositionService.prototype.cmd_mpo = function() {
        var that = this;
        return that.planner.cmd_mpo();
    }

    module.exports = exports.PositionService = PositionService;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("planner", function() {
    var MockCartesian = require("./mock-cartesian.js");
    var C3Planner = module.exports;
    var MTO_C3 = require("../../www/js/shared/MTO_C3");
    function mockModel(path) {
        return {
            home: {},
            rest: {
                serialPath: path
            }
        };
    }

    it("homing synchronizes kinematic model values", function() {
        var PositionService = exports.PositionService;
        var options = {
            mtoName: "MTO_C3",
            driver: "mock",
        };
        var position = new PositionService(options);
        var mto = position.mto;
        var driver = position.driver;
        mto.constructor.name.should.equal("MTO_C3");
        driver.constructor.name.should.equal("MockDriver");
        position.model.kinematics.currentType.should.equal("MTO_C3");
        var kinematics = position.model.kinematics.MTO_C3;
        should.deepEqual(kinematics, mto.model);
        var maxPos = ++kinematics.zAxis.maxPos;
        mto.model.zAxis.maxPos.should.equal(maxPos - 1); // kinematic change is only in position.model
        position.homeAll();
        mto.model.zAxis.maxPos.should.equal(maxPos); // kinematic change has been applied
    }); // homing
});

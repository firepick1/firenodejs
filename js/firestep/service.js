var child_process = require('child_process');
var should = require("should");
var JsonUtil = require("../../www/js/shared/JsonUtil");
var Logger = require("../../www/js/shared/Logger");
var FireStepDriver = require("./driver");
var FireStepPlanner = require("./planner");

function millis() {
    var hrt = process.hrtime();
    var ms = hrt[0] * 1000 + hrt[1] / 1000000;
    return ms;
}

(function(exports) {
    ////////////////// constructor
    function FireStepService(options) {
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
        that.model = {
            available: null,
            initialized: false,
            writes: 0,
            reads: 0,
            home: {
                x: 0,
                y: 0,
                z: 0,
            },
            rest: {
                homeLPP: 5, // auto-home every N LPP moves
                lppSpeed: 0.8, // slow and safe
                lppZ: 50,
                msSettle: 600, // millisecond settle time for mpo command
                marks: marks,
                displayLevel: 32,
                jog: 10,
                serialPath: "/dev/ttyACM0",
            }
        };
        if (options.mock === "MTO_FPD") {
            var MockFPD = require("./mock-fpd");
            that.driver = new MockFPD(that.model, options);
        } else if (options.mock === "MTO_XYZ") {
            var MockCartesian = require("./mock-cartesian.js");
            that.driver = new MockCartesian(that.model, options);
        } else if (options.mock === "TINYG") {
            var TinyG = require("./tinyg-driver.js");
            that.driver = new TinyG(that.model, options);
        } else {
            that.driver = new FireStepDriver(that.model, options);
        }
        that.planner = new FireStepPlanner(that.model, that.driver, options);
        that.serviceBus && that.serviceBus.onBeforeRestore(function(savedModels) {
            if (savedModels.firestep) {
                delete savedModels.firestep.available;
                delete savedModels.firestep.initialized;
                delete savedModels.firestep.reads;
                delete savedModels.firestep.writes;
                delete savedModels.firestep.driver;
            }
        });
        that.serviceBus && that.serviceBus.onBeforeRebase(function() {
            that.planner.beforeRebase();
        });
        return that;
    }

    FireStepService.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }
    FireStepService.prototype.reset = function(cmd, onDone) {
        var that = this;
        if (cmd == null || Object.keys(cmd).length === 0) {
            cmd = that.model.rest.beforeReset;
        } else if (typeof cmd != "object") {
            console.logger.log("WARN\t: FireStepService: reset() ignoring invalid command:", cmd);
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
    FireStepService.prototype.getLocation = function() {
        var that = this;
        that.send(that.cmd_mpo());
        return that.model.mpo;
    }
    FireStepService.prototype.test = function(res, options) {
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
        console.log("DEBUG\t: FireStepService: lpp.timedPath() msElapsed:", millis() - msStart);
        var cmd = new DVSFactory().createDVS(pts);
        console.log("DEBUG\t: FireStepService: lpp.createDVS() msElapsed:", millis() - msStart);
        if (options.usScale > 0) {
            cmd.dvs.us = Math.round(cmd.dvs.us * options.usScale);
        }
        that.send(cmd, function(data) {
            var msElapsed = millis() - msStart;
            console.log("TTY \t: FireStepService.test(dvs) msElapsed:", msElapsed);
        });
        that.send(that.cmd_mpo(), function(data) {
            var msElapsed = millis() - msStart;
            console.log("INFO\t: FireStepService.test(", JSON.stringify(options), ") complete msElapsed:", msElapsed);
            data.mpo = that.model.mpo;
            res.send(data);
            console.log("HTTP\t: FireStepService: POST " + Math.round(msElapsed) + 'ms => ' + JSON.stringify(data));
        });
    }
    FireStepService.prototype.send = function(jobj, onDone) {
        var that = this;
        return that.planner.send(jobj, onDone);
    }
    FireStepService.prototype.syncModel = function(data) {
        var that = this;
        return that.planner.syncModel(data);
    }
    FireStepService.prototype.cmd_mpo = function() {
        var that = this;
        return that.planner.cmd_mpo();
    }

    module.exports = exports.FireStepService = FireStepService;
})(typeof exports === "object" ? exports : (exports = {}));

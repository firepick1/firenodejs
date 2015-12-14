var should = require("should");
var math = require("mathjs");
var shared = require("../../www/js/shared/JsonUtil");
var Logger = require("../../www/js/shared/Logger");
var DVSFactory = require("../lib/DVSFactory");
var LPPCurve = require("../lib/LPPCurve");
var MockFPD = require("./mock-fpd").MockFPD;

module.exports.FireStepPlanner = (function() {
    ////////////////// constructor
    function FireStepPlanner(model, driver, options) {
        var that = this;
        should.exist(model);
        options = options || {};

        that.driver = driver || new MockFPD(model, options);
        that.driver.on("idle", function() {
            that.onIdle();
        });
        that.driver.on("response", function(response) {
            that.onResponse(response);
        });
        that.logger = options.logger || new Logger({
            nPlaces: 3
        });
        that.model = model;
        that.model.initialized = false;

        return that;
    }

    FireStepPlanner.prototype.syncModel = function(data) {
        var that = this;
        if (data) {
            var available = that.model.available;
            var initialized = that.model.initialized;
            var reads = that.model.reads;
            var writes = that.model.writes;
            var serialPath = that.model.rest.serialPath;
            //console.log("FireStepPlanner.syncModel() data:" + JSON.stringify(data));
            shared.applyJson(that.model, data);
            that.model.available = available;
            that.model.initialized = initialized;
            that.model.reads = reads;
            that.model.writes = writes;
            if (serialPath !== that.model.rest.serialPath) {
                console.log('INFO\t: new serial path:', that.model.rest.serialPath);
                if (that.model.available) {
                    that.driver.close();
                    setTimeout(function() {
                        that.driver.open(that.onStartup);
                    }, 2000);
                } else {
                    that.driver.open(that.onStartup);
                }
            } else if (!that.model.available) {
                that.driver.open(that.onStartup);
            }
        } else {
            that.driver.pushQueue({
                "sys": ""
            });
            that.driver.pushQueue({
                "dim": ""
            });
        }
        return that.model;
    }
    FireStepPlanner.prototype.moveLPP = function(x, y, z, onDone) {
        var that = this;
        var mpoPlan = that.mpoPlan;
        var cmdsUp = [];
        should.exist(x);
        should.exist(y);
        should.exist(z);
        if (mpoPlan && mpoPlan.x != null && mpoPlan.y != null && mpoPlan.z != null) {
            if (mpoPlan.x || mpoPlan.y || mpoPlan.z != that.model.rest.lppZ) {
                var lpp = new LPPCurve({
                    zHigh: that.model.rest.lppZ,
                    delta: that.delta,
                });
                var pts = lpp.laplacePath(mpoPlan.x, mpoPlan.y, mpoPlan.z);
                pts.reverse();
                that.mpoPlanSetXYZ(0, 0, pts[pts.length - 1].z, {
                    log: "LPP up"
                });
                var cmd = new DVSFactory().createDVS(pts);
                cmd.dvs.us = math.round(cmd.dvs.us / that.model.rest.lppSpeed);
                that.send1(cmd);
            }
        } else {
            should.fail("TBD");
            //that.send1({
            //"hom": ""
            //});
            //that.send1(that.cmd_mpo());
            //that.send1({
            //mov: {z:that.model.rest.lppZ}
            //});
        }
        //that.send1(that.cmd_mpo());
        var pts = lpp.laplacePath(x, y, z);
        var ptN = pts[pts.length - 1];
        var cmd = new DVSFactory().createDVS(pts);
        cmd.dvs.us = math.round(cmd.dvs.us / that.model.rest.lppSpeed);
        that.mpoPlanSetXYZ(ptN.x, ptN.y, ptN.z, {
            log: "LPP down"
        });
        that.send1(cmd);
        that.send1(that.cmd_mpo(), onDone);
        return that;
    }
    FireStepPlanner.prototype.isLPPMove = function(cmd) {
        var that = this;
        if (!cmd.hasOwnProperty("mov")) {
            return false;
        }
        if (that.model.rest.lppSpeed <= 0) {
            console.log("FireStepPlanner.isLPPMove(lppSpeed <= 0) => false");
            return false;
        }
        if (!cmd.mov.hasOwnProperty("x") ||
            !cmd.mov.hasOwnProperty("y") ||
            !cmd.mov.hasOwnProperty("z")) {
            console.log("FireStepPlanner.isLPPMove(not absolute) => false");
            return false;
        }
        if (cmd.mov.lpp === false) {
            console.log("FireStepPlanner.isLPPMove(lpp:false) => false");
            return false;
        }
        return true;
    }
    FireStepPlanner.prototype.mpoPlanSetXYZ = function(x, y, z, options) {
        var that = this;
        options = options || {};
        var xyz = {
            x: x,
            y: y,
            z: z
        };
        var pulses = that.delta.calcPulses(xyz);
        that.mpoPlanSetPulses(pulses.p1, pulses.p2, pulses.p3);
        if (options.log) {
            that.logger.withPlaces(3).info(
                "mpoPlanSetXYZ(", xyz, ") ", pulses, " context:", options.log);
        }
    }
    FireStepPlanner.prototype.mpoPlanSetPulses = function(p1, p2, p3, options) {
        var that = this;
        options = options || {};
        var xyz = that.delta.calcXYZ({
            p1: p1,
            p2: p2,
            p3: p3
        });
        that.mpoPlan = {
            p1: p1,
            p2: p2,
            p3: p3,
            x: xyz.x,
            y: xyz.y,
            z: xyz.z
        }
        if (options.log) {
            that.logger.withPlaces(3).info(
                "mpoPlanSetPulses(", that.mpoPlan, ") context:", options.log);
        }
    }
    FireStepPlanner.prototype.send1 = function(cmd, onDone) {
        var that = this;
        onDone = onDone || function(data) {}
        var mpoPlan = that.mpoPlan;
        var sendCmd = true;

        if (that.isLPPMove(cmd)) {
            that.moveLPP(cmd.mov.x, cmd.mov.y, cmd.mov.z, onDone);
            sendCmd = false;
        } else if (cmd.hasOwnProperty("movxr")) {
            that.mpoPlanSetXYZ(mpoPlan.x + cmd.movxr, mpoPlan.y, mpoPlan.z, {
                log: "send1.movxr:" + cmd.movxr
            });
        } else if (cmd.hasOwnProperty("movyr")) {
            that.mpoPlanSetXYZ(mpoPlan.x, mpoPlan.y + cmd.movyr, mpoPlan.z, {
                log: "send1.movyr:" + cmd.movyr
            });
        } else if (cmd.hasOwnProperty("movzr")) {
            that.mpoPlanSetXYZ(mpoPlan.x, mpoPlan.y, mpoPlan.z + cmd.movzr, {
                log: "send1.movzr:" + cmd.movzr
            });
        } else if (cmd.hasOwnProperty("mov")) {
            delete cmd.mov.lpp; // firenodejs attribute (FireStep will complain)
            var x = cmd.mov.x == null ? mpoPlan.x : cmd.mov.x;
            var y = cmd.mov.y == null ? mpoPlan.y : cmd.mov.y;
            var z = cmd.mov.z == null ? mpoPlan.z : cmd.mov.z;
            x = cmd.mov.xr == null ? x : x + cmd.mov.xr;
            y = cmd.mov.yr == null ? y : y + cmd.mov.yr;
            z = cmd.mov.zr == null ? z : z + cmd.mov.zr;
            that.mpoPlanSetXYZ(x, y, z, {
                log: "send1.non-lpp-mov(" + x + "," + y + "," + z + ")"
            });
        }
        console.log("FireStepPlanner.send1 mpoPlan:" + JSON.stringify(that.mpoPlan));
        if (sendCmd) {
            that.driver.pushQueue(cmd, onDone);
        }
        that.driver.processQueue();
    }
    FireStepPlanner.prototype.send = function(jobj, onDone) {
        var that = this;

        if (!onDone) {
            onDone = function(data) {
                if (data.s) {
                    console.log("TTY\t: FireStep response:" + data.s);
                }
            }
        }
        if (jobj instanceof Array) {
            if (jobj.length > 0) {
                for (var i = 0; i < jobj.length; i++) {
                    if (i < jobj.length - 1) {
                        that.send1(jobj[i]);
                    } else {
                        that.send1(jobj[i], onDone);
                    }
                }
            } else {
                onDone();
            }
        } else {
            that.send1(jobj, onDone);
        }
        that.driver.processQueue();
        if (that.driver.queueLength()) {
            console.log("TTY\t: FireStepPlanner.send() queued:", that.driver.queueLength());
        }
        return that;
    }
    FireStepPlanner.prototype.cmd_mpo = function() {
        var that = this;
        return {
            mpo: "",
            dpyds: 12,
        }
    }
    FireStepPlanner.prototype.onResponse = function(response) {
        var that = this;
        var r = response.r;
        //console.log("DEBUG\t: FireStepPlanner.onResponse(" + JSON.stringify(response) + ")");
        that.model.id = r.id || that.model.id;
        that.model.sys = r.sys || that.model.sys;
        that.model.dim = r.dim || that.model.dim;
        if (that.model.sys && that.model.sys.to === 1 && r.dim) {
            console.log("DEBUG\t: FireStepPlanner.creating delta");
            that.delta = new DeltaCalculator({
                e: r.dim.e,
                f: r.dim.f,
                gearRatio: r.dim.gr,
                re: r.dim.re,
                rf: r.dim.rf,
                spa: r.dim.spa,
                spr: r.dim.spr,
                steps360: r.dim.st,
                microsteps: r.dim.mi,
                homeAngles: {
                    theta1: r.dim.ha,
                    theta2: r.dim.ha,
                    theta3: r.dim.ha,
                }
            });
            console.log("TTY\t: FireStepPlanner.onSerialData() synchronized delta dimensions");
        }
        that.model.a = r.a || that.model.a;
        that.model.b = r.b || that.model.b;
        that.model.c = r.c || that.model.c;
        that.model.x = r.x || that.model.x;
        that.model.y = r.y || that.model.y;
        that.model.z = r.z || that.model.z;
        that.model.mpo = r.mpo || that.model.mpo;
        that.model.response = r;
    }
    FireStepPlanner.prototype.onIdle = function() {
        var that = this;
        if (that.model.response && that.model.response.mpo) {
            that.model.initialized = true;
            var mpo = that.model.response.mpo;
            var pulses = {
                p1: mpo["1"],
                p2: mpo["2"],
                p3: mpo["3"]
            };
            var xyz = that.delta.calcXYZ(pulses);
            that.mpoPlanSetPulses(mpo["1"], mpo["2"], mpo["3"], {
                log: "FireStepPlanner.onIdle(initialized)"
            });
        } else {
            console.log("TTY\t: FireStepPlanner.onIdle(waiting) ...");
        }
        if (that.mpoPlan) {
            that.model.mpo = JSON.parse(JSON.stringify(that.mpoPlan));
            // round for archival
            that.model.mpo.x = math.round(that.model.mpo.x, 3);
            that.model.mpo.y = math.round(that.model.mpo.y, 3);
            that.model.mpo.z = math.round(that.model.mpo.z, 3);
        }
        return that;
    }
    FireStepPlanner.prototype.onStartup = function(err) {
        var that = this;
        if (err == null) {
            that.driver.pushQueue({
                "id": ""
            }); // a simple, safe command
            that.driver.pushQueue({
                "dim": ""
            }); // required for delta sync
        }
    }

    return FireStepPlanner;
})();

var should = require("should");
var math = require("mathjs");
var shared = require("../../www/js/shared/JsonUtil");
var Logger = require("../../www/js/shared/Logger");
var JsonUtil = require("../../www/js/shared/JsonUtil");
var DVSFactory = require("../lib/DVSFactory");
var MockDriver = require("./mock-driver");

(function(exports) {
    ////////////////// constructor
    function C3Planner(model, mto, driver, options) {
        var that = this;

        should && should.exist(model);
        options = options || {};

        that.verbose = options.verbose;
        should && should.exist(mto);
        that.mto = mto;
        that.driver = driver || new MockDriver(model, mto, options);
        that.driver.on("idle", function() {
            that.onIdle();
        });
        that.driver.on("response", function(response) {
            that.onSerialResponse(response);
        });
        that.logger = options.logger || new Logger({
            nPlaces: 3
        });
        that.model = model;
        that.model.initialized = false;
        Logger.start("C3Planner() driver:" + driver.name);

        return that;
    }

    C3Planner.prototype.beforeRebase = function() {
        var that = this;
        if (that.serialPath !== that.model.rest.serialPath) {
            Logger.start('C3Planner: new serial path:', that.model.rest.serialPath);
            if (that.model.available) {
                that.driver.close();
                setTimeout(function() {
                    that.driver.open(function() {
                        that.onStartup();
                    });
                }, 2000);
            } else {
                that.driver.open(function() {
                    that.onStartup()
                });
            }
        } else if (!that.model.available) {
            that.driver.open(function() {
                that.onStartup()
            });
        }
    }
    C3Planner.prototype.syncModel = function(data) {
        var that = this;
        if (data) {
            var available = that.model.available;
            var initialized = that.model.initialized;
            var reads = that.model.reads;
            var writes = that.model.writes;
            var serialPath = that.model.rest.serialPath;
            //console.log("C3Planner.syncModel() data:" + JSON.stringify(data));
            shared.applyJson(that.model, data);
            that.model.available = available;
            that.model.initialized = initialized;
            that.model.reads = reads;
            that.model.writes = writes;
            that.model.rest.serialPath = that.model.rest.serialPath || "/dev/ttyACM0";
            if (serialPath !== that.model.rest.serialPath) {
                console.log('INFO\t: C3Planner: new serial path:', that.model.rest.serialPath);
                if (that.model.available) {
                    that.driver.close();
                    setTimeout(function() {
                        that.driver.open(function() {
                            that.onStartup();
                        });
                    }, 2000);
                } else {
                    that.driver.open(function() {
                        that.onStartup()
                    });
                }
            } else if (!that.model.available) {
                that.driver.open(function() {
                    that.onStartup()
                });
            }
        } else {
            that.driver.pushQueue({
                "sys": ""
            });
            if (that.model.dim) {
                that.driver.pushQueue({
                    "dim": ""
                });
            }
        }
        return that.model;
    }
    C3Planner.prototype.mpoPlanSetXYZ = function(x, y, z, options) {
        var that = this;
        options = options || {};
        that.mpoPlan = that.mpoPlan || {};
        x == null && (x = that.mpoPlan.xn);
        y == null && (y = that.mpoPlan.yn);
        z == null && (z = that.mpoPlan.zn);
        x == null && (x = 0);
        y == null && (y = 0);
        z == null && (z = 0);
        var xyz = {
            x: x,
            y: y,
            z: z
        };
        var pulses = that.mto.calcPulses(xyz);
        if (pulses == null) {
            console.warn("ERROR\t: calcPulses failed xyz:", xyz);
        }
        that.mpoPlan.p1 = pulses.p1;
        that.mpoPlan.p2 = pulses.p2;
        that.mpoPlan.p3 = pulses.p3;
        that.mpoPlan.xn = math.round(x, 3);
        that.mpoPlan.yn = math.round(y, 3);
        that.mpoPlan.zn = math.round(z, 3);
        var xyz = that.mto.calcXYZ(pulses);
        that.mpoPlan.x = xyz.x;
        that.mpoPlan.y = xyz.y;
        that.mpoPlan.z = xyz.z;
        if (options.log) {
            that.verbose && that.logger.withPlaces(3).info(
                "mpoPlanSetXYZ(", xyz, ") ", pulses, " context:", options.log);
        }
    }
    C3Planner.prototype.mpoPlanSetPulses = function(p1, p2, p3, options) {
        var that = this;
        options = options || {};
        var pulses = {
            p1: p1,
            p2: p2,
            p3: p3
        };
        var xyz = that.mto.calcXYZ(pulses);
        var mpoPlan = that.mpoPlan = that.mpoPlan || {};
        mpoPlan.p1 = p1;
        mpoPlan.p2 = p2;
        mpoPlan.p3 = p3;
        mpoPlan.x = xyz.x;
        mpoPlan.y = xyz.y;
        mpoPlan.z = xyz.z;
        if (that.mpoPlan) {
            if (p1 !== that.mpoPlan.p1 || p2 !== that.mpoPlan.p2 || p3 !== that.mpoPlan.p3) {
                throw new Error("mpoPlanSetPulses() position sync error" +
                    " actual:" + JSON.stringify(that.mpoPlan) +
                    " expected:" + JSON.stringify(pulses));
            }
        }
        // if we don't have a plan, use current pulse position
        mpoPlan.xn = mpoPlan.xn == null ? xyz.x : mpoPlan.xn;
        mpoPlan.yn = mpoPlan.yn == null ? xyz.y : mpoPlan.yn;
        mpoPlan.zn = mpoPlan.zn == null ? xyz.z : mpoPlan.zn;
        if (options.log) {
            that.verbose && that.logger.withPlaces(3).info(
                "mpoPlanSetPulses(", that.mpoPlan, ") context:", options.log);
        }
    }
    C3Planner.prototype.hom = function(axisId, onDone) {
        var that = this;
        var kinematics = that.mto.model;
        var homed = {};
        if (axisId) {
            var axisProp = axisId + "Axis";
            var axis = kinematics[axisProp];
            that.driver.pushQueue({
                sys: {
                    to: 0, // MTO_RAW
                },
            });
            that.driver.pushQueue({
                sys: {
                    tv: axis.tAccel,
                    mv: axis.maxHz,
                }
            });
            var axisCmd = {
            };
            axisCmd[axisId] = {
                tn: axis.minPos,
                tm: axis.maxPos,
            };
            that.driver.pushQueue(axisCmd);
            var homeCmd = {};
            homeCmd["hom"+axisId] = "";
            that.driver.pushQueue(homeCmd);
            that.driver.pushQueue({
                dpydl: that.model.rest.displayLevel,
            });
            homed[axisId] = true;
        } else {
            that.driver.pushQueue({
                hom: "",
            });
            that.driver.pushQueue({
                "dpydl": that.model.rest.displayLevel,
            });
            homed.x = homed.y = homed.z = true;
        }
        that.driver.pushQueue({
            mpo:""
        }, function(data) {
            onDone(data);
            JsonUtil.applyJson(that.model.homed, homed);
        });
    }
    C3Planner.prototype.send1 = function(cmd, onDone) {
        var that = this;
        onDone = onDone || function(data) {}
        var mpoPlan = that.mpoPlan;
        var sendCmd = true;

        should && that.model.initialized && should.exist(mpoPlan);
        if (cmd.hasOwnProperty("hom")) {
            var x = null;
            var y = null;
            var z = null;
            var kinematics = that.mto.model;
            if (cmd.hom.hasOwnProperty("x")) {
                var x = kinematics.xAxis.maxLimit ? kinematics.xAxis.minPos : kinematics.xAxis.minPos;
            }
            if (cmd.hom.hasOwnProperty("y")) {
                var y = kinematics.maxLimit ? kinematics.yAxis.minPos : kinematics.yAxis.minPos;
            }
            if (cmd.hom.hasOwnProperty("z")) {
                var z = kinematics.maxLimit ? kinematics.zAxis.minPos : kinematics.zAxis.minPos;
            }
            that.mpoPlanSetXYZ(x, y, z, {
                log: "send1.hom:"
            });
            sendCmd = false;
            if (x != null && y != null && z != null) {
                that.hom(null, onDone);
            } else if (x != null) {
                that.hom("x", onDone);
            } else if (y != null) {
                that.hom("y", onDone);
            } else if (z != null) {
                that.hom("z", onDone);
            } 
        } else if (cmd.hasOwnProperty("movxr")) {
            that.mpoPlanSetXYZ(mpoPlan.xn + cmd.movxr, mpoPlan.yn, mpoPlan.zn, {
                log: "send1.movxr:" + cmd.movxr
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        } else if (cmd.hasOwnProperty("movyr")) {
            that.mpoPlanSetXYZ(mpoPlan.xn, mpoPlan.yn + cmd.movyr, mpoPlan.zn, {
                log: "send1.movyr:" + cmd.movyr
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        } else if (cmd.hasOwnProperty("movzr")) {
            that.mpoPlanSetXYZ(mpoPlan.xn, mpoPlan.yn, mpoPlan.zn + cmd.movzr, {
                log: "send1.movzr:" + cmd.movzr
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        } else if (cmd.hasOwnProperty("mov")) {
            should && should.exist(mpoPlan.xn);
            should && should.exist(mpoPlan.yn);
            should && should.exist(mpoPlan.zn);
            var x = cmd.mov.x == null ? mpoPlan.xn : cmd.mov.x;
            var y = cmd.mov.y == null ? mpoPlan.yn : cmd.mov.y;
            var z = cmd.mov.z == null ? mpoPlan.zn : cmd.mov.z;
            x = cmd.mov.xr == null ? x : x + cmd.mov.xr;
            y = cmd.mov.yr == null ? y : y + cmd.mov.yr;
            z = cmd.mov.zr == null ? z : z + cmd.mov.zr;
            that.mpoPlanSetXYZ(x, y, z, {
                log: "send1.mov(" + x + "," + y + "," + z + ")"
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        }
        that.verbose && mpoPlan && console.log("DEBUG\t: C3Planner.send1 mpoPlan:" + JSON.stringify(mpoPlan));
        if (sendCmd) {
            that.driver.pushQueue(cmd, onDone);
        }
        that.driver.processQueue();
    }
    C3Planner.prototype.send = function(jobj, onDone) {
        var that = this;

        if (!onDone) {
            onDone = function(data) {
                if (data.s) {
                    console.log("TTY \t: C3Planner: FireStep response:" + data.s);
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
            console.log("TTY \t: C3Planner.send() queued:", that.driver.queueLength());
        }
        return that;
    }
    C3Planner.prototype.cmd_mpo = function() {
        var that = this;
        return {
            mpo: "",
            //dpyds: 12,
        }
    }
    C3Planner.prototype.onSerialResponse = function(response) {
        var that = this;
        var r = response.r;
        //console.log("DEBUG\t: C3Planner.onSerialResponse(" + JSON.stringify(response) + ")");
        that.model.id = r.id || that.model.id;
        that.model.sys = r.sys || that.model.sys;
        that.model.a = r.a || that.model.a;
        that.model.b = r.b || that.model.b;
        that.model.c = r.c || that.model.c;
        that.model.x = r.x || that.model.x;
        that.model.y = r.y || that.model.y;
        that.model.z = r.z || that.model.z;
        that.model.mpo = r.mpo || that.model.mpo;
        if (r.mpo && that.mpoPlan) {
            r.mpo.xn = that.mpoPlan.xn;
            r.mpo.yn = that.mpoPlan.yn;
            r.mpo.zn = that.mpoPlan.zn;
        }
        that.model.response = r;
    }
    C3Planner.prototype.onIdle = function() {
        var that = this;
        if (that.model.response && that.model.response.mpo) {
            that.model.initialized = true;
            var mpo = that.model.response.mpo;
            var pulses = {
                p1: mpo["1"],
                p2: mpo["2"],
                p3: mpo["3"]
            };
            that.mpoPlanSetPulses(mpo["1"], mpo["2"], mpo["3"], {
                log: "C3Planner.onIdle(initialized)"
            });
        } else {
            that.verbose && console.log("TTY \t: C3Planner.onIdle(waiting) ...");
        }
        if (that.mpoPlan) {
            that.model.mpo = that.model.mpo || {};
            JsonUtil.applyJson(that.model.mpo, JSON.parse(JSON.stringify(that.mpoPlan)));
            // round for archival
            that.model.mpo.x = math.round(that.model.mpo.x, 3);
            that.model.mpo.y = math.round(that.model.mpo.y, 3);
            that.model.mpo.z = math.round(that.model.mpo.z, 3);
        }
        return that;
    }
    C3Planner.prototype.onStartup = function(err) {
        // 1) Driver startup synchronizes information without movement
        // 2) Movement initialization is separate and must happen under operator control

        var that = this;
        that.model.homed = {};

        if (err == null) {
            that.serialPath = that.model.rest.serialPath;

            that.driver.pushQueue({
                "id": ""
            }); // a simple, safe command
            that.driver.pushQueue({
                "sys": ""
            }); // required for systo
        }
    }

    module.exports = exports.C3Planner = C3Planner;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("planner", function() {
    var MockCartesian = require("./mock-cartesian.js");
    var C3Planner = module.exports;
    var MTO_C3 = require("../../www/js/shared/MTO_C3");
    function mockModel(path) {
        return {
            home: {
            },
            rest: {
                serialPath: path
            }
        };
    }
    it("planner works with MockCartesian", function() {
        var options = null;
        var model = mockModel("/dev/ttyACM0");
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto, options);
        console.log("TESTIT");
        var planner = new C3Planner(model, mto, driver, options);
        planner.beforeRebase();
        var cmds = [];
        var onDone = function() {
            console.log("DONE");
        };
        cmds.push({
            sys: {
                to: 0,
                mv: 18000,
                tv: 0.4,
            }
        });
        cmds.push({homz:""});
        cmds.push({hom:{ x:"", y:""}});
        cmds.push({mpo:""});
        planner.send(cmds, onDone);
    })
});

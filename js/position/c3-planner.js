var should = require("should");
var math = require("mathjs");
var shared = require("../../www/js/shared/JsonUtil");
var Logger = require("../../www/js/shared/Logger");
var JsonUtil = require("../../www/js/shared/JsonUtil");
var DVSFactory = require("../lib/DVSFactory");
var MockDriver = require("./mock-driver");

(function(exports) {
    var pulseAxis = {
        x: "p1",
        y: "p2",
        z: "p3",
    };
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

    C3Planner.prototype.bounds = function() {
        var that = this;
        var kinematics = that.mto.model;
        return {
            minPos: {
                x: kinematics.xAxis.minPos,
                y: kinematics.yAxis.minPos,
                z: kinematics.zAxis.minPos,
            },
            maxPos: {
                x: kinematics.xAxis.maxPos,
                y: kinematics.yAxis.maxPos,
                z: kinematics.zAxis.maxPos,
            },
        }
    }

    C3Planner.prototype.applyKinematics = function(c3delta = {}) {
        var that = this;
        var promise = new Promise( (resolve, reject) => {
            var err = null;
            err == null && that.serialPath == null && 
                (err = new Error("connect() is required"));
            if (err) {
                return reject(err);
            }
            if (typeof c3delta === 'string') {
                var json = c3delta;
            } else {
                var json = JSON.stringify(c3delta);
            }
            that.mto.deserialize(json);
            var kinematics = that.mto.model;

            that.driver.pushQueue({
                sys: {
                    to: 0, // MTO_RAW
                },
            });
            var bounds = that.bounds();
            var minPulses = that.calcPulses(bounds.minPos);
            var maxPulses = that.calcPulses(bounds.maxPos);
            var axisCmd = {};
            kinematics.xAxis.enabled && (axisCmd.x = {
                tm: Math.max(maxPulses.p1, minPulses.p1),
                tn: Math.min(maxPulses.p1, minPulses.p1),
                mp: kinematics.xAxis.mstepPulses,
            });
            kinematics.yAxis.enabled && (axisCmd.y = {
                tm: Math.max(maxPulses.p2, minPulses.p2),
                tn: Math.min(maxPulses.p2, minPulses.p2),
                mp: kinematics.yAxis.mstepPulses,
            });
            kinematics.zAxis.enabled && (axisCmd.z = {
                tm: Math.max(maxPulses.p3, minPulses.p3),
                tn: Math.min(maxPulses.p3, minPulses.p3),
                mp: kinematics.zAxis.mstepPulses,
            });
            if (Object.keys(axisCmd).length) {
                that.driver.pushQueue(axisCmd, () => {
                    resolve(JSON.parse(JSON.stringify(that.mto.model)));
                }); // set min/max position
            } else {
                resolve(JSON.parse(JSON.stringify(that.mto.model)));
            }
            that.driver.processQueue();
        }); // new Promise;
        return promise;
    }

    C3Planner.prototype.isConnected = function() {
        var that = this;
        return that.serialPath != null;
    }

    C3Planner.prototype.connect = function(serialPath, reopen = true) {
        var that = this;
        serialPath = serialPath || that.model.rest.serialPath;
        that.model.rest.serialPath = serialPath;
        var promise = new Promise((resolve, reject) => {
            var oldSerialPath = that.serialPath;
            if (oldSerialPath) {
                if (serialPath !== oldSerialPath || reopen) {
                    Logger.start('C3Planner: connect() old:' + oldSerialPath, ' new:' + serialPath);
                    that.driver.close();
                    setTimeout(function() {
                        that.driver.open(() => {
                            that.onStartup();
                            resolve({
                                closed: oldSerialPath,
                                opened: serialPath,
                            });
                        });
                    }, 2000);
                } else {
                    resolve({}); // already open
                }
            } else {
                Logger.start('C3Planner: connect new:', serialPath);
                that.driver.open(() => {
                    that.onStartup();
                    resolve({
                        opened: serialPath,
                    });
                });
            }
        });
        return promise;
    }

    C3Planner.prototype.beforeRebase = function() {
        var that = this;
        that.connect(that.model.rest.serialPath, false);
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
            that.connect(that.model.rest.serialPath, false);
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
        var pulses = that.calcPulses(xyz);
        if (pulses == null) {
            console.warn("ERROR\t: calcPulses failed xyz:", xyz);
        }
        that.mpoPlan.p1 = pulses.p1;
        that.mpoPlan.p2 = pulses.p2;
        that.mpoPlan.p3 = pulses.p3;
        that.mpoPlan.xn = math.round(x, 3);
        that.mpoPlan.yn = math.round(y, 3);
        that.mpoPlan.zn = math.round(z, 3);
        var xyz = that.calcXYZ(pulses);
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
        var xyz = that.calcXYZ(pulses);
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
    C3Planner.prototype.move = function(pos = {}) {
        var that = this;
        var promise = new Promise(function(resolve, reject) {
            var kinematics = that.mto.model;
            var err = null;
            err = err || (pos.x != null || pos.xr != null) && 
                !that.model.homed.x && new Error("move: X-axis is not homed");
            err = err || (pos.y != null || pos.yr != null) && 
                !that.model.homed.y && new Error("move: Y-axis is not homed");
            err = err || (pos.z != null || pos.zr != null) && 
                !that.model.homed.z && new Error("move: Z-axis is not homed");
            if (err) {
                console.log("ERROR\t: ", err);
                reject(err);
                return;
            }
            var mpoPlan = that.mpoPlan = that.mpoPlan || {};
            var x = pos.x == null ? mpoPlan.xn : pos.x;
            var y = pos.y == null ? mpoPlan.yn : pos.y;
            var z = pos.z == null ? mpoPlan.zn : pos.z;
            x = pos.xr == null ? x : (x + pos.xr);
            y = pos.yr == null ? y : (y + pos.yr);
            z = pos.zr == null ? z : (z + pos.zr);
            that.mpoPlanSetXYZ(x, y, z, {
                log: "move(" + x + "," + y + "," + z + ")"
            });
            var cmd = {};
            if (pos.x != null || pos.xr != null) {
                var axis = kinematics.xAxis;
                cmd.systv = cmd.systv == null ? axis.tAccel : Math.max(axis.tAccel, cmd.systv);
                cmd.sysmv = cmd.sysmv == null ? axis.maxHz : Math.min(axis.maxHz, cmd.sysmv);
            }
            if (pos.y != null || pos.yr != null) {
                var axis = kinematics.yAxis;
                cmd.systv = cmd.systv == null ? axis.tAccel : Math.max(axis.tAccel, cmd.systv);
                cmd.sysmv = cmd.sysmv == null ? axis.maxHz : Math.min(axis.maxHz, cmd.sysmv);
            }
            if (pos.z != null || pos.zr != null) {
                var axis = kinematics.zAxis;
                cmd.systv = cmd.systv == null ? axis.tAccel : Math.max(axis.tAccel, cmd.systv);
                cmd.sysmv = cmd.sysmv == null ? axis.maxHz : Math.min(axis.maxHz, cmd.sysmv);
            }
            cmd.sysmv = Math.round(cmd.sysmv);
            
            cmd.mov = {};    
            if (pos.x != null || pos.xr != null) {
                cmd.mov["1"] = mpoPlan.p1;
            }
            if (pos.y != null || pos.yr != null) {
                cmd.mov["2"] = mpoPlan.p2;
            }
            if (pos.z != null || pos.zr != null) {
                cmd.mov["3"] = mpoPlan.p3;
            }
            that.driver.pushQueue(cmd);
            that.driver.pushQueue({
                mpo: "",
            }, function(data) {
                resolve(data);
            });
            that.driver.processQueue();
        }); // new Promise()
        return promise;
    } /* move */
    C3Planner.prototype.homePos = function(axisId) {
        var that = this;
        var kinematics = that.mto.model;
        var axis = kinematics[axisId + "Axis"];
        return axis.homeMin ? axis.minPos : axis.maxPos;
    }
    C3Planner.prototype.calcXYZ = function(pulses) {
        var that = this;
        var kinematics = that.mto.model;
        var rawPulses = {
            p1: kinematics.xAxis.homeMin ? pulses.p1 : -pulses.p1,
            p2: kinematics.yAxis.homeMin ? pulses.p2 : -pulses.p2,
            p3: kinematics.zAxis.homeMin ? pulses.p3 : -pulses.p3,
        }
        return that.mto.calcXYZ(rawPulses);
    }
    C3Planner.prototype.calcPulses = function(xyz) {
        var that = this;
        var rawPulses = that.mto.calcPulses(xyz);
        var kinematics = that.mto.model;
        !kinematics.xAxis.homeMin && (rawPulses.p1 = -rawPulses.p1);
        !kinematics.yAxis.homeMin && (rawPulses.p2 = -rawPulses.p2);
        !kinematics.zAxis.homeMin && (rawPulses.p3 = -rawPulses.p3);
        return rawPulses;
    }
    C3Planner.prototype.homeAxis = function(axisId = "z", mpo = true) {
        var that = this;
        var promise = new Promise(function(resolve, reject) {
            that.applyKinematics().then( () => {
                try {
                    var kinematics = that.mto.model;
                    var axisProp = axisId + "Axis";
                    var axis = kinematics[axisProp];
                    var homed = {};
                    that.driver.pushQueue({ // set accelleration
                        sys: {
                            tv: axis.tAccel,
                            mv: Math.round(axis.maxHz),
                        }
                    });
                    var mpoPlan = that.mpoPlan || {};
                    var x = axisId == "x" ? that.homePos(axisId) : (mpoPlan.xn || 0);
                    var y = axisId == "y" ? that.homePos(axisId) : (mpoPlan.yn || 0);
                    var z = axisId == "z" ? that.homePos(axisId) : (mpoPlan.zn || 0);
                    var homePulses = that.calcPulses({
                        x:x,
                        y:y,
                        z:z,
                    });
                    var pulseProp = pulseAxis[axisId];
                    that.mpoPlanSetXYZ(x, y, z, {
                        log: "homeAll(" + x + "," + y + "," + z + ")"
                    });
                    var homeCmd = {
                        hom: {}
                    };
                    homeCmd.hom[axisId] = homePulses[pulseProp];
                    that.mpoPlanSetXYZ(x, y, z, {
                        log: "homeAxis(" + x + "," + y + "," + z + ")"
                    });
                    if (mpo) {
                        that.driver.pushQueue(homeCmd);
                        that.driver.pushQueue({
                            mpo: ""
                        }, function(data) {
                            that.model.homed[axisId] = true;
                            resolve(data);
                        });
                    } else {
                        that.driver.pushQueue(homeCmd, function(data) {
                            that.model.homed[axisId] = true;
                            resolve(data);
                        });
                    } // if (mpo)
                    that.driver.processQueue();
                } catch (err) {
                    reject(err);
                }
            }, err => {
                reject(err);
            }); // appplyKinematics
        }); // new Promise()
        return promise;
    } /* homeAxis */
    C3Planner.prototype.$homeXY = function(resolve,reject) {
        var that = this;
        var kinematics = that.mto.model;
        var homed = {};
        that.driver.pushQueue({ // set acceleration
            sys: {
                tv: Math.max(kinematics.xAxis.tAccel, kinematics.yAxis.tAccel),
                mv: Math.round(Math.min(kinematics.xAxis.maxHz, kinematics.yAxis.maxHz)),
            }
        });
        var x = that.homePos("x");
        var y = that.homePos("y");
        var z = that.homePos("z");
        var homePulses = that.calcPulses({
            x:x,
            y:y,
            z:z,
        });
        var homeCmd = {
            hom: {
                x: homePulses.p1,
                y: homePulses.p2,
            }
        };
        that.mpoPlanSetXYZ(x, y, z, {
            log: "homeAll(" + x + "," + y + "," + z + ")"
        });
        that.driver.pushQueue(homeCmd);
        homed.x = homed.y = true;
        that.driver.pushQueue({
            mpo: ""
        }, function(data) {
            JsonUtil.applyJson(that.model.homed, homed);
            resolve(data);
        });
        that.driver.processQueue();
    }
    C3Planner.prototype.homeAll = function() {
        var that = this;
        var kinematics = that.mto.model;
        var promise = new Promise( (resolve, reject) => {
            if (!that.isConnected()) {
                reject(new Error("connect() has not been called"));
            } else if (kinematics.zAxis.enabled) {
                that.homeAxis("z", false).then(
                    response => that.$homeXY(resolve, reject), 
                    err => reject(err)
                ); // homeAxis("z").then ...
            } else {
                that.$homeXY(resolve, reject);
            }
        }); // new Promise()...
        return promise;
    } /* homeAll */
    C3Planner.prototype.send1 = function(cmd, onDone) { // DEPRECATED
        var that = this;
        console.log("WARN\t: " + that.constructor.name + ".send1() is deprecated");
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
                var x = kinematics.xAxis.homeMin ? kinematics.xAxis.minPos : kinematics.xAxis.maxPos;
            }
            if (cmd.hom.hasOwnProperty("y")) {
                var y = kinematics.homeMin ? kinematics.yAxis.minPos : kinematics.yAxis.maxPos;
            }
            if (cmd.hom.hasOwnProperty("z")) {
                var z = kinematics.homeMin ? kinematics.zAxis.minPos : kinematics.zAxis.maxPos;
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
    C3Planner.prototype.send = function(jobj, onDone) { // DEPRECATED
        throw new Error("DEPRECATED");
        var that = this;
        console.log("WARN\t: " + that.constructor.name + ".send() is deprecated");

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
(typeof describe === 'function') && describe("planner", done => {
    var MockCartesian = require("./mock-cartesian.js");
    var C3Planner = module.exports;
    var MTO_C3 = require("../../www/js/shared/MTO_C3");
    var serialPath = "/dev/ttyACM0";
    var x100 = {
        x: 100,
    };

    function mockModel(path) {
        return {
            home: {},
            rest: {
                serialPath: path
            }
        };
    }

    it("connect(serialPath) closes any existing connection and connects to serial device", done => {
        var model = mockModel("some-device");
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto);
        var planner = new C3Planner(model, mto, driver);
        should.equal(null, planner.serialPath);
        should.equal(null, planner.model.available);
        planner.connect(serialPath).then(result => { /* new connection */
            should.equal(serialPath, planner.serialPath, "connect.1.0.1"); /* currently connected path */
            should.equal(serialPath, planner.model.rest.serialPath, "connect.1.0.2"); /* user specified path */
            should.equal(true, planner.model.available, "connect.1.0.3");
            should.deepEqual(result, {
                opened: serialPath,
            }, "connect.1");
            var h = driver.history();
            var iHist = 0;
            should.deepEqual(h[iHist] && h[iHist++].cmd, {
                sys: ""
            }, "connect.1.0.4");
            should.deepEqual(h[iHist] && h[iHist++].cmd, {
                id: ""
            }, "connect.1.0.5");
            var expectedSerialCommands = 2;
            h.length.should.equal(expectedSerialCommands, "connect.1.0.3");
            planner.connect(serialPath).then(result => { /* re-open existing connection (default) */
                should.equal(serialPath, planner.serialPath);
                should.equal(true, planner.model.available);
                should.deepEqual(result, {
                    opened: serialPath,
                    closed: serialPath,
                }, "connect.1.1");
                driver.history().length.should.equal(2 * expectedSerialCommands, "connect.1.1.0.1"); /* additional serial commands sent */
                planner.connect(serialPath, false).then(result => { /* don't reopen existing connection */
                    should.deepEqual(result, {}, "connect.1.1.1");
                    driver.history().length.should.equal(2 * expectedSerialCommands, "connect.1.1.1.1"); /* no serial commands sent */
                }, err => {
                    should.fail("connect.1.1.2");
                });
            }, err => {
                should.fail("connect.1.2");
            });
            done();
        }, err => {
            should.fail("connect.2");
        }); // connect()
    });
    it("homeAxis(axisId) homes a single axis", done => {
        var model = mockModel(serialPath);
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto);
        driver.mockPosition["1"] = 1;
        driver.mockPosition["2"] = 2;
        driver.mockPosition["3"] = 3;
        var planner = new C3Planner(model, mto, driver);
        planner.connect(); // use model.rest.serialPath
        mto.model.xAxis.enabled = true;
        mto.model.yAxis.enabled = true;
        mto.model.zAxis.enabled = true;
        driver.history().length.should.equal(2);
        planner.homeAxis("z").then( result => { // home single axis
            should(result.s).equal(0, "homeAxis 1.0.0");
            should(result.r.mpo["1"]).equal(1, "homeAxis 1.0.0.1");
            should(result.r.mpo["2"]).equal(2, "homeAxis 1.0.0.2");
            should(result.r.mpo["3"]).equal(0, "homeAxis 1.0.0.3");
            should(model.mpo["1"]).equal(1, "homeAxis 1.0.0.4");
            should(model.mpo["2"]).equal(2, "homeAxis 1.0.0.5");
            should(model.mpo["3"]).equal(0, "homeAxis 1.0.0.6");
            should.deepEqual(planner.model.homed, {
                z: true,
            }, "homeAxis 1.1");
            var h = driver.history();
            var iHist = h.length - 2;
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set MTO_RAW (applyKinematics)
                sys: {
                    to: 0,
                }
            }, "homeAxis 1.0.2");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set axes (applyKinematics)
                x: {
                    tm: 20000,
                    tn: 0,
                    mp: 1,
                },
                y: {
                    tm: 20000,
                    tn: 0,
                    mp: 1,
                },
                z: {
                    tn: -0,
                    tm: 31624,
                    mp: 1,
                },
            });//, "homeAxis 1.0.3");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set acceleration
                sys: {
                    tv: 0.4,
                    mv: 18000,
                }
            }, "homeAxis 1.0.4");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // home axis
                hom: {
                    z: -0,
                }
            }, "homeAxis 1.0.6");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // get current position
                mpo: ""
            }, "homeAxis 1.0.7");
            driver.mockPosition["1"] = 1;
            driver.mockPosition["2"] = 2;
            driver.mockPosition["3"] = 3;
            planner.homeAxis().then(result => { // home z-axis by default
                should(result.s).equal(0, "homeAxis 1.2.1.1");
                should(result.r.mpo["1"]).equal(1, "homeAxis 1.2.1.2");
                should(result.r.mpo["2"]).equal(2, "homeAxis 1.2.1.3");
                should(result.r.mpo["3"]).equal(0, "homeAxis 1.2.1.4");
                should.deepEqual(planner.model.homed, {
                    z: true,
                }, "homeAxis 1.2.2");
            }, err => {
                should.fail(null, null, "homeAxis 1.2.3 " + err);
            });
            done();
        }, err => {
            console.log(err);
            should.fail(null, null, "homeAxis 1.2 " + err);
        }); // planner.homeAxis("z").then ...
    }); // homeAxis
    it("homeAll() homes all axes", done => {
        var model = mockModel(serialPath);
        var mto = new MTO_C3();
        mto.model.yAxis.tAccel = 0.5;
        mto.model.yAxis.maxPos = 300;
        mto.model.zAxis.maxHz = 16000;
        mto.model.zAxis.maxPos = 1;
        mto.model.xAxis.enabled = true;
        mto.model.yAxis.enabled = true;
        mto.model.zAxis.enabled = true;
        var driver = new MockCartesian(model, mto);
        var planner = new C3Planner(model, mto, driver);
        planner.connect(); // use model.rest.serialPath
        driver.history().length.should.equal(2);
        planner.homeAll().then( result => { // home all axes
            result.r.mpo['1'].should.equal(0, "homeAll 1.0.1");
            result.r.mpo['2'].should.equal(0, "homeAll 1.0.2");
            result.r.mpo['3'].should.equal(0, "homeAll 1.0.3");
            result.r.mpo.xn.should.equal(0, "homeAll 1.0.4");
            result.r.mpo.yn.should.equal(0, "homeAll 1.0.5");
            result.r.mpo.zn.should.equal(1, "homeAll 1.0.6");
            should.deepEqual(planner.model.homed, {
                x: true,
                y: true,
                z: true,
            }, "homeAll 1.1");
            var h = driver.history(); // most recent is first
            var iHist = h.length - 4;
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set acceleration to slowest off all axes
                sys: {
                    tv: 0.4,
                    mv: 16000, // limited by z-axis
                }
            }, "homeAll 1.0.4");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // home z-axis first to avoid xy collision
                hom: {
                    z: -3162,
                },
            }, "homeAll 1.0.6");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set x and y axes min/max position
                sys: {
                    tv: 0.5,
                    mv: 18000, // limited by z-axis
                }
            }, "homeAll 1.0.10");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // home x and y axes simultaneously
                hom: {
                    x: 0,
                    y: 0,
                },
            }, "homeAll 1.0.11");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // get current position
                mpo: ""
            }, "homeAll 1.0.12");

            done();
        }, err => {
            should.fail(null, null, "homeAll 1.2 " + err);
        }); // homeAll()
    }); // homeAll
    it("applyKinematics(kinematics) updates local and remote kinematic models", (done) => {
        var model = mockModel(serialPath);
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto);
        var planner = new C3Planner(model, mto, driver);
        should(driver.model.available).undefined;
        planner.connect().then( data => {
            driver.model.available.should.equal(true, "applyKinematics 1.0");
        });
        driver.model.available.should.equal(true); // only works with mock-driver, which resolves promises immediately
        driver.history().length.should.equal(2);
        mto.model.xAxis.enabled = true;
        mto.model.yAxis.enabled = true;
        mto.model.zAxis.enabled = true;
        var maxPos = mto.model.xAxis.maxPos;
        var delta = {
            xAxis: {
                maxPos: maxPos+1,
            },
            yAxis: {
                maxPos: maxPos-1,
            },
            zAxis: {
                minPos: -2,
                maxPos: 1,
            }
        };
        var promise = planner.applyKinematics(delta);
        promise.then(model => {
            model.xAxis.maxPos.should.equal(maxPos+1, "applyKinematics 1.0.1");
            model.yAxis.maxPos.should.equal(maxPos-1, "applyKinematics 1.0.2");
            model.zAxis.maxPos.should.equal(1, "applyKinematics 1.0.3");
            var h = driver.history(); // most recent is first
            h.length.should.above(3, "applyKinematics 1.0.3.1");
            var iHist = h.length-2;
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set machine topology MTO_RAW
                sys: {
                    to: 0,
                }
            }, "applyKinematics 1.1");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set axes min/max position
                x: {
                    tn: 0,
                    tm: 20100,
                    mp: 1,
                },
                y: {
                    tn: 0,
                    tm: 19900,
                    mp: 1,
                },
                z: {
                    tn: -3162,
                    tm: 6325,
                    mp: 1,
                },
            }, "applyKinematics 1.2");
            h.length.should.equal(4, "applyKinematics 1.3");
            done();
        }, err => {
            should.fail("applyKinematics 2.0");
        }); // new Promise
    }); // applyKinematics
    it("move(xyz) positions one or more axes to the given position", done => {
        var model = mockModel(serialPath);
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto);
        var planner = new C3Planner(model, mto, driver);
        planner.connect().then( whatever => {
            planner.homeAll().then( whatever => {
                var xyz = {
                    x: 100,
                    y: 200,
                }
                planner.move(xyz).then( response => {
                    var mpo = response.r.mpo;
                    mpo["1"].should.equal(10000, "move 1.1");
                    mpo["2"].should.equal(20000, "move 1.2");
                    mpo["3"].should.equal(0, "move 1.3");
                    response.s.should.equal(0); // FireStep ok status
                    should.deepEqual(driver.history()[1].cmd.mov, {
                        '1': 10000, // x
                        '2': 20000, // y
                        // no z!
                    });
                    done();
                });
            });
        });
    });
    it("connect() is required before moving and homing", done => {
        var mto = new MTO_C3();
        var model = mockModel(serialPath);
        var driver = new MockCartesian(model, mto);
        var planner = new C3Planner(model, mto, driver);
        planner.move(x100).then( whatever => should.fail(), err => {
            planner.homeAll().then( whatever => {
                console.log("BX");should.fail("connect2")
                }, err => {
                planner.homeAxis("x").then( whatever => should.fail(), err => {
                    done();
                });
            });
        });
    });
});

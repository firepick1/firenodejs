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

    C3Planner.prototype.connect = function(serialPath, reopen = true) {
        var that = this;
        serialPath = serialPath || that.model.rest.serialPath;
        that.model.rest.serialPath = serialPath;
        var promise = new Promise(function(resolve, reject) {
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
    C3Planner.prototype.homeAxis = function(axisId = "z", mpo = true) { 
        var that = this;
        var promise = new Promise(function(resolve, reject) {
            var kinematics = that.mto.model;
            var homed = {};
            that.driver.pushQueue({
                sys: {
                    to: 0, // MTO_RAW
                },
            });
            var axisProp = axisId + "Axis";
            var axis = kinematics[axisProp];
            that.driver.pushQueue({ // set accelleration
                sys: {
                    tv: axis.tAccel,
                    mv: axis.maxHz,
                }
            });
            var minXYZ = { x: 0, y: 0, z: 0};
            minXYZ[axisId] = axis.minPos;
            var minPulses = that.mto.calcPulses(minXYZ);
            var maxXYZ = { x: 0, y: 0, z: 0};
            maxXYZ[axisId] = axis.maxPos;
            var maxPulses = that.mto.calcPulses(maxXYZ);
            var axisCmd = {};
            var pulseProp = pulseAxis[axisId];
            axisCmd[axisId] = {};
            axisCmd[axisId].tn = minPulses[pulseProp];
            axisCmd[axisId].tm = maxPulses[pulseProp];
            that.driver.pushQueue(axisCmd); // set min/max position
            var homeCmd = {
                hom: {}
            };
            homeCmd.hom[axisId] = axis.maxLimit ?  maxPulses[pulseProp] : minPulses[pulseProp];
            if (mpo) {
                that.driver.pushQueue(homeCmd, function(data) {
                    that.model.homed[axisId] = true;
                    resolve(data);
                });
            } else {
                that.driver.pushQueue(homeCmd);
                that.driver.pushQueue({
                    mpo: ""
                }, function(data) {
                    that.model.homed[axisId] = true;
                    resolve(data);
                });
            }
        });
        return promise;
    } /* homeAxis */
    C3Planner.prototype.homeAll = function() {
        var that = this;
        var promise = new Promise(function(resolve, reject) {
            that.homeAxis("z").then( response => {
                var kinematics = that.mto.model;
                var homed = {};
                that.driver.pushQueue({ // set acceleration
                    sys: {
                        tv: Math.max(kinematics.xAxis.tAccel, kinematics.yAxis.tAccel),
                        mv: Math.min(kinematics.xAxis.maxHz, kinematics.yAxis.maxHz),
                    }
                });
                var minPulses = that.mto.calcPulses({
                    x: kinematics.xAxis.minPos,
                    y: kinematics.yAxis.minPos,
                });
                var maxPulses = that.mto.calcPulses({
                    x: kinematics.xAxis.maxPos,
                    y: kinematics.yAxis.maxPos,
                });
                that.driver.pushQueue({
                    x: {
                        tn: minPulses.p1,
                        tm: maxPulses.p1,
                    },
                    y: {
                        tn: minPulses.p2,
                        tm: maxPulses.p2,
                    },
                });
                that.driver.pushQueue({
                    hom: {  
                        x: kinematics.xAxis.maxLimit ? maxPulses.p1 : minPulses.p1,
                        y: kinematics.yAxis.maxLimit ? maxPulses.p2 : minPulses.p2,
                    },
                });
                homed.x = homed.y = true;
                that.driver.pushQueue({
                    mpo: ""
                }, function(data) {
                    JsonUtil.applyJson(that.model.homed, homed);
                    resolve(data);
                });
            }); // homeAxis("z").then ...
        }); // new Promise()...
        return promise;
    } /* homeAll */
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
    var homResponse = {
        s: 0,
        t: 0.001,
        r: {
            mpo: {
                '1': 0,
                '2': 0,
                '3': 0,
                'p1': 0,
                'p2': 0,
                'p3': 0,
                'x': 0,
                'xn': 0,
                'y': 0,
                'yn': 0,
                'z': 0,
                'zn': 0,
            }
        }
    };

    function mockModel(path) {
        return {
            home: {},
            rest: {
                serialPath: path
            }
        };
    }
    it("connect(serialPath) closes any existing connection and connects to serial device", function() {
        var options = null;
        var path = "/dev/ttyACM0";
        var model = mockModel("some-device");
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto, options);
        var planner = new C3Planner(model, mto, driver, options);
        should.equal(null, planner.serialPath);
        should.equal(null, planner.model.available);
        planner.connect(path).then(result => { /* new connection */
            should.equal(path, planner.serialPath, "connect.1.0.1"); /* currently connected path */
            should.equal(path, planner.model.rest.serialPath, "connect.1.0.2"); /* user specified path */
            should.equal(true, planner.model.available, "connect.1.0.3");
            should.deepEqual(result, {
                opened: path,
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
            planner.connect(path).then(result => { /* re-open existing connection (default) */
                should.equal(path, planner.serialPath);
                should.equal(true, planner.model.available);
                should.deepEqual(result, {
                    opened: path,
                    closed: path,
                }, "connect.1.1");
                driver.history().length.should.equal(2 * expectedSerialCommands, "connect.1.1.0.1"); /* additional serial commands sent */
                planner.connect(path, false).then(result => { /* don't reopen existing connection */
                    should.deepEqual(result, {}, "connect.1.1.1");
                    driver.history().length.should.equal(2 * expectedSerialCommands, "connect.1.1.1.1"); /* no serial commands sent */
                }, err => {
                    should.fail("connect.1.1.2");
                });
            }, err => {
                should.fail("connect.1.2");
            });
        }, err => {
            should.fail("connect.2");
        });
    })
    it("homeAxis(axisId) homes a single axis", function() {
        var options = null;
        var path = "/dev/ttyACM0";
        var model = mockModel(path);
        var mto = new MTO_C3();
        var driver = new MockCartesian(model, mto, options);
        var planner = new C3Planner(model, mto, driver, options);
        planner.connect(); // use model.rest.serialPath
        driver.history().length.should.equal(2);
        planner.homeAxis("z").then(result => { // home single axis
            should.deepEqual(result, homResponse, "hom 1.0");
            should.deepEqual(planner.model.homed, {
                z: true,
            }, "hom 1.1");
            var h = driver.history();
            var iHist = h.length;
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // connect
                id: ""
            }, "hom 1.0.1");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // connect
                sys: ""
            }, "hom 1.0.2");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set machine topology MTO_RAW
                sys: {
                    to: 0,
                }
            }, "hom 1.0.3");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set acceleration
                sys: {
                    tv: 0.4,
                    mv: 18000,
                }
            }, "hom 1.0.4");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set axis min/max position
                x: {
                    tn: 0,
                    tm: 200,
                }
            }, "hom 1.0.5");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // home axis
                homx: ""
            }, "hom 1.0.6");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // get current position
                mpo: ""
            }, "hom 1.0.7");
            planner.homeAxis().then(result => { // home all axes
                should.deepEqual(result, homResponse, "hom 1.2.1");
                should.deepEqual(planner.model.homed, {
                    x: true,
                    y: true,
                    z: true,
                }, "hom 1.2.2");
            }, err => {
                should.fail(null, null, "hom 1.2.3 " + err);
            });
        }, err => {
            should.fail(null, null, "hom 1.2 " + err);
        }); // planner.homeAxis("z").then ...
    }) // homeAxis
    it("homeAll() homes all axes", function() {
        var options = null;
        var path = "/dev/ttyACM0";
        var model = mockModel(path);
        var mto = new MTO_C3();
        mto.model.yAxis.tAccel = 0.5;
        mto.model.yAxis.maxPos = 300;
        mto.model.zAxis.maxHz = 16000;
        mto.model.zAxis.maxPos = 10;
        var driver = new MockCartesian(model, mto, options);
        var planner = new C3Planner(model, mto, driver, options);
        planner.connect(); // use model.rest.serialPath
        driver.history().length.should.equal(2);
        planner.homeAll().then(result => { // home all axes
            should.deepEqual(result, homResponse, "homeAll 1.0");
            should.deepEqual(planner.model.homed, {
                x: true,
                y: true,
                z: true,
            });//, "homeAll 1.1");
            var h = driver.history(); // most recent is first
            var iHist = h.length;
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // connect
                id: ""
            }, "homeAll 1.0.1");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // connect
                sys: ""
            }, "homeAll 1.0.2");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set machine topology MTO_RAW
                sys: {
                    to: 0,
                }
            }, "homeAll 1.0.3");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set acceleration to slowest off all axes
                sys: {
                    tv: 0.4, 
                    mv: 16000, // limited by z-axis
                }
            }, "homeAll 1.0.4");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set z-axis min/max position
                z: {
                    tn: -632471,
                    tm: 31624,
                },
            }, "homeAll 1.0.5");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // home z-axis first to avoid xy collision
                hom: {
                    z: 31624,
                },
            }, "homeAll 1.0.6");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set acceleration to slowest off x and y axes
                sys: {
                    tv: 0.5,  // limited by y-axis
                    mv: 18000, 
                }
            }, "homeAll 1.0.9");
            should.deepEqual(h[--iHist] && h[iHist].cmd, { // set x and y axes min/max position
                x: {
                    tn: 0,
                    tm: 20000,
                },
                y: {
                    tn: 0,
                    tm: 30000,
                },
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
        }, err => {
            should.fail(null, null, "homeAll 1.2 " + err);
        });
    }) // homeAll
});

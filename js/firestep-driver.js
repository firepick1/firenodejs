//console.log("INFO\t: loading FireStepDriver");
var child_process = require('child_process');
var should = require("should");
var shared = require("../www/js/shared/JsonUtil.js");
var DVSFactory = require("./lib/DVSFactory.js");
var LPPCurve = require("./lib/LPPCurve.js");
var Logger = require("../www/js/shared/Logger.js");
var math = require("mathjs");
var fs = require('fs');
var serialport;

try {
    serialport = require("serialport");
} catch (e) {
    serialport = null; // failover
}

function millis() {
    var hrt = process.hrtime();
    var ms = hrt[0] * 1000 + hrt[1] / 1000000;
    return ms;
}


module.exports.FireStepDriver = (function() {
    ////////////////////////// FireStep commands
    var CMD_ID = {
        "id": ""
    };
    var CMD_SYS = {
        "sys": ""
    };
    var CMD_DIM = {
        "dim": ""
    };
    var CMD_A = {
        "a": ""
    };
    var CMD_B = {
        "b": ""
    };
    var CMD_C = {
        "c": ""
    };
    var CMD_X = {
        "x": ""
    };
    var CMD_Y = {
        "y": ""
    };
    var CMD_Z = {
        "z": ""
    };
    var CMD_MPO = {
        mpo: "",
        dpyds: 12,
    };
    var CMD_HOME = [{
        "hom": ""
    }, CMD_MPO];
    var CMD_SYNC = {
        "cmt": "synchronize serial"
    };

    function reset_serialDriver(that) {
        console.log("TTY\t: FireStepDriver reset_serialDriver()");
        that.model.available = false;
        that.model.initialized = false;
        that.serialQueue = [];
    }


    function send_startup(that) {
        that.model.available = true;
        if (that.serialQueue.length > 0) {
            console.log("TTY\t: FireStepDriver send_startup() clearing queue items:", that.serialQueue.length);
            that.serialQueue = [];
        }
        that.serialInProgress = false;
        that.model.initialized = false;
        that.send(CMD_ID); // a simple, safe command
        that.send(CMD_DIM); // required for delta sync
        that.processQueue();
    }

    function open_serialport(that, options) {
        console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") opening serialport");
        that.serial = new serialport.SerialPort(that.model.rest.serialPath, {
            buffersize: options.buffersize,
            parser: serialport.parsers.readline('\n'),
            baudrate: options.baudrate
        }, false);
        that.serial.on("data", function(data) {
            var jdata = JSON.parse(data);
            that.onSerialData(data);
        });
        that.serialInProgress = true;
        that.model.driver = "serialport";
        that.serial.open(function(error) {
            that.error = error;
            if (error) {
                console.log("TTY\t: FireStepDriver.open(" + that.model.rest.serialPath + ") FAILED:" + error);
                reset_serialDriver(that);
            } else {
                that.model.available = true;
                console.log("TTY\t: FireStepDriver() SerialPort.open(" + that.model.rest.serialPath + ") ready...");
                reset_serialDriver(that);
                send_startup(that);
            }
        });
    }

    function open_firestep(that, options) {
        try {
            that.firestep_proc = {}; // mark intent (actual value is set async)
            that.model.driver = "firestep";

            function onOpenSuccess(that, stdout, attempts) {
                console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") firestep reset successful. attempts:" + attempts + " stdout:" + stdout);
                that.firestep_proc = child_process.spawn('firestep', ['-d', that.model.rest.serialPath]);
                console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") firestep cli pid:" + that.firestep_proc.pid);
                that.firestep_proc.on('close', function(code) {
                    if (code) {
                        console.log("TTY\t: firestep cli ERROR:" + code);
                    } else {
                        console.log("TTY\t: firestep cli ended normally");
                    }
                });
                that.firestep_proc.stdout.on('data', function(buffer) {
                    var data = buffer.toString();
                    data = data.substr(0, data.length - 1); // chop LF to match serialport
                    //console.log("TTY\t: firestep stdout:" + data);
                    that.onSerialData(data);
                });
                that.firestep_proc.stderr.on('data', function(data) {
                    console.warn("STDERR\t: firestep => " + data);
                    reset_serialDriver(that);
                });
                send_startup(that);
            }
            var cmd = 'firestep -d ' + that.model.rest.serialPath + ' -r';
            console.log("TTY\t: FirestepDriver(" + that.model.rest.serialPath + ") " + cmd);
            var child1 = child_process.exec(cmd, function(error, stdout, stdin) {
                if (error instanceof Error) {
                    console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") attempt #1:" + error);
                    var child2 = child_process.exec(cmd, function(error, stdout, stdin) {
                        if (error instanceof Error) {
                            reset_serialDriver(that);
                            console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") RETRY #1:" + error);
                        } else {
                            onOpenSuccess(that, stdout, 2);
                        }
                    });
                } else {
                    onOpenSuccess(that, stdout, 1);
                }
            });
        } catch (e) {
            console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") UNAVAILABLE:" + e);
            reset_serialDriver(that);
        }
    }

    function open_serialDriver(that, options) {
        if (serialport) {
            open_serialport(that, options);
        } else {
            open_firestep(that, options);
        }
    }

    function close_serialport(that) {
        console.log("ERROR\t: close_serialport() not implemented");
    }

    function close_firestep(that) {
        if (that.isAvailable() && that.firestep_proc != null) {
            console.log("INFO\t: shutting down FireStep");
            that.firestep_proc.kill('SIGTERM');
        }
    }

    function close_serialDriver(that) {
        if (serialport) {
            close_serialport(that);
        } else {
            close_firestep(that);
        }
    }

    ////////////////// constructor
    function FireStepDriver(options) {
        var that = this;
        options = options || {};
        options.buffersize = options.buffersize || 255;
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // allow EEPROM commands to complete
        options.onIdle = options.onIdle || that.onIdle;

        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.serialHistory = [];
        that.msLaunchTimeout = options.msLaunchTimeout;
        that.logger = options.logger || new Logger({
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
        that.model = {
            available: null,
            initialized: false,
            writes: 0,
            reads: 0,
            rest: {
                startup: {
                    id: true,
                    mpo: true,
                    hom: true
                },
                lppSpeed: 0.8, // slow and safe
                lppZ: 50,
                msSettle: 600, // millisecond settle time for mpo command
                marks: marks,
                displayLevel: 32,
                jog: 10,
                serialPath: "/dev/ttyACM0",
            }
        };
        return that;
    }

    FireStepDriver.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }

    FireStepDriver.prototype.write = function(cmd) {
        var that = this;
        that.model.writes++;
        console.log("TTY\t: WRITE(" + that.model.writes + ") " + cmd + "\\n");
        try {
            if (that.serial) {
                that.serial.write(cmd);
                that.serial.write("\n");
            } else if (that.firestep_proc) {
                if (that.firestep_proc.pid) {
                    that.firestep_proc.stdin.write(cmd);
                    that.firestep_proc.stdin.write("\n");
                } else {
                    setTimeout(function() {
                        if (that.firestep_proc.pid) {
                            that.firestep_proc.stdin.write(cmd);
                            that.firestep_proc.stdin.write("\n");
                        } else {
                            // FireStep spawn failed
                            console.log("TTY\t: firestep response TIMEOUT:" + that.msLaunchTimeout + "ms");
                            reset_serialDriver(that);
                        }
                    }, that.msLaunchTimeout);
                }
            } else {
                throw new Error("no serial driver");
            }
        } catch (e) {
            console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") UNAVAILABLE:" + e);
            reset_serialDriver(that);
        }
    }
    FireStepDriver.prototype.processQueue = function() {
        var that = this;
        if (that.serialQueue.length <= 0) {
            //console.log("TTY\t: FireStepDriver.processQueue(empty) ");
        } else if (!that.model.available) {
            console.log("TTY\t: FireStepDriver.processQueue(unavailable) ", that.serialQueue.length,
                " items");
        } else if (that.serialInProgress) {
            //console.log("TTY\t: FireStepDriver.processQueue(busy) ", that.serialQueue.length, " items");
        } else {
            that.serialInProgress = true;
            var jcmd = that.serialQueue.shift();
            that.serialHistory.splice(0, 0, jcmd);
            that.serialHistory.splice(that.maxHistory);
            var cmd = JSON.stringify(jcmd.cmd);
            that.write(cmd);
        }
    };

    FireStepDriver.prototype.onIdle = function() {
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
                log: "FireStepDriver.onIdle(initialized)"
            });
        } else {
            console.log("TTY\t: FireStepDriver.onIdle(waiting) ...");
        }
        if (that.mpoPlan) {
            that.model.mpo = JSON.parse(JSON.stringify(that.mpoPlan));
            // round for archival
            that.model.mpo.x = math.round(that.model.mpo.x, 3);
            that.model.mpo.y = math.round(that.model.mpo.y, 3);
            that.model.mpo.z = math.round(that.model.mpo.z, 3);
        }
        return that;
    };

    FireStepDriver.prototype.onSerialData = function(data) {
        var that = this;
        that.model.reads++;
        console.log("TTY\t: READ(" + that.model.reads + ") " + data + "\\n");
        if (typeof data !== 'string') {
            throw new Error("expected Javascript string for serial data return");
        }
        if (data.indexOf('{') === 0) { // success
            var jdata = JSON.parse(data);
            if (!jdata) {
                throw new Error("could not parse firestep response:" + data);
            }
            var r = jdata.r;
            that.model.id = r.id || that.model.id;
            that.model.sys = r.sys || that.model.sys;
            that.model.dim = r.dim || that.model.dim;
            if (r.dim) {
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
                console.log("TTY\t: FireStepDriver.onSerialData() synchronized delta dimensions");
            }
            that.model.a = r.a || that.model.a;
            that.model.b = r.b || that.model.b;
            that.model.c = r.c || that.model.c;
            that.model.x = r.x || that.model.x;
            that.model.y = r.y || that.model.y;
            that.model.z = r.z || that.model.z;
            that.model.mpo = r.mpo || that.model.mpo;
            that.model.response = r;
            if (jdata.s < 0) {
                console.log("TTY\t: FireStep COMMAND FAILED:" + data);
                console.log("TTY\t: FireStepDriver() COMMAND QUEUE CLEARED " + that.serialQueue.length + " ITEMS");
                that.serialQueue = [];
            }
        }

        if (that.serialInProgress && data[data.length - 1] === ' ') { // FireStep idle is SPACE-LF
            that.serialInProgress = false;
            var h = that.serialHistory.length > 0 ? that.serialHistory[0] : {};
            var jdata;
            try {
                h.resp = JSON.parse(data);
            } catch (e) {
                console.log("TTY\t: ERROR(INVALID JSON): " + data, e);
            }
            try {
                h.onDone && h.onDone(h.resp);
            } catch (e) {
                console.log("TTY\t: ERROR(response handler failed):" + data, e);
            }
            that.processQueue();
            if (that.serialQueue.length == 0) {
                that.onIdle();
            }
        }

        return that;
    };

    FireStepDriver.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    FireStepDriver.prototype.getLocation = function() {
        var that = this;
        that.send(that.cmd_mpo());
        return that.model.mpo;
    }
    FireStepDriver.prototype.syncModel = function(data) {
        var that = this;
        if (data) {
            var initialized = that.model.initialized;
            var serialPath = that.model.rest.serialPath;
            //console.log("FireStepDriver.syncModel() data:" + JSON.stringify(data));
            shared.applyJson(that.model, data);
            that.model.initialized = initialized;
            if (serialPath !== that.model.rest.serialPath) {
                console.log('INFO\t: new serial path:', that.model.rest.serialPath);
                if (that.isAvailable()) {
                    close_serialDriver(that);
                    setTimeout(function() {
                        open_serialDriver(that);
                    }, 2000);
                } else {
                    open_serialDriver(that);
                }
            } else if (!that.isAvailable()) {
                open_serialDriver(that);
            }
        } else {
            that.send(CMD_SYS);
            that.send(CMD_DIM);
        }
        return that.model;
    }
    FireStepDriver.prototype.test = function(res, options) {
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
        //var pts = lpp.timedPath(x, y, z);
        var pts = lpp.laplacePath(x, y, z);
        console.log("DEBUG\t: lpp.timedPath() msElapsed:", millis() - msStart);
        var cmd = new DVSFactory().createDVS(pts);
        console.log("DEBUG\t: lpp.createDVS() msElapsed:", millis() - msStart);
        if (options.usScale > 0) {
            cmd.dvs.us = math.round(cmd.dvs.us * options.usScale);
        }
        that.send(cmd, function(data) {
            var msElapsed = millis() - msStart;
            console.log("TTY\t: FireStepDriver.test(dvs) msElapsed:", msElapsed);
        });
        that.send(that.cmd_mpo(), function(data) {
            var msElapsed = millis() - msStart;
            console.log("INFO\t: FireStepDriver.test(", JSON.stringify(options), ") complete msElapsed:", msElapsed);
            data.mpo = that.model.mpo;
            res.send(data);
            console.log("HTTP\t: POST " + Math.round(msElapsed) + 'ms => ' + JSON.stringify(data));
        });
    }
    FireStepDriver.prototype.moveLPP = function(x, y, z, onDone) {
        var that = this;
        var mpoPlan = that.mpoPlan;
        var cmdsUp = [];
        should.exist(x);
        should.exist(y);
        should.exist(z);
        if (mpoPlan && mpoPlan.x != null && mpoPlan.y != null && mpoPlan.z != null) {
            if (mpoPlan.x || mpoPlan.y || mpoPlan.z != that.model.rest.lppZ) {
                console.log("DEBUG\t: FireStepDriver.moveLPP() mpoPlan:" + JSON.stringify(mpoPlan));
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
            that.send1(CMD_HOME);
            that.send1({
                movz: that.model.rest.lppZ
            });
        }
        that.send1(that.cmd_mpo());
        var pts = lpp.laplacePath(x, y, z);
        console.log("DEBUG\t: LPP up:" + JSON.stringify(pts[pts.length - 1]));
        var cmd = new DVSFactory().createDVS(pts);
        cmd.dvs.us = math.round(cmd.dvs.us / that.model.rest.lppSpeed);
        that.send1(cmd);
        that.send1(that.cmd_mpo(), onDone);
        var ptN = pts[pts.length - 1];
        that.mpoPlanSetXYZ(ptN.x, ptN.y, ptN.z, {
            log: "moveLPP"
        });
        return that;
    }
    FireStepDriver.prototype.isLPPMove = function(cmd) {
        var that = this;
        if (!cmd.hasOwnProperty("mov")) {
            return false;
        }
        if (that.model.rest.lppSpeed <= 0) {
            console.log("FireStepDriver.isLPPMove(lppSpeed <= 0) => false");
            return false;
        }
        if (!cmd.mov.hasOwnProperty("x") ||
            !cmd.mov.hasOwnProperty("y") ||
            !cmd.mov.hasOwnProperty("z")) {
            console.log("FireStepDriver.isLPPMove(not absolute) => false");
            return false;
        }
        if (cmd.mov.lpp === false) {
            console.log("FireStepDriver.isLPPMove(lpp:false) => false");
            return false;
        }
        return true;
    }
    FireStepDriver.prototype.mpoPlanSetXYZ = function(x, y, z, options) {
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
    FireStepDriver.prototype.mpoPlanSetPulses = function(p1, p2, p3, options) {
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
    FireStepDriver.prototype.send1 = function(cmd, onDone) {
        var that = this;
        onDone = onDone || function(data) {}
        var mpoPlan = that.mpoPlan;
        var sendCmd = true;

        if (that.isLPPMove(cmd)) {
            that.moveLPP(cmd.mov.x, cmd.mov.y, cmd.mov.z, onDone);
            sendCmd = false;
        } else if (cmd.hasOwnProperty("movxr")) {
            that.mpoPlanSetXYZ(mpoPlan.x + cmd.movxr, mpoPlan.y, mpoPlan.z, {
                log: "send1.movxr" + cmd.movxr
            });
        } else if (cmd.hasOwnProperty("movyr")) {
            that.mpoPlanSetXYZ(mpoPlan.x, mpoPlan.y + cmd.movyr, mpoPlan.z, {
                log: "send1.movyr" + cmd.movyr
            });
        } else if (cmd.hasOwnProperty("movzr")) {
            that.mpoPlanSetXYZ(mpoPlan.x, mpoPlan.y, mpoPlan.z + cmd.movzr, {
                log: "send1.movzr" + cmd.movzr
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
                log: "send1"
            });
        }
        if (sendCmd) {
            that.serialQueue.push({
                "cmd": cmd,
                "onDone": onDone
            });
        }
        that.processQueue();
    }
    FireStepDriver.prototype.send = function(jobj, onDone) {
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
        that.processQueue();
        if (that.serialQueue.length) {
            console.log("TTY\t: FireStepDriver.send() queued:", that.serialQueue.length);
        }
        return that;
    }
    FireStepDriver.prototype.cmd_mpo = function() {
        var that = this;
        return {
            mpo: "",
            dpyds: 12,
        }
    }

    return FireStepDriver;
})();

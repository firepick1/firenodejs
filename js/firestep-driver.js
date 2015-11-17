//console.log("INFO\t: loading FireStepDriver");
var child_process = require('child_process');
var fs = require('fs');
var serialport;

try {
    serialport = require("serialport");
} catch (e) {
    serialport = null; // failover
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
    var CMD_MPO = [{
        "mpo": ""
    }];
    var CMD_HOME = [{
        "hom": ""
    }, CMD_MPO];
    var CMD_SYNC = {
        "cmt": "synchronize serial"
    };

    function open_serialport(that, options) {
        console.log("TTY\t: FireStepDriver(" + that.serialPath + ") opening serialport");
        that.serial = new serialport.SerialPort(that.serialPath, {
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
                console.log("TTY\t: FireStepDriver.open(" + that.serialPath + ") FAILED:" + error);
                that.model.available = false;
            } else {
                that.model.available = true;
                console.log("TTY\t: FireStepDriver() SerialPort.open(" + that.serialPath + ") ready...");
                that.serialInProgress = false;
                that.processQueue();
            }
        });
    }

    function open_firestep(that, options) {
        try {
            that.firestep = {}; // mark intent (actual value is set async)
            that.model.driver = "firestep";

            function onOpenSuccess(that, stdout, attempts) {
                console.log("TTY\t: FireStepDriver(" + that.serialPath + ") firestep reset successful. attempts:" + attempts + " stdout:" + stdout);
                that.firestep = child_process.spawn('firestep', ['-d', that.serialPath]);
                console.log("TTY\t: FireStepDriver(" + that.serialPath + ") firestep cli pid:" + that.firestep.pid);
                that.firestep.on('close', function(code) {
                    if (code) {
                        console.log("TTY\t: firestep cli ERROR:" + code);
                    } else {
                        console.log("TTY\t: firestep cli ended normally");
                    }
                });
                that.firestep.stdout.on('data', function(buffer) {
                    var data = buffer.toString();
                    data = data.substr(0, data.length - 1); // chop LF to match serialport
                    //console.log("TTY\t: firestep stdout:" + data);
                    that.onSerialData(data);
                });
                that.firestep.stderr.on('data', function(data) {
                    console.warn("STDERR\t: firestep => " + data);
                    that.model.available = false;
                });
                that.model.available = true;
                that.processQueue();
            }
            var cmd = 'firestep -r';
            console.log("TTY\t: FirestepDriver(" + that.serialPath + ") " + cmd);
            var child1 = child_process.exec(cmd, function(error, stdout, stdin) {
                if (error instanceof Error) {
                    console.log("TTY\t: FireStepDriver(" + that.serialPath + ") attempt #1:" + error);
                    var child2 = child_process.exec(cmd, function(error, stdout, stdin) {
                        if (error instanceof Error) {
                            that.model.available = false;
                            console.log("TTY\t: FireStepDriver(" + that.serialPath + ") RETRY #1:" + error);
                        } else {
                            onOpenSuccess(that, stdout, 2);
                        }
                    });
                } else {
                    onOpenSuccess(that, stdout, 1);
                }
            });
        } catch (e) {
            console.log("TTY\t: FireStepDriver(" + that.serialPath + ") UNAVAILABLE:" + e);
            that.model.available = false;
        }
    }

    ////////////////// constructor
    function FireStepDriver(options) {
        var that = this;
        options = options || {};
        options.serialPath = options.serialPath || "/dev/ttyACM0";
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
        that.model = {
            available: null,
            initialized: false,
            writes: 0,
            reads: 0,
            rest: {
                startup:{id:true, mpo:true, hom:true},
                displayLevel: 128, 
                jog:10
            }
        };
        that.serialPath = options.serialPath;
        if (serialport) {
            open_serialport(that, options);
        } else {
            open_firestep(that, options);
        }
        that.send(CMD_ID); // a simple, safe command
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
            } else if (that.firestep) {
                if (that.firestep.pid) {
                    that.firestep.stdin.write(cmd);
                    that.firestep.stdin.write("\n");
                } else {
                    setTimeout(function() {
                        if (that.firestep.pid) {
                            that.firestep.stdin.write(cmd);
                            that.firestep.stdin.write("\n");
                        } else {
                            // FireStep spawn failed
                            console.log("TTY\t: firestep response TIMEOUT:" + that.msLaunchTimeout + "ms");
                            that.model.available = false;
                        }
                    }, that.msLaunchTimeout);
                }
            } else {
                throw new Error("no serial driver");
            }
        } catch (e) {
            console.log("TTY\t: FireStepDriver(" + that.serialPath + ") UNAVAILABLE:" + e);
            that.model.available = false;
        }
    }
    FireStepDriver.prototype.processQueue = function() {
        var that = this;
        if (that.model.available && !that.serialInProgress && that.serialQueue[0]) {
            that.serialInProgress = true;
            var jcmd = that.serialQueue.shift();
            that.serialHistory.splice(0, 0, jcmd);
            that.serialHistory.splice(that.maxHistory);
            var cmd = JSON.stringify(jcmd.cmd);
            that.write(cmd);
        } else {
            //console.log("TRACE\t: FireStepDriver ignoring serial write (no FireStep)");
        }
    };

    FireStepDriver.prototype.onIdle = function() {
        var that = this;
        console.log("TTY\t: FireStepDriver() onIdle...");
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
            that.model.a = r.a || that.model.a;
            that.model.b = r.b || that.model.b;
            that.model.c = r.c || that.model.c;
            that.model.x = r.x || that.model.x;
            that.model.y = r.y || that.model.y;
            that.model.z = r.z || that.model.z;
            that.model.mpo = r.mpo || that.model.mpo;
            that.model.initialized = that.model.initialized || (r.hom != null);
            that.model.response = r;
            if (jdata.s < 0) {
                console.log("TTY\t: FireStep COMMAND FAILED:" + data);
                console.log("TTY\t: FireStepDriver() COMMAND QUEUE CLEARED " + that.serialQueue.length + " ITEMS");
                that.serialQueue = [];
            }
        }

        if (that.serialInProgress && data[data.length - 1] === ' ') { // FireStep idle is SPACE-LF
            that.serialInProgress = false;
            if (that.serialQueue.length == 0) {
                that.onIdle();
            }
            try {
                var h = that.serialHistory[0];
                h.resp = JSON.parse(data);
                h.onDone && h.onDone(h.resp);
            } catch (e) {
                console.log("TTY\t: " + data + " (INVALID JSON)");
            }
            that.processQueue();
        }

        return that;
    };

    FireStepDriver.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    FireStepDriver.prototype.getLocation = function() {
        var that = this;
        that.send(CMD_MPO);
        return that.model.mpo;
    }
    FireStepDriver.prototype.syncModel = function(data) {
        var that = this;
        if (data) {
            var initialized = that.model.initialized;
            console.log("syncModel initialized:" + initialized);
            shared.applyJson(that.model, data);
            that.model.initialized = initialized;
        } else {
            that.send(CMD_SYS);
        }
        return that.model;
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
            for (var i = 0; i < jobj.length; i++) {
                if (i < jobj.length - 1) {
                    that.serialQueue.push({
                        "cmd": jobj[i]
                    });
                } else {
                    that.serialQueue.push({
                        "cmd": jobj[i],
                        "onDone": onDone
                    });
                }
            }
        } else {
            that.serialQueue.push({
                "cmd": jobj,
                "onDone": onDone
            });
        }
        that.processQueue();
        return that;
    }
    return FireStepDriver;
})();

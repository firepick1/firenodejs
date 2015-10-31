console.log("INFO\t: loading FireStepDriver");
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
    var CMD_MODEL = [CMD_SYNC, CMD_ID, CMD_SYS, CMD_DIM, CMD_A, CMD_B, CMD_C, CMD_X, CMD_Y, CMD_Z, CMD_MPO];

    ////////////////// constructor
    function FireStepDriver(options) {
        var that = this;
        options = options || {};
        options.serialPath = options.serialPath || "/dev/ttyACM0";
        options.buffersize = options.buffersize || 255;
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 10000; // allow EEPROM commands to complete
        options.onIdle = options.onIdle || that.onIdle;

        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.serialHistory = [];
        that.msLaunchTimeout = options.msLaunchTimeout;
        that.model = {
            isAvailable: true
        };
        that.serialPath = options.serialPath;
        if (serialport) {
            console.log("INFO\t: FireStepDriver(" + that.serialPath + ") opening serialport");
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
            that.serial.open(function(error) {
                that.error = error;
                if (error) {
                    throw new Error("FireStepDriver.open(" + that.serialPath + ") failed:" + error);
                }
                console.log("INFO\t: FireStepDriver() SerialPort.open(" + that.serialPath + ") Reading...");
                that.serialInProgress = false;
                processQueue();
            });
        } else {
            try {
                that.firestep = {}; // mark intent (actual value is set async)
                fs.stat(that.serialPath, function (error, stats) {
                    if (error) {
                        console.log("WARN\t: FireStepDriver(cmd) " + error);
                    } else if (!stats.isCharacterDevice()) {
                        console.log("WARN\t: FireStepDriver(cmd) expected character device");
                    } else {
                        that.firestep = child_process.spawn('firestep', ['-d', that.serialPath]);
                        console.log("INFO\t: FireStepDriver(" + that.serialPath + ") firestep cli pid:" + that.firestep.pid);
                        that.firestep.on('close', function(code) {
                            if (code) {
                                console.log("WARN\t: firestep cli error code:" + code);
                            } else {
                                console.log("INFO\t: firestep cli ended normally");
                            }
                        });
                        that.firestep.stdout.on('data', function(buffer) {
                            var data = buffer.toString();
                            data = data.substr(0, data.length - 1); // chop LF to match serialport
                            console.log("STDOUT\t: firestep => " + data);
                            that.onSerialData(data);
                        });
                        that.firestep.stderr.on('data', function(data) {
                            console.log("STDERR\t: firestep => " + data);
                        });
                        console.log("INFO\t: FireStepDriver(" + that.serialPath + ") firestep cli spawned. Reading...");
                    }
                });
            } catch (e) {
                console.log("WARN\t: FireStepDriver(" + that.serialPath + ") " + e);
                that.model.isAvailable = false;
            }
        }
        that.send(CMD_MODEL);
        //that.send(CMD_HOME);
        return that;
    }

    FireStepDriver.prototype.write = function(cmd) {
        var that = this;
        console.log("WRITE\t: " + cmd + "\\n");
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
                            throw new Error("firestep launch timeout:" + that.msLaunchTimeout + "ms");
                       }
                    }, that.msLaunchTimeout);
                }
            } else {
                throw new Error("no serial driver");
            }
        } catch (e) {
            console.log("WARN\t: FireStepDriver(" + that.serialPath + ") unavailable:" + e);
            that.model.isAvailable = false;
        }
    }
    FireStepDriver.prototype.processQueue = function() {
        var that = this;
        if (that.model.isAvailable && !that.serialInProgress && that.serialQueue[0]) {
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
        console.log("INFO\t: FireStepDriver() onIdle...");
        return that;
    };

    FireStepDriver.prototype.onSerialData = function(data) {
        var that = this;
        console.log("READ\t: " + data + "\\n");
        if (typeof data !== 'string') {
            throw new Error("expected Javascript string for serial data return");
        }
        if (data.indexOf('{"s":0,"r":{') === 0) { // success
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
        }
        if (data.indexOf('{"s":-') === 0) { // failure
            that.serialQueue = [];
            console.log("ERROR\t: " + data);
            console.log("INFO\t: FireStepDriver() command queue cleared and ready for next command.");
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
                console.log("WARN\t: JSON.parse(" + data + ")" + "syntax error");
            }
            that.processQueue();
        }

        return that;
    };

    FireStepDriver.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    FireStepDriver.prototype.getModel = function() {
        var that = this;
        that.send(CMD_MODEL);
        return that.model;
    }
    FireStepDriver.prototype.send = function(jobj, onDone) {
        var that = this;
        if (!onDone) {
            onDone = function(data) {
                console.log("INFO\t: firestep response:" + data.s);
            }
        }

        if (jobj instanceof Array) {
            for (var i = 0; i < jobj.length; i++) {
                if (i < jobj.length -1 ) {
                    that.serialQueue.push({"cmd":jobj[i]});
                } else {
                    that.serialQueue.push({"cmd":jobj[i], "onDone":onDone});
                }
            }
        } else {
            that.serialQueue.push({"cmd":jobj, "onDone":onDone});
        }
        that.processQueue();
        return that;
    }
    return FireStepDriver;
})();

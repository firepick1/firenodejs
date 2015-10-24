console.log("loading FireStepDriver");
var child_process = require('child_process');
var serialport;

try {
    serialport = require("serialport");
} catch (e) {
    serialport = null; // failover
}

var firepick = firepick || {};
(function(firepick) {
    var FireStepDriver = (function() {
        ///////////////////////// private instance variables
        var child;
        var serial;
        var serialQueue = [];
        var serialInProgress = false;
        var serialHistory = [];
        var maxHistory = 50;
        var model = {};

        var processQueue = function() {
            if (!serialInProgress && serialQueue[0]) {
                serialInProgress = true;
                var jobj = serialQueue.shift();
                serialHistory.splice(0, 0, {
                    "cmd": jobj
                });
                serialHistory.splice(maxHistory);
                var cmd = JSON.stringify(jobj);
                console.log("WRITE\t: " + cmd + "\\n");
                if (serial) {
                    serial.write(cmd);
                    serial.write("\n");
                } else if (child) {
                    child.stdin.write(cmd);
                    child.stdin.write("\n");
                } else {
                    throw new Error("FireStep serial connection unavailable");
                }

            }
        };

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
        var CMD_HOME = [{
            "hom": ""
        }, {
            "mpo": ""
        }];
        var CMD_SYNC = {
            "cmt": "synchronize serial"
        };
        var CMD_MODEL = [CMD_SYNC, CMD_ID, CMD_SYS, CMD_DIM, CMD_A, CMD_B, CMD_C, CMD_X, CMD_Y, CMD_Z];

        ////////////////// constructor
        function FireStepDriver(options) {
            var that = this;
            options = options || {};
            options.serialPath = options.serialPath || "/dev/ttyACM0";
            options.buffersize = options.buffersize || 255;
            options.baudrate = options.baudrate || 19200;
            options.maxHistory = options.maxHistory || maxHistory;
            options.onIdle = options.onIdle || onIdle;

            maxHistory = options.maxHistory;
            that.serialPath = options.serialPath;
            console.log("INFO\t: FireStepDriver(" + that.serialPath + ") ...");
            if (serialport) {
                console.log("INFO\t: opening serialport");
                serial = new serialport.SerialPort(that.serialPath, {
                    buffersize: options.buffersize,
                    parser: serialport.parsers.readline('\n'),
                    baudrate: options.baudrate
                }, false);
                serial.on("data", function(data) {
                var jdata = JSON.parse(data);
                    onSerialData(data);
                });
                serialInProgress = true;
                serial.open(function(error) {
                    that.error = error;
                    if (error) {
                        throw new Error("FireStepDriver.open(" + that.serialPath + ") failed:" + error);
                    }
                    console.log("INFO\t: SerialPort.open(" + that.serialPath + ") Reading...");
                    serialInProgress = false;
                    processQueue();
                });
            } else {
                console.log("WARN\t: serialport unavailable, failing over to firestep cli");
                child = child_process.spawn('firestep',['-d', that.serialPath]);
                child.on('error', function(data) {
                    throw new Error("could not spawn firestep cli process:" + data);
                });
                child.on('close', function() {
                    console.log("INFO\t: closing firestep cli processl");
                });
                child.stdout.on('data', function(buffer) {
                    var data = buffer.toString();
                    data = data.substr(0,data.length-1); // chop LF to match serialport
                    //console.log("STDOUT\t: " + data);
                    onSerialData(data);
                });
                child.stderr.on('data', function(data) {
                    console.log("STDERR\t: " + data);
                });
                console.log("INFO\t: spawned firestep cli pid:" + child.pid);
                console.log("INFO\t: firestep cli spawned. Reading...");
            }
            that.send(CMD_MODEL);
            that.send(CMD_HOME);
            return that;
        }

        var onIdle = function() {
            var that = this;
            console.log("INFO\t: onIdle...");
            return that;
        }

        var onSerialData = function(data) {
            var that = this;
            console.log("READ\t: " + data + "\\n");
            if (typeof data !== 'string') {
                throw new Error("expected Javascript string for serial data return");
            }
            if (data.indexOf('{"s":0,"r":{') === 0) { // success
                var jdata = JSON.parse(data);
                var r = jdata.r;
                model.id = r.id || model.id;
                model.sys = r.sys || model.sys;
                model.dim = r.dim || model.dim;
                model.a = r.a || model.a;
                model.b = r.b || model.b;
                model.c = r.c || model.c;
                model.x = r.x || model.x;
                model.y = r.y || model.y;
                model.z = r.z || model.z;
                model.mpo = r.mpo || model.mpo;
            }
            if (data.indexOf('{"s":-') === 0) { // failure
                serialQueue = [];
                console.log("ERROR\t: " + data);
                console.log("INFO\t: command queue cleared and ready for next command.");
            }

            if (serialInProgress && data[data.length - 1] === ' ') { // FireStep idle is SPACE-LF
                serialInProgress = false;
                if (serialQueue.length == 0) {
                    onIdle();
                }
                try {
                    serialHistory[0].resp = JSON.parse(data);
                } catch(e) {
                    console.log("WARN\t: JSON.parse(" + data + ")" + "syntax error");
                }
                processQueue();
            }

            return that;
        };

        FireStepDriver.prototype.history = function() {
            return serialHistory;
        }
        FireStepDriver.prototype.model = function() {
            var that = this;
            that.send(CMD_MODEL);
            return model;
        }
        FireStepDriver.prototype.send = function(jobj) {
            var that = this;
            if (jobj instanceof Array) {
                for (var i = 0; i < jobj.length; i++) {
                    serialQueue.push(jobj[i]);
                }
            } else {
                serialQueue.push(jobj);
            }
            processQueue();
            return that;
        }
        return FireStepDriver;
    })();
    firepick.FireStepDriver = FireStepDriver;
})(firepick);

module.exports.FireStepDriver = firepick.FireStepDriver;

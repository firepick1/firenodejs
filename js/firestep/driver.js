var child_process = require('child_process');
var should = require("should");
var serialport;
var shared = require("../../www/js/shared/JsonUtil.js");
var Logger = require("../../www/js/shared/Logger.js");

try {
    serialport = require("serialport");
} catch (e) {
    serialport = null; // failover
}

module.exports.FireStepDriver = (function() {
    function reset_serialDriver(that) {
        console.log("TTY\t: FireStepDriver reset_serialDriver()");
        that.model.available = false;
        that.model.initialized = false;
        that.serialQueue = [];
    }

    function send_startup(that, onStartup) {
        that.model.available = true;
        if (that.serialQueue.length > 0) {
            console.log("TTY\t: FireStepDriver send_startup() clearing queue items:", that.serialQueue.length);
            that.serialQueue = [];
        }
        that.serialInProgress = false;
        that.model.initialized = false;
        onStartup();
        that.processQueue();
    }

    function open_serialport(that, onStartup, options) {
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
                that.model.available = false;
                reset_serialDriver(that);
            } else {
                that.model.available = true;
                console.log("TTY\t: FireStepDriver() SerialPort.open(" + that.model.rest.serialPath + ") ready...");
                reset_serialDriver(that);
                send_startup(that, onStartup);
            }
        });
    }

    function open_firestep(that, onStartup, options) {
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
                send_startup(that, onStartup);
            }
            var cmd = 'firestep -d ' + that.model.rest.serialPath + ' -r';
            console.log("TTY\t: FireStepDriver(" + that.model.rest.serialPath + ") " + cmd);
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

    function close_serialport(that) {
        console.log("ERROR\t: close_serialport() not implemented");
    }

    function close_firestep(that) {
        if (that.isAvailable() && that.firestep_proc != null) {
            console.log("INFO\t: shutting down FireStep");
            that.firestep_proc.kill('SIGTERM');
        }
    }

    ////////////////// constructor
    function FireStepDriver(model, options) {
        var that = this;
        should.exist(model);
        options = options || {};
        options.buffersize = options.buffersize || 255;
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // allow EEPROM commands to complete
        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.serialHistory = [];
        that.msLaunchTimeout = options.msLaunchTimeout;
        that.model = model;
        that.name = "FireStepDriver";
        that.handlers = {
            idle: function() {},
            response: function(response) {},
        };

        return that;
    }
    FireStepDriver.prototype.on = function(event, callback) {
        var that = this;
        that.handlers[event] = callback;
        return that;
    }

    FireStepDriver.prototype.open = function(onStartup, options) {
        var that = this;
        if (serialport) {
            open_serialport(that, onStartup, options);
        } else {
            open_firestep(that, onStartup, options);
        }
    }

    FireStepDriver.prototype.close = function(options) {
        var that = this;
        if (serialport) {
            close_serialport(that);
        } else {
            close_firestep(that);
        }
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
    FireStepDriver.prototype.onSerialData = function(data) {
        var that = this;
        that.model.reads++;
        console.log("TTY\t: READ(" + that.model.reads + ") " + data + "\\n");
        if (typeof data !== 'string') {
            throw new Error("expected Javascript string for serial data return");
        }
        if (data.indexOf('{') === 0) { // success
            var response = JSON.parse(data);
            if (!response) {
                throw new Error("could not parse firestep response:" + data);
            }
            that.handlers.response(response);
            if (response.s < 0) {
                console.log("TTY\t: FireStep COMMAND FAILED:" + data);
                console.log("TTY\t: FireStepDriver() COMMAND QUEUE CLEARED " + that.serialQueue.length + " ITEMS");
                that.serialQueue = [];
            }
        }

        if (that.serialInProgress && data[data.length - 1] === ' ') { // FireStep idle is SPACE-LF
            that.serialInProgress = false;
            var request = that.serialHistory.length > 0 ? that.serialHistory[0] : {};
            try {
                request.resp = JSON.parse(data);
            } catch (e) {
                console.log("TTY\t: ERROR(INVALID JSON): " + data, e);
            }
            try {
                request.onDone && request.onDone(request.resp);
            } catch (e) {
                console.log("TTY\t: ERROR(response handler failed):" + data, e);
            }
            that.processQueue();
            if (that.serialQueue.length == 0) {
                that.handlers.idle();
            }
        }

        return that;
    };

    FireStepDriver.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    FireStepDriver.prototype.queueLength = function() {
        var that = this;
        return that.serialQueue.length;
    }
    FireStepDriver.prototype.pushQueue = function(cmd, onDone) {
        var that = this;
        that.serialQueue.push({
            "cmd": cmd,
            "onDone": onDone
        });
    }

    return FireStepDriver;
})();

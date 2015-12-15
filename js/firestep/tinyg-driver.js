var should = require("should");
var MTO_XYZ = require("./mto-xyz").MTO_XYZ;
var fs = require('fs');

// ANTHONY COMMENT THIS OUT
module.exports.TinyG = (function() {
    function TinyG(){
        var that = this;
        // stub
        that.status = {
            stat:0
        };
        return that;
    }
    TinyG.prototype.open = function(path, flag) {
        var that = this;
        // stub
    }
    TinyG.prototype.close = function() {
        var that = this;
        // stub
    }
    TinyG.prototype.write = function(str) {
        var that = this;
        // stub
    }
    TinyG.prototype.on = function(event, callback) {
        var that = this;
        // stub
    }
    return TinyG;
})();
var TinyG = module.exports.TinyG;
// ANTHONY COMMENT THIS OUT

// AND MAKE THIS LOOK LIKE YOURS
//var TinyG = ANTHONY_require("tinyg");;

var util = require('util');

var devName = '/dev/ttyUSB0';
var driverName = "TinyG-XYZ";

function mockAsync(callback) {
    callback();
}

module.exports.TinyGDriver = (function() {
    var closeTimeout = null;
    function resetClose(that) {
        clearTimeout(closeTimeout);
        closeTimeout = setTimeout(function() {
            console.log('#### close');
            tinyg.close();
        }, 1000);
    }

    var mockXYZ = function(that) {
        var xyz = that.mto.calcXYZ({
            p1: that.mockPosition["1"],
            p2: that.mockPosition["2"],
            p3: that.mockPosition["3"],
        });
        return JSON.parse(JSON.stringify(xyz));
    }
    var mockSerial = function(that, cmd) { // CANNOT BLOCK!!!
        that.model.writes = that.model.writes ? that.model.writes + 1 : 1;
        var serialData = JSON.stringify(cmd);
        console.log("TTY\t: WRITE(" + that.model.writes + ") " + serialData + "\\n");

        // SEND SERIAL DATA HERE

        mockAsync(function() { // MOCK ASYNC SERIAL RETURN
            // MOCKS EXPECTED RESPONSES TO firenodejs
            if (cmd.hasOwnProperty("id")) { // identify machine
                that.mockResponse(0, {
                    "app": that.name,
                    "ver": 1.0
                });
            } else if (cmd.hasOwnProperty("hom")) { // home
                that.mockPosition = {
                    "1": 0,
                    "2": 0,
                    "3": 0
                };
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("movxr")) { // x-relative move
                var xyz = mockXYZ(that);
                xyz.x += cmd.movxr;
                var pulses = that.mto.calcPulses(xyz);
                that.mockPosition = {
                    "1": pulses.p1,
                    "2": pulses.p2,
                    "3": pulses.p3,
                }
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("movyr")) { // y-relative move
                var xyz = mockXYZ(that);
                xyz.y += cmd.movyr;
                var pulses = that.mto.calcPulses(xyz);
                that.mockPosition = {
                    "1": pulses.p1,
                    "2": pulses.p2,
                    "3": pulses.p3,
                }
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("movzr")) { // z-relative move
                var xyz = mockXYZ(that);
                xyz.z += cmd.movzr;
                var pulses = that.mto.calcPulses(xyz);
                that.mockPosition = {
                    "1": pulses.p1,
                    "2": pulses.p2,
                    "3": pulses.p3,
                }
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("mov")) { // absolute move
                var xyz = mockXYZ(that);
                if (cmd.mov.hasOwnProperty("x")) {
                    xyz.x = cmd.mov.x;
                }
                if (cmd.mov.hasOwnProperty("y")) {
                    xyz.y = cmd.mov.y;
                }
                if (cmd.mov.hasOwnProperty("z")) {
                    xyz.z = cmd.mov.z;
                }
                if (cmd.mov.hasOwnProperty("xr")) {
                    xyz.x += cmd.mov.xr;
                }
                if (cmd.mov.hasOwnProperty("yr")) {
                    xyz.y += cmd.mov.yr;
                }
                if (cmd.mov.hasOwnProperty("zr")) {
                    xyz.z += cmd.mov.zr;
                }
                var pulses = that.mto.calcPulses(xyz);
                that.mockPosition = {
                    "1": pulses.p1,
                    "2": pulses.p2,
                    "3": pulses.p3,
                }
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("dvs")) { // delta velocity stroke
                var dp = cmd.dvs.dp;
                // a delta velocity stroke just increments the pulses by dp
                // now that may be a long traverse!!!
                that.mockPosition["1"] += dp[0];
                that.mockPosition["2"] += dp[1];
                that.mockPosition["3"] += dp[2];
                var dvs = JSON.parse(JSON.stringify(cmd.dvs));
                var plannedTraversalSeconds = dvs.us / 1000000;
                dvs["1"] = dp[0];
                dvs["2"] = dp[1];
                dvs["3"] = dp[2];
                that.mockResponse(0, {
                    dvs: dvs
                }, plannedTraversalSeconds);
            } else if (cmd.hasOwnProperty("mpo")) { // machine position
                var mpo = JSON.parse(JSON.stringify(that.mockPosition));
                var xyz = mockXYZ(that);
                mpo.x = xyz.x;
                mpo.y = xyz.y;
                mpo.z = xyz.z;
                that.mockResponse(0, {
                    mpo: mpo
                }); // 
            } else if (cmd.hasOwnProperty("dim")) { // machine dimensions
                that.mockResponse(0, {
                    dim: that.mto.getModel().dim
                });
            } else if (cmd.hasOwnProperty("sys")) { // system information
                that.mockResponse(0, {
                    sys: that.mto.getModel().sys
                });
            } else {
                that.mockResponse(-402, cmd); // unknown command
            }
        }); // mock async

    }

    ////////////////// constructor
    function TinyGDriver(model, options) {
        var that = this;
        should.exist(model);
        options = options || {};

        // firenodejs option defaults
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // board startup time

        that.mto = options.mto || new MTO_XYZ();
        that.name = driverName;
        that.tinyg = new TinyG();
        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.serialHistory = [];
        that.msLaunchTimeout = options.msLaunchTimeout;
        that.model = model;
        that.mockPosition = {
            p1: 0,
            p2: 0,
            p3: 0
        };
        that.handlers = {
            idle: function() {
                //    console.log("TTY\t: idle");
            },
            response: function(response) {
                //   console.log("TTY\t: response(" + JSON.stringify(response) + ")");
            },
        };

        return that;
    }
    TinyGDriver.prototype.mockResponse = function(status, data, seconds) {
        var that = this;
        var response = {
            s: status, // https://github.com/firepick1/FireStep/blob/master/FireStep/Status.h
            r: data, // JSON query by example patterned after on request 
            t: seconds || 0.001 // time in seconds
        };
        var data = JSON.stringify(response);
        that.onSerialData(data);
    }
    TinyGDriver.prototype.on = function(event, callback) {
        var that = this;
        event.should.exist;
        callback.should.be.Function;
        that.handlers[event] = callback;
        return that;
    }
    TinyGDriver.prototype.open = function(onStartup, options) {
        var that = this;
        var tinyg = that.tinyg;
        onStartup = onStartup || function(err) {};

        tinyg.open(that.model.rest.serialPath, false);
        tinyg.on('open', function() {
            resetClose();
            tinyg.write('{"test":1}\n');
            tinyg.write('{"gc":"g21"}\n'); // use millimeters
            tinyg.write('{"xvm":800}\n'); // max 800 mm travel speed
            tinyg.write('{"gc":"g0x100"}\n');
            tinyg.write('{"gc":"g0x0"}\n');

            onStartup(); // notify firenodejs 

            //tinyg.write('{"gc":"m2"}\n');
            //console.log('#### open');
            //console.log('sys/ex: ' + util.inspect(tinyg.ex));
        });
        tinyg.on('data', function(data) {
            console.log('#### data received: ' + data);
            resetClose();
        });
        var starting = true;
        tinyg.on('stateChanged', function(changed) {
            console.log("State changed: " + util.inspect(changed));
            if (tinyg.status.stat == 4) {
                if (starting) {
                    starting = false;
                    return;
                }
                tinyg.write('{"md":1}\n');
                console.log("##DONE");
                clearTimeout(closeTimeout);
                tinyg.close();
            } else {
                console.log("stat: ", tinyg.status.stat);
                resetClose();
            }
        });
        tinyg.on('configChanged', function(changed) {
            console.log("Config changed: " + util.inspect(changed));
        });

        console.log("TTY\t: opened serial connection to:" + that.model.rest.serialPath);

        // MAKE IT WORK OR THROW
        that.model.driver = that.name;
        if (that.model.rest.serialPath === "NOTFOUND") { // mock not found
            that.model.available = false;
            onStartup(new Error("serialPath not found:" + that.model.rest.serialPath));
        } else { // mock found
            that.model.available = true;
            that.model.reads = 0;
            that.model.writes = 0;
            onStartup();
            that.processQueue();
        }
        return that;
    }
    TinyGDriver.prototype.close = function(options) {
        var that = this;
        // MAKE IT WORK OR THROW
        that.model.available = false;
        return that;
    }

    TinyGDriver.prototype.processQueue = function() {
        var that = this;

        if (that.serialQueue.length <= 0) {
            //        console.log("TTY\t: TinyGDriver.processQueue(empty) ");
        } else if (!that.model.available) {
            console.log("TTY\t: TinyGDriver.processQueue(unavailable) ", that.serialQueue.length,
                " items");
        } else if (that.serialInProgress) {
            //       console.log("TTY\t: TinyGDriver.processQueue(busy) ", that.serialQueue.length, " items");
        } else {
            that.serialInProgress = true;
            that.request = that.serialQueue.shift();
            that.serialHistory.splice(0, 0, that.request);
            that.serialHistory.splice(that.maxHistory);
            mockSerial(that, that.request.cmd);
        }
    };
    TinyGDriver.prototype.onSerialData = function(data) {
        var that = this;
        that.model.reads = that.model.reads ? that.model.reads + 1 : 1;
        console.log("TTY\t: READ(" + that.model.reads + ") " + data + "\\n");
        that.request.response = JSON.parse(data);
        that.handlers.response(that.request.response);
        that.serialInProgress = false;
        that.request.onDone && that.request.onDone(that.request.response);
        that.processQueue();
        if (that.serialQueue.length == 0) {
            that.handlers.idle();
        }
        return that;
    };
    TinyGDriver.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    TinyGDriver.prototype.queueLength = function() {
        var that = this;
        return that.serialQueue.length;
    }
    TinyGDriver.prototype.pushQueue = function(cmd, onDone) {
        var that = this;
        that.serialQueue.push({
            "cmd": cmd,
            "onDone": onDone
        });
        that.processQueue();
        return that;
    }

    return TinyGDriver;
})();

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("TinyGDriver", function() {
    var options = {
        baudrate: 19200
    };

    function mockModel(path) {
        return {
            rest: {
                serialPath: path
            }
        };
    }
    it("TinyGDriver should open()/close()", function() {
        var model = mockModel(devName);
        var driver = new exports.TinyGDriver(model, options);
        var testStartup = false;
        var onStartup = function(err) {
            testStartup = err;
        }
        driver.open(onStartup);
        mockAsync(function() {
            should(testStartup == null).be.true; // success
            driver.model.should.equal(model);
            should.deepEqual(driver.model, {
                driver: driverName,
                available: true, // serial connection established
                rest: {
                    serialPath: devName
                },
                reads: 0,
                writes: 0,
            });
            driver.history.length.should.equal(0);
            driver.queueLength().should.equal(0);
        });

        driver.close();
        should.deepEqual(driver.model, {
            driver: driverName,
            available: false,
            rest: {
                serialPath: devName
            },
            reads: 0,
            writes: 0,
        });

        model.rest.serialPath = "NOTFOUND";
        driver.open(onStartup);
        mockAsync(function() {
            should(testStartup == null).be.false; // failure
            should(testStartup instanceof Error).be.true; // failure
            driver.model.should.equal(model);
            should.deepEqual(driver.model, { // mock async
                driver: driverName,
                available: false, // serial connection failed
                rest: {
                    serialPath: "NOTFOUND"
                },
                reads: 0,
                writes: 0,
            });
        }); // mock async
    })
    it('TinyGDriver should handle "response" event', function() {
        var model = mockModel(devName);
        var driver = new exports.TinyGDriver(model);
        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({
            id: ""
        });
        mockAsync(function() {
            model.available.should.be.true;
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    app: driverName,
                    "ver": 1
                },
                t: 0.001
            });
        });
    })
    it('TinyGDriver should handle "idle" event', function() {
        var model = mockModel(devName);
        var driver = new exports.TinyGDriver(model);
        var testidle = 0;
        driver.on("idle", function() {
            testidle++;
        });
        testidle.should.equal(0);
        driver.open();
        driver.pushQueue({
            id: ""
        });
        mockAsync(function() {
            testidle.should.equal(1);
            model.writes.should.equal(1);
            model.reads.should.equal(1);
        }); // mock async
    })
    it('TinyGDriver should handle {"id":""}', function() {
        var model = mockModel(devName);
        var driver = new exports.TinyGDriver(model);
        driver.open();
        var testid;
        driver.pushQueue({
            id: ""
        }, function(response) {
            testid = response;
        });
        mockAsync(function() {
            should.deepEqual(testid, {
                s: 0,
                r: {
                    app: driverName,
                    "ver": 1
                },
                t: 0.001
            });
        }); // mock async
    })
})

var should = require("should");
var MTO_XYZ = require("../../www/js/shared/MTO_XYZ");
var fs = require('fs');
var util = require('util');
var TinyG = require("tinyg");

var devName = process.env.TINYG_SERIAL || "/dev/ttyUSB0"
var driverName = "TinyG-XYZ";

function mockAsync(callback) {
    callback();
}

(function(exports) {

    var mockSerial = function(that, cmd) { // CANNOT BLOCK!!!
        that.model.writes = that.model.writes ? that.model.writes + 1 : 1;
        var serialData = JSON.stringify(cmd);
        console.log("TTY \t: WRITE(" + that.model.writes + ") " + serialData + "\\n");

        // SEND SERIAL DATA HERE
        if (cmd.hasOwnProperty("id")) { // identify machine
            that.mockResponse(0, {
                "app": that.name,
                "ver": 1.0
            });
        } else if (cmd.hasOwnProperty("hom")) { // home
            // TODO, do this once you have some homing switches that.tinyg.write('{"gc":"g28.2x0y0z0"}'); // 28.2 is to move to the endstops, 28.3 sets whereever you are at as your home
            that.tinyg.write('{"gc":"g28.3x0y0z0"}');

        } else if (cmd.hasOwnProperty("mov")) { // absolute move
            // send the tinyg to this XYZ
            var tmpCommand = "g0"
            if (cmd.mov.hasOwnProperty("x")) {
                tmpCommand += "x" + cmd.mov.x
            }
            if (cmd.mov.hasOwnProperty("y")) {
                tmpCommand += "y" + cmd.mov.y
            }
            if (cmd.mov.hasOwnProperty("z")) {
                tmpCommand += "z" + cmd.mov.z
            }
            if (cmd.mov.hasOwnProperty("xr")) {
                throw new Error("planner error");
            }
            if (cmd.mov.hasOwnProperty("yr")) {
                throw new Error("planner error");
            }
            if (cmd.mov.hasOwnProperty("zr")) {
                throw new Error("planner error");
            }

            if (tmpCommand != "g0") {
                that.machineIsMoving = true; // any time a machine movement is called, we need to wait for a SR to tell us it is done
                that.tinyg.write('{"gc":"' + tmpCommand + '"}');
            }

        } else if (cmd.hasOwnProperty("movxr")) { // x-relative move
            throw new Error("planner error");

        } else if (cmd.hasOwnProperty("movyr")) { // y-relative move
            throw new Error("planner error");

        } else if (cmd.hasOwnProperty("movzr")) { // z-relative move
            throw new Error("planner error");

        } else if (cmd.hasOwnProperty("mpo")) { // machine position
            that.tinyg.write('{"mpo":n}\n');


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


    }

    ////////////////// constructor
    function TinyGDriver(model, options) {
        var that = this;
        should.exist(model);
        options = options || {};

        // firenodejs option defaults
        options.baudrate = options.baudrate || 115200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // board startup time

        that.mto = options.mto || new MTO_XYZ();
        that.name = driverName;
        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.machineIsMoving = false;
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
                //    console.log("TTY \t: idle");
            },
            response: function(response) {
                //   console.log("TTY \t: response(" + JSON.stringify(response) + ")");
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
        should.exist(event);
        callback.should.be.Function;
        that.handlers[event] = callback;
        return that;
    }
    TinyGDriver.prototype.open = function(onStartup, options) {
        var that = this;
        that.tinyg = new TinyG();
        var tinyg = that.tinyg;
        onStartup = onStartup || function(err) {};
        if (that.model.available) {
            that.close();
        }

        tinyg.open(that.model.rest.serialPath, false);

        tinyg.on('open', function() {
            tinyg.write('{"sys":""}\n'); // Pull some of the default config from the tinyg
        });

        tinyg.on('data', function(data) {
            console.log('#### data received: ' + data);
            var parsed = JSON.parse(data);
            // dont forward status reports (the ones with an "sr" property) through, kind of just eat them for now
            if (parsed.hasOwnProperty("r") && that.request) {
                that.onSerialData(data);
            } else if (parsed.hasOwnProperty("sr")) {
                if (parsed.sr.stat == 5) {
                    // machine is moving, I should not processQueue() until it is complete
                    that.machineIsMoving = true;

                } else {
                    // now that the machine is done moving we can continue processing by calling processQueue()
                    that.machineIsMoving = false;
                    that.processQueue();
                }
            }

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

            } else {
                console.log("stat: ", tinyg.status.stat);

            }
        });

        tinyg.on('configChanged', function(changed) {
            console.log("Config changed: " + util.inspect(changed));
        });

        console.log("TTY \t: tinyg-driver: opened serial connection to:" + that.model.rest.serialPath);

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
        console.log('Closing this connection');
        that.tinyg.close();
        return that;
    }
    TinyGDriver.prototype.processQueue = function() {
        var that = this;

        if (that.serialQueue.length <= 0) {
            //console.log("TTY \t: TinyGDriver.processQueue(empty) ");
        } else if (!that.model.available) {
            //console.log("TTY \t: TinyGDriver.processQueue(unavailable) ", that.serialQueue.length, " items");
            //console.log(that.serialQueue);
        } else if (that.serialInProgress) {
            //console.log("TTY \t: TinyGDriver.processQueue(busy) ", that.serialQueue.length, " items");
            //console.log(that.serialQueue);
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
        console.log("TTY \t: READ(" + that.model.reads + ") " + data + "\\n");
        var parsed = JSON.parse(data);
        var retData = parsed;

        // mpo need back a specific format
        if (parsed.r && parsed.r.mpo) {
            console.log('found an mpo');
            var tmpXYZ = {};
            tmpXYZ.x = parsed.r.mpo.x;
            tmpXYZ.y = parsed.r.mpo.y;
            tmpXYZ.z = parsed.r.mpo.z;

            var p = that.mto.calcPulses(tmpXYZ);
            console.log(p);
            tmpXYZ["1"] = p.p1;
            tmpXYZ["2"] = p.p2;
            tmpXYZ["3"] = p.p3;

            var temp = {
                s: 0, // https://github.com/firepick1/FireStep/blob/master/FireStep/Status.h
                r: {
                    mpo: tmpXYZ
                }, // JSON query by example patterned after on request 
                t: 0.001 // time in seconds
            };

            retData = temp;
        }

        that.request.response = retData;
        that.handlers.response(that.request.response);
        that.serialInProgress = false;
        that.request.onDone && that.request.onDone(that.request.response);

        if (that.machineIsMoving == false) {
            // maching not moving, OK to move along
            that.processQueue();
        }

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

    module.exports = exports.TinyGDriver = TinyGDriver;
})(typeof exports === "object" ? exports : (exports = {}));

///////////////////////////////////////////////////////////////////////////
// MOCHA TESTS (run from firenodejs root directory)
// mocha -R min --inline-diffs js/firestep/tinyg-driver.js -t 1500
///////////////////////////////////////////////////////////////////////////
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

    it('TinyG should handle {"mov":""}', function(done) {
        var onIdle = function() {};
        var model = mockModel(devName);
        var driver = new exports.TinyGDriver(model, options);

        var testStartup = false;
        var onStartup = function(err) {
            testStartup = err;
        }

        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open(onStartup);

        // wait 3 seconds for everything to be totally open
        setTimeout(function() {
            driver.pushQueue({
                hom: ""
            });
            console.log('moving the machine');
            driver.pushQueue({
                mov: {
                    x: -3,
                    y: -2,
                    z: 3.485
                }
            });

            // wait for the machine to move
            setTimeout(function() {
                driver.pushQueue({
                    mpo: ""
                });

                // wait while the currecnt machine position comes back from tinyg
                setTimeout(function() {
                    should.deepEqual(testresponse, {
                        s: 0,
                        r: {
                            mpo: {
                                "1": -300,
                                "2": -200,
                                "3": 349,
                                x: -3,
                                y: -2,
                                z: 3.485 // note that typcially actual position is NOT same as requested, but for tinyg somehow it is
                            }
                        },
                        t: 0.001
                    });
                    model.reads.should.equal(3);
                    model.writes.should.equal(3);
                    driver.close();
                    done();
                }, 3000)

            }, 3000)

        }, 3000)

    })

    /***
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
	***/
})

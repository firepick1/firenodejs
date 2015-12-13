var should = require("should");
var math = require("mathjs");
var DeltaCalculator = require("../../www/js/shared/DeltaCalculator.js");

function mockAsync(callback) {
    callback();
}

module.exports.MockFPD = (function() {
    var write = function(that, cmd) { // CANNOT BLOCK!!!
        that.model.writes = that.model.writes ? that.model.writes + 1 : 1;
        var serialData = JSON.stringify(cmd);
        console.log("TTY\t: WRITE(" + that.model.writes + ") " + serialData + "\\n");

        // SEND SERIAL DATA HERE

        mockAsync(function() { // MOCK ASYNC SERIAL RETURN
            // MOCKS EXPECTED RESPONSES TO firenodejs
            if (cmd.hasOwnProperty("id")) { // identify machine
                that.mockResponse(0, {
                    "app": "mock-fpd",
                    "ver": 1.0
                });
            } else if (cmd.hasOwnProperty("hom")) { // home
                that.mockPosition = {
                    "1": 0,
                    "2": 0,
                    "3": 0
                };
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("mov")) { // absolute move
                var delta = DeltaCalculator.createLooseCanonRAMPS();
                var pulses = delta.calcPulses(cmd.mov);
                that.mockPosition = {
                    "1": pulses.p1,
                    "2": pulses.p2,
                    "3": pulses.p3,
                }
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("mpo")) { // machine position
                var mpo = JSON.parse(JSON.stringify(that.mockPosition));
                var delta = DeltaCalculator.createLooseCanonRAMPS();
                var xyz = delta.calcXYZ({
                    p1:mpo["1"],
                    p2:mpo["2"],
                    p3:mpo["3"],
                });
                mpo.x = math.round(xyz.x,3);
                mpo.y = math.round(xyz.y,3);
                mpo.z = math.round(xyz.z,3);
                that.mockResponse(0, {
                    mpo: mpo
                }); // 
            } else if (cmd.hasOwnProperty("dim")) { // machine dimensions
                that.mockResponse(0, cmd); // reserved for future use
            } else if (cmd.hasOwnProperty("sys")) { // system information
                that.mockResponse(0, {
                    sys: {
                        to: 2
                    }
                }); // MTO_XYZ cartesian
            } else {
                that.mockResponse(-402, cmd); // unknown command
            }
        }); // mock async

    }

    ////////////////// constructor
    function MockFPD(model, options) {
        var that = this;
        should.exist(model);
        options = options || {};

        // firenodejs option defaults
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // board startup time

        var microsteps = 16;
        var revolution = 200;
        var teeth = 16;
        that.travel = options.travel || {
            x: teeth * 2 / (microsteps * revolution),
            y: teeth * 2 / (microsteps * revolution),
            z: teeth * 2 / (microsteps * revolution),
        };
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
    MockFPD.prototype.mockResponse = function(status, data) {
        var that = this;
        var response = {
            s: status, // https://github.com/firepick1/FireStep/blob/master/FireStep/Status.h
            r: data, // JSON query by example patterned after on request 
            t: 0.001 // time in seconds
        };
        var data = JSON.stringify(response);
        that.onSerialData(data);
    }
    MockFPD.prototype.on = function(event, callback) {
        var that = this;
        event.should.exist;
        callback.should.be.Function;
        that.handlers[event] = callback;
        return that;
    }
    MockFPD.prototype.open = function(onStartup, options) {
        var that = this;
        onStartup = onStartup || function(err) {};
        console.log("TTY\t: opened serial connection to:" + that.model.rest.serialPath);
        // MAKE IT WORK OR THROW
        that.model.driver = "mock-fpd";
        if (that.model.rest.serialPath === "NOTFOUND") { // mock not found
            that.model.available = false;
            onStartup(new Error("serialPath not found:" + that.model.rest.serialPath));
        } else { // mock found
            that.model.available = true;
            onStartup();
            that.processQueue();
        }
        return that;
    }
    MockFPD.prototype.close = function(options) {
        var that = this;
        // MAKE IT WORK OR THROW
        that.model.available = false;
        return that;
    }

    MockFPD.prototype.processQueue = function() {
        var that = this;

        if (that.serialQueue.length <= 0) {
            //        console.log("TTY\t: MockFPD.processQueue(empty) ");
        } else if (!that.model.available) {
            console.log("TTY\t: MockFPD.processQueue(unavailable) ", that.serialQueue.length,
                " items");
        } else if (that.serialInProgress) {
            //       console.log("TTY\t: MockFPD.processQueue(busy) ", that.serialQueue.length, " items");
        } else {
            that.serialInProgress = true;
            that.request = that.serialQueue.shift();
            that.serialHistory.splice(0, 0, that.request);
            that.serialHistory.splice(that.maxHistory);
            write(that, that.request.cmd);
        }
    };
    MockFPD.prototype.onSerialData = function(data) {
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
    MockFPD.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    MockFPD.prototype.queueLength = function() {
        var that = this;
        return that.serialQueue.length;
    }
    MockFPD.prototype.pushQueue = function(cmd, onDone) {
        var that = this;
        that.serialQueue.push({
            "cmd": cmd,
            "onDone": onDone
        });
        that.processQueue();
        return that;
    }

    return MockFPD;
})();

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockFPD", function() {
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
    var onResponse = function(response) {};
    var onIdle = function() {};
    var LATER = 100; // mock async
    it("MockFPD should open()/close()", function() {
        var model = mockModel("/dev/ttyACM0");
        var driver = new exports.MockFPD(model, options);
        var testStartup = false;
        var onStartup = function(err) {
            testStartup = err;
        }
        driver.open(onStartup);
        mockAsync(function() {
            should(testStartup == null).be.true; // success
            driver.model.should.equal(model);
            should.deepEqual(driver.model, {
                driver: "mock-fpd",
                available: true, // serial connection established
                rest: {
                    serialPath: "/dev/ttyACM0"
                }
            });
            driver.history.length.should.equal(0);
            driver.queueLength().should.equal(0);
        });

        driver.close();
        should.deepEqual(driver.model, {
            driver: "mock-fpd",
            available: false,
            rest: {
                serialPath: "/dev/ttyACM0"
            }
        });

        model.rest.serialPath = "NOTFOUND";
        driver.open(onStartup);
        mockAsync(function() {
            should(testStartup == null).be.false; // failure
            should(testStartup instanceof Error).be.true; // failure
            driver.model.should.equal(model);
            should.deepEqual(driver.model, { // mock async
                driver: "mock-fpd",
                available: false, // serial connection failed
                rest: {
                    serialPath: "NOTFOUND"
                }
            }); 
        }); // mock async
    })
    it('MockFPD should handle "response" event', function() {
        var model = mockModel("/dev/ttyACM0");
        var driver = new exports.MockFPD(model);
        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({
            id: ""
        });
        mockAsync(function(){
            model.available.should.be.true;
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    app: "mock-fpd",
                    "ver": 1
                },
                t: 0.001
            });
        });
    })
    it('MockFPD should handle "idle" event', function() {
        var model = mockModel("/dev/ttyACM0");
        var driver = new exports.MockFPD(model);
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
    it('MockFPD should handle {"id":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new exports.MockFPD(model);
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
                    app: "mock-fpd",
                    "ver": 1
                },
                t: 0.001
            });
        }); // mock async
    })
    it('MockFPD should handle {"hom":""} and {"mpo":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new exports.MockFPD(model);
        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({
            hom: ""
        });
        driver.pushQueue({
            mpo: ""
        });
        mockAsync(function() { 
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    mpo: {
                        "1": 0,
                        "2": 0,
                        "3": 0,
                        x: 0,
                        y: 0,
                        z: 0
                    }
                },
                t: 0.001
            });
        }); // mock async
    })
    it('TESTTESTMockFPD should handle {"mov":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new exports.MockFPD(model);
        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({
            hom: ""
        });
        driver.pushQueue({
            mov: {
                x: 1,
                y: 2,
                z: 3.485
            }
        });
        driver.pushQueue({
            mpo: ""
        });
        mockAsync(function() { // 
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    mpo: {
                        "1": -141,
                        "2": -232,
                        "3": -191,
                        x: 1.006,
                        y: 1.997,
                        z: 3.486, 
                    }
                },
                t: 0.001
            });
            model.reads.should.equal(3);
            model.writes.should.equal(3);
        }); // mock async
    })
})

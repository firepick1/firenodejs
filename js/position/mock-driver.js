var should = require("should");
var MTO_XYZ = require("../../www/js/shared/MTO_XYZ");
var JsonUtil = require("../../www/js/shared/JsonUtil");

function mockAsync(callback) {
    callback();
}

(function(exports) {
    var mockXYZ = function(that) {
        var xyz = that.mto.calcXYZ({
            p1: that.mockPosition["1"] || 0,
            p2: that.mockPosition["2"] || 0,
            p3: that.mockPosition["3"] || 0,
            p4: that.mockPosition["4"] || 0,
        });
        return JSON.parse(JSON.stringify(xyz));
    }
    var mockSerial = function(that, cmd) { // CANNOT BLOCK!!!
        that.model.writes = that.model.writes ? that.model.writes + 1 : 1;
        var serialData = JSON.stringify(cmd);
        console.log("TTY \t: WRITE(" + that.model.writes + ") " + serialData + "\\n");

        // SEND SERIAL DATA HERE

        mockAsync(function() { // MOCK ASYNC SERIAL RETURN
            // MOCKS EXPECTED RESPONSES TO firenodejs
            if (cmd.hasOwnProperty("id")) { // identify machine
                that.mockResponse(0, {
                    "app": that.name,
                    "ver": 1.0
                });
            } else if (cmd.hasOwnProperty("homx")) { // home axis
                that.mockPosition = {
                    "1": that.mockPosition["1"] || 0,
                    "2": that.mockPosition["2"] || 0,
                    "3": that.mockPosition["3"] || 0,
                    "4": that.mockPosition["4"] || 0,
                };
                that.mockPosition["1"] = 0;
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("homy")) { // home axis
                that.mockPosition = {
                    "1": that.mockPosition["1"] || 0,
                    "2": that.mockPosition["2"] || 0,
                    "3": that.mockPosition["3"] || 0,
                    "4": that.mockPosition["4"] || 0,
                };
                that.mockPosition["2"] = 0;
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("homz")) { // home axis
                that.mockPosition = {
                    "1": that.mockPosition["1"] || 0,
                    "2": that.mockPosition["2"] || 0,
                    "3": that.mockPosition["3"] || 0,
                    "4": that.mockPosition["4"] || 0,
                };
                that.mockPosition["3"] = 0;
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("hom")) { // home
                cmd.hom.x != null && (that.mockPosition["1"] = 0);
                cmd.hom.y != null && (that.mockPosition["2"] = 0);
                cmd.hom.z != null && (that.mockPosition["3"] = 0);
                cmd.hom.a != null && (that.mockPosition["4"] = 0);
                that.mockResponse(0, cmd);
            } else if (cmd.hasOwnProperty("x")) {
                var model = that.mto.getModel();
                var axis = model.x = model.x || {};
                JsonUtil.applyJson(axis, cmd.x);
                that.mockResponse(0, {
                    x: axis
                });
            } else if (cmd.hasOwnProperty("y")) {
                var model = that.mto.getModel();
                var axis = model.y = model.y || {};
                JsonUtil.applyJson(sys, cmd.y);
                that.mockResponse(0, {
                    y: axis
                });
            } else if (cmd.hasOwnProperty("z")) {
                var model = that.mto.getModel();
                var axis = model.z = model.z || {};
                JsonUtil.applyJson(sys, cmd.z);
                that.mockResponse(0, {
                    z: axis
                });
            } else if (cmd.hasOwnProperty("a")) {
                var model = that.mto.getModel();
                var axis = model.a = model.a || {};
                JsonUtil.applyJson(sys, cmd.a);
                that.mockResponse(0, {
                    a: axis
                });
            } else if (cmd.hasOwnProperty("movxr")) { // x-relative move
                throw new Error("planner error");
            } else if (cmd.hasOwnProperty("movyr")) { // y-relative move
                throw new Error("planner error");
            } else if (cmd.hasOwnProperty("movzr")) { // z-relative move
                throw new Error("planner error");
            } else if (cmd.hasOwnProperty("movar")) { // a-relative move
                throw new Error("planner error");
            } else if (cmd.hasOwnProperty("mov")) { // absolute move
                var mov = cmd.mov;
                if (mov.xr != null || mov.yr != null || mov.zr != null) {
                    throw new Error("not supported");
                }
                if (mov.x != null || mov.y != null || mov.z != null || mov.a != null) {
                    var xyz = mockXYZ(that);
                    mov.x != null && (xyz.x = mov.x);
                    mov.y != null && (xyz.y = mov.y);
                    mov.z != null && (xyz.z = mov.z);
                    mov.a != null && (xyz.a = mov.a);
                    var pulses = that.mto.calcPulses(xyz);
                    that.mockPosition = {
                        "1": pulses.p1,
                        "2": pulses.p2,
                        "3": pulses.p3,
                        "4": pulses.p4,
                    }
                }
                if (mov["1"] != null || mov["2"] != null || mov["3"] != null || mov["4"] != null) {
                    mov["1"] != null && (that.mockPosition["1"] = mov["1"]);
                    mov["2"] != null && (that.mockPosition["2"] = mov["2"]);
                    mov["3"] != null && (that.mockPosition["3"] = mov["3"]);
                    mov["4"] != null && (that.mockPosition["4"] = mov["4"]);
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
                mpo["1"] = mpo["1"] || 0;
                mpo["2"] = mpo["2"] || 0;
                mpo["3"] = mpo["3"] || 0;
                mpo["4"] = mpo["4"] || 0;
                var xyz = mockXYZ(that);
                mpo.x = xyz.x;
                mpo.y = xyz.y;
                mpo.z = xyz.z;
                mpo.a = xyz.a;
                that.mockResponse(0, {
                    mpo: mpo
                }); // 
            } else if (cmd.hasOwnProperty("dim")) { // machine dimensions
                that.mockResponse(0, {
                    dim: that.mto.getModel().dim
                });
            } else if (cmd.hasOwnProperty("sys")) { // system information
                var sys = that.mto.getModel().sys;
                JsonUtil.applyJson(sys, cmd.sys);
                that.mockResponse(0, {
                    sys: sys
                });
            } else if (cmd.hasOwnProperty("cmt")) { // comment
                that.mockResponse(0, cmd); // comment
            } else if (cmd.hasOwnProperty("dpyds")) { // comment
                that.mockResponse(0, cmd); // comment
            } else {
                that.mockResponse(-431, cmd); // command not mocked
            }
        }); // mock async

    }

    ////////////////// constructor
    function MockDriver(model, mto, options) {
        var that = this;
        should.exist(model);
        options = options || {};

        // firenodejs option defaults
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // board startup time

        that.mto = mto || new MTO_XYZ(options);
        that.verbose = options.verbose;
        that.name = "mock-" + that.mto.model.type;
        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.serialHistory = [];
        that.msLaunchTimeout = options.msLaunchTimeout;
        that.model = model;
        that.mockPosition = {
            p1: 0,
            p2: 0,
            p3: 0,
            p4: 0,
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
    MockDriver.prototype.mockResponse = function(status, data, seconds) {
        var that = this;
        var response = {
            s: status, // https://github.com/firepick1/FireStep/blob/master/FireStep/Status.h
            r: data, // JSON query by example patterned after on request 
            t: seconds || 0.001 // time in seconds
        };
        var data = JSON.stringify(response);
        that.onSerialData(data);
    }
    MockDriver.prototype.on = function(event, callback) {
        var that = this;
        should.exist(event);
        callback.should.be.Function;
        that.handlers[event] = callback;
        return that;
    }
    MockDriver.prototype.open = function(onStartup, options) {
        var that = this;
        onStartup = onStartup || function(err) {};
        console.log("TTY \t: MockDriver: opened simulated serial connection to:" + that.model.rest.serialPath);
        // MAKE IT WORK OR THROW
        that.model.driver = that.name;
        if (that.model.rest.serialPath === "/dev/ttyACM0") { // mock not found
            that.model.available = true;
            that.model.reads = 0;
            that.model.writes = 0;
            onStartup();
            that.processQueue();
        } else { // not found
            that.model.available = false;
            console.log("WARN\t: MockDriver no device found at serialPath:", that.model.rest.serialPath);
            onStartup(new Error("FireStep no device found at serialPath:" + that.model.rest.serialPath));
        }
        return that;
    }
    MockDriver.prototype.close = function(options) {
        var that = this;
        // MAKE IT WORK OR THROW
        that.model.available = false;
        return that;
    }

    MockDriver.prototype.processQueue = function() {
        var that = this;

        if (that.serialQueue.length <= 0) {
            //        console.log("TTY \t: MockDriver.processQueue(empty) ");
        } else if (!that.model.available) {
            console.log("TTY \t: MockDriver.processQueue(available:"+that.model.available+") ", that.serialQueue.length,
                " items");
        } else if (that.serialInProgress) {
            //       console.log("TTY \t: MockDriver.processQueue(busy) ", that.serialQueue.length, " items");
        } else {
            that.serialInProgress = true;
            that.request = that.serialQueue.shift();
            that.serialHistory.splice(0, 0, that.request); // most recent first
            that.serialHistory.splice(that.maxHistory);
            mockSerial(that, that.request.cmd);
        }
    };
    MockDriver.prototype.onSerialData = function(data) {
        var that = this;
        that.model.reads = that.model.reads ? that.model.reads + 1 : 1;
        console.log("TTY \t: READ(" + that.model.reads + ") " + data + "\\n");
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
    MockDriver.prototype.history = function() {
        var that = this;
        return that.serialHistory;
    }
    MockDriver.prototype.queueLength = function() {
        var that = this;
        return that.serialQueue.length;
    }
    MockDriver.prototype.pushQueue = function(cmd, onDone) {
        var that = this;
        that.serialQueue.push({
            "cmd": cmd,
            "onDone": onDone
        });
        return that;
    }

    module.exports = exports.MockDriver = MockDriver;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockDriver", function() {
    var MTO_C4 = require("../../www/js/shared/MTO_C4");
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
    it("MockDriver should open()/close()", function() {
        var model = mockModel("/dev/ttyACM0");
        var mto = new MTO_XYZ();
        var driver = new exports.MockDriver(model, mto, options);
        var testStartup = false;
        var onStartup = function(err) {
            testStartup = err;
        }
        driver.open(onStartup);
        mockAsync(function() {
            should(testStartup == null).be.true; // success
            driver.model.should.equal(model);
            should.deepEqual(driver.model, {
                driver: "mock-MTO_XYZ",
                available: true, // serial connection established
                rest: {
                    serialPath: "/dev/ttyACM0"
                },
                reads: 0,
                writes: 0,
            });
            driver.history.length.should.equal(0);
            driver.queueLength().should.equal(0);
        });

        driver.close();
        should.deepEqual(driver.model, {
            driver: "mock-MTO_XYZ",
            available: false,
            rest: {
                serialPath: "/dev/ttyACM0"
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
                driver: "mock-MTO_XYZ",
                available: false, // serial connection failed
                rest: {
                    serialPath: "NOTFOUND"
                },
                reads: 0,
                writes: 0,
            });
        }); // mock async
    })
    it('MockDriver should handle "response" event', function() {
        var model = mockModel("/dev/ttyACM0");
        var mto = new MTO_C4();
        var driver = new exports.MockDriver(model, mto);
        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({
            id: ""
        });
        driver.processQueue();
        mockAsync(function() {
            model.available.should.be.true;
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    app: "mock-MTO_C4",
                    "ver": 1
                },
                t: 0.001
            });
        });
    })
    it('MockDriver should handle "idle" event', function() {
        var model = mockModel("/dev/ttyACM0");
        var mto = new MTO_C4();
        var driver = new exports.MockDriver(model, mto);
        var testidle = 0;
        driver.on("idle", function() {
            testidle++;
        });
        testidle.should.equal(0);
        driver.open();
        driver.pushQueue({
            id: ""
        });
        driver.processQueue();
        mockAsync(function() {
            testidle.should.equal(1);
            model.writes.should.equal(1);
            model.reads.should.equal(1);
        }); // mock async
    })
    it('MockDriver should handle {"id":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var mto = new MTO_XYZ();
        var driver = new exports.MockDriver(model, mto);
        driver.open();
        var testid;
        driver.pushQueue({
            id: ""
        }, function(response) {
            testid = response;
        });
        driver.processQueue();
        mockAsync(function() {
            should.deepEqual(testid, {
                s: 0,
                r: {
                    app: "mock-MTO_XYZ",
                    "ver": 1
                },
                t: 0.001
            });
        }); // mock async
    })
    it('MockDriver should handle {"x":...}', function() {
        var model = mockModel("/dev/ttyACM0");
        var mto = new MTO_XYZ();
        var driver = new exports.MockDriver(model, mto);
        driver.open();
        var testid;
        driver.pushQueue({
            x: {
                tm: 200,
                tn: 2,
            },
        }, function(response) {
            testid = response;
        });
        driver.processQueue();
        mockAsync(function() {
            should.deepEqual(testid, {
                s: 0,
                r: {
                    x: {
                        tm: 200,
                        tn: 2,
                    },
                },
                t: 0.001
            });
        }); // mock async
    })
})

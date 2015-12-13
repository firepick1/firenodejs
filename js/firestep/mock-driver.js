var should = require("should");

module.exports.MockDriver = (function() {
    ////////////////// constructor
    function MockDriver(model, options) {
        var that = this;
        should.exist(model);
        options = options || {};

        //driver
        options.buffersize = options.buffersize || 255; // serial buffer size
        options.baudrate = options.baudrate || 19200;
        options.maxHistory = options.maxHistory || 50;
        options.msLaunchTimeout = options.msLaunchTimeout || 3000; // allow EEPROM commands to complete
        that.maxHistory = options.maxHistory;
        that.serialQueue = [];
        that.serialInProgress = false;
        that.serialHistory = [];
        that.msLaunchTimeout = options.msLaunchTimeout;
        that.model = model;
        that.handlers = {
            idle: function() {
                console.log("TTY\t: idle");
            },
            startup: function(){
                console.log("TTY\t: startup");
            },
            response: function(response) {
                console.log("TTY\t: response(" + JSON.stringify(response) + ")");
            },
        };

        return that;
    }
    MockDriver.prototype.mockResponse = function(status, data) {
        var that = this;
        var response = {
            s:status, // https://github.com/firepick1/FireStep/blob/master/FireStep/Status.h
            r:data, // JSON query by example patterned after on request 
            t:0.001 // time in seconds
        };
        that.model.reads++;
        var data = JSON.stringify(response);
        that.onSerialData(data);
    }
    MockDriver.prototype.on = function(event, callback) {
        var that = this;
        event.should.exist;
        callback.should.be.Function;
        that.handlers[event] = callback;
        return that;
    }
    MockDriver.prototype.open = function(options) {
        var that = this;
        console.log("TTY\t: opened serial connection to:" + that.model.rest.serialPath); 
        // MAKE IT WORK OR THROW
        that.model.driver = "mock";
        that.model.available = true;
        that.model.initialized = true;
        that.handlers.startup();
        that.processQueue();
        return that;
    }
    MockDriver.prototype.close = function(options) {
        var that = this;
        // MAKE IT WORK OR THROW
        that.model.available = false;
        that.model.initialized = false;
        return that;
    }

    MockDriver.prototype.write = function(cmd) {  // CANNOT BLOCK!!!
        var that = this;
        that.model.writes = that.model.writes ? that.model.writes+1 : 1;
        var serialData = JSON.stringify(cmd);
        console.log("TTY\t: WRITE(" + that.model.writes + ") " + serialData + "\\n");

        // SEND SERIAL DATA HERE

        // SHOULD BE CALLBACK CODE FOR HANDLING SERIAL RESPONSE
        if (cmd.hasOwnProperty("id")) {
            that.mockResponse(0, {"app":"MockFireStep", "ver":1.0});
        } else if (cmd.hasOwnProperty("hom")) {
            that.mockResponse(-402, cmd);
        } else if (cmd.hasOwnProperty("mov")) {
            that.mockResponse(-402, cmd);
        } else if (cmd.hasOwnProperty("dim")) {
            that.mockResponse(-402, cmd);
        } else if (cmd.hasOwnProperty("sys")) {
            that.mockResponse(-402, cmd);
        } else {
            that.mockResponse(-402, cmd);
        }
    }
    MockDriver.prototype.processQueue = function() {
        var that = this;

        if (that.serialQueue.length <= 0) {
    //        console.log("TTY\t: MockDriver.processQueue(empty) ");
        } else if (!that.model.available) {
            console.log("TTY\t: MockDriver.processQueue(unavailable) ", that.serialQueue.length,
                " items");
        } else if (that.serialInProgress) {
     //       console.log("TTY\t: MockDriver.processQueue(busy) ", that.serialQueue.length, " items");
        } else {
            that.serialInProgress = true;
            that.request = that.serialQueue.shift();
            that.serialHistory.splice(0, 0, that.request);
            that.serialHistory.splice(that.maxHistory);
            that.write(that.request.cmd);
        }
    };
    MockDriver.prototype.onSerialData = function(data) {
        var that = this;
        that.model.reads = that.model.reads ? that.model.reads+1 : 1;
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
        that.processQueue();
        return that;
    }

    return MockDriver;
})();

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockDriver", function() {
    var options = {
        baudrate: 19200
    };
    var rest = {
        serialPath: "/dev/ttyACM0"
    };
    var onStartup = function(err) {};
    var onResponse = function(response){};
    var onIdle = function(){};
    it("MockDriver should open()/close()", function() {
        var model = {rest:rest};
        var driver = new exports.MockDriver(model, options);
        driver.open();
        driver.model.should.equal(model); 
        should.deepEqual(driver.model, {
            driver: "mock",
            available: true, // serial connection established
            initialized: true, // driver startup data sync completed
            rest: {
                serialPath: "/dev/ttyACM0"
            }
        });
        driver.history.length.should.equal(0);
        driver.queueLength().should.equal(0);
        driver.close();
        should.deepEqual(driver.model, {
            driver: "mock",
            available: false, 
            initialized: false, 
            rest: {
                serialPath: "/dev/ttyACM0"
            }
        });
    })
    it("MockDriver should handle startup event", function() {
        var model = {rest:rest};
        var driver = new exports.MockDriver(model, options);
        var testStartup;
        var onStartup = function(err) {
            should(err == null).be.true;
            testStartup = true;
        }
        should(testStartup).be.undefined;
        driver.on("startup", onStartup);
        driver.open();
        testStartup.should.be.true;
    })
    it('MockDriver should handle "response" event', function() {
        var model = {rest:rest};
        var driver = new exports.MockDriver(model);
        var testresponse;
        driver.on("response", function(response){
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({id:""});
        should.deepEqual(testresponse, {
            s: 0,
            r: {app:"MockFireStep", "ver":1},
            t: 0.001
        });
    })
    it('MockDriver should handle "idle" event', function() {
        var model = {rest:rest};
        var driver = new exports.MockDriver(model);
        var testidle = 0;
        driver.on("idle", function(){
            testidle++;
        });
        testidle.should.equal(0);
        driver.open();
        testidle.should.equal(0);
        driver.pushQueue({id:""});
        testidle.should.equal(1);
        model.writes.should.equal(1);
        model.reads.should.equal(1);
    })
    it('MockDriver should handle {"id":""}', function() {
        var model = {rest:rest};
        var onResponse = function(response){};
        var onIdle = function(){};
        var driver = new exports.MockDriver(model, onStartup, onResponse, onIdle);
        driver.open();
        var testid;
        driver.pushQueue({id:""},function(response) {
            testid = response;
        });
        should.deepEqual(testid, {
            s: 0,
            r: {app:"MockFireStep", "ver":1},
            t: 0.001
        });
    })
})

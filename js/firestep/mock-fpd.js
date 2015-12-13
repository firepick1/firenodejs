var should = require("should");
var math = require("mathjs");
var MockDriver = require("./mock-driver").MockDriver;
var MTO_FPD = require("./mto-fpd").MTO_FPD;

function mockAsync(callback) {
    callback();
}

module.exports.MockFPD = (function() {
    ////////////////// constructor
    function MockFPD(model, options) {
        var that = this;
        options = options || {};
        options.mto = new MTO_FPD();
        return new MockDriver(model, options);
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

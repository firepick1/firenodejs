var should = require("should");
var math = require("mathjs");
var MockDriver = require("./mock-driver");
var MTO_FPD = require("../../www/js/shared/MTO_FPD");

function mockAsync(callback) {
    callback();
}

(function(exports) {
    ////////////////// constructor
    function MockFPD(model, options) {
        var that = this;
        should.exist(model);
        options = options || {};
        var mto = new MTO_FPD();
        return new MockDriver(model, mto, options);
    }

    module.exports = exports.MockFPD = MockFPD;
})(typeof exports === "object" ? exports : (exports = {}));

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
                driver: "mock-MTO_FPD",
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
            driver: "mock-MTO_FPD",
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
                driver: "mock-MTO_FPD",
                available: false, // serial connection failed
                rest: {
                    serialPath: "NOTFOUND"
                },
                reads: 0,
                writes: 0,
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
        driver.processQueue();
        mockAsync(function() {
            model.available.should.be.true;
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    app: "mock-MTO_FPD",
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
        driver.processQueue();
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
        driver.processQueue();
        mockAsync(function() {
            should.deepEqual(testid, {
                s: 0,
                r: {
                    app: "mock-MTO_FPD",
                    "ver": 1
                },
                t: 0.001
            });
        }); // mock async
    })
    it('MockFPD should handle {"sys":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new exports.MockFPD(model);
        driver.open();
        var testresponse;
        driver.pushQueue({
            sys: ""
        }, function(response) {
            testresponse = response;
        });
        driver.processQueue();
        mockAsync(function() {
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    sys: {
                        to: 1
                    }
                },
                t: 0.001
            });
        }); // mock async
    })
    it('MockFPD should handle {"dim":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new exports.MockFPD(model);
        driver.open();
        var testresponse;
        driver.pushQueue({
            dim: ""
        }, function(response) {
            testresponse = response;
        });
        driver.processQueue();
        mockAsync(function() {
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    dim: {
                        e: 131.64,
                        f: 190.53,
                        gr: 9.47375,
                        ha: 60.33,
                        mi: 16,
                        re: 270,
                        rf: 90,
                        spa: -54.617,
                        spr: -0.383,
                        st: 200,
                    }
                },
                t: 0.001
            });
        }); // mock async
    })
    it('MockFPD should handle {"hom":""} and {"mpo":""}', function(done) {
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
        driver.processQueue();
        mockAsync(function() {
            testresponse.s.should.equal(0);
            testresponse.r.mpo["1"].should.equal(0);
            testresponse.r.mpo["2"].should.equal(0);
            testresponse.r.mpo["3"].should.equal(0);
            testresponse.r.mpo["x"].should.equal(0);
            testresponse.r.mpo["y"].should.equal(0);
            testresponse.r.mpo["z"].should.equal(0);
            done();
        }); // mock async
    })
    it('MockFPD should handle {"mov":""}', function() {
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
        driver.processQueue();
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

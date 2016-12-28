var should = require("should");
var MockDriver = require("./mock-driver");

function mockAsync(callback) {
    callback();
}

(function(exports) {
    ////////////////// constructor
    function MockCartesian(model, mto, options) {
        should.exist(model);
        return new MockDriver(model, mto, options); // default for MockDriver
    }
    module.exports = exports.MockCartesian = MockCartesian;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockCartesian", function() {
    var MockCartesian = exports.MockCartesian;
    var MTO_XYZ = require("../../www/js/shared/MTO_XYZ");
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
    it('MockCartesian should handle {"hom":""} and {"mpo":""}', function(done) {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var mto = new MTO_XYZ();
        var mto = new MTO_XYZ();
        var driver = new MockCartesian(model, mto);
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
    it('homx, homy and homz home individual axes', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var mto = new MTO_XYZ();
        var driver = new MockCartesian(model, mto);
        var testresponse;
        driver.on("response", function(response) {
            testresponse = response;
        });
        driver.open();
        driver.pushQueue({
            hom: "",
        });
        driver.pushQueue({
            mov: {
                x: 10,
                y: 20,
                z: 30,
            }
        });
        driver.pushQueue({
            homy: ""
        });
        driver.pushQueue({
            mpo: ""
        });
        driver.processQueue();
        mockAsync(function() {
            should.deepEqual(testresponse, {
                s: 0,
                r: {
                    mpo: {
                        "1": 1000,
                        "2": 0,
                        "3": 3000,
                        x: 10,
                        y: 0,
                        z: 30
                    }
                },
                t: 0.001
            });
        }); // mock async
    })
    it('MockCartesian should handle {"mov":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var mto = new MTO_XYZ();
        var driver = new MockCartesian(model, mto);
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
                        "1": 100,
                        "2": 200,
                        "3": 349,
                        x: 1,
                        y: 2,
                        z: 3.49 // note that actual position is NOT same as requested
                    }
                },
                t: 0.001
            });
            model.reads.should.equal(3);
            model.writes.should.equal(3);
        }); // mock async
    })
})

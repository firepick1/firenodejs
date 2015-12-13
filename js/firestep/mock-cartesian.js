var should = require("should");
var MockDriver = require("./mock-driver").MockDriver;

function mockAsync(callback) {
    callback();
}

module.exports.MockCartesian = (function() {
    ////////////////// constructor
    function MockCartesian(model, options) {
        should.exist(model);
        return new MockDriver(model, options); // default for MockDriver
    }
    return MockCartesian;
})();

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockCartesian", function() {
    var MockCartesian = exports.MockCartesian;
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
    it('MockCartesian should handle {"hom":""} and {"mpo":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new MockCartesian(model);
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
    it('MockCartesian should handle {"mov":""}', function() {
        var model = mockModel("/dev/ttyACM0");
        var onIdle = function() {};
        var driver = new MockCartesian(model);
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

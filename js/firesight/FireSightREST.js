var child_process = require('child_process');
var path = require("path");
var should = require("should");
var fs = require("fs");
var Logger = require("../../www/js/shared/Logger");
var JsonUtil = require("../../www/js/shared/JsonUtil");
var JsonError = require("../../www/js/shared/JsonError");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FireSightREST(images, options) {
        var that = this;
        options = options || {};

        that.model = {};
        that.model.available = null;
        that.executable = options.executable || "firesight";
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;
        that.calcs = {};
        that.msSettle = options.msSettle || that.camera.msSettle || 600;
        that.storeDir = that.images.storeDir("FireSightREST");
        that.appDir = options.appDir || "";
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    FireSightREST.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }
    FireSightREST.prototype.syncModel = function(delta) {
        var that = this;
        delete delta.available;
        console.log("INFO\t: FireSightREST.syncModel() delta:", JsonUtil.summarize(delta));
        JsonUtil.applyJson(that.model, delta);
    }
    FireSightREST.prototype.open = function(onOpen) {
        var that = this;
        var cmd = that.executable + " -version";
        var result = child_process.exec(cmd, function(error, stdout, stderr) {
            if (error) {
                var msg = "FireSightREST.open() failed.";
                console.log("WARN\t:", msg, error.message);
                that.model.available = false;
                onOpen instanceof Function && onOpen(new Error(msg, "firesight-rest.js"));
            } else {
                that.model.version = JSON.parse(stdout).version;
                that.model.available = true;
                Logger.start("FireSightREST: firesight available version:", that.model.version);
                cmd = "mkdir -p " + that.storeDir;
                result = child_process.exec(cmd, function(error, stdout, stderr) {
                    if (error) {
                        var msg = "FireSightREST.open() mkdir failed.";
                        console.log("WARN\t:", msg, error.message);
                        that.model.available = false;
                        onOpen instanceof Function && onOpen(new Error(msg, "firesight-rest.js"));
                    } else {
                        Logger.start("FireSightREST: ", JsonUtil.summarize(that.model));
                        onOpen instanceof Function && onOpen(null);
                    }
                });
            }
        });
        return that;
    }
    FireSightREST.prototype.outputImagePath = function(camName, checkExist) {
        var that = this;
        camName = typeof camName == "undefined" ? that.camera.name : camName;
        var loc = that.images.location();
        var jpgPath = path.join(that.storeDir, camName + "_" + loc + ".jpg");
        if (checkExist) {
            try {
                var fs_stats = fs.statSync(jpgPath);
            } catch (err) {
                return null; // does not exist
            }
        }
        return jpgPath;
    }
    FireSightREST.prototype.outputJsonPath = function(camName, checkExist) {
        var that = this;
        camName = typeof camName == "undefined" ? that.camera.name : camName;
        var loc = that.images.location();
        var jsonPath = path.join(that.storeDir, camName + "_" + loc + ".json");
        if (checkExist) {
            try {
                var fs_stats = fs.statSync(jsonPath);
            } catch (err) {
                //(verify == null || verify === true) && console.log("WARN\t: FireSightREST: JSON file expected at " + loc + ":" + err);
                return null;
            }
        }
        return jsonPath;
    }
    FireSightREST.prototype.registerCalc = function(calcName, calculator) {
        var that = this;
        should.exist(calcName);
        that.calcs[calcName] = calculator;
        return that;
    }
    FireSightREST.prototype.processImage = function(camName, calcName, onSuccess, onFail, options) {
        var that = this;
        if (!that.calcs.hasOwnProperty(calcName)) {
            throw new Error("FireSightREST.processImage(" + camName + ") unknown calcName:" + calcName);
        }
        that.calcs[calcName].calculate(camName, onSuccess, onFail, options);
        return that;
    }
    FireSightREST.prototype.buildCommand = function(camName, pipeline, args, capturedImagePath) {
        var that = this;
        var jpgDstPath = that.outputImagePath(camName);
        var jsonDstPath = that.outputJsonPath(camName);
        var cmd = that.executable +
            " -i " + capturedImagePath +
            " -p " + that.appDir + pipeline +
            " -o " + jpgDstPath +
            " " + args +
            " | tee " + jsonDstPath;
        return cmd;
    }
    FireSightREST.prototype.calcImage = function(camName, pipeline, args, onCalc, onFail) {
        var that = this;
        var jpgDstPath = that.outputImagePath(camName);
        var jsonDstPath = that.outputJsonPath(camName);
        var onCapture = function(imagePath) {
            var cmd = that.buildCommand(camName, pipeline, args, imagePath);
            console.log("EXEC\t: " + cmd);
            try {
                var execResult = child_process.exec(cmd, function(error, stdout, stderr) {
                    var fail = function(msg) {
                        console.log("WARN\t: " + msg);
                        //var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                        var execResult = child_process.exec("cp " + imagePath + " " + jpgDstPath, function() {
                            // don't care
                        });
                        onFail(new Error(msg));
                    }

                    if (error instanceof Error) {
                        console.log("WARN\t: FireSightREST.calcImage() error:" + error.message);
                        onCalc(stdout, stderr, fail);
                    } else if (stderr && stderr != "") {
                        console.log("WARN\t: FireSightREST.calcImage() stderr:" + stderr);
                        onCalc(stdout, stderr, fail);
                    } else {
                        onCalc(stdout, stderr, fail);
                    }
                });
            } catch (e) {
                onFail(new JsonError("FireSightREST.calcImage() child_process_exec(" + that.executable + ") error:" + e.message));
            }
        };
        setTimeout(function() {
            that.camera.capture(camName, onCapture, function(error) {
                onFail(new JsonError("FireSightREST.calcImage(" + pipeline + ") camera capture error:", error.message));
            });
        }, that.msSettle);
        return that;
    }

    module.exports = exports.FireSightREST = FireSightREST;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("FireSightREST", function() {
    var FireSightREST = require("../firesight/FireSightREST");
    var MockImages = require("../mock/MockImages");
    var mock_firestep = {};
    var mock_camera = {
        name: "mock_camera",
    };
    var mock_images = function() {
        var mock = {
            firestep: mock_firestep,
            camera: mock_camera,
            mock_location: "x0_y0_z0",
            location: function() {
                return mock.mock_location;
            },
            storeDir: function(dir, camera) {
                return '../../www/img';
            }
        };
        return mock;
    };
    it("isAvailable() should return true if firesight C++ is installed", function() {
        var defaultOptions = {};
        var rest = new FireSightREST(mock_images(), defaultOptions);
        rest.isAvailable().should.equal(false);
        rest.open(function(err) {
            should(err instanceof Error).equal(false);
            rest.isAvailable().should.equal(true);
        });
        console.log("TEST\t: error handling test (BEGIN-1)");
        var restBad = new FireSightREST(mock_images(), {
            executable: "firesight-test-no-executable available"
        });
        restBad.open(function(err) {
            should(err instanceof Error).equal(true);
            rest.isAvailable().should.equal(false);
            err.message.should.equal("FireSightREST.open() failed.");
            console.log("TEST\t: error handling (PASSED-1)");
        });
    });
    it("outputImagePath(camName) should return path to most recent output image at current location", function() {
        var images = mock_images();
        var rest = new FireSightREST(images);
        var completed = false;
        rest.open(function() {
            rest.outputImagePath(mock_camera.name).should.equal("../../www/img/mock_camera_x0_y0_z0.jpg");
            images.mock_location = "mock-empty-location";
            should(rest.outputImagePath(mock_camera.name, true)).be.Null;
            completed = true;
        });
        setTimeout(function() {
            completed.should.equal(true);
        }, 100);
    });
    it("outputJsonPath(camName) should return path to most recently calculated firesight output at current location", function() {
        var images = mock_images();
        var rest = new FireSightREST(images);
        var completed = false;
        rest.open(function() {
            rest.outputJsonPath(mock_camera.name).should.equal("../../www/img/mock_camera_x0_y0_z0.json");
            images.mock_location = "mock-empty-location";
            should(rest.outputJsonPath(mock_camera.name, true)).be.Null;
            completed = true;
        });
        setTimeout(function() {
            completed.should.equal(true);
        }, 100);
    });
    it("registerCalc(calcName, calculator) should register a new image processor", function() {
        var images = mock_images();
        var rest = new FireSightREST(images);
        var calcOptions = {};
        var mockImageProcessor = {
            calculate: function(camName, onSuccess, onFail, options) {
                should.exist(onSuccess);
                onSuccess.should.be.Function;
                should.exist(onFail);
                onFail.should.be.Function;
                camName === "test-camera" && options.should.equal(calcOptions);
                camName === "bad-camera" && should(calcOptions == null);
                if (camName === "test-camera") {
                    onSuccess({
                        happiness: true
                    });
                } else {
                    onFail(new Error("bad camera"));
                }
            }
        };
        rest.registerCalc("mock-image-processor", mockImageProcessor).should.equal(rest);
        var success = 0;
        var onSuccess = function(result) {
            should.deepEqual(result, {
                happiness: true
            });
            success++;
        }
        var errors = 0;
        var onFail = function(err) {
            should(err instanceof Error).equal(true);
            errors++;
        }
        rest.processImage("test-camera", "mock-image-processor", onSuccess, onFail, calcOptions);
        rest.processImage("bad-camera", "mock-image-processor", onSuccess, onFail);
        setTimeout(function() {
            success.should.equal(1);
            errors.should.equal(1);
        }, 100);
    });
})

var child_process = require('child_process');
var path = require("path");
var should = require("should");
var fs = require("fs");
var Grid = require("../../www/js/shared/Grid");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FireSightREST(images, options) {
        var that = this;
        options = options || {};

        that.model = {};
        that.verbose = options.verbose;
        that.model.available = null;
        that.executable = options.executable || "firesight";
        that.verbose = options.verbose;
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;

        return that;
    }

    FireSightREST.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }
    FireSightREST.prototype.open = function(onOpen) {
        var that = this;
        var cmd = that.executable + " -version";
        that.storeDir = that.images.storeDir("FireSightREST");
        var result = child_process.exec(cmd, function(error, stdout, stderr) {
            if (error) {
                var msg = "FireSightREST.open() executable failed.";
                console.log("WARN\t:", msg, error.message);
                that.model.available = false;
                onOpen instanceof Function && onOpen(new Error(msg, "firesight-rest.js"));
            } else {
                that.model.version = JSON.parse(stdout).version;
                that.model.available = true;
                cmd = "mkdir -p " + that.storeDir;
                result = child_process.exec(cmd, function(error, stdout, stderr) {
                    if (error) {
                        var msg = "FireSightREST.open() mkdir failed.";
                        console.log("WARN\t:", msg, error.message);
                        that.model.available = false;
                        onOpen instanceof Function && onOpen(new Error(msg, "firesight-rest.js"));
                    } else {
                        console.log("INFO\t: FireSightREST: ", that.model);
                        onOpen instanceof Function  && onOpen(null);
                    }
                });
            }
        });
        return that;
    }
    FireSightREST.prototype.outputImagePath = function(camName, verify) { 
        var that = this;
        camName = typeof camName == "undefined" ?  that.camera.name : camName;
        var loc = that.images.location();
        var jpgPath = path.join(that.storeDir, camName + "_" + loc + ".jpg");
        try {
            var fs_stats = (verify == null || verify === true) && fs.statSync(jpgPath);
        } catch (err) {
            (verify == null || verifiy === true) && console.log("WARN\t: no FireSightREST image at " + loc + ": " + err);
            return null;
        }
        return jpgPath;
    }
    FireSightREST.prototype.outputJsonPath = function(camName, verify) {
        var that = this;
        camName = typeof camName == "undefined" ?  that.camera.name : camName;
        var loc = that.images.location();
        var jsonPath = path.join(that.storeDir, camName + "_" + loc + ".json");
        try {
            var fs_stats = (verify == null || verify === true) && fs.statSync(jsonPath);
        } catch (err) {
            (verify == null || verifiy === true) && console.log("WARN\t: no FireSightREST JSON at " + loc + ":" + err);
            return null;
        }
        return jsonPath;
    }
    FireSightREST.prototype.measureGrid = function(camName, onSuccess, onFail) {
        var that = this;
        var jpgDstPath = that.outputImagePath(camName, false);
        var jsonDstPath = that.outputJsonPath(camName, false);
        var outputImage = that.images.outputImagePath(camName);
        var onMeasureGrid = function(error, stdout, stderr) {
            if (error instanceof Error) {
                var msg = "FireSightREST.measureGrid(" + jpgDstPath + ") " + error;
                console.log("ERROR\t: " + msg);
                onFail(new Error(msg));
            } else {
                //console.log(stdout);
                var outJson;
                var rects;
                console.log("DEBUG\t: measure-grid stdout:", stdout);
                if (stdout && stdout.length > 0) {
                    try {
                        outJson = JSON.parse(stdout);
                        rects = outJson.match && outJson.match.rects;
                        for (var i=rects.length; 0 < i--; ) {
                            delete rects[i].angle;
                            delete rects[i].width;
                            delete rects[i].height;
                        }
                    } catch (e) {
                        console.log("ERROR\t: FireSightREST.measureGrid(" + jsonDstPath + ") could not parse JSON:", stdout);
                    }
                }
                var msgFail = "FireSightREST.measureGrid(" + jsonDstPath + ") no match";
                var grid = (rects && rects.length > 4) ? Grid.createFromPoints(rects) : null;
                if (grid) {
                    var result = {
                        origin: grid.origin,
                        angle: grid.angle,
                        cellSize: grid.cellSize,
                    }
                    console.log("INFO\t: FireSightREST.measureGrid(" + jsonDstPath + ") ");
                    that.verbose && console.log("INFO\t: " + JSON.stringify(result));
                    onSuccess(result);
                } else {
                    console.log("INFO\t: " + msgFail);
                    var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                        // don't care
                    });
                    onFail(new Error(msgFail));
                }
            }
        };
        var onCapture = function(imagePath) {
            var cmd = 
                "firesight -p json/measureGrid.json" +
                " -i " + imagePath +
                " -o " + jpgDstPath +
                " -Dtemplate=www/img/cross32.png" +
                " | " +
                "tee " + jsonDstPath;
            that.verbose && console.log("EXEC\t: " + cmd);
            var execResult = child_process.exec(cmd, onMeasureGrid);
        };
        setTimeout(function() {
            that.camera.capture(camName, onCapture, function(error) {
                onFail(new Error("FireSightREST.measureGrid() could not capture current image"));
            });
        }, that.firestep.model.rest.msSettle);
    }
    FireSightREST.prototype.calcOffset = function(camName, onSuccess, onFail) {
        var that = this;
        camName = typeof camName == "undefined" ?  that.camera.name : camName;
        var loc = that.images.location();
        var jpgDstPath = that.outputImagePath(camName, false);
        var jsonDstPath = that.outputJsonPath(camName, false);
        var savedImage = that.images.savedImagePath(camName);
        var onCalcOffset = function(error, stdout, stderr) {
            if (error instanceof Error) {
                var msg = "FireSightREST.calcOffset(" + loc + ") " + error;
                console.log("ERROR\t: " + msg);
                var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                    // don't care
                });
                onFail(new Error(msg));
            } else {
                //console.log(stdout);
                var outJson;
                var offset;
                if (stdout && stdout.length > 0) {
                    try {
                        outJson = JSON.parse(stdout);
                        offset = outJson.model && outJson.model.channels && outJson.model.channels["0"];
                    } catch (e) {
                        console.log("ERROR\t: FireSightREST.calcOffset(" + loc + ") could not parse JSON:", stdout);
                    }
                }
                if (offset && offset.dx != null && offset.dy != null) {
                    var result = {
                        dx: offset.dx,
                        dy: offset.dy
                    }
                    console.log("INFO\t: FireSightREST.calcOffset(" + loc + ") " + JSON.stringify(result));
                    onSuccess(result);
                } else {
                    var msg = "FireSightREST.calcOffset(" + loc + ") no match";
                    console.log("INFO\t: " + msg);
                    var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                        // don't care
                    });
                    onFail(new Error(msg));
                }
            }
        };
        var onCapture = function(imagePath) {
            var cmd = 
                "firesight -p json/calc-offset.json" +
                " -i " + imagePath +
                " -o " + jpgDstPath +
                " -Dsaved=" + savedImage + " | " +
                "tee " + jsonDstPath;
            that.verbose && console.log("EXEC\t: " + cmd);
            var execResult = child_process.exec(cmd, onCalcOffset);
        };
        if (savedImage) {
            setTimeout(function() {
                that.camera.capture(camName, onCapture, function(error) {
                    onFail(new Error("FireSightREST.calcOffset() could not capture current image"));
                });
            }, that.firestep.model.rest.msSettle);
        } else {
            onFail(new Error("FireSightREST.calcOffset() no saved image"));
        }
    }

    module.exports = exports.FireSightREST = FireSightREST;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("FireSightREST", function() {
    var FireSightREST = require("../firesight/firesight-rest.js");
    var mock_firestep = {};
    var mock_camera = {
        name: "mock_camera",
    };
    var mock_images = function() {
        var mock = {
            firestep:mock_firestep,
            camera:mock_camera,
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
        var restBad = new FireSightREST(mock_images(), {
            executable:"firesight-test-no-executable available"
        });
        restBad.open(function(err) {
            should(err instanceof Error).equal(true);
            rest.isAvailable().should.equal(false);
            console.log(Object.keys(err));
            err.message.should.equal("FireSightREST.open() failed.");
        });
    });
    it("outputImagePath(camName) should return path to most recent output image at current location", function() {
        var images = mock_images();
        var rest = new FireSightREST(images);
        var completed = false;
        rest.open(function() {
            rest.outputImagePath(mock_camera.name).should.equal("../../www/img/mock_camera_x0_y0_z0.jpg");
            images.mock_location = "mock-empty-location";
            should(rest.outputImagePath(mock_camera.name)).be.Null;
            completed = true;
        });
        setTimeout(function() {
            completed.should.equal(true);
        },100);
    });
    it("outputJsonPath(camName) should return path to most recently calculated firesight output at current location", function() {
        var images = mock_images();
        var rest = new FireSightREST(images);
        var completed = false;
        rest.open(function() {
            rest.outputJsonPath(mock_camera.name).should.equal("../../www/img/mock_camera_x0_y0_z0.json");
            images.mock_location = "mock-empty-location";
            should(rest.outputJsonPath(mock_camera.name)).be.Null;
            completed = true;
        });
        setTimeout(function() {
            completed.should.equal(true);
        },100);
    });
})

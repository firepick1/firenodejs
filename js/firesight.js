//console.log("INFO\t: loading FireSight");
var child_process = require('child_process');
var path = require("path");
var fs = require("fs");
var Grid = require("../www/js/shared/Grid");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FireSight(images, options) {
        var that = this;
        options = options || {};

        that.model = {};
        that.verbose = options.verbose;
        that.model.available = null;
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;
        var cmd = "firesight -version";
        var result = child_process.exec(cmd, function(error, stdout, stderr) {
            if (error) {
                console.log("WARN\t: firesight unavailable", error);
                that.model.available = false;
            } else {
                that.model.version = JSON.parse(stdout).version;
                that.model.available = true;
                console.log("INFO\t: firesight", that.model);
            }
        });

        return that;
    }

    FireSight.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }
    FireSight.prototype.savedImage = function(camera) {
        var that = this;
        var loc = that.images.location();
        var jpgPath = path.join(that.images.storeDir("firesight", camera), loc + ".jpg");
        try {
            var fs_stats = fs.statSync(jpgPath);
        } catch (err) {
            console.log("WARN\t: no firesight image at current location" + err);
            return null;
        }
        return jpgPath;
    }
    FireSight.prototype.savedJSON = function(camera) {
        var that = this;
        var loc = that.images.location();
        var jsonPath = path.join(that.images.storeDir("firesight", camera), loc + ".json");
        try {
            var fs_stats = fs.statSync(jsonPath);
        } catch (err) {
            console.log("WARN\t: no firesight JSON at current location" + err);
            return null;
        }
        return jsonPath;
    }
    FireSight.prototype.measureGrid = function(camName, onSuccess, onFail) {
        var that = this;
        var loc = that.images.location();
        var storeDir = that.images.storeDir("firesight", camName);
        var jpgDstPath = path.join(storeDir, loc + ".jpg");
        var jsonDstPath = path.join(storeDir, loc + ".json");
        var savedImage = that.images.savedImage(camName);
        var onMeasureGrid = function(error, stdout, stderr) {
            if (error instanceof Error) {
                var msg = "FireSight.measureGrid(" + loc + ") " + error;
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
                        console.log("ERROR\t: FireSight.measureGrid(" + loc + ") could not parse JSON:", stdout);
                    }
                }
                var msgFail = "FireSight.measureGrid(" + loc + ") no match";
                var grid = (rects && rects.length > 4) ? Grid.createFromPoints(rects) : null;
                if (grid) {
                    var result = {
                        origin: grid.origin,
                        angle: grid.angle,
                        cellSize: grid.cellSize,
                    }
                    console.log("INFO\t: FireSight.measureGrid(" + loc + ") " + JSON.stringify(result));
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
            var cmd = "mkdir -p " + storeDir + "; " +
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
                onFail(new Error("firesight.measureGrid() could not capture current image"));
            });
        }, that.firestep.model.rest.msSettle);
    }
    FireSight.prototype.calcOffset = function(camName, onSuccess, onFail) {
        var that = this;
        var loc = that.images.location();
        var storeDir = that.images.storeDir("firesight", camName);
        var jpgDstPath = path.join(storeDir, loc + ".jpg");
        var jsonDstPath = path.join(storeDir, loc + ".json");
        var savedImage = that.images.savedImage(camName);
        var onCalcOffset = function(error, stdout, stderr) {
            if (error instanceof Error) {
                var msg = "FireSight.calcOffset(" + loc + ") " + error;
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
                        console.log("ERROR\t: FireSight.calcOffset(" + loc + ") could not parse JSON:", stdout);
                    }
                }
                if (offset && offset.dx != null && offset.dy != null) {
                    var result = {
                        dx: offset.dx,
                        dy: offset.dy
                    }
                    console.log("INFO\t: FireSight.calcOffset(" + loc + ") " + JSON.stringify(result));
                    onSuccess(result);
                } else {
                    var msg = "FireSight.calcOffset(" + loc + ") no match";
                    console.log("INFO\t: " + msg);
                    var execResult = child_process.exec("cp www/img/no-image.jpg " + jpgDstPath, function() {
                        // don't care
                    });
                    onFail(new Error(msg));
                }
            }
        };
        var onCapture = function(imagePath) {
            var cmd = "mkdir -p " + storeDir + "; " +
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
                    onFail(new Error("firesight.calcOffset() could not capture current image"));
                });
            }, that.firestep.model.rest.msSettle);
        } else {
            onFail(new Error("firesight.calcOffset() no saved image"));
        }
    }

    module.exports = exports.FireSight = FireSight;
})(typeof exports === "object" ? exports : (exports = {}));

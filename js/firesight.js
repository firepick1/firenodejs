console.log("INFO\t: loading FireSight");
var child_process = require('child_process');
var path = require("path");
var fs = require("fs");

module.exports.FireSight = (function() {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FireSight(images, options) {
        var that = this;
        options = options || {};
        options.model = options.model || {};

        that.model = options.model;
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
        return that.model.available;
    }
    FireSight.prototype.getModel = function() {
        var that = this;
        return that.model;
    }
    FireSight.prototype.savedImage = function(camera) {
        var that = this;
        var loc = that.images.location();
        var jpgPath = path.join(that.images.storeDir("firesight",camera), loc + ".jpg");
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
        var jsonPath = path.join(that.images.storeDir("firesight",camera), loc + ".json");
        try {
            var fs_stats = fs.statSync(jsonPath);
        } catch (err) {
            console.log("WARN\t: no firesight JSON at current location" + err);
            return null;
        }
        return jsonPath;
    }
    FireSight.prototype.calcOffset = function(camName, onSuccess, onFail) {
        var that = this;
        var loc = that.images.location();
        var storeDir = that.images.storeDir("firesight", camName);
        var jpgDstPath = path.join(storeDir, loc  + ".jpg");
        var jsonDstPath = path.join(storeDir, loc  + ".json");
        var savedImage = that.images.savedImage(camName);
        if (savedImage) {
            that.camera.capture(camName, function(imagePath) {
                var cmd = "mkdir -p " + storeDir + "; " +
                   "firesight -p json/calc-offset.json" +
                   " -i " + imagePath + 
                   " -o " + jpgDstPath +
                   " -Dsaved=" + savedImage + " | " +
                   "tee " + jsonDstPath;
                var result = child_process.exec(cmd, function(error, stdout, stderr) {
                    if (error instanceof Error) {
                        onFail(new Error("firesight.calcOffset() " + error));
                    } else {
                        console.log(stdout);
                        var outJson = JSON.parse(stdout);
                        var offset = outJson.model && outJson.model.channels && outJson.model.channels["0"];
                        if (offset) {
                            onSuccess({ dx:offset.dx, dy:offset.dy });
                        } else {
                            onFail(new Error('firesight.calcOffset() expected JSON model.channels["0"]:' + stdout));
                        }
                    }
                });
            }, function(error) {
                onFail(new Error("firesight.calcOffset() could not capture current image"));
            });
        } else {
            onFail(new Error("firesight.calcOffset() no saved image"));
        }
    }

    return FireSight;
})();

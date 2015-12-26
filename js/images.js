var child_process = require('child_process');
var path = require("path");
var fs = require("fs");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function Images(firestep, camera, options) {
        var that = this;
        options = options || {};
        options.imageStore = options.imageStore || "/var/img/";
        options.model = options.model || {
            available: false
        };
        that.pathNoImage = options.pathNoImage;
        that.model = options.model;
        that.imageStore = options.imageStore;
        that.available = null;
        that.verbose = options.verbose;
        if ((that.firestep = firestep) == null) throw new Error("firestep is required");
        if ((that.camera = camera) == null) throw new Error("camera is required");;
        that.model.available = true;

        return that;
    }

    Images.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }

    Images.prototype.location = function() {
        var that = this;
        if (!that.firestep.model) {
            that.verbose && console.log("INFO\t: Images.location() no firestep.model");
            return "no-location";
        }
        if (!that.firestep.model.available) {
            that.verbose && console.log("INFO\t: Images.location() firestep not available");
            return "no-location";
        }
        if (!that.firestep.model.mpo) {
            that.verbose && console.log("INFO\t: Images.location() no firestep.model.mpo");
            that.firestep.syncModel();
            return "no-location";
        }
        var mpo = that.firestep.model.mpo;
        var p1 = mpo.p1 == null ? mpo["1"] : mpo.p1;
        var p2 = mpo.p2 == null ? mpo["2"] : mpo.p2;
        var p3 = mpo.p3 == null ? mpo["3"] : mpo.p3;
        return p1 + "_" + p2 + "_" + p3;
    }
    Images.prototype.storeDir = function(camera, subDir) {
        var that = this;
        var storeDir = path.join(that.imageStore, camera);
        if (subDir) {
            storeDir = path.join(storeDir, subDir);
        }
        return storeDir;
    }
    Images.prototype.hasSavedImage = function(camera) {
        var that = this;
        var loc = that.location();
        var jpgPath = path.join(that.storeDir(camera), loc + ".jpg");
        try {
            var fs_stats = fs.statSync(jpgPath);
        } catch (err) {
            return false;
        }
        return true;
    }
    Images.prototype.savedImagePath = function(camera) {
        var that = this;
        var loc = that.location();
        var jpgPath = path.join(that.storeDir(camera), loc + ".jpg");
        try {
            var fs_stats = fs.statSync(jpgPath);
        } catch (err) {
            return that.pathNoImage;
        }
        return jpgPath;
    }
    Images.prototype.save = function(camName, onSuccess, onFail) {
        var that = this;
        var model;
        camName = camName || that.camera.name;

        if (!that.camera.isAvailable(camName)) {
            onFail(new Error("Cannot save image (" + camName + " camera unavailable)"));
            return that;
        }

        setTimeout(function() {
            that.camera.capture(camName, function(filePath) {
                var loc = that.location();
                var storeDir = path.join(that.imageStore, camName);
                var storePath = path.join(storeDir, loc + ".jpg");
                var cmd = "mkdir -p " + storeDir + "; cp " + filePath + " " + storePath;
                var result = child_process.exec(cmd, function(error, stdout, stderr) {
                    if (error) {
                        console.log("WARN\t: could not save image:" + cmd, error);
                        console.log("\t: " + stderr);
                        onFail(error);
                    } else {
                        var urlPath = "/images/" + camName + "/" + that.location() + ".jpg";
                        console.log("INFO\t: Image saved(" + storePath + ")", urlPath);
                        onSuccess(urlPath);
                    }
                });
            }, function(error) {
                console.log("ERROR\t: cannot save image: ", error);
                onFail(error);
            });
        }, that.firestep.model.rest.msSettle);

        return that;
    }

    module.exports = exports.Images = Images;
})(typeof exports === "object" ? exports : (exports = {}));

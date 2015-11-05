console.log("INFO\t: loading images service");
var child_process = require('child_process');
var path = require("path");
var fs = require("fs");

module.exports.Images = (function() {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function Images(firestep, camera, options) {
        var that = this;
        options = options || {};
        options.imageStore = options.imageStore || "/var/img/";
        options.model = options.model || {
            available: false
        };

        that.model = options.model;
        that.imageStore = options.imageStore;
        that.available = null;
        if ((that.firestep = firestep) == null) throw new Error("firestep is required");
        if ((that.camera = camera) == null) throw new Error("camera is required");;
        that.available = true;

        return that;
    }

    Images.prototype.location = function() {
        var that = this;
        if (!that.firestep.model) {
            console.log("INFO\t: Images.location() no firestep.model");
            return "null";
        }
        if (!that.firestep.model.available) {
            console.log("INFO\t: Images.location() firestep not available");
            return "null";
        }
        if (!that.firestep.model.mpo) {
            console.log("INFO\t: Images.location() no firestep.model.mpo");
            that.firestep.getModel();
            return "null";
        }
        var mpo = that.firestep.model.mpo;
        return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
    }

    Images.prototype.savedImage = function(camera, onSuccess, onFail) {
        var that = this;
        var loc = that.location();
        var storeDir = path.join(that.imageStore, camera);
        var storePath = path.join(storeDir, loc + ".jpg");
        fs.stat(storePath, function(err, stats) {
            if (err) {
                console.log("ERROR\t: no saved image at current location", err);
                onFail(err);
            } else {
                onSuccess(storePath);
            }
        });
    }

    Images.prototype.save = function(camName, onSuccess, onFail) {
        var that = this;
        var model;

        if (!that.camera.isAvailable(camName)) {
            onFail(new Error("Cannot save image (" + camName + " camera unavailable)"));
            return that;
        }

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

        return that;
    }

    return Images;
})();

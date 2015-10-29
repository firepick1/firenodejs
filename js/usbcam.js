console.log("INFO\t: loading ModelUSB");
var child_process = require('child_process');
var path = require("path");

module.exports.ModelUSB = (function() {
    function ModelUSB(n, options) {
        var that = this;
        options = options || {};
        that.camera = "usb" + n;
        that.width = options.width || 640; // device may have minimum width (e.g., 320)
        that.height = options.height || 480; // device may have minimum height (e.g., 180)
        that.source = options.source || ("/dev/video" + n);
        that.imageDir = options.imageDir || "/var/img";
        that.imageName = options.imageName || ("usb" + n + ".jpeg");
        that.imagePath = path.join(that.imageDir, that.imageName);
        that.msCapture = 1500;
        return that;
    }

    ModelUSB.prototype.isAvailable = function() {
        var that = this;
        if (!that.available && that.onAvail) {
            that.whenAvailable(that.onAvail);
        }
        return that.available;
    };
    ModelUSB.prototype.whenAvailable = function(onAvail) {
        var that = this;
        that.onAvail = onAvail;
        console.log("INFO\t: Camera() checking for " + that.source);
        var result = child_process.exec('ls ' + that.source, function(error, stdout, stdin) {
            that.available = !error;
            that.available && that.onAvail();
            console.log("INFO\t: Camera() attached " + that.source);
        });
    }
    ModelUSB.prototype.capture = function(onSuccess, onFail) {
        var that = this;
        var cmd = "streamer -q" + " -c " + that.source + " -s " + that.width + "x" + that.height + " -o " + that.imagePath;

        function capture_closure() {
            return function(error, stdout, stderr) {
                that.capturing = false;
                if (error instanceof Error) {
                    //console.log("TRACE\t: FAIL " + cmd + " " + error);
                    onFail(error);
                } else {
                    //console.log("TRACE\t: OK " + cmd);
                    onSuccess(that.imagePath);
                }
            }
        }
        that.capturing = true;
        child_process.exec(cmd, capture_closure());
        return that;
    }
    return ModelUSB;
})();

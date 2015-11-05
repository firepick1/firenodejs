console.log("INFO\t: loading ModelVideo");
var child_process = require('child_process');
var path = require("path");

module.exports.ModelVideo = (function() {
    function ModelVideo(n, options) {
        var that = this;
        options = options || {};
        that.name = "video" + n;
        that.width = options.width || 640; // device may have minimum width (e.g., 320)
        that.height = options.height || 480; // device may have minimum height (e.g., 180)
        that.source = options.source || ("/dev/video" + n);
        that.imageDir = options.imageDir || "/var/img";
        that.imageName = options.imageName || ("video" + n + ".jpeg");
        that.imagePath = path.join(that.imageDir, that.imageName);
        that.msCapture = 1500;
        return that;
    }

    ModelVideo.prototype.isAvailable = function() {
        var that = this;
        if (!that.available && that.onAvail) {
            that.whenAvailable(that.onAvail);
        }
        return that.available;
    };
    ModelVideo.prototype.whenAvailable = function(onAvail) {
        var that = this;
        that.onAvail = onAvail;
        console.log("INFO\t: Camera() checking for " + that.source);
        var result = child_process.exec('ls ' + that.source, function(error, stdout, stdin) {
            that.available = !error;
            that.available && that.onAvail();
            console.log("INFO\t: Camera() attached " + that.source);
        });
    }
    ModelVideo.prototype.capture = function(onSuccess, onFail) {
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
    return ModelVideo;
})();

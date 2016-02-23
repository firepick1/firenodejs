//console.log("INFO\t: loading CamVideo");
var child_process = require('child_process');
var path = require("path");
var Logger = require("../www/js/shared/Logger");

(function(exports) {
    function CamVideo(n, options) {
        var that = this;
        options = options || {};
        that.verbose = options.verbose;
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

    CamVideo.prototype.isAvailable = function() {
        var that = this;
        if (!that.available && that.onAvail) {
            that.whenAvailable(that.onAvail);
        }
        return that.available === true;
    };
    CamVideo.prototype.syncModel = function() {
        var that = this;
        return {
            name: that.name,
            width: that.width,
            height: that.height,
            source: that.source,
            msCapture: that.msCapture,
            available: that.available,
        };
    }
    CamVideo.prototype.whenAvailable = function(onAvail) {
        var that = this;
        that.onAvail = onAvail;
        that.verbose && Logger.start("CamVideo() checking for " + that.source);
        var result = child_process.exec('ls ' + that.source, function(error, stdout, stdin) {
            that.available = !error;
            that.available && that.onAvail();
            that.available && Logger.start("CamVideo() found " + that.source);
        });
    }
    CamVideo.prototype.capture = function(onSuccess, onFail) {
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

    module.exports = exports.CamVideo = CamVideo;
})(typeof exports === "object" ? exports : (exports = {}));

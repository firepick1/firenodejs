console.log("INFO\t: loading ModelUSB");
var child_process = require('child_process');
var path = require("path");

module.exports.ModelUSB = (function() {
    function ModelUSB(n, options) {
        var that = this;
        options = options || {};
        that.camera = "USB" + n;
        that.width = options.width || 640; // device may have minimum width (e.g., 320)
        that.height = options.height || 480; // device may have minimum height (e.g., 180)
        that.source = options.source || ("/dev/video" + n);
        that.imageDir = options.imageDir || "/var/img";
        that.imageName = options.imageName || ("usb" + n + ".jpeg");
        return that;
    }

    ModelUSB.prototype.whenAvailable = function(onAvail) {
            var that = this;
            console.log("INFO\t: Camera() checking for " + that.source);
            var result = child_process.exec('ls ' + that.source, function(error, stdout, stdin) {
                if (!(error instanceof Error)) {
                    onAvail();
                }
            });
        },
        ModelUSB.prototype.apply = function() {
            var that = this;
            that.imagePath = path.join(that.imageDir, that.imageName);
            console.log("INFO\t: Camera() accessing " + that.source);
            return true;
        },
        ModelUSB.prototype.capture = function(onSuccess, onFail) {
            var that = this;
            var cmd = "streamer -q" + " -c " + that.source + " -s " + that.width + "x" + that.height + " -o " + that.imagePath;

            function capture_closure() {
                return function(error, stdout, stderr) {
                    if (error instanceof Error) {
                        //console.log("TRACE\t: FAIL " + cmd + " " + error);
                        onFail(error);
                    } else {
                        //console.log("TRACE\t: OK " + cmd);
                        onSuccess(that.imagePath);
                    }
                }
            }
            child_process.exec(cmd, capture_closure());
            return that;
        }
    return ModelUSB;
})();


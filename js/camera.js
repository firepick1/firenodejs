console.log("INFO\t: loading Camera");
var child_process = require('child_process');
var path = require("path");

var firepick = firepick || {};
(function(firepick) {
    var Camera = (function() {
        ///////////////////////// private instance variables
        var MODEL_NONE = {
            camera: "UNAVAILABLE",
            isAvailable: function() {
                return false;
            },
            apply: function() {
                console.log("WARN\t: Camera() no camera found");
                return false;
            },
            capture: function(onSuccess, onFail) {
                onFail(new Error("Camera unavailable"));
            }
        };
        var MODEL_RASPISTILL = {
            camera: "raspistill",
            width: 400,
            height: 400,
            source: "raspistill",
            exposure: "snow",
            awb: "fluorescent",
            ev: 12, // exposure compensation for white background (paper)
            imageDir: "/var/img",
            imageName: "image.jpg",
            msCapture: 350, // milliseconds to wait for capture
            isAvailable: function() {
                var that = this;
                console.log("INFO\t: Camera() checking for " + that.source);
                try {
                    var result = child_process.execSync('raspistill --help');
                    return !(result.error instanceof Error);
                } catch (e) {
                    return false;
                }
            },
            apply: function() {
                var that = this;
                that.imagePath = path.join(that.imageDir, that.imageName);
                console.log("INFO\t: Camera() launching raspistill process");
                that.raspistill = child_process.spawn('raspistill', [
                    '-w', model.width,
                    '-h', model.height,
                    '-ex', model.exposure,
                    '-awb', model.awb,
                    '-ev', model.ev,
                    '-t', 0,
                    '-s', 
                    '-o', that.imagePath]);
                that.raspistill.on('error', function(data) {
                    model = MODEL_NONE;
                    console.log("INFO\t: raspistill unvailable:" + data);
                    that.raspistill = null;
                });
                that.raspistill.on('close', function() {
                    console.log("INFO\t: closing raspistill process");
                    that.raspistill = null;
                });
                that.raspistill.stdout.on('data', function(buffer) {
                    console.log("STDOUT\t: " + buffer);
                });
                that.raspistill.stderr.on('data', function(buffer) {
                    console.log("STDERR\t: " + buffer);
                });
                console.log("INFO\t: spawned raspistill pid:" + that.raspistill.pid);
                return that.raspistill ? true : false;
            },
            capture: function(onSuccess, onFail) {
                var that = this;
                if (that.raspistill) {
                    that.raspistill.kill('SIGUSR1');
                    setTimeout(function() {
                        onSuccess(that.imagePath);
                    }, that.msCapture);
                } else {
                    var err = new Error("ERROR\t: capture failed (no camera)");
                    console.log(err);
                    onFail(err);
                }
                return that;
            }
        };
        var MODEL_USB0 = {
            camera: "USB0",
            width: 640, // device may have minimum width (e.g., 320)
            height: 480, // device may have minimum height (e.g., 180)
            source: "/dev/video0",
            imageDir: "/var/img",
            imageName: "usb0.jpeg",
            isAvailable: function() {
                var that = this;
                console.log("INFO\t: Camera() checking for " + that.source);
                var result = child_process.execSync('ls ' + that.source);
                return !(result.error instanceof Error);
            },
            apply: function() {
                var that = this;
                that.imagePath = path.join(that.imageDir, that.imageName);
                console.log("INFO\t: Camera() accessing " + that.source);
                return true;
            },
            capture: function(onSuccess, onFail) {
                var that = this;
                var cmd ="streamer -q"
                   + " -c " + that.source 
                   + " -s " + that.width + "x" + that.height 
                   + " -o " + that.imagePath;
                //console.log("TRACE\t: " + cmd);
                var result = child_process.execSync(cmd);
                if (result instanceof Error) {
                    console.log(err);
                    onFail(err);
                } else {
                    onSuccess(that.imagePath);
                }
                return that;
            }
        };
        var models = [
            MODEL_RASPISTILL,
            MODEL_USB0,
            MODEL_NONE,
        ];
        var model;

        ////////////////// constructor
        function Camera(options) {
            var that = this;
            options = options || {};
            for (var i=0; i<models.length; i++) {
                if (options.camera === models[i].camera) {
                    model = models[i];
                    break;
                }
            }
            if (!model) { // auto-discovery
                model = MODEL_NONE;
                for (var i=0; i<models.length; i++) {
                    if (models[i].isAvailable()) {
                        model = models[i];
                        break;
                    }
                }
            }

            model.apply();
            return that;
        }

        Camera.prototype.model = function() {
            var that = this;
            return model;
        }

        Camera.prototype.capture = function(onSuccess, onFail) {
            return model.capture(onSuccess, onFail);
        }
        return Camera;
    })();
    firepick.Camera = Camera;
})(firepick);

module.exports.Camera = firepick.Camera;

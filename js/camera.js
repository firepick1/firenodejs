console.log("INFO\t: loading Camera");
var child_process = require('child_process');
var path = require("path");

var firepick = firepick || {};

var ModelNone = (function() {
    function ModelNone(options) {
        var that = this;
        that.camera = "UNAVAILABLE";

        ModelNone.prototype.whenAvailable = function(onAvail) { }
        ModelNone.prototype.apply = function() {
            console.log("WARN\t: Camera() no camera found");
            return false;
        },
        ModelNone.prototype.capture = function(onSuccess, onFail) {
            onFail(new Error("Camera unavailable"));
        }
    }
    return ModelNone;
})();

var ModelRaspistill = (function() {
    function ModelRaspistill(options) {
        var that = this;
        that.camera = "raspistill";
        that.width = 400;
        that.height = 400;
        that.source = "raspistill";
        that.exposure = "snow";
        that.awb = "fluorescent";
        that.ev = 12; // exposure compensation for white background (paper)
        that.imageDir = "/var/img";
        that.imageName = "image.jpg";
        that.msCapture = 350; // milliseconds to wait for capture
        return that;
    }
    ModelRaspistill.prototype.whenAvailable = function(onAvail) {
        var that = this;
        console.log("INFO\t: Camera() checking for " + that.source);
        var result = child_process.exec('raspistill --help', function(error, stdout, stderr) {
            if (!error) {
                onAvail();
            }
        });
    },
    ModelRaspistill.prototype.apply = function() {
        var that = this;
        that.imagePath = path.join(that.imageDir, that.imageName);
        console.log("INFO\t: Camera() launching raspistill process");
        that.raspistill = child_process.spawn('raspistill', [
            '-w', that.width,
            '-h', that.height,
            '-ex', that.exposure,
            '-awb', that.awb,
            '-ev', that.ev,
            '-t', 0,
            '-s', 
            '-o', that.imagePath]);
        that.raspistill.on('error', function(data) {
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
    ModelRaspistill.prototype.capture = function(onSuccess, onFail) {
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
    return ModelRaspistill;
})();

var ModelUSB = (function() {
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
        var cmd ="streamer -q"
           + " -c " + that.source 
           + " -s " + that.width + "x" + that.height 
           + " -o " + that.imagePath;
        function capture_closure() {
            return function(error, stdout, stderr) {
                if (error instanceof Error) {
                    console.log("TRACE\t: FAIL " + cmd + " " + err);
                    onFail(err);
                } else {
                    console.log("TRACE\t: OK " + cmd);
                    onSuccess(that.imagePath);
                }
            }
        }
        child_process.exec(cmd, capture_closure());
        return that;
    }
    return ModelUSB;
})();

(function(firepick) {
    var Camera = (function() {
        ///////////////////////// private instance variables
        var models = [
            new ModelUSB(1), 
            new ModelRaspistill(), 
            new ModelUSB(0), 
        ];

        ////////////////// constructor
        function Camera(options) {
            var that = this;
            options = options || {};
            for (var i=0; i<models.length; i++) {
                if (options.camera === models[i].camera) {
                    that.model = models[i];
                    break;
                }
            }
            if (!that.model) { // auto-discovery
                that.model = new ModelNone();
                function onAvail_closure(i) {
                    return function() {
                        //console.log("models" + models + " i:" + i + " " + models[i].camera);
                        that.model = models[i];
                        console.log("INFO\t: Camera() found:" + that.model.camera);
                        that.model.apply();
                    }
                };
                for (var i=0; i<models.length; i++) {
                    models[i].whenAvailable(onAvail_closure(i));
                }
            }

            return that;
        }

        Camera.prototype.getModel = function() {
            var that = this;
            return that.model;
        }

        Camera.prototype.capture = function(onSuccess, onFail) {
            var that = this;
            return that.model.capture(onSuccess, onFail);
        }
        return Camera;
    })();
    firepick.Camera = Camera;
})(firepick);

module.exports.Camera = firepick.Camera;

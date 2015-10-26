console.log("loading Camera");
var child_process = require('child_process');
var path = require("path");

var firepick = firepick || {};
(function(firepick) {
    var Camera = (function() {
        ///////////////////////// private instance variables
        var raspistill;
        var model = {
            camera: "UNAVAILABLE",
            width: 400,
            height: 400,
            exposure: "snow",
            awb: "fluorescent",
            ev: 12, // exposure compensation for white background (paper)
            imageDir: "/var/img",
            imageName: "image.jpg",
            msCapture: 300, // milliseconds to wait for capture
        };

        ////////////////// constructor
        function Camera(options) {
            var that = this;
            options = options || {};

            var imagePath = path.join(model.imageDir, model.imageName);
            console.log("INFO\t: Camera() launching raspistill process");
            model.camera = "raspistill";
            raspistill = child_process.spawn('raspistill', [
                '-w', model.width,
                '-h', model.height,
                '-ex', model.exposure,
                '-awb', model.awb,
                '-ev', model.ev,
                '-t', 0,
                '-s', 
                '-o', imagePath]);
            raspistill.on('error', function(data) {
                model.camera = "UNAVAILABLE";
                console.log("INFO\t: raspistill unvailable:" + data);
            });
            raspistill.on('close', function() {
                console.log("INFO\t: closing raspistill process");
            });
            raspistill.stdout.on('data', function(buffer) {
                console.log("STDOUT\t: " + buffer);
            });
            raspistill.stderr.on('data', function(buffer) {
                console.log("STDERR\t: " + buffer);
            });
            console.log("INFO\t: spawned raspistill pid:" + raspistill.pid);
            return that;
        }

        Camera.prototype.model = function() {
            var that = this;
            return model;
        }

        Camera.prototype.capture = function(onSuccess, onFail) {
            var that = this;
            if (raspistill) {
                var cmd = child_process.exec('kill -SIGUSR1 ' + raspistill.pid, function(error, stdout, stderr) {
                    if (error) {
                        onFail(new Error('Could not send signal to raspistill pid:' + raspistill.pid));
                    } else {
                        var imagePath = path.join(model.imageDir, model.imageName);
                        setTimeout(function() {
                            onSuccess(imagePath);
                        }, model.msCapture);
                    }
                });
            } else {
                var err = new Error("ERROR\t: capture failed (no camera)");
                console.log(err);
                onFail(err);
            }
            return that;
        }
        return Camera;
    })();
    firepick.Camera = Camera;
})(firepick);

module.exports.Camera = firepick.Camera;

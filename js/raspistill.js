console.log("INFO\t: loading ModelRaspistill");
var child_process = require('child_process');
var path = require("path");

module.exports.ModelRaspistill = (function() {

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
    }
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
            '-o', that.imagePath
        ]);
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
    }
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

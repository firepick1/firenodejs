//console.log("INFO\t: loading CamRaspistill");
var child_process = require('child_process');
var path = require("path");

module.exports.CamRaspistill = (function() {

    function CamRaspistill(options) {
        var that = this;
        that.name = "raspistill";
        that.width = 400;
        that.height = 400;
        that.source = "raspistill";
        that.exposure = "snow";
        that.awb = "fluorescent";
        that.ev = 12; // exposure compensation for white background (paper)
        that.imageDir = "/var/img";
        that.imageName = "image.jpg";
        that.msCapture = 400; // milliseconds to wait for capture
        that.available = null;
        return that;
    }
    CamRaspistill.prototype.isAvailable = function() {
        var that = this;
        if (!that.raspistillProcess && that.onAvail) {
            that.whenAvailable(that.onAvail);
        }
        return that.available;
    };
    CamRaspistill.prototype.syncModel = function() {
        var that = this;
        return {
            name: that.name,
            width: that.width,
            height: that.height,
            source: that.source,
            exposure: that.exposure,
            awb: that.awb,
            ev: that.ev,
            msCapture: that.msCapture,
            available: that.available,
        };
    }
    CamRaspistill.prototype.whenAvailable = function(onAvail) {
        var that = this;
        console.log("INFO\t: Camera() checking for " + that.source);
        var result = child_process.exec('raspistill --help 2>&1 | grep "usage: raspistill"', function(error, stdout, stderr) {
            if (error) {
                console.log("WARN\t: Camera() raspistill unavailable:" + error);
                console.log("\t: " + stderr);
            } else {
                console.log("INFO\t: Camera() raspistill is available");
                that.available = true;
                that.onAvail = onAvail;
                that.onAvail();
                that.attach();
            }
        });
    }
    CamRaspistill.prototype.attach = function() {
        var that = this;
        that.imagePath = path.join(that.imageDir, that.imageName);
        console.log("INFO\t: Camera() launching raspistill process");
        that.raspistillProcess = child_process.spawn('raspistill', [
            '-w', that.width,
            '-h', that.height,
            '-ex', that.exposure,
            '-awb', that.awb,
            '-ev', that.ev,
            '-t', 0,
            '-s',
            '-o', that.imagePath
        ]);
        that.raspistillProcess.on('error', function(data) {
            console.log("INFO\t: raspistill unvailable:" + data);
            that.raspistillProcess = null;
        });
        that.raspistillProcess.on('close', function() {
            console.log("INFO\t: closing raspistill process");
            that.raspistillProcess = null;
        });
        that.raspistillProcess.stdout.on('data', function(buffer) {
            console.log("STDOUT\t: " + buffer);
        });
        that.raspistillProcess.stderr.on('data', function(buffer) {
            console.log("STDERR\t: " + buffer);
        });
        console.log("INFO\t: spawned raspistill pid:" + that.raspistillProcess.pid);
        return that;
    }
    CamRaspistill.prototype.capture = function(onSuccess, onFail) {
        var that = this;
        if (that.raspistillProcess) {
            that.capturing = true;
            that.raspistillProcess.kill('SIGUSR1');
            setTimeout(function() {
                that.capturing = false;
                onSuccess(that.imagePath);
            }, that.msCapture);
        } else {
            that.capturing = false;
            var err = new Error(that.name + " capture failed (unavailable)");
            onFail(err);
        }
        return that;
    }
    return CamRaspistill;

})();

//console.log("INFO\t: loading CamRaspistill");
var child_process = require('child_process');
var path = require("path");
var Logger = require("../www/js/shared/Logger");

(function(exports) {

    function CamRaspistill(options) {
        var that = this;
        options = options || {};
        that.name = "raspistill";
        that.verbose = options.verbose;
        that.width = options.imageWidth || 400;
        that.height = options.imageHeight || 400;
        that.source = "raspistill";
        that.exposure = "snow";
        that.awb = "fluorescent";
        that.ev = 12; // exposure compensation for white background (paper)
        that.imageDir = "/var/img";
        that.imageName = "image.jpg";
        that.msCapture = options.msCapture || 400; // milliseconds to wait for capture
        that.available = null;
        return that;
    }
    CamRaspistill.prototype.isAvailable = function() {
        var that = this;
        if (!that.raspistillProcess && that.onAvail) {
            that.whenAvailable(that.onAvail);
        }
        return that.available === true;
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
        that.verbose && console.log("INFO\t: CamRaspistill() checking for " + that.source);
        var result = child_process.exec('raspistill --help 2>&1 | grep "usage: raspistill"', function(error, stdout, stderr) {
            if (error) {
                that.verbose && console.log("INFO\t: Camera() raspistill unavailable");
                that.verbose && console.log("DEBUG\t: " + error);
                that.verbose && console.log("DEBUG\t: " + stderr);
            } else {
                Logger.start("CamRaspistill() raspistill is available");
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
        Logger.start("CamRaspistill() launching raspistill process");
        that.raspistillProcess = child_process.spawn('raspistill', [
            '-w', that.width,
            '-h', that.height,
			'-vf', // vertical flip
			'-hf', // horizontal flip
            '-ex', that.exposure,
            '-awb', that.awb, // average white balance
            '-ev', that.ev,
            '-t', 0, // elapsed time
            '-s',
            '-o', that.imagePath
        ]);
        that.raspistillProcess.on('error', function(data) {
            Logger.start("CamRaspistill: raspistill unvailable:" + data);
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
        Logger.start("CamRaspistill: spawned raspistill pid:" + that.raspistillProcess.pid);
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
    module.exports = exports.CamRaspistill = CamRaspistill;
})(typeof exports === "object" ? exports : (exports = {}));

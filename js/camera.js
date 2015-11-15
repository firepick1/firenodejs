//console.log("INFO\t: loading Camera");
var child_process = require('child_process');
var path = require("path");
var CamRaspistill = require("./raspistill").CamRaspistill;
var CamVideo = require("./video").CamVideo;

var CamNone = (function() {
    function CamNone(options) {
        var that = this;
        that.name = "UNAVAILABLE";

        CamNone.prototype.isAvailable = function() {
            return false;
        };
        CamNone.prototype.syncModel = function() {
            var that = this;
            return {
                name: that.name,
                available: false,
            };
        };
        CamNone.prototype.whenAvailable = function(onAvail) {}
        CamNone.prototype.capture = function(onSuccess, onFail) {
            onFail(new Error("Camera unavailable"));
        }
    }
    return CamNone;
})();

module.exports.Camera = (function() {
    ///////////////////////// private instance variables
    var noCam = new CamNone();

    ////////////////// constructor
    function Camera(options) {
        var that = this;
        options = options || {};
        var priority = [new CamVideo(1), new CamRaspistill(), new CamVideo(0)];
        that.availCameras = {};
        that.selected = "default";
        for (var i = 0; i < priority.length; i++) {
            that.availCameras[priority[i].name] = priority[i];
            if (options.name === priority[i].name) {
                that.camDefault = priority[i];
                that.availCameras.default = that.camDefault;
            }
        }
        if (!that.camDefault) { // auto-discovery
            that.camDefault = noCam;

            function onAvail_closure(i) {
                return function() {
                    that.camDefault = priority[i];
                    that.availCameras[that.camDefault.name] = that.camDefault;
                    that.availCameras.default = that.camDefault;
                    console.log("INFO\t: Camera() found:" + that.camDefault.name);
                }
            };
            for (var i = 0; i < priority.length; i++) {
                priority[i].whenAvailable(onAvail_closure(i));
            }
        }

        return that;
    }

    Camera.prototype.syncModel = function(name) {
        var that = this;
        var cam = that.camDefault;
        if (name) {
            cam = that.availCameras.hasOwnProperty(name) ? that.availCameras[name] : noCam;
        }
        return cam.syncModel();
    }

    Camera.prototype.isAvailable = function(name) {
        var that = this;
        return that.syncModel(name).available;
    }

    Camera.prototype.capture = function(name, onSuccess, onFail) {
        var that = this;
        var cam = that.availCameras[name];

        if (!cam) {
            onFail(new Error("unknown camera name:" + name, Object.keys(that.availCameras)));
        } else if (!cam.isAvailable()) {
            onFail(new Error("camera unavailable::" + name));
        } else {
            if (cam.capturing) {
                setTimeout(function() {
                    if (cam.capturing) {
                        onFail(new Error("camera is busy:" + name));
                    } else {
                        onSuccess(cam.imagePath);
                    }
                }, cam.msCapture);
            } else {
                cam.capture(onSuccess, onFail);
            }
        }
    }

    return Camera;
})();

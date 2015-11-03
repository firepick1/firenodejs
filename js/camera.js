console.log("INFO\t: loading Camera");
var child_process = require('child_process');
var path = require("path");
var ModelRaspistill = require("./raspistill").ModelRaspistill;
var ModelVideo = require("./video").ModelVideo;

var ModelNone = (function() {
    function ModelNone(options) {
        var that = this;
        that.camera = "UNAVAILABLE";

        ModelNone.prototype.isAvailable = function() {
            return false;
        };
        ModelNone.prototype.whenAvailable = function(onAvail) {}
        ModelNone.prototype.capture = function(onSuccess, onFail) {
            onFail(new Error("Camera unavailable"));
        }
    }
    return ModelNone;
})();

module.exports.Camera = (function() {
    ///////////////////////// private instance variables
    var noModel = new ModelNone();

    ////////////////// constructor
    function Camera(options) {
        var that = this;
        options = options || {};
        var priority = [new ModelVideo(1), new ModelRaspistill(), new ModelVideo(0)];
        that.models = {};
        for (var i = 0; i < priority.length; i++) {
            that.models[priority[i].camera] = priority[i];
            if (options.camera === priority[i].camera) {
                that.model = priority[i];
                that.models.default = that.model;
            }
        }
        if (!that.model) { // auto-discovery
            that.model = new ModelNone();

            function onAvail_closure(i) {
                return function() {
                    that.model = priority[i];
                    that.models.default = that.model;
                    console.log("INFO\t: Camera() found:" + that.model.camera);
                }
            };
            for (var i = 0; i < priority.length; i++) {
                priority[i].whenAvailable(onAvail_closure(i));
            }
        }

        return that;
    }

    Camera.prototype.getModel = function() {
        var that = this;
        return that.model;
    }

    Camera.prototype.capture = function(camera, onSuccess, onFail) {
        var that = this;
        var model = that.models.hasOwnProperty(camera) ? that.models[camera] : noModel;

        if (model && model.isAvailable) {
            if (model.capturing) {
                setTimeout(function() {
                    if (model.capturing) {
                        onFail(new Error("camera is busy:" + camera));
                    } else {
                        onSuccess(model.imagePath);
                    }
                }, model.msCapture);
            } else if (!model.isAvailable) {
                onFail(new Error("camera is not available:" + camera));
            } else {
                model.capture(onSuccess, onFail);
            }
        } else {
            onFail(new Error("unknown camera " + camera, that.models.keys()));
        }
    }
    return Camera;
})();

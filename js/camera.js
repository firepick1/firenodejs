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
    var modelVideo1 = new ModelVideo(1);
    var modelVideo0 = new ModelVideo(0);
    var modelRaspistill = new ModelRaspistill();
    var models = [modelVideo1, modelRaspistill, modelVideo0];

    ////////////////// constructor
    function Camera(options) {
        var that = this;
        options = options || {};
        for (var i = 0; i < models.length; i++) {
            if (options.camera === models[i].camera) {
                that.model = models[i];
                break;
            }
        }
        if (!that.model) { // auto-discovery
            that.model = new ModelNone();

            function onAvail_closure(i) {
                return function() {
                    that.model = models[i];
                    console.log("INFO\t: Camera() found:" + that.model.camera);
                }
            };
            for (var i = 0; i < models.length; i++) {
                models[i].whenAvailable(onAvail_closure(i));
            }
        }

        return that;
    }

    Camera.prototype.getModel = function() {
        var that = this;
        return that.model;
    }

    Camera.prototype.capture = function(onSuccess, onFail, camera) {
        var that = this;
        var model;

        if (camera === modelRaspistill.camera) {
            model = modelRaspistill;
        } else if (camera === modelVideo0.camera) {
            model = modelVideo0;
        } else if (camera === modelVideo1.camera) {
            model = modelVideo1;
        } else if (!camera || camera === "default") {
            model = that.model;
        }
        if (model) {
            if (model.capturing) {
                setTimeout(function() {
                    if (model.capturing) {
                        onFail(new Error("camera is busy:" + camera));
                    } else {
                        onSuccess(model.imagePath);
                    }
                }, model.msCapture);
            } else if (!model.isAvailable()) {
                onFail(new Error("camera is not available:" + camera));
            } else {
                model.capture(onSuccess, onFail);
            }
        } else {
            onFail(new Error("unknown camera:" + camera));
        }
    }
    return Camera;
})();

console.log("INFO\t: loading Camera");
var child_process = require('child_process');
var path = require("path");
var ModelRaspistill = require("./raspistill").ModelRaspistill;
var ModelVideo = require("./video").ModelVideo;

var ModelNone = (function() {
    function ModelNone(options) {
        var that = this;
        that.name = "UNAVAILABLE";

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
        that.selected = "default";
        for (var i = 0; i < priority.length; i++) {
            that.models[priority[i].name] = priority[i];
            if (options.name === priority[i].name) {
                that.model = priority[i];
                that.models.default = that.model;
            }
        }
        if (!that.model) { // auto-discovery
            that.model = new ModelNone();

            function onAvail_closure(i) {
                return function() {
                    that.model = priority[i];
                    that.models[that.model.name] = that.model;
                    that.models.default = that.model;
                    console.log("INFO\t: Camera() found:" + that.model.name);
                }
            };
            for (var i = 0; i < priority.length; i++) {
                priority[i].whenAvailable(onAvail_closure(i));
            }
        }

        return that;
    }

    Camera.prototype.getModel = function(name) {
        var that = this;
        var model = that.model;
        if (name) {
            model = that.models.hasOwnProperty(name) ? that.models[name] : null;
        }
        return model;
    }

    Camera.prototype.isAvailable = function(name) {
        var that = this;
        return that.getModel(name).isAvailable();
    }

    Camera.prototype.capture = function(name, onSuccess, onFail) {
        var that = this;
        var model = that.getModel(name);

        if (!model) {
            onFail(new Error("unknown camera name:" + name, Object.keys(that.models)));
        } else if (!model.isAvailable) {
            onFail(new Error("camera availability unknown:" + name));
        } else if (!model.isAvailable()) {
            onFail(new Error("camera unavailable::" + name));
        } else {
            if (model.capturing) {
                setTimeout(function() {
                    if (model.capturing) {
                        onFail(new Error("camera is busy:" + name));
                    } else {
                        onSuccess(model.imagePath);
                    }
                }, model.msCapture);
            } else {
                model.capture(onSuccess, onFail);
            }
        }
    }

    return Camera;
})();

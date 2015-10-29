console.log("INFO\t: loading Camera");
var child_process = require('child_process');
var path = require("path");
var ModelRaspistill = require("./raspistill").ModelRaspistill;
var ModelUSB = require("./usbcam").ModelUSB;

var ModelNone = (function() {
    function ModelNone(options) {
        var that = this;
        that.camera = "UNAVAILABLE";

        ModelNone.prototype.whenAvailable = function(onAvail) {}
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

module.exports.Camera = (function() {
    ///////////////////////// private instance variables
    var modelUSB1 = new ModelUSB(1);
    var modelUSB0 = new ModelUSB(0);
    var modelRaspistill = new ModelRaspistill();
    var models = [modelUSB1, modelRaspistill, modelUSB0];

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
                    //console.log("models" + models + " i:" + i + " " + models[i].camera);
                    that.model = models[i];
                    console.log("INFO\t: Camera() found:" + that.model.camera);
                    that.model.apply();
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

        // check for specific camera
        if (camera === modelRaspistill.camera) {
            return modelRaspistill.capture(onSuccess, onFail);
        } 
        if (camera === modelUSB0.camera) {
            return modelUSB0.capture(onSuccess, onFail);
        } 
        if (camera === modelUSB1.camera) {
            return modelUSB1.capture(onSuccess, onFail);
        } 

        // return discovered camera
        if (!camera) {
            return that.model.capture(onSuccess, onFail);
        }
        onFail(new Error("unknown camera:" + camera));
    }
    return Camera;
})();

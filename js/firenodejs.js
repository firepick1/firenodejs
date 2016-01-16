var child_process = require('child_process');
var path = require("path");
var fs = require("fs");
var shared = require("../www/js/shared/JsonUtil.js");

(function(exports) {
    ///////////////////////// private instance variables
    var started = new Date();

    ////////////////// constructor
    function firenodejs(images, firesight, measure, mesh_rest, firekue_rest, options) {
        var that = this;

        options = options || {};

        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.measure = measure) == null) throw new Error("measure is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;
        if ((that.mesh_rest = mesh_rest) == null) throw new Error("mesh_rest is required");;
        if ((that.firekue_rest = firekue_rest) == null) throw new Error("firekue_rest is required");;
        that.verbose = options.verbose;
        that.modelPath = options.modelPath || '/var/firenodejs/firenodejs.json';
        that.model = {};
        that.version = options.version;
        that.models = {
            firestep: that.firestep.model,
            images: that.images.model,
            firesight: that.firesight.model,
            measure: that.measure.model,
            mesh: that.mesh_rest.model,
            firekue_rest: that.firekue_rest.model,
            camera: that.camera.syncModel(),
            firenodejs: that.model,
        };
        that.services = {
            firestep: that.firestep,
            images: that.images,
            firesight: that.firesight,
            measure: that.measure,
            mesh: that.mesh_rest,
            firekue_rest: that.firekue_rest,
            camera: that.camera,
            firenodejs: that,
        };
        try {
            console.log("INFO\t: loading existing firenodejs model from:" + that.modelPath);
            var models = JSON.parse(fs.readFileSync(that.modelPath));
            that.syncModels(models);
        } catch (e) {
            if (e.code === 'ENOENT') {
                console.log("INFO\t: created new firenodejs model archival file:" + that.modelPath);
            } else {
                var msg = "Could not read saved firenodejs file:" + e.message;
                console.log("ERROR\t:", msg);
                console.log("TRY\t: Delete file and retry:" + that.modelPath);
                throw e;
            }
        }
        console.log("INFO\t: updating " + that.modelPath);
        that.syncModels({
            firenodejs: {
                started: started.toString()
            }
        });

        return that;
    }

    firenodejs.prototype.syncModels = function(delta) {
        var that = this;
        if (delta) {
            var keys = Object.keys(delta);
            for (var i = keys.length; i-- > 0;) {
                var key = keys[i];
                if (that.services.hasOwnProperty(key)) {
                    var svc = that.services[key];
                    var serviceDelta = delta[key];
                    if (serviceDelta) {
                        if (typeof svc.syncModel === "function") {
                            that.verbose && console.log("INFO\t: firenodejs.syncModels() delegate sync:" + key, JSON.stringify(serviceDelta));
                            svc.syncModel(serviceDelta);
                        } else {
                            that.verbose && console.log("INFO\t: firenodejs.syncModels() default sync:" + key, JSON.stringify(serviceDelta));
                            if (svc.model) {
                                shared.applyJson(svc.model, serviceDelta);
                            }
                        }
                    }
                }
            }
            that.model.version = JSON.parse(JSON.stringify(that.version));
            fs.writeFile(that.modelPath, JSON.stringify(that.models, null, '  ')+"\n", function(err) {
                if (err instanceof Error) {
                    console.log("WARN\t: could not write " + that.modelPath, err);
                }
            });
        }
        var now = new Date();
        var msElapsed = now.getTime() - started.getTime();
        that.model.uptime = msElapsed / 1000;
        return that.models;
    }
    firenodejs.prototype.isAvailable = function() {
        var that = this;
        var result = false;
        result = result || that.camera.isAvailable();
        result = result || that.firestep.isAvailable();
        result = result || that.images.isAvailable();
        result = result || that.firesight.isAvailable();
        result = result || that.measure.isAvailable();
        result = result || that.mesh_rest.isAvailable();
        result = result || that.firekue_rest.isAvailable();
        return result;
    }

    module.exports = exports.firenodejs = firenodejs;
})(typeof exports === "object" ? exports : (exports = {}));

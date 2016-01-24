var child_process = require('child_process');
var path = require("path");
var fs = require("fs");
var JsonUtil = require("../www/js/shared/JsonUtil.js");

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
            if (that.upgradeModels(models)) {
                var s = JSON.stringify(models, null, '  ') + '\n';
                fs.writeFile("/tmp/foo1", s);
                fs.writeFile("/tmp/foo2", s, function(err) {
                    if (err instanceof Error) {
                        console.log("WARN\t: could not write " + that.modelPath, err);
                    }
                });
                fs.writeFile(that.modelPath, s, function(err) {
                    if (err instanceof Error) {
                        console.log("WARN\t: could not write " + that.modelPath, err);
                    }
                });
            }
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

    firenodejs.prototype.upgradeModels_0_11 = function(models) {
        console.log("INFO\t: Upgrading firestep model to 0.11");
        if (models.firestep.rest.hasOwnProperty("startup")) {
            // Startup initialization replaced by beforeReset string
            if (!JsonUtil.isEmpty(models.firestep.rest.startup)) {
                try {
                    var br = JSON.parse(models.firestep.rest.startup.json);
                    if (br instanceof Array) {
                        if (br.length > 0 && br[br.length - 1].hasOwnProperty("mpo")) {
                            br = br.slice(0, br.length - 1);
                        }
                        if (br.length > 0 && br[br.length - 1].hasOwnProperty("hom")) {
                            br = br.slice(0, br.length - 1);
                        }
                    }
                    models.firestep.rest.beforeReset = br;
                    upgraded = true;
                } catch (e) {
                    // ignore invalid json
                }
            }
            delete models.firestep.rest.startup;
        }

        // presentation info should not be archived
        var marks = models.firestep.rest.marks;
        for (var i = 0; i < marks.length; i++) {
            var mark = marks[i];
            delete mark.title;
            delete mark.icon;
            delete mark.class;
        }

        models.firenodejs.version = {
            major: 0,
            minor: 11,
            patch: 0
        };
    }

    firenodejs.prototype.upgradeModels = function(models) {
        var that = this;
        var upgraded = false;
        var version = models.firenodejs.version;
        var vMajMin = Number(version.major + "." + version.minor);
        vMajMin < 0.11 && that.upgradeModels_0_11(models);
        return upgraded;
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
                                JsonUtil.applyJson(svc.model, serviceDelta);
                            }
                        }
                    }
                }
            }
            that.model.version = JSON.parse(JSON.stringify(that.version));
            var s = JSON.stringify(that.models, null, '  ') + '\n';
            fs.writeFile(that.modelPath, s, function(err) {
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

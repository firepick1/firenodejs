const EventEmitter = require('events');
const util = require('util');

var child_process = require('child_process');
var path = require("path");
var fs = require("fs");
var JsonUtil = require("../www/js/shared/JsonUtil");
var Synchronizer = require("../www/js/shared/Synchronizer");

(function(exports) {
    ///////////////////////// private instance variables
    var started = new Date();

    ////////////////// constructor
    function firenodejs(images, firesight, measure, mesh_rest, firekue_rest, options) {
        var that = this;
        EventEmitter.call(that);
        util.inherits(that.constructor, EventEmitter);

        options = options || {};

        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.measure = measure) == null) throw new Error("measure is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;
        if ((that.mesh_rest = mesh_rest) == null) throw new Error("mesh_rest is required");;
        if ((that.firekue_rest = firekue_rest) == null) throw new Error("firekue_rest is required");;
        that.verbose = options.verbose;
        that.port = options.port || 80;
        that.modelPath = options.modelPath || '/var/firenodejs/firenodejs.json';
        that.model = {
            started: started.toString(),
        };
        that.version = options.version;
        that.models = {
            age: 0,
            firestep: that.firestep.model,
            images: that.images.model,
            firesight: that.firesight.model,
            measure: that.measure.model,
            mesh: that.mesh_rest.model,
            firekue_rest: that.firekue_rest.model,
            camera: that.camera.syncModel(),
            firenodejs: that.model,
        };
        that.synchronizer = new Synchronizer(that.models);
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
            var savedModels = JSON.parse(fs.readFileSync(that.modelPath));
            var bakPath = that.modelPath + ".bak";
            console.log("INFO\t: saving backup model age:" + savedModels.age, "path:", bakPath);
            // since we successfully read the JSON file and parsed it, we can save it as a valid backup
            that.saveModels(bakPath, savedModels, function() {
                if (that.upgradeModels(savedModels)) {
                    console.log("INFO\t: upgraded saved model age:", savedModels.age);
                }
                console.log("before syncModel savedage:", savedModels.age, " age:", that.models.age);
                that.updateModels(savedModels);
                console.log("after syncModel savedage:", savedModels.age, " age:", that.models.age);
                that.emit("firenodejsSaveModels");
                that.synchronizer.rebase();
            });
        } catch (e) {
            if (e.code === 'ENOENT') {
                console.log("INFO\t: created new firenodejs model archival file:" + that.modelPath);
            } else {
                var msg = "Could not read saved firenodejs file:" + e.message;
                console.log("ERROR\t:", msg);
                try {
                    var bakPath = that.modelPath + ".bak";
                    console.log("INFO\t: attempting to restore from backup:", bakPath);
                    var models = JSON.parse(fs.readFileSync(bakPath));
                    if (that.upgradeModels(models)) {
                        console.log("upgradeModelsB age:", that.models.age);
                        that.saveModels(that.modelPath, models);
                    }
                    that.updateModels(models);
                    that.synchronizer.rebase();
                } catch (e) {
                    console.log("ERROR\t: Could not read firenodejs backup file.");
                    console.log("TRY\t: Delete file and retry:" + that.modelPath);
                    throw e;
                }
            }
        }
        //console.log("INFO\t: updating " + that.modelPath);
        //that.updateModels({
        //age: that.model.age,
        //firenodejs: {
        //started: started.toString()
        //}
        //});

        ///////////// Events
        that.saveRequests = 0;
        that.on("firenodejsSaveModels", function() {
            that.saveRequests++;
            console.log("INFO\t: on(firenodejsSaveModels) saveRequests:", that.saveRequests);
            setTimeout(function() {
                if (that.saveRequests) {
                    console.log("event age:", that.models.age);
                    that.saveModels(that.modelPath, that.models);
                    that.saveRequests = 0;
                }
            }, 1000); // throttle saves to this frequency
        });

        return that;
    }
    firenodejs.prototype.saveModels = function(path, models, callback) {
        var that = this;
        path = path || that.modelPath;
        var s = JSON.stringify(models, null, '  ') + '\n';
        fs.writeFile(path, s, function(err) {
            if (err instanceof Error) {
                console.log("ERROR\t: could not write " + path, err);
                throw err;
            }
            console.log("INFO\t: firenodejs.saveModels() age:" + that.models.age, "bytes:" + s.length, "path:" + path);
            callback != null && callback();
        });
        return s;
    }
    firenodejs.prototype.setPort = function(port) {
        var that = this;
        that.port = port;
        that.services.firekue_rest.setPort(port);
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

    firenodejs.prototype.sync = function(syncMsgIn, res) {
        var that = this;
        var syncMsgOut = that.synchronizer.sync(syncMsgIn); 
        res && res.status(200);
        return syncMsgOut;
    }
    firenodejs.prototype.updateModels = function(delta, res) {
        var that = this;
        if (delta.age != null && delta.age >= that.models.age || that.models.age === 0) {
            var keys = Object.keys(delta);
            that.models.age = delta.age || that.models.age || 1;
            for (var i = keys.length; i-- > 0;) {
                var key = keys[i];
                if (that.services.hasOwnProperty(key)) {
                    var svc = that.services[key];
                    var serviceDelta = delta[key];
                    if (serviceDelta) {
                        if (typeof svc.syncModel === "function") {
                            that.verbose &&
                                console.log("INFO\t: firenodejs.updateModels() delegate sync:" + key, JSON.stringify(serviceDelta));
                            svc.syncModel(serviceDelta);
                        } else {
                            that.verbose &&
                                console.log("INFO\t: firenodejs.updateModels() default sync:" + key, JSON.stringify(serviceDelta));
                            if (svc.model) {
                                JsonUtil.applyJson(svc.model, serviceDelta);
                            }
                        }
                    }
                }
            }
            that.model.version = JSON.parse(JSON.stringify(that.version));
            that.emit("firenodejsSaveModels");
            res && res.status(200);
        } else {
            console.log("INFO\t: firenodjs.updateModels() ignoring stale delta:", JsonUtil.summarize(delta), " age:", that.models.age, " delta.age:", delta.age);
            res && res.status(205);
        }
        var now = new Date();
        var msElapsed = now.getTime() - started.getTime();
        that.model.uptime = msElapsed / 1000;
        return that.models;
    }
    firenodejs.prototype.getModels = function(res) {
        var that = this;
        // By incrementing the age, we ensure that all other clients updates will be ignored
        // This is a cheap way to address multiple updates: updates to stale data are ignored
        that.models.age++;
        var now = new Date();
        var msElapsed = now.getTime() - started.getTime();
        that.model.uptime = msElapsed / 1000;
        res.status(200);
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

var child_process = require('child_process');
var path = require("path");
var fs = require("fs");
var JsonUtil = require("../www/js/shared/JsonUtil");
var Logger = require("../www/js/shared/Logger");
var Synchronizer = require("../www/js/shared/Synchronizer");

(function(exports) {
    ///////////////////////// private instance variables
    var started = new Date();

    ////////////////// constructor
    function firenodejs(
        images, position, firesight, measure, mesh_rest, firekue_rest, pcb, firepaste,
        options) {
        var that = this;

        options = options || {};

        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.measure = measure) == null) throw new Error("measure is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.position = position) == null) throw new Error("position service is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");
        if ((that.mesh_rest = mesh_rest) == null) throw new Error("mesh_rest is required");
        if ((that.firekue_rest = firekue_rest) == null) throw new Error("firekue_rest is required");
        if ((that.pcb = pcb) == null) throw new Error("pcb is required");
        if ((that.firepaste = firepaste) == null) throw new Error("firepaste is required");
        that.verbose = options.verbose;
        that.port = options.port || 80;
        that.modelPath = options.modelPath || '/var/firenodejs/firenodejs.json';
        that.serviceBus = options.serviceBus;
        that.serviceBus.onBeforeRestore(function(savedModel) {
            delete savedModel.firenodejs.shell;
        });
        that.model = {
            started: started.toString(),
        };
        that.version = options.version;
        that.models = {
            position: that.position.model,
            images: that.images.model,
            firesight: that.firesight.model,
            measure: that.measure.model,
            mesh: that.mesh_rest.model,
            firekue_rest: that.firekue_rest.model,
            camera: that.camera.syncModel(),
            pcb: that.pcb.model,
            firepaste: that.firepaste.model,
            firenodejs: that.model,
        };
        that.restSync = options.restSync;
        that.synchronizer = new Synchronizer(that.models, {
            beforeRebase: function() {
                that.serviceBus && that.serviceBus.emitBeforeRebase();
                that.beforeRebase();
                that.model.version = that.version;
            },
            beforeUpdate: function() {
                that.serviceBus && that.serviceBus.emitBeforeUpdate();
            },
            afterUpdate: function() {
                that.serviceBus && that.serviceBus.emitSaveModels();
                that.serviceBus && that.serviceBus.emitAfterUpdate();
            },
        });
        that.restSync.setSynchronizer(that.synchronizer);
        that.services = {
            position: that.position,
            images: that.images,
            firesight: that.firesight,
            measure: that.measure,
            mesh: that.mesh_rest,
            firekue_rest: that.firekue_rest,
            camera: that.camera,
            pcb: that.pcb,
            firepaste: that.firepaste,
            firenodejs: that,
        };
        try {
            Logger.start("firenodejs: loading existing firenodejs model from:" + that.modelPath);
            var savedData = fs.readFileSync(that.modelPath);
            Logger.start("firenodejs: saved JSON model bytes:" + savedData.length);
            var savedModels = JSON.parse(savedData);
            that.serviceBus && that.serviceBus.emitBeforeRestore(savedModels);
            JsonUtil.applyJson(that.models, savedModels);
            that.serviceBus && that.serviceBus.emitAfterRestore(savedModels);
            // since we successfully read saved firenodjes JSON file and parsed it, 
            // we can save it as a valid backup
            var bakPath = that.modelPath + ".bak";
            Logger.start("firenodejs: saving backup model path:", bakPath);
            that.saveModels(bakPath, savedModels, function() {
                if (that.upgradeModels(savedModels)) {
                    Logger.start("firenodejs: upgraded saved model");
                } else {
                    Logger.start("firenodejs: backup saved:", bakPath);
                }
                that.synchronizer.rebase(); // mark model as initialized
                that.serviceBus && that.serviceBus.emitSaveModels();
                Logger.start("firenodejs: initialized and rebased");
            });
        } catch (e) {
            if (e.code === 'ENOENT') {
                that.synchronizer.rebase(); // make model as initialized
                that.saveModels(that.modelPath, that.models, function() {
                    Logger.start("firenodejs: created new firenodejs model archival file:" + that.modelPath);
                });
            } else {
                var msg = "firenodejs: could not read saved file:" + e.message;
                console.log("ERROR\t:", msg);
                try {
                    var bakPath = that.modelPath + ".bak";
                    Logger.start("firenodejs: attempting to restore from backup:", bakPath);
                    var models = JSON.parse(fs.readFileSync(bakPath));
                    if (that.upgradeModels(models)) {
                        Logger.start("firenodejs.upgradeModels()");
                        that.saveModels(that.modelPath, models);
                    }
                    //that.updateModels(models);
                    that.synchronizer.rebase();
                } catch (e) {
                    console.log("ERROR\t: firenodejs: could not read firenodejs backup file.");
                    console.log("TRY\t: Delete file and retry:" + that.modelPath);
                    throw e;
                }
            }
        }

        ///////////// Events
        that.saveRequests = 0;
        that.serviceBus && that.serviceBus.onSaveModels(function() {
            that.saveRequests++;
            Logger.start("firenodejs: on(SaveModels) saveRequests:", that.saveRequests);
            setTimeout(function() {
                if (that.saveRequests) {
                    that.saveModels(that.modelPath, that.models);
                    that.saveRequests = 0;
                }
            }, 1000); // throttle saves to this frequency
        });

        return that;
    }
    firenodejs.prototype.shell = function(req, res) {
            var that = this;
            console.log("INFO\t: firenodejs: shell(" + JSON.stringify(req.body) + ")");
            var cmd;
            var response = {
                cmd: req.body,
            };
            if (req.body.exec === "halt") {
                cmd = "/sbin/shutdown -P now";
                response.msg = "System shutdown";
                that.model.shell = "System shutdown in progress...";
            } else {
                res && res.setStatus(400);
                response.error = "SECURITY VIOLATION";
            }
            var result = child_process.exec(cmd, function(error, stdout, stderr) {
                if (error) {
                    that.model.shell = "firenodejs: shell() failed:" + error.message;
                    console.log("WARN\t:", that.model.shell);
                } else {
                    that.model.shell = "firenodejs: shell() " + stdout + "; " + stderr;
                    console.log("INFO\t: shell(", JSON.stringify(req.body), ") ", stdout);
                }
            });
            return response;
        },
        firenodejs.prototype.saveModels = function(path, models, callback) {
            var that = this;
            path = path || that.modelPath;
            var s = JSON.stringify(models, null, '  ') + '\n';
            //console.log("DEBUG===> saveModels " + JSON.stringify(that.models.position.rest.marks[0]));
            fs.writeFile(path, s, function(err) {
                if (err instanceof Error) {
                    console.log("ERROR\t: firenodejs: could not write " + path, err);
                    throw err;
                }
                that.verbose && console.log("INFO\t: firenodejs.saveModels() bytes:" + s.length, "path:" + path);
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
        Logger.start("firenodejs: upgrading position model to 0.11");
        var position = models.position || models.firestep;
        if (position.rest.hasOwnProperty("startup")) {
            // Startup initialization replaced by beforeReset string
            if (!JsonUtil.isEmpty(position.rest.startup)) {
                try {
                    var br = JSON.parse(position.rest.startup.json);
                    if (br instanceof Array) {
                        if (br.length > 0 && br[br.length - 1].hasOwnProperty("mpo")) {
                            br = br.slice(0, br.length - 1);
                        }
                        if (br.length > 0 && br[br.length - 1].hasOwnProperty("hom")) {
                            br = br.slice(0, br.length - 1);
                        }
                    }
                    position.rest.beforeReset = br;
                    upgraded = true;
                } catch (e) {
                    // ignore invalid json
                }
            }
            delete position.rest.startup;
        }

        // presentation info should not be archived
        var marks = position.rest.marks;
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
        var vMajMin = version == null ? 0 : Number(version.major + "." + version.minor);
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
        console.log("DEPRECATED: firenodejs.updateModels");
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
            that.serviceBus && that.serviceBus.emitSaveModels();
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
    firenodejs.prototype.beforeRebase = function() {
        var that = this;
        var now = new Date();
        var msElapsed = now.getTime() - started.getTime();
        that.model.uptime = msElapsed / 1000;
        //console.log("INFO\t: firenodejs: beforeRebase()");
        //that.position.beforeRebase();
    }
    firenodejs.prototype.getModels = function(res) {
        var that = this;
        // By incrementing the age, we ensure that all other clients updates will be ignored
        // This is a cheap way to address multiple updates: updates to stale data are ignored
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
        result = result || that.position.isAvailable();
        result = result || that.images.isAvailable();
        result = result || that.firesight.isAvailable();
        result = result || that.measure.isAvailable();
        result = result || that.mesh_rest.isAvailable();
        result = result || that.firekue_rest.isAvailable();
        result = result || that.pcb.isAvailable();
        result = result || that.firepaste.isAvailable();
        return result;
    }

    module.exports = exports.firenodejs = firenodejs;
})(typeof exports === "object" ? exports : (exports = {}));

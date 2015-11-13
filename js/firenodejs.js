
//console.log("INFO\t: loading firenodejs");
var child_process = require('child_process');
var path = require("path");
var fs = require("fs");

module.exports.firenodejs = (function() {
    ///////////////////////// private instance variables
    var started = new Date();

    ////////////////// constructor
    function firenodejs(images, firesight, measure, options) {
        var that = this;

        options = options || {};

        that.modelPath = options.modelPath || '/var/firenodejs/firenodejs.json';
        try {
            that.model = JSON.parse(fs.readFileSync(that.modelPath));
            console.log("INFO\t: loading existing firenodejs model");
        } catch (e) {
            console.log("INFO\t: new firenodejs model created");
            that.model = {};
        }
        console.log("INFO\t: updating " + that.modelPath);
        that.updateModel({
            firenodejs: {
                version: {major:0, minor:4, patch:0},
                started: started.toString()
            }
        });
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.measure = measure) == null) throw new Error("measure is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;

        return that;
    }

    firenodejs.applyJson = function(dst, update) {
        var keys = Object.keys(update);
        for (var i=keys.length; i-- > 0;) {
            var key = keys[i];
            var value = update[key];
            if (value == null) {
                // nothing to do
            } else if (typeof value === 'string') {
                dst[key] = value;
            } else if (typeof value === 'number') {
                dst[key] = value;
            } else if (typeof value === 'boolean') {
                dst[key] = value;
            } else {
                if (!dst.hasOwnProperty(key)) {
                    dst[key] = {};
                }
                firenodejs.applyJson(dst[key], value);
            }
        }
        return dst;
    }

    firenodejs.prototype.updateModel = function(update) {
        var that = this;
        firenodejs.applyJson(that.model, update);
        fs.writeFile(that.modelPath, JSON.stringify(that.model,null,'  '), function(err) {
            if (err instanceof Error) {
                console.log("WARN\t: could not write " + that.modelPath, err);
            }
        });
        return that;
    }
    firenodejs.prototype.isAvailable = function() {
        var that = this;
        return 
            that.camera.isAvailable() ||
            that.firestep.isAvailable() ||
            that.images.isAvailable() ||
            that.firesight.isAvailable() ||
            that.measure.isAvailable();
    }
    firenodejs.prototype.getModel = function() {
        var that = this;
        that.model.camera = that.camera.getModel();
        that.model.firesight = that.firesight.getModel();
        that.model.firestep = that.firestep.getModel();
        that.model.images = that.images.getModel();
        that.model.measure = that.measure.getModel();
        var now = new Date();
        var msElapsed = now.getTime() - started.getTime();
        that.model.firenodejs.uptime = msElapsed/1000;
        return that.model;
    }

    return firenodejs;
})();

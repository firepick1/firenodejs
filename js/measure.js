//console.log("INFO\t: loading Measure");
var child_process = require('child_process');
var path = require("path");
var fs = require("fs");

module.exports.Measure = (function() {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function Measure(images, firesight, options) {
        var that = this;
        options = options || {};
        options.model = options.model || {};

        that.model = options.model;
        that.model.available = true;
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;

        return that;
    }

    Measure.prototype.isAvailable = function() {
        var that = this;
        return that.model.available;
    }
    Measure.prototype.getModel = function() {
        var that = this;
        return that.model;
    }
    Measure.prototype.jogPrecision = function(camName, options, onSuccess, onFail) {
        var that = this;
        options = options || {};
        var jog = options.jog || 10;
        var n = options.n || 2;
        that.images.save(camName, function(urlPath) {
            var x = that.firestep.model.mpo.x;
            var y = that.firestep.model.mpo.y;
            var z = that.firestep.model.mpo.z;
            var cmd = [];
            var dx = Math.random()<0.5 ? -jog : jog;
            var dy = Math.random()<0.5 ? -jog : jog;
            for (var i=0; i < n; i++) {
                cmd.push({movxr:dx});
            }
            for (var i=0; i < n; i++) {
                cmd.push({movyr:dy});
            }
            cmd.push({mov:{x:x,y:y,z:z}});
            cmd.push({mpo:"",dpyds:12});
            that.firestep.send(cmd, function() {
                console.log("jogPrecision TBD");
                that.firesight.calcOffset(camName, function(offset) {
                    console.log("INFO\t: jogPrecision() => " + offset);
                    onSuccess(offset);
                }, function(error) {
                    onFail(error);
                });
            });
        }, function(error) {
            onFail(error);
        });
    }

    return Measure;
})();

//console.log("INFO\t: loading Measure");
var child_process = require('child_process');
var path = require("path");
var fs = require("fs");
var DVSFactory = require("./lib/DVSFactory.js");
var LPPCurve = require("./lib/LPPCurve.js");

(function(exports) {
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
        return that.model.available === true;
    }
    Measure.prototype.jogPrecision = function(camName, options, onSuccess, onFail) {
        var that = this;
        options = options || {};
        var jog = options.jog || 10;
        var n = options.n || 2;
        var testPrecision = function() {
            var urlPath = that.images.savedImage(camName);
            var x = that.firestep.model.mpo.x;
            var y = that.firestep.model.mpo.y;
            var z = that.firestep.model.mpo.z;
            var cmd = [];
            var dx = Math.random() < 0.5 ? -jog : jog;
            var dy = Math.random() < 0.5 ? -jog : jog;
            for (var i = 0; i < n; i++) {
                that.firestep.send({
                    movxr: dx
                });
            }
            for (var i = 0; i < n; i++) {
                that.firestep.send({
                    movyr: dy
                });
            }
            that.firestep.send({
                mov: {
                    x: x,
                    y: y,
                    z: z,
                    lpp: false,
                }
            });
            that.firestep.send(that.firestep.cmd_mpo(), function() {
                that.firesight.calcOffset(camName, function(offset) {
                    var result = {
                        xErr: offset.dx == null ? "unknown" : offset.dx,
                        yErr: offset.dy == null ? "unknown" : offset.dy,
                        dx: dx,
                        dy: dy,
                        n: n,
                    };
                    console.log("INFO\t: jogPrecision() => " + JSON.stringify(result));
                    onSuccess(result);
                }, function(error) {
                    onFail(error);
                });
            });
        }
        if (that.images.hasSavedImage(camName)) {
            testPrecision();
        } else {
            that.images.save(camName, testPrecision, function(error) {
                onFail(error);
            });
        }
    }
    Measure.prototype.lppPrecision = function(camName, options, onSuccess, onFail) {
        var that = this;
        options = options || {};
        var jog = options.jog || 10;
        var n = options.n || 2;
        var z1 = options.z1 || 30;
        var z2 = options.z2 || 0;
        var x = that.firestep.model.mpo.x;
        var y = that.firestep.model.mpo.y;
        var z = that.firestep.model.mpo.z;
        var movxyz = {
            mov: {
                x: x,
                y: y,
                z: z
            }
        };
        var testLPP = function() {
            var urlPath = that.images.savedImage(camName);
            var cmd = [];
            var dx = Math.random() < 0.5 ? -jog : jog;
            var dy = Math.random() < 0.5 ? -jog : jog;
            for (var i = 0; i < n; i++) {
                that.firestep.send({
                    movxr: dx
                });
            }
            for (var i = 0; i < n; i++) {
                that.firestep.send({
                    movyr: dy
                });
            }
            that.firestep.send(movxyz, function() {
                that.firesight.calcOffset(camName, function(offset) {
                    var result = {
                        xErr: offset.dx == null ? "unknown" : offset.dx,
                        yErr: offset.dy == null ? "unknown" : offset.dy,
                        dx: dx,
                        dy: dy,
                        n: n,
                    };
                    console.log("INFO\t: Measure.lppPrecision() => " + JSON.stringify(result));
                    onSuccess(result);
                }, function(error) {
                    onFail(error);
                });
            });
        }
        that.firestep.send(movxyz, function() {
            if (that.images.hasSavedImage(camName)) {
                console.log("INFO\t: Measure.lppPrecision() re-using saved image");
                testLPP();
            } else {
                console.log("INFO\t: Measure.lppPrecision() saving image");
                that.images.save(camName, testLPP, function(error) {
                    onFail(error);
                });
            }
        }, function(error) {
            onFail(error);
        });
    }

    module.exports = exports.Measure = Measure;
})(typeof exports === "object" ? exports : (exports = {}));

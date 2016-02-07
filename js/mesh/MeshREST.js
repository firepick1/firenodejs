var child_process = require('child_process');
var JsonUtil = require("../../www/js/shared/JsonUtil");
var DeltaMesh = require("../../www/js/shared/DeltaMesh");
var path = require("path");
var fs = require("fs");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function MeshREST(images, firesight, options) {
        var that = this;
        options = options || {};

        that.model = {};
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;
        that.model.rest = "MeshREST";
        that.model.config = {
            type: "DeltaMesh",
            zMax: 60,
            zMin: -50,
            rIn: 195,
            zPlanes: 7,
            maxLevel: 5,
        }

        return that;
    }

    MeshREST.prototype.isAvailable = function() {
        var that = this;
        return that.model.rest === "MeshREST";
    }
    MeshREST.prototype.syncModel = function(delta) {
        var that = this;
        JsonUtil.applyJson(that.model, delta);
        var config = that.model.config;
        if (that.mesh == null ||
            that.mesh.zMax != config.zMax ||
            that.mesh.zMin != config.zMin ||
            that.mesh.rIn != config.rIn ||
            that.mesh.zPlanes != config.zPlanes) {
            that.mesh = new DeltaMesh(config);
        }
        console.log("INFO\t: MeshREST.syncModel() model:", JSON.stringify(that.model));
        return that.model;
    }
    MeshREST.prototype.create = function(config, onSuccess, onFail) {
        var that = this;
        console.log(config);
        console.log("INFO\t: MestREST.create() config:", config);
        that.model.config = config;
        onSuccess(config);
    }
    MeshREST.prototype.scan = function(camName, data, onSuccess, onFail) {
        console.log("INFO\t: MeshREST.scan(" + camName + ")", data);
        onSuccess(data);
    }

    module.exports = exports.MeshREST = MeshREST;
})(typeof exports === "object" ? exports : (exports = {}));

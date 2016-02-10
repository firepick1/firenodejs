var child_process = require('child_process');
var JsonUtil = require("../../www/js/shared/JsonUtil");
var DeltaMesh = require("../../www/js/shared/DeltaMesh");
var RestClient = require("../RestClient");
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
    MeshREST.prototype.apply = function(config) {
        var that = this;
        if (that.mesh == null ||
            that.mesh.zMax != config.zMax ||
            that.mesh.zMin != config.zMin ||
            that.mesh.rIn != config.rIn ||
            that.mesh.zPlanes != config.zPlanes) {
            that.mesh = new DeltaMesh(config);
            console.log("INFO\t: MeshREST.apply() mesh cleared and reconfigured:", JSON.stringify(config));
            return true; // new mesh
        }
        return false; // no change
    }
    MeshREST.prototype.syncModel = function(delta) {
        var that = this;
        JsonUtil.applyJson(that.model, delta);
        that.apply(that.model.config);
        return that.model;
    }
    MeshREST.prototype.configure = function(config, onSuccess, onFail) {
        var that = this;
        var changed = that.apply(that.model.config);
        that.model.config = config;
        onSuccess(config);
    }
    MeshREST.prototype.gatherData = function(camName, point, props, onSuccess, onFail) {
        var that = this;
        var rest = new RestClient();
        var result = {
            pt: point,
            props: props,
            data: {
            }
        };
        if (props && (props.gcw || props.gch || props.ga)) {
            rest.get("/firesight/" + camName + "/calc-grid", function(gridData) {
                console.log("INFO\t: MeshREST.gatherData(" + camName + ") gridData:", gridData);
                gridData.cellSize && (result.data.gcw = gridData.cellSize.width);
                gridData.cellSize && (result.data.gch = gridData.cellSize.height);
                gridData.angle && (result.data.ga = gridData.angle);
                onSuccess(result);
            }, onFail)
        } else {
            console.log("INFO\t: MeshREST.gatherData(" + camName + ") result:", result);
            onSuccess(result);
        }
    }
    MeshREST.prototype.scan = function(camName, postData, onSuccess, onFail) {
        var that = this;
        var rest = new RestClient();
        if (postData.hasOwnProperty("pt")) {
            rest.post("/firestep", [{   
                mov: {
                    x: postData.pt.x,
                    y: postData.pt.y,
                    z: postData.pt.z,
                }, 
                dpyds: 12,
            }], function(movResponse) {
                console.log("INFO\t: MeshREST.scan(" + camName + ") pt:", postData);
                that.gatherData(camName, postData.pt, postData.props, onSuccess, onFail);
            }, onFail);
        } else if (postData.hasOwnProperty("roi")) {
            console.log("INFO\t: MeshREST.scan(" + camName + ") roi:", postData);
            onSuccess(postData);
        } else {
            console.log("INFO\t: MeshREST.scan(" + camName + ")", postData);
            onSuccess(postData);
        }

    }

    module.exports = exports.MeshREST = MeshREST;
})(typeof exports === "object" ? exports : (exports = {}));

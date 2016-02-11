var child_process = require('child_process');
var JsonUtil = require("../../www/js/shared/JsonUtil");
var JsonError = require("../../www/js/shared/JsonError");
var DeltaMesh = require("../../www/js/shared/DeltaMesh");
var XYZ = require("../../www/js/shared/XYZ");
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
    MeshREST.prototype.calcGrid = function(result, camName, scanRequest, next, onFail) {
        var that = this;
        var props = scanRequest.props;
        var maxError = scanRequest.maxError;
        var rest = new RestClient();
        rest.get("/firesight/" + camName + "/calc-grid", function(gridData) {
            that.verbose && verboseLogger.debug("INFO\t: MeshREST.gatherData(" + camName + ") gridData:", gridData);
            result.summary += gridData.summary + "; ";
            if (props.gcw) {
                if (gridData.cellSize == null) {
                    result.summary += "gcw:n/a; ";
                } else if (maxError == null) {
                    result.data.gcw = gridData.cellSize.w;
                } else if (gridData.rmse.x == null) {
                    result.summary += "gcw:n/a (measurement error unknown); ";
                } else if (maxError < gridData.rmse.y) {
                    result.summary += "gcw:n/a (" + gridData.rmse.x + ">maxError); ";
                } else {
                    result.data.gcw = gridData.cellSize.w;
                }
            }
            if (props.gch) {
                if (gridData.cellSize == null) {
                    result.summary += "gch:n/a; ";
                } else if (maxError == null) {
                    result.data.gch = gridData.cellSize.h;
                } else if (gridData.rmse.y == null) {
                    result.summary += "gch:n/a (measurement error unknown); ";
                } else if (maxError < gridData.rmse.y) {
                    result.summary += "gch:n/a (" + gridData.rmse.y + ">maxError); ";
                } else {
                    result.data.gch = gridData.cellSize.h;
                }
            }
            if (props.ga) {
                if (gridData.angle == null) {
                    result.summary += "ga:n/a; ";
                } else if (maxError == null) {
                    result.data.ga = gridData.angle;
                } else if (gridData.rmse.x == null || gridData.rmse.y == null) {
                    result.summary += "ga:n/a (measurement error unknown; ";
                } else if (maxError < gridData.rmse.x) {
                    result.summary += "ga:n/a (" + gridData.rmse.x + ">maxError); ";
                } else if (maxError < gridData.rmse.y) {
                    result.summary += "ga:n/a (" + gridData.rmse.y + ">maxError); ";
                } else {
                    result.data.ga = gridData.angle;
                }
            }
            next();
        }, onFail);
    }
    MeshREST.prototype.gatherData = function(result, camName, scanRequest, onSuccess, onFail) {
        var that = this;
        var props = scanRequest.props;
        var scanCalcGrid = function(next) {
            if (props == null || props.gcw || props.gch || props.ga) {
                that.calcGrid(result, camName, scanRequest, next, onFail);
            } else {
                next();
            }
        }
        scanCalcGrid(function() {
            JsonUtil.applyJson(result.vertex, result.data);
            onSuccess(result);
        });
    }
    MeshREST.prototype.scan_vertex = function(camName, postData, onSuccess, onFail) {
        var that = this;
        try {
            var rest = new RestClient();
            var v = that.mesh.vertexAtXYZ(postData.pt, {
                snapDistance:postData.snapDistance,
            });
            v.should.exist;
            var result = {
                vertex: v,
                data: {},
                summary: "",
            }
            rest.post("/firestep", [{   
                mov: v, 
                dpyds: 12,
            }], function(movResponse) {
                console.log("INFO\t: MeshREST.scan(" + camName + ") vertex:", v);
                that.gatherData(result, camName, postData, function() {
                    onSuccess(result);
                }, onFail);
            }, onFail);
        } catch(e) {
            onFail(e);
        }
    }
    MeshREST.prototype.scan_roi = function(camName, postData, onSuccess, onFail) {
        onSuccess(new JsonError("not implemented"));
    }

    module.exports = exports.MeshREST = MeshREST;
})(typeof exports === "object" ? exports : (exports = {}));

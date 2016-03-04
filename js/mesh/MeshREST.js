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

        that.serviceBus = options.serviceBus;
        that.model = {
            available: true,
        };
        if ((that.images = images) == null) throw new Error("images is required");
        if ((that.firesight = firesight) == null) throw new Error("firesight is required");
        if ((that.firestep = images.firestep) == null) throw new Error("firestep is required");
        if ((that.camera = images.camera) == null) throw new Error("camera is required");;
        that.model.rest = "MeshREST";
        that.serviceBus && that.serviceBus.onAfterUpdate(function() {
            that.applyMeshConfig();
        });

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

    MeshREST.prototype.banana = function() {
        var that = this;
        return that.model.config.type;
    }
    MeshREST.prototype.isAvailable = function() {
        var that = this;
        return that.model.rest === "MeshREST";
    }
    MeshREST.prototype.applyMeshConfig = function(config) {
            var that = this;
            config = config || that.model.config;
            if (that.mesh == null ||
                that.mesh.zMax != config.zMax ||
                that.mesh.zMin != config.zMin ||
                that.mesh.rIn != config.rIn ||
                that.mesh.zPlanes != config.zPlanes) {
                that.mesh = new DeltaMesh(config);
                console.log("INFO\t: MeshREST.applyMeshConfig() mesh cleared and reconfigured:", JSON.stringify(config));
                return true; // new mesh
            }
            return false; // no change
        }
        //MeshREST.prototype.syncModel = function(delta) {
        //var that = this;
        //JsonUtil.applyJson(that.model, delta);
        //that.applyMeshConfig();
        //return that.model;
        //}
    MeshREST.prototype.configure = function(config, onSuccess, onFail) {
        var that = this;
        var changed = that.applyMeshConfig();
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
            var xOk = gridData.rmse != null && isResultAccurate(result, "rmse.x", gridData.rmse.x, maxError);
            var yOk = gridData.rmse != null && isResultAccurate(result, "rmse.y", gridData.rmse.y, maxError);
            props.gcw && updateResultProp(result, "gcw", gridData.cellSize, "w", xOk);
            props.gch && updateResultProp(result, "gch", gridData.cellSize, "h", yOk);
            props.ga && updateResultProp(result, "ga", gridData, "angle", xOk && yOk);
            props.gex && updateResultProp(result, "gex", gridData.rmse, "x", gridData.rmse && gridData.rmse.x != null);
            props.gey && updateResultProp(result, "gey", gridData.rmse, "y", gridData.rmse && gridData.rmse.y != null);
            result.vertex.summary = result.data.summary = result.summary;
            next();
        }, onFail);
    }
    MeshREST.prototype.gatherData = function(result, camName, scanRequest, onSuccess, onFail) {
        var that = this;
        var props = scanRequest.props;
        var scanCalcGrid = function(next) {
            if (props == null || props.gcw || props.gch || props.ga || props.gex || props.gey) {
                that.calcGrid(result, camName, scanRequest, next, onFail);
            } else {
                next();
            }
        }
        var gatherEnd = function() {
            that.model.config = that.mesh.export();
            that.model.config.data.sort(function(a, b) {
                var cmp = a.x - b.x;
                cmp === 0 && (cmp = a.y - b.y);
                cmp === 0 && (cmp = a.z - b.z);
                return cmp;
            });
            that.serviceBus && that.serviceBus.emitSaveModels();
            onSuccess(result);
        }
        scanCalcGrid(function() {
            JsonUtil.applyJson(result.vertex, result.data);
            gatherEnd();
        });
    }
    MeshREST.prototype.scan_vertex = function(camName, postData, onSuccess, onFail) {
        var that = this;
        try {
            var rest = new RestClient();
            var v = that.mesh.vertexAtXYZ(postData.pt, {
                snapDistance: postData.snapDistance || 1,
            });
            v.should.exist;
            var result = {
                vertex: v,
                data: {},
                summary: "",
            }
            rest.post("/firestep", [{
                mov: {
                    x: v.x,
                    y: v.y,
                    z: v.z,
                },
                dpyds: 12,
            }], function(movResponse) {
                console.log("INFO\t: MeshREST.scan(" + camName + ") vertex:", v);
                that.gatherData(result, camName, postData, function() {
                    that.serviceBus && that.serviceBus.emitSaveModels();
                    onSuccess(result);
                }, function(e) {
                    console.log("WARN\t: MeshREST.scan_vertex(" + JSON.stringify(v) + ") move failed:" + e.message, "stack:", e.stack);
                    onFail(e);
                });
            }, function(e) {
                console.log("WARN\t: MeshREST.scan_vertex(" + JSON.stringify(v) + ") move failed:" + e.message, "stack:", e.stack);
                onFail(e);
            });
        } catch (e) {
            console.log("WARN\t: MeshREST.scan_vertex() caught exception:" + e.message, "stack:", e.stack);
            onFail(e);
        }
    }
    var updateResultProp = function(result, dstKey, src, srcKey, isValid) {
        delete result.vertex[dstKey]; // remove existing value
        if (isValid) {
            if (src == null || src[srcKey] == null) {
                result.summary += dstKey + ":n/a; ";
            } else {
                result.vertex[dstKey] = result.data[dstKey] = src[srcKey];
            }
        }
    }
    var isResultAccurate = function(result, dstKey, error, maxError) {
        if (maxError == null) {
            return true;
        }
        if (error == null) {
            result.summary += dstKey + ":n/a; ";
            return false;
        }
        if (error > maxError) {
            result.summary += dstKey + ":" + error + ">maxError); ";
            return false;
        }
        return true;
    }

    module.exports = exports.MeshREST = MeshREST;
})(typeof exports === "object" ? exports : (exports = {}));

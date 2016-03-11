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
        that.precision = options.precision == null ? 3 : options.precision
        that.precisionScale = Math.pow(10, that.precision);

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
    MeshREST.prototype.rest_mend = function(reqBody, onSuccess, onFail) {
        var that = this;
        var propName = reqBody && reqBody.propName;
        if (propName == null) {
            var err = new Error("MeshREST.rest_mend: expected propName");
            onFail(err);
            return err;
        }
        var result = {
            propName: propName,
            patched: [0,0],
        };
        var options = {
            roi: reqBody.roi || that.model.client.roi,
        }
        var mesh = that.mesh;
        var scanPlanes = that.model.client.scanPlanes;
        var patched0;
        scanPlanes && scanPlanes[0] && (patched0 = mesh.mendZPlane(0, propName, options));
        result.patched[0] = patched0.length;
        var patched1;
        scanPlanes && scanPlanes[1] && (patched1 = mesh.mendZPlane(1, propName, options));
        result.patched[1] = patched1.length;
        that.saveMesh();
        onSuccess(result);
        return that;
    }
    MeshREST.prototype.calcProp = function(v, propName) {
        var that = this;
        var z1 = v.z;
        var mesh = that.mesh;
        var zpi1 = mesh.zPlaneIndex(z1);
        var zpi2 = zpi1 === 0 ? 1 : zpi1 - 1;
        var z2 = mesh.zPlaneZ(zpi2);
        var count = 0;

        delete v[propName];
        if (propName === "dgcw") {
            var val1 = v.gcw;
            var val2 = mesh.interpolate(new XYZ(v.x,v.y, z2), "gcw");
            var dgcw = (val1-val2);
            if (!isNaN(dgcw)) {
                v[propName] = round(dgcw, that.precisionScale);
                count++;
            }
        } else if (propName === "dgch") {
            var val1 = v.gch;
            var val2 = mesh.interpolate(new XYZ(v.x,v.y, z2), "gch");
            var dgch = (val1-val2);
            console.log("calcprop dgch:", dgch, "val1:", val1, "val2:", val2);
            if (!isNaN(dgch)) {
                v[propName] = round(dgch, that.precisionScale);
                count++;
            }
        }
        return count;
    }
    MeshREST.prototype.rest_calcProps = function(reqBody, onSuccess, onFail) {
        var that = this;
        var selectedProps = reqBody && reqBody.props;
        var result = {
            count:{
                "dgcw": 0,
                "dgch": 0,
            },
        };
        var propNames = Object.keys(result.count);
        var mesh = that.mesh;
        var data = that.model.config.data;
        var sumP = 0;
        for (var i=data.length; i-- > 0; ) {
            var d = data[i];
            var v = mesh.vertexAtXYZ(d);
            if (v != null) {
                for (var ip = 0; ip < propNames.length; ip++) {
                    var propName = propNames[ip];
                    if (selectedProps[propName]) {
                        console.log("v ", v.x, v.y, v.z);
                        result.count[propName] += that.calcProp(v, propName);
                    }
                }
            }
        }
        that.saveMesh();
        onSuccess(result);
        return that;
    }
    MeshREST.prototype.rest_configure = function(reqBody, onSuccess, onFail) {
        var that = this;
        var changed = that.applyMeshConfig();
        that.model.config = reqBody;
        onSuccess(config);
        return that;
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
    MeshREST.prototype.saveMesh = function() {
        var that = this;
        that.model.config = that.mesh.export();
        that.model.config.data.sort(function(a, b) {
            var cmp = a.x - b.x;
            cmp === 0 && (cmp = a.y - b.y);
            cmp === 0 && (cmp = a.z - b.z);
            return cmp;
        });
        that.serviceBus && that.serviceBus.emitSaveModels();
        return that;
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
            that.saveMesh();
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
                //dpyds: 12,
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

    function round(val, scale) {
        return Math.round(val*scale)/scale;
    }

    module.exports = exports.MeshREST = MeshREST;
})(typeof exports === "object" ? exports : (exports = {}));

'use strict';

var services = angular.module('firenodejs.services');
var should = require("./should");
var DeltaMesh = require("./shared/DeltaMesh");

services.factory('mesh-service', ['$http', 'AlertService',
    function($http, alerts) {
        var service = {
            isAvailable: function() {
                return service.model.available === true;
            },
            color: {
                activeScan: "black",
                inactiveScan: "#d0d0d0",
            },
            model: {
                roi:{
                    type: "rect",
                    cx: 0,
                    cy: 0,
                    width: 150,
                    height: 150,
                    vertices: [],
                },
                properties: [
                    {id:"gcw", selected:true, name:"GridCellW", title:"Horizontal pixel separation of vertical grid lines"},
                    {id:"gch", selected:true, name:"GridCellH", title:"Vertical pixel separation of horizontal grid lines"},
                    {id:"ga", selected:true, name:"GridAngle", title:"Counter-clockwise angle in degrees between image x-axis and grid horizontal axis"},
                    {id:"gox", selected:false, name:"GridOriginX", title:"x-position of grid intersection closest to image center"},
                    {id:"goy", selected:false, name:"GridOriginY", title:"y-position of grid intersection closest to image center"},
                ],
                type:"DeltaMesh",
                zMin:-50,
                rIn: 195,
                zPlanes: 7,
                maxLevel: 6,
            },
            validate: function () {
                var mesh = service.mesh;
                if (mesh == null || 
                    mesh.rIn !== service.model.rIn ||
                    mesh.zMin !== service.model.zMin ||
                    mesh.zPlanes !== service.model.zPlanes) 
                {
                    mesh = service.mesh = new DeltaMesh(service.model);
                }
                var nLevels = mesh.zPlanes - 2;
                service.model.maxLevel = Math.min(nLevels,
                    service.model.maxLevel == null ? nLevels-1 : service.model.maxLevel);
                service.levels = [];
                for (var i=0; i++ < nLevels; ) {
                    service.levels.push(i);
                }
                var opts = {
                    maxLevel:service.model.maxLevel,
                    includeExternal:false,
                };
                service.vertices = mesh.zPlaneVertices(0, opts);
                var rv = service.model.roi.vertices = [];
                for (var i=0; i<service.vertices.length; i++) {
                    var v = service.vertices[i];
                    service.isVertexROI(v) && rv.push(v);
                }
                console.log("validate() created mesh vertices:", service.vertices.length);

                return service;
            },
            vertexRadius: function(v) {
                return 4;
            },
            isVertexROI: function(v) {
                var roi = service.model.roi;
                if (roi.type === "rect") {
                    var w2 = roi.width/2;
                    var h2 = roi.height/2;
                    if (v.x < roi.cx-w2 || roi.cx+w2 < v.x || v.y < roi.cy-h2 || roi.cy+h2 < v.y) {
                        return false;
                    }
                }
                return true;
            },
            vertexColor: function(v) {
                return service.isVertexROI(v) ? service.color.activeScan : service.color.inactiveScan;
            },
            create: function() {
                service.mesh = null;
                service.validate();
                service.model.height = service.mesh.height;
                service.model.rIn = service.mesh.rIn;
            },
            onChangeLevel: function() {
                service.validate();
            },
            //save: function(camera, onDone) {
                //alerts.taskBegin();
                //camera = camera || service.camera;
                //var url = "/scan-mesh/" + camera + "/save";
                //$http.get(url).success(function(response, status, headers, config) {
                    //console.log("scan-mesh.save(" + camera + ") ", response);
                    //service.saveCount++;
                    //alerts.taskEnd();
                    //if (onDone) {
                        //onDone();
                    //}
                //}).error(function(err, status, headers, config) {
                    //console.warn("scan-mesh.save(" + camera + ") failed HTTP" + status, err);
                    //alerts.taskEnd();
                    //if (onDone) {
                        //onDone(err);
                    //}
                //});
            //},
        };

        service.model.available = true; // TODO
        //$.ajax({
            //url: "/scan-mesh/location",
            //success: function(data) {
                //available = data ? true : false;
                //console.log("scan-mesh available:", available);
                //service.model = data;
            //},
            //error: function(jqXHR, ex) {
                //available = false;
                //console.warn("scan-mesh unavailable :", jqXHR, ex);
            //}
        //});

        return service;
    }
]);

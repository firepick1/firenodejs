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
                scan:{
                    cx: 0,
                    cy: 0,
                    width: 150,
                    height: 150,
                },
                properties: {
                    all: [
                        "CalcGrid",
                        "TBD",
                    ],
                    selected: {},
                },
                type:"DeltaMesh",
                zMin:-50,
                rIn: 195,
                zPlanes: 7,
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
                service.maxLevel = Math.min(nLevels,
                    service.maxLevel == null ? nLevels-1 : service.maxLevel);
                service.levels = [];
                for (var i=0; i++ < nLevels; ) {
                    service.levels.push(i);
                }
                var opts = {
                    maxLevel:service.maxLevel,
                    includeExternal:false,
                };
                service.vertices = mesh.zPlaneVertices(0, opts);
                console.log("vertices:", service.vertices.length);
                service.vertices = mesh.zPlaneVertices(1, opts);
                console.log("vertices:", service.vertices.length);
                //service.vertices = service.vertices.concat(mesh.zPlaneVertices(1, {
                    //maxLevel:service.maxLevel,
                    //includeExternal:false,
                //}));

                return service;
            },
            vertexRadius: function(v) {
                return 4;
            },
            vertexColor: function(v) {
                var scan = service.model.scan;
                var w2 = scan.width/2;
                var h2 = scan.height/2;
                if (v.x < scan.cx-w2 || scan.cx+w2 < v.x || v.y < scan.cy-h2 || scan.cy+h2 < v.y) {
                    return service.color.inactiveScan;
                }
                return service.color.activeScan;
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

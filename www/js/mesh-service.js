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
            model: {
                zMin:-50,
                rIn: 195,
                zPlanes: 7,
            },
            validate: function () {
                var mesh = service.deltaMesh;
                if (mesh == null || 
                    mesh.rIn !== service.model.rIn ||
                    mesh.zMin !== service.model.zMin ||
                    mesh.zPlanes !== service.model.zPlanes) 
                {
                    mesh = service.deltaMesh = new DeltaMesh(service.model);
                }
                var nLevels = mesh.zPlanes - 2;
                service.maxLevel = service.maxLevel == null ? nLevels-1 : service.maxLevel;
                service.levels = [];
                for (var i=0; i++ < nLevels; ) {
                    service.levels.push(i);
                }
                service.vertices = mesh.zPlaneVertices(0, {
                    maxLevel:service.maxLevel,
                    includeExternal:false,
                });
                return service;
            },
            vertexRadius: function(v) {
                if (v.level === service.maxLevel) {
                    return 4;
                } else if (v.level === service.maxLevel-1) {
                    return 6;
                } else {
                    return 8;
                }
            },
            vertexColor: function(v) {
                if (v.level === service.maxLevel) {
                    return "orange";
                } else if (v.level === service.maxLevel-1) {
                    return "red";
                } else {
                    return "blue";
                }
            },
            onChangeLevel: function() {
                service.validate();
            }
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

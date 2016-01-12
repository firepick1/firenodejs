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
            deltaMesh: new DeltaMesh(),
            vertices: [],
            validate: function () {
                service.vertices = service.deltaMesh.zPlaneVertices(1);
                return service;
            },
            model: {},
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

        service.validate();
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

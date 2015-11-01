'use strict';

var services = angular.module('FireREST.services');

services.factory('firenodejs-service', [
    '$http', 'ServiceConfig', '$interpolate', 'AjaxAdapter', 
    'firestep-service', 
    'camera-service',
    'firesight-service',
    function($http, service, interpolate, transmit, firestep, camera, firesight) {
        console.debug("firenodejs-service initializing...");
        function availableIcon(test) {
            if (test === true) {
                return "glyphicon glyphicon-ok fr-test-pass";
            } else if (test === null) {
                return "glyphicon glyphicon-transfer fr-test-tbd";
            } else {
                return "glyphicon glyphicon-remove fr-test-fail";
            }
        }

        var service = {
            resource_XHR: function(resource, classname, response, ok) {
                service.scope.$apply(function() {
                    console.log('resource_XHR' + resource + response);
                    service.resource_response[resource] = response;
                    service.resource_classname[resource] = classname;
                    transmit.end(true);
                });
            },
            camera: camera,
            firestep: firestep,
            firesight: firesight,
            bind: function(scope) {
                scope.camera = camera;
                scope.firestep = firestep;
                scope.firesight = firesight;
                scope.availableIcon = availableIcon;
            },
            resource_GET: function(resource) {
                console.log("GET " + resource);
                transmit.start();
                $.ajax({
                    url: service.resource_url(resource),
                    data: {
                        r: Math.floor(Math.random() * 1000000)
                    },
                    success: function(data) {
                        if (typeof data === 'object') {
                            data = JSON.stringify(data);
                        }
                        data = ("" + data).trim();
                        service.resource_XHR(resource, "fr-postdata-ok", data, true);
                    },
                    error: function(jqXHR, ex) {
                        service.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
                    }
                });
            }
        };

        return service;
    }
]);

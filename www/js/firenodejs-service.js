'use strict';

var services = angular.module('FireREST.services');

services.factory('firenodejs-service', [
    '$http', 'ServiceConfig', '$interpolate', 
    'firestep-service', 
    'camera-service',
    'firesight-service',
    function($http, service, interpolate, firestep, camera, firesight) {
        console.log("firenodejs-service initializing...");
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
            camera: camera,
            firestep: firestep,
            firesight: firesight,
            bind: function(scope) {
                scope.fnjs = service;
                scope.camera = camera;
                scope.firestep = firestep;
                scope.firesight = firesight;
                scope.availableIcon = availableIcon;
            }
        };

        return service;
    }
]);

'use strict';

var services = angular.module('FireREST.services');

services.factory('firenodejs-service', [
    '$http', 
    'firestep-service', 
    'camera-service',
    'firesight-service',
    function($http, firestep, camera, firesight) {
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
                scope.firenodejs = service;
                scope.camera = camera;
                scope.firestep = firestep;
                scope.firesight = firesight;
                scope.availableIcon = availableIcon;
            }
        };

        return service;
    }
]);

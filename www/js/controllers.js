'use strict';

var controllers = angular.module('FireREST.controllers', []);

controllers.controller('firenodejs-ctrl', ['$scope', '$location', 'AlertService', 'BackgroundThread', 'ServiceConfig', 'AjaxAdapter', 'CvService',
    function(scope, location, alerts, bg, service, transmit, cv) {
        scope.view = {
            mainTab: "view-main"
        };
        scope.alerts = alerts;
        scope.viewTabClass = function(tab) {
            return tab === scope.view.mainTab ? "active" : "";
        }
        scope.viewTabContentClass = function(tab) {
            return tab === scope.view.mainTab ? "fr-navbar-active" : "";
        }
        console.debug("firenodejs-ctrl loaded");
    }
]);

controllers.controller('HomeCtrl', ['$scope', '$http', '$interval', 
    'firenodejs-service', 
    'firestep-service', 
    'camera-service',
    function(scope, $http, $interval, fnjs, firestep, camera) {
        scope.view.mainTab = "view-home";
        scope.firestep = firestep;
        fnjs.bind(scope);
        scope.fnjs = fnjs;
        scope.camera = camera;
        scope.onMore = function() {
            scope.more = !scope.more;
        }
    }
]);


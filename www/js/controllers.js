'use strict';

var controllers = angular.module('firenodejs.controllers', []);

controllers.controller('firenodejs-ctrl', ['$scope', '$location', 'AlertService', 'BackgroundThread',
    function(scope, location, alerts, bg) {
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
        console.log("firenodejs-ctrl loaded");
    }
]);

controllers.controller('HomeCtrl', ['$scope', '$http', '$interval',
    'firenodejs-service',
    function(scope, $http, $interval, firenodejs) {
        scope.view.mainTab = "view-home";
        firenodejs.bind(scope);
        scope.onMore = function() {
            scope.more = !scope.more;
        }
    }
]);

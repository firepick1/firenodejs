'use strict';
var bootstrap = angular.module('FireREST.bootstrap', ['ui.bootstrap']);

var controllers = angular.module('FireREST.controllers', []);

controllers.controller('MainCtrl', 
  ['$scope','$location', 'BackgroundThread', 'ServiceConfig', 'AjaxAdapter', 'CvService',
  function(scope, location, bg, service, transmit, cv) {
    transmit.clear();
    scope.transmit = transmit;
    scope.service = service;
    scope.config = {};
    scope.cv = cv;

    scope.worker = function(ticks) {
     if ((ticks % 5) === 0 ) {
       cv.resources.indexOf('process.fire') >= 0 && cv.resource_GET('process.fire');
     } else if ((ticks % 3) === 0 ) {
       cv.image_GET('monitor.jpg');
     } else if ((ticks % 3) === 1 ) {
       cv.image_GET('camera.jpg');
     }
     return true;
    }

    cv.clear_results();
    service.load_config(scope).then( function(config) {
      console.log("processing config.json" );
      scope.config = config;
      if (typeof config.cv === 'object') {
	bg.worker = scope.worker;
      }
    }, function(ex) {
      // no action
    }, function(notify) {
      console.log("promise notify " + notify);
    });

}]);


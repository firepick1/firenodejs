'use strict';
var bootstrap = angular.module('FireREST.bootstrap', ['ui.bootstrap']);

var controllers = angular.module('FireREST.controllers', []);

controllers.controller('MainCtrl', 
  ['$scope','$location', 'BackgroundThread', 'ServiceConfig', 'AjaxAdapter', 'CvService', 'CncService',
  function(scope, location, bg, service, transmit, cv, cnc) {
    transmit.clear();
    scope.transmit = transmit;
    scope.service = service;
    scope.config = {};
    scope.cv = cv;
    scope.cnc = cnc;
    cnc.cv = cv;

    scope.worker = function(ticks) {
     if ((ticks % 3) === 0 ) {
       cv.image_GET('camera.jpg');
     } else if ((ticks % 5) === 0) {
       cnc.resource_GET('gcode.fire');
     }
     return true;
    }

    cnc.clear_results();

    service.load_config(scope).then( function(config) {
      console.log("processing config.json" );
      scope.config = config;
      if (typeof config.cnc === 'object') {
        cnc.config_loaded(config);
	bg.worker = scope.worker;
      }
    }, function(ex) {
      // no action
    }, function(notify) {
      console.log("promise notify " + notify);
    });

}]);


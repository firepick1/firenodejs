'use strict';
var bootstrap = angular.module('FireREST.bootstrap', ['ui.bootstrap']);

var controllers = angular.module('FireREST.controllers', []);

controllers.controller('TestCtrl', 
  ['$scope',
  function(scope) {
    scope.tests = [];

    scope.tests.push(firepick.SpiralIteratorTest());
    scope.tests.push(firepick.DeltaModelTest());

    scope.testIcon = function(test) {
      if (test.outcome) {
        return "glyphicon-ok fr-test-pass";
      } else {
        return "glyphicon-remove fr-test-fail";
      }
    }

    scope.testResult = function(test) {
      if (test.outcome === true) {
        return "success";
      } else if (test.outcome === null) {
        return "warning";
      } else {
        return "danger";
      }
    }

}]);


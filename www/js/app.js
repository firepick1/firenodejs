'use strict';

// Declare app level module which depends on filters, and services
angular.module('FireREST', [
    'ui.bootstrap',
    'ngRoute',
    //  'FireREST.filters',
    'FireREST.services',
    //  'FireREST.directives',
    'FireREST.controllers'
]).
config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/home', {
        templateUrl: 'partials/view-home.html',
        controller: 'HomeCtrl'
    });
    $routeProvider.when('/fs', {
        templateUrl: 'partials/view-fs.html',
        controller: 'FireStepCtrl'
    });
    $routeProvider.when('/cnc', {
        templateUrl: 'partials/view-cnc.html',
        controller: 'CncCtrl'
    });
    $routeProvider.when('/cve', {
        templateUrl: 'partials/view-cve.html',
        controller: 'CveCtrl'
    });
    $routeProvider.when('/vcal', {
        templateUrl: 'partials/view-vcal.html',
        controller: 'VcalCtrl'
    });
    $routeProvider.when('/delta', {
        templateUrl: 'partials/view-delta.html',
        controller: 'DeltaCtrl'
    });
    $routeProvider.when('/test', {
        templateUrl: 'partials/view-test.html',
        controller: 'TestCtrl'
    });
    $routeProvider.otherwise({
        redirectTo: '/home'
    });
}]);

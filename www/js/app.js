'use strict';

// Declare app level module which depends on filters, and services
angular.module('firenodejs', [
    'ui.bootstrap',
    'ngRoute',
    //  'firenodejs.filters',
    'firenodejs.services',
    //  'firenodejs.directives',
    'firenodejs.controllers',
    'colorpicker.module',
    'd3',
    'd3AngularApp',
]).
config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/home', {
        templateUrl: 'partials/view-home.html',
        controller: 'HomeCtrl'
    });
    $routeProvider.when('/calibrate', {
        templateUrl: 'partials/view-calibrate.html',
        controller: 'CalibrateCtrl'
    });
    $routeProvider.when('/pcb', {
        templateUrl: 'partials/view-pcb.html',
        controller: 'PcbCtrl'
    });
    $routeProvider.when('/jobs', {
        templateUrl: 'partials/view-jobs.html',
        controller: 'JobsCtrl'
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

'use strict';

var services = angular.module('firenodejs.services');

services.factory('camera-service', ['$http', 
    function($http) {
        var service = {
            isAvailable: null,
        };

        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                service.isAvailable = data && data.isAvailable;
                service.model = data;
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
            }
        });

        $.ajax({
            url: "/camera/default/image.jpg",
            success: function(data) {
                service.isAvailable = true;
                console.log("camera available:", service.isAvailable);
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.warn("camera unavailable:", jqXHR, ex);
            }
        });
        return service;
    }
]);

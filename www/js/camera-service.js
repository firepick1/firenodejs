'use strict';

var services = angular.module('FireREST.services');

services.factory('camera-service', ['$http', 'AjaxAdapter',
    function($http, transmit) {
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
                console.info("camera-service:", service.isAvailable);
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.info("camera-service:", service.isAvailable, jqXHR, ex);
            }
        });
        return service;
    }
]);

'use strict';

var services = angular.module('firenodejs.services');

services.factory('images-service', ['$http', 
    function($http) {
        var service = {
            isAvailable: null,
        };

        $.ajax({
            url: "/images/location",
            success: function(data) {
                service.isAvailable = data ? true : false;
                console.log("images available:", service.isAvailable);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.warn("images unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

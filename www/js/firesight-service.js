'use strict';

var services = angular.module('FireREST.services');

services.factory('firesight-service', ['$http', 
    function($http) {
        var service = {
            isAvailable: null,
        };

        $.ajax({
            url: "/firesight/model",
            success: function(data) {
                service.isAvailable = data && data.isAvailable;
                console.log("firesight available:", service.isAvailable);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.warn("firesight unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

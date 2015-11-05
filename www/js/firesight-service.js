'use strict';

var services = angular.module('firenodejs.services');

services.factory('firesight-service', ['$http',
    function($http) {
        var available = null;
        var service = {
            isAvailable: function() {
                return available;
            }
        };

        $.ajax({
            url: "/firesight/model",
            success: function(data) {
                available = data && data.available;
                console.log("firesight available:", available);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("firesight unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

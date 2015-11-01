'use strict';

var services = angular.module('FireREST.services');

services.factory('firestep-service', ['$http', 'AjaxAdapter',
    function($http, transmit) {
        var service = {
            isAvailable: null,
            model: {},
            jog: 10,
            send: function(data) {
                var sdata = JSON.stringify(data) + "\n";
                $http.post("/firestep", data).success(function(response, status, headers, config) {
                    console.log("INFO\t: FireStepService.send(" + data + ") => " + response);
                }).error(function(err, status, headers, config) {
                    console.log("WARN\t: FireStepService.send(" + data + ") failed HTTP" + status);
                });
            }
        };

        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                service.isAvailable = data && data.isAvailable;
                console.info("firestep-service:", service.isAvailable);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.warn("firestep-service not available");
            }
        });
        return service;
    }
]);

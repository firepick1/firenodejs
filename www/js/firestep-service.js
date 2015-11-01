'use strict';

var services = angular.module('FireREST.services');

services.factory('firestep-service', ['$http', 'AjaxAdapter',
    function($http, transmit) {
        var service = {
            isAvailable: null,
            model: {},
            count: 0, // command count (changes imply model updated)
            jog: 10,
            send: function(data) {
                var sdata = JSON.stringify(data) + "\n";
                transmit.start();
                $http.post("/firestep", data).success(function(response, status, headers, config) {
                    console.log("INFO\t: FireStepService.send(" + data + ") => " + response);
                    if (response.r.mpo) {
                        service.model.mpo = response.r.mpo;
                    }
                    service.count++;
                    transmit.end(true);
                }).error(function(err, status, headers, config) {
                    console.log("WARN\t: FireStepService.send(" + data + ") failed HTTP" + status);
                    service.count++;
                    transmit.end(false);
                });
            }
        };

        transmit.start();
        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                service.isAvailable = data && data.isAvailable;
                console.info("firestep-service:", service.isAvailable);
                service.model = data;
                transmit.end();
                service.count++;
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.warn("firestep-service not available");
                transmit.end();
                service.count++;
            }
        });
        return service;
    }
]);

'use strict';

var services = angular.module('FireREST.services');

services.factory('firestep-service', ['$http', 'AlertService',
    function($http, alerts) {
        var service = {
            isAvailable: null,
            model: {},
            count: 0, // command count (changes imply model updated)
            jog: 10,
            send: function(data) {
                var sdata = JSON.stringify(data) + "\n";
                alerts.taskBegin();
                $http.post("/firestep", data).success(function(response, status, headers, config) {
                    console.debug("firestep.send(", data, " => ", response);
                    if (response.r.mpo) {
                        service.model.mpo = response.r.mpo;
                    }
                    service.count++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("firestep.send(", data, ") failed HTTP" + status);
                    service.count++;
                    alerts.taskEnd();
                });
            }
        };

        alerts.taskBegin();
        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                service.isAvailable = data && data.isAvailable;
                console.log("firestep available:", service.isAvailable);
                service.model = data;
                alerts.taskEnd();
                service.count++;
            },
            error: function(jqXHR, ex) {
                service.isAvailable = false;
                console.warn("firestep not available");
                transmit.end();
                service.count++;
            }
        });
        return service;
    }
]);

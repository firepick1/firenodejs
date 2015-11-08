'use strict';

var services = angular.module('firenodejs.services');

services.factory('measure-service', ['$http','firestep-service','images-service', 'camera-service',
    function($http, firestep, images, camera) {
        var available = null;
        var service = {
            processCount: 0,
            lpp: {z1:30, z2:-30},
            nRandom: 2,
            radius: firestep.jog,
            results: {},
            location: function() {
                var mpo = firestep.model.mpo || {};
                return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
            },
            getResults: function() {
                return service.results[service.location()];
            },
            isAvailable: function() {
                return available;
            },
            jogPrecision: function(camera) {
                alerts.taskBegin();
                var url = "/measure/" + camera.selected + "/jog-precision"; 
                var data = {
                    jog: firestep.getJog(1)
                };
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.debug("measure.jogPrecision(", data, " => ", response);
                    var loc = service.location();
                    service.results[loc] = service.results[loc] || {};
                    service.results[loc].jog = response;
                    service.count++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("measure.jogPrecision(", data, ") failed HTTP" + status);
                    service.count++;
                    alerts.taskEnd();
                });
            }
        };

        $.ajax({
            url: "/measure/model",
            success: function(data) {
                available = data && data.available;
                console.log("measure available:", available);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("measure unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

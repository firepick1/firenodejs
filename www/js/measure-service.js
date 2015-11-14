'use strict';

var services = angular.module('firenodejs.services');

services.factory('measure-service', [
    '$http','firestep-service','images-service', 'AlertService',
    function($http, firestep, images, alerts) {
        var available = null;
        var service = {
            count: 0,
            lpp: {z1:30, z2:0},
            nRandom: 2,
            radius: firestep.jog,
            results: {},
            location: function() {
                var mpo = firestep.model.mpo || {};
                return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
            },
            model: {},
            resultClass: function(result) {
                if (result.xErr === 0 && result.yErr === 0) {
                    return "success";
                } else if (result.xErr === "unknown" || result.yErr === "unknown") {
                    return "danger";
                } else if (Math.abs(result.xErr) >= 2 || Math.abs(result.yErr) >= 2) {
                    return "danger";
                } else {
                    return "warning";
                }
            },
            getResults: function() {
                return service.results[service.location()];
            },
            isAvailable: function() {
                return available;
            },
            jogPrecision: function(camName) {
                alerts.taskBegin();
                var url = "/measure/" + camName + "/jog-precision"; 
                var data = {
                    jog: firestep.getJog(1)
                };
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.debug("measure.jogPrecision(", data, " => ", response);
                    var loc = service.location();
                    service.results[loc] = service.results[loc] || {};
                    service.results[loc].jogPrecision = service.results[loc].jogPrecision || [];
                    service.results[loc].jogPrecision.push(response);
                    service.count++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("measure.jogPrecision(", data, ") failed HTTP" + status);
                    alerts.taskEnd();
                });
            },
            lppPrecision: function(camName) {
                alerts.taskBegin();
                var url = "/measure/" + camName + "/lpp-precision"; 
                var data = {
                    jog: firestep.getJog(1),
                    z1:service.lpp.z1,
                    z2:service.lpp.z2,
                };
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.debug("measure.lppPrecision(", data, " => ", response);
                    var loc = service.location();
                    service.results[loc] = service.results[loc] || {};
                    service.results[loc].lppPrecision = service.results[loc].lppPrecision || [];
                    service.results[loc].lppPrecision.push(response);
                    service.count++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("measure.lppPrecision(", data, ") failed HTTP" + status);
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

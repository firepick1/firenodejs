'use strict';

var services = angular.module('firenodejs.services');

services.factory('firesight-service', ['$http', 'firestep-service',
    function($http, firestep) {
        var available = null;
        var service = {
            processCount: 0,
            results: {},
            location: function() {
                var mpo = firestep.model.mpo || {};
                return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
            },
            getResults: function() {
                return service.results[service.location()];
            },
            model: {},
            isAvailable: function() {
                return available === true;
            },
            calcOffsetClass: function(dim) {
                var loc = service.location();
                if (service.results[loc].calcOffset[dim] === 0) {
                    return "success";
                } else if (Math.abs(service.results[loc].calcOffset[dim]) <= 1) {
                    return "warning";
                }
                return "danger";

            },
            calcOffset: function(camName) {
                var loc = service.location();
                service.results[loc] = {
                    calcOffset: {
                        dx: "...",
                        dy: "..."
                    }
                };
                $.ajax({
                    url: "/firesight/" + camName + "/calc-offset",
                    success: function(outJson) {
                        console.log("calcOffset() ", outJson);
                        service.results[loc] = service.results[loc] || {};
                        service.results[loc].calcOffset = outJson;
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        console.warn("calcOffset() failed:", jqXHR, ex);
                    }
                });
            }
        };

        $.ajax({
            url: "/firesight/model",
            success: function(data) {
                available = data && data.available;
                console.log("firesight available:", available);
                shared.applyJson(service.model, data);
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("firesight unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

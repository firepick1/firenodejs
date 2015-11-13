'use strict';

var services = angular.module('firenodejs.services');

services.factory('images-service', ['$http', 'AlertService',
    function($http, alerts) {
        var available = null;
        var service = {
            isAvailable: function() {
                return available;
            },
            camera: "default",
            saveCount: 0,
            model: {},
            getModel: function() {
                return service.model;
            },
            save: function(camera, onDone) {
                alerts.taskBegin();
                camera = camera || service.camera;
                var url = "/images/" + camera + "/save";
                $http.get(url).success(function(response, status, headers, config) {
                    console.log("images.save(" + camera + ") ", response);
                    service.saveCount++;
                    alerts.taskEnd();
                    if (onDone) { onDone(); }
                }).error(function(err, status, headers, config) {
                    console.warn("images.save(" + camera + ") failed HTTP" + status, err);
                    alerts.taskEnd();
                    if (onDone) { onDone(err); }
                });
            },
        };

        $.ajax({
            url: "/images/location",
            success: function(data) {
                available = data ? true : false;
                console.log("images available:", available);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("images unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

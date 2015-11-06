'use strict';

var services = angular.module('firenodejs.services');

services.factory('camera-service', ['$http',
    function($http) {
        var available = null;
        var service = {
            selected: "default",
            isAvailable: function() {
                return available;
            },
            changeCount: 0,
            index: function(externalIndex) {
                return externalIndex * 1000 + service.changeCount;
            },
            onChange: function() {
                available = null;
                service.changeCount++;
                console.log("camera changed:", service.selected);
                $.ajax({
                    url: "/camera/" + service.selected + "/model",
                    success: function(data) {
                        available = data && data.available;
                        service.model = data;
                    },
                    error: function(jqXHR, ex) {
                        available = false;
                    }
                });
            }
        };
        service.onChange();
        $.ajax({
            url: "/camera/default/image.jpg",
            success: function(data) {
                available = true;
                console.log("camera available:", available);
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("camera unavailable:", jqXHR, ex);
            }
        });
        return service;
    }
]);

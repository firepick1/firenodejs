'use strict';

var services = angular.module('firenodejs.services');

services.factory('camera-service', ['$http',
    function($http) {
        var available = null;
        var service = {
            selected: "default",
            isAvailable: function() {
                return available === true;
            },
            model: {},
            changeCount: 0,
            reticle:{opacity:1,color:"fuchsia"},
            crosshair:{opacity:1,color:"fuchsia"},
            image:{height:150,aspect:1},
            index: function(externalIndex) {
                return externalIndex * 1000 + service.changeCount;
            },
            onResize: function() {
                if (service.image.height === 100) {
                    service.image.height = 200;
                } else if (service.image.height === 200) {
                    service.image.height = 300;
                } else {
                    service.image.height = 100;
                }
                service.image.width = service.image.height/service.image.aspect;
                service.image.style = "width:" + service.image.width + "px !important; height:" + service.image.height + "px !important";
            },
            onReticle: function() {
                if (service.reticle.opacity) {
                    service.reticle.opacity = 0;
                } else if (service.crosshair.opacity) {
                    service.crosshair.opacity = 0;
                } else {
                    service.reticle.opacity = 1;
                    service.crosshair.opacity = 1;
                }
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
        service.onResize();
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

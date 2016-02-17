'use strict';
var JsonUtil = require("./shared/JsonUtil");
var services = angular.module('firenodejs.services');

services.factory('camera-service', ['$http', 'UpdateService', 
    function($http, updateService) {
        var available = null;
        var service = {
            isAvailable: function() {
                return available === true;
            },
            model: {
                selected: "default",
                autoRefresh: false,
            },
            changeCount: 0,
            reticle: {
                opacity: 1,
                color: "fuchsia"
            },
            crosshair: {
                opacity: 1,
                color: "fuchsia"
            },
            image: {
                height: 150,
            },
            index: function(externalIndex) {
                return externalIndex * 1000 + service.changeCount;
            },
            updateAspect: function() {
                var aspectW = service.model.width == null ? 640 : service.model.width;
                var aspectH = service.model.height == null ? 480 : service.model.height;
                service.image.width = service.image.height * aspectW / aspectH;
                service.image.style = "width:" + service.image.width + "px !important; height:" + service.image.height + "px !important";
            },
            onResize: function() {
                if (service.image.height === 100) {
                    service.image.height = 200;
                } else if (service.image.height === 200) {
                    service.image.height = 300;
                } else {
                    service.image.height = 100;
                }
                service.updateAspect();
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
            refreshClass: function() {
                return service.model.autoRefresh ? "btn-primary" : "btn-default";
            },
            onAutoCapture: function() {
                service.model.autoRefresh = !service.model.autoRefresh;
            },
            idleUpdate: function(msIdle) {
                service.model.autoRefresh && service.changeCount++;
            },
            onChange: function() {
                available = null;
                service.changeCount++;
                //console.log("camera changed:", service.model.selected);
                $.ajax({
                    url: "/camera/" + service.model.selected + "/model",
                    success: function(data) {
                        available = data && data.available;
                        JsonUtil.applyJson(service.model, data);
                        service.updateAspect();
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
                //console.log("camera available:", available);
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("camera unavailable:", jqXHR, ex);
            }
        });
        updateService.subscribeIdle(service.idleUpdate);

        return service;
    }
]);

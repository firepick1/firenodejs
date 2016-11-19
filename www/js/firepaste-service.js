
'use strict';

var services = angular.module('firenodejs.services');

services.factory('firepaste-service', ['$http', 'AlertService', 'firestep-service',
    function($http, alerts, firestep) {
        var service = {
            isAvailable: function() {
                return service.model.available === true;
            },
            model: {
                xAxis:{},
                yAxis:{},
                zAxis:{},
                bedPlane: [{
                    x: 0,
                    y: 0,
                    z: 0,
                }, {
                    x: 1,
                    y: 0,
                    z: 0,
                }, {
                    x: 0,
                    y: 1,
                    z: 0,
                }],
                yAngle: 90,
            },
            getSyncJson: function() {
                return service.model;
            },
            syncModel: function(data) {
                if (data) {
                    JsonUtil.applyJson(service.model, data);
                    console.log("DEBUG syncModel(", data, ")");
                    console.log("DEBUG service.model", service.model);
                }
                return service.model;
            },
            calibrateBed: function() {
                alerts.danger("Not implemented");
            },
            calibrateYSkew: function() {
                alerts.danger("Not implemented");
            },
        };

        return service;
    }
]);

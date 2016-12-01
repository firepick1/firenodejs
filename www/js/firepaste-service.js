
'use strict';

var services = angular.module('firenodejs.services');

services.factory('firepaste-service', ['$http', 'AlertService', 'firestep-service',
    function($http, alerts, firestep) {
        var service = {
            isAvailable: function() {
                service.model.available = service.model.kinematics === 'cartesian';
                return service.model.available === true;
            },
            model: {
                kinematics: "",
                xAxis:{
                    name: "X-axis",
                    icon: "glyphicon glyphicon-resize-horizontal",
                    drive: "belt",
                    pitch: 2,
                    teeth: 20,
                    steps: 200,
                    microsteps: 16,
                    gearout: 1,
                    gearin: 1,
                    mmMicrosteps: 80,
                    homePos: 0,
                    minPos: 0,
                    maxPos: 200,
                    maxHz: 18000,
                    tAccel:0.4,
                },
                yAxis:{
                    name: "Y-axis",
                    icon: "glyphicon glyphicon-resize-horizontal",
                    drive: "belt",
                    pitch: 2,
                    teeth: 20,
                    steps: 200,
                    microsteps: 16,
                    gearout: 1,
                    gearin: 1,
                    mmMicrosteps: 80,
                    homePos: 0,
                    minPos: 0,
                    maxPos: 200,
                    maxHz: 18000,
                    tAccel:0.4,
                },
                zAxis:{
                    name: "Z-axis",
                    icon: "glyphicon glyphicon-resize-vertical",
                    drive: "belt",
                    pitch: 2,
                    teeth: 20,
                    steps: 200,
                    microsteps: 16,
                    gearout: 1,
                    gearin: 1,
                    mmMicrosteps: 80,
                    homePos: 0,
                    minPos: -200,
                    maxPos: 0,
                    maxHz: 18000,
                    tAccel:0.4,
                },
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
        service.cfgAxis = service.model.xAxis;

        return service;
    }
]);

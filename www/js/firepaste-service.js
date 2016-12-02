'use strict';

var services = angular.module('firenodejs.services');

services.factory('firepaste-service', ['$http', 'AlertService', 'position-service',
    function($http, alerts, position) {
        var service = {
            isAvailable: function() {
                var kinematics = position.model.kinematics;
                service.model.available = kinematics.type === 'cartesian' &&
                    (kinematics.xAxis.minPos != null && kinematics.xAxis.maxPos != null) &&
                    (kinematics.yAxis.minPos != null && kinematics.yAxis.maxPos != null) &&
                    (kinematics.zAxis.minPos != null && kinematics.zAxis.maxPos != null) &&
                    (kinematics.xAxis.minLimit || kinematics.xAxis.maxLimit) &&
                    (kinematics.yAxis.minLimit || kinematics.yAxis.maxLimit) &&
                    (kinematics.zAxis.minLimit || kinematics.zAxis.maxLimit);
                return service.model.available === true;
            },
            model: {
                kinematics: {
                    type: "",
                    xAxis: {
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
                        tAccel: 0.4,
                        minLimit: true,
                        maxLimit: false,
                    },
                    yAxis: {
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
                        tAccel: 0.4,
                        minLimit: true,
                        maxLimit: false,
                    },
                    zAxis: {
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
                        tAccel: 0.4,
                        minLimit: false,
                        maxLimit: true,
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
        service.cfgAxis = position.model.kinematics.xAxis;

        return service;
    }
]);

'use strict';

var services = angular.module('firenodejs.services');

services.factory('images-service', ['$http', 'AlertService', 'firestep-service',
    function($http, alerts, firestep) {
        var service = {
            isAvailable: function() {
                return service.model.available === true;
            },
            camera: "default",
            saveCount: 0,
            model: {
                saveName: "saved",
                saveBy: "location",
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
            savedImageName: function(saveBy) {
                saveBy = saveBy || service.saveBy;
                if (saveBy === 'name') {
                    return service.model.saveName + ".jpg";
                }
                var mpo = firestep.model.mpo;
                return mpo == null || mpo["1"] == null ?
                    "?_?_?.jpg" :
                    mpo["1"] + "_" + mpo["2"] + "_" + mpo["3"] + ".jpg";
            },
            save: function(camera, onDone) {
                alerts.taskBegin();
                camera = camera || service.camera;
                var url = "/images/" + camera + "/save";
                if (service.model.saveBy === 'name' && service.model.saveName) {
                    url += "?name=" + service.model.saveName;
                }
                $http.get(url).success(function(response, status, headers, config) {
                    console.log("images.save(" + camera + ") ", response);
                    service.saveCount++;
                    alerts.taskEnd();
                    if (onDone) {
                        onDone();
                    }
                }).error(function(err, status, headers, config) {
                    console.warn("images.save(" + camera + ") failed HTTP" + status, err);
                    alerts.taskEnd();
                    if (onDone) {
                        onDone(err);
                    }
                });
            },
        };

        return service;
    }
]);

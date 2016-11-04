'use strict';

var services = angular.module('firenodejs.services');

services.factory('PcbService', ['$http', 'AlertService', '$interval',
    function($http, alerts, $interval ) {
        var service = {
            isAvailable: function() {
                return service.model.available === true;
            },
            saveCount: 0,
            pcbFiles: {
            },
            model: {
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
            onChooseFile: function(file, fileType) {
                service.pcbFiles[fileType] = file;
                service.model.uploadDate = "";
            },
            isUploadReady: function() {
                return service.model.fileFormat === "BRD" && service.pcbFiles.BRD || 
                    service.model.fileFormat === "SparkFun" && service.pcbFiles.GKO && service.pcbFiles.GTP ||
                    service.model.fileFormat === "Altium" && service.pcbFiles.GKO && service.pcbFiles.GTP;
            },
            uploadFile: function() {
                var msg = "Uploading PCB files: ";
                var fd = new FormData();
                var fileTypes = Object.keys(service.pcbFiles);
                for (var iFile = 0; iFile < fileTypes.length; iFile++) {
                    var fileType = fileTypes[iFile];
                    if (iFile) {
                        msg += ", ";
                    }
                    msg += fileType;
                    fd.append('fileType', fileType);
                    fd.append('file', service.pcbFiles[fileType]);
                }
                var info = alerts.info(msg);
                var seconds = 0;
                alerts.taskBegin();
                $interval(function() {
                    info.msg = msg + " [" + (++seconds) + "...]";
                }, 1000, seconds);
                var url = "/pcb/file";
                $http.post(url, fd, {
                        transformRequest: angular.identity,
                        headers: {
                            'Content-Type': undefined
                        }
                    })
                    .then(function(response) {
                        alerts.close(info);
                        alerts.taskEnd();
                        service.syncModel(response.data);
                    })
                    .catch(function(err) {
                        var msg = "Upload failed: " + err;
                        alerts.danger(msg);
                        alerts.close(info);
                        alerts.taskEnd();
                    });
            },
        };

        return service;
    }
]);

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
                png: {
                    width: 800,
                }
            },
            selection: {
                points:"",
                items: [],
            },
            getSyncJson: function() {
                return service.model;
            },
            padRowClass: function(pad) {
                if (service.selection.items[0] !== pad) {
                    return "fn-row";
                }
                return "fn-row-selection";
            },
            pixelX: function(x) {
                var bounds = service.cam.bounds;
                var scale = service.model.png.width/(bounds.r - bounds.l);
                var pixel = scale * (x - bounds.l);
                return Math.round(pixel*10)/10;
            },
            pixelY: function(y) {
                var bounds = service.cam.bounds;
                var scale = service.model.png.width/(bounds.r - bounds.l);
                var pixel = scale * (bounds.t - y);
                return Math.round(pixel*10)/10;
            },
            onClickPad: function(pad) {
                var bounds = service.cam.bounds;
                var scale = service.model.png.width/(bounds.r - bounds.l);
                var strokeWidth = 3;
                var w2 = (strokeWidth/scale + pad.width)/2;
                var h2 = (strokeWidth/scale + pad.height)/2;
                var x1 = service.pixelX(pad.x - w2);
                var x2 = service.pixelX(pad.x + w2);
                var y1 = service.pixelY(pad.y - h2);
                var y2 = service.pixelY(pad.y + h2);
                var points = "";
                points += x1 + "," + y1 + " ";
                points += x1 + "," + y2 + " ";
                points += x2 + "," + y2 + " ";
                points += x2 + "," + y1 + " ";
                points += x1 + "," + y1 ;
                service.selection = {
                    points: points,
                    items: [pad],
                    strokeWidth: strokeWidth,
                }
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
            orderBy: function(list, attrName) {
                list.sort(function(a,b) {
                    var aVal = a[attrName];
                    var bVal = b[attrName];
                    if (aVal < bVal) {
                        return -1;
                    }
                    return aVal === bVal ? 0: 1;
                });
            },
            loadCamInfo: function() {
                $http.get("/pcb/s/cam.json")
                .then(response => {
                    service.cam = response.data;
                })
                .catch(err => alerts.danger(err));
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
                        service.loadCamInfo();
                    })
                    .catch(function(err) {
                        var msg = "Upload failed: " + err;
                        alerts.danger(msg);
                        alerts.close(info);
                        alerts.taskEnd();
                    });
            },
        };
        service.loadCamInfo();

        return service;
    }
]);

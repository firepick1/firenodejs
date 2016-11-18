'use strict';

var services = angular.module('firenodejs.services');

services.factory('PcbService', [
    '$http',
    'AlertService',
    '$interval',
    'UpdateService',
    '$document',
    function($http, alerts, $interval, updateService, $document) {
        var service = {
            isAvailable: function() {
                return service.model.available === true;
            },
            saveCount: 0,
            pcbFiles: {},
            model: {
                png: {
                    width: 800,
                }
            },
            scale: {
                x: 1,
                y: 1,
            },
            selection: {
                items: [],
            },
            setDefaults: function() {
                JsonUtil.applyJson(service.model, {
                    fileFormat: "SparkFun",
                    png: {
                        width: 800,
                    },
                    colors: {
                        board: "#000644",
                        outline: "#000",
                        pads: "#f00",
                        selectionStroke: "rgba(0,255,130,0.7)",
                        selectionFill: "rgba(255,0,255,1)",
                    },
                });
            },
            onMouseDown: function(evt) {
                if (evt == null) return {};
                var mouse = service.pcbMouseXY(evt);
                var dMax = 10;
                var smdpads = service.pcb.smdpads;
                var bounds = service.pcb.bounds;
                service.mouse = mouse;
                var d2Min = bounds.width * bounds.width + bounds.height * bounds.height;
                var minPad = null;

                for (var iPad = smdpads.length; iPad-- > 0;) {
                    var pad = smdpads[iPad];
                    if (pad == null) {
                        continue;
                    }
                    var dx = pad.x - mouse.x;
                    var dy = pad.y - mouse.y;
                    var d2 = dx * dx + dy * dy;
                    if (d2 < d2Min) {
                        d2Min = d2;
                        minPad = pad;
                    }
                }
                if (minPad) {
                    service.onClickPad(minPad);
                }
                return true;
            },
            pcbMouseXY: function(evt) {
                var mouse = service.svgMouseXY(evt);
                mouse.x += service.pcb.bounds.l;
                mouse.y += service.pcb.bounds.b;
                return mouse;
            },
            svgMouseXY: function(evt) {
                var x = evt.offsetX;
                var svg = evt.currentTarget;
                var y = svg.clientHeight - evt.offsetY; // pcb coordinates are bottom left origin
                return {
                    x: x / service.scale.x,
                    y: y / service.scale.y,
                }
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
                var pixel = service.scale.x * (x - service.pcb.bounds.l);
                return Math.round(pixel * 10) / 10;
            },
            pixelY: function(y) {
                var pixel = service.scale.y * (service.pcb.bounds.t - y);
                return Math.round(pixel * 10) / 10;
            },
            onClickPad: function(pad) {
                var tbody = $document.find("tbody")[0];
                var rowH = tbody.rows[0].clientHeight;
                var iRow;
                var smdpads = service.pcb.smdpads;
                for (iRow = 0; iRow < smdpads.length; iRow++) {
                    if (pad === smdpads[iRow]) {
                        break;
                    }
                }
                if (iRow < smdpads.length) {
                    var offsetTop = Math.max(0, tbody.rows[iRow].offsetTop - rowH);
                    $("tbody").animate({
                        scrollTop: offsetTop
                    }, "slow");
                    //tbody.scrollTop = rowH * iRow;
                }
                var strokeWidth = 3;
                var w2 = (strokeWidth / service.scale.x + pad.width) / 2;
                var h2 = (strokeWidth / service.scale.y + pad.height) / 2;
                var x1 = service.pixelX(pad.x - w2);
                var x2 = service.pixelX(pad.x + w2);
                var y1 = service.pixelY(pad.y - h2);
                var y2 = service.pixelY(pad.y + h2);
                var points = pad.points;
                if (points == null) {
                    points = "";
                    points += x1 + "," + y1 + " ";
                    points += x1 + "," + y2 + " ";
                    points += x2 + "," + y2 + " ";
                    points += x2 + "," + y1 + " ";
                    points += x1 + "," + y1;
                    pad.points = points;
                }
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
                var ascending = function(a, b) {
                    var aVal = a[attrName];
                    var bVal = b[attrName];
                    if (aVal < bVal) {
                        return -1;
                    }
                    return aVal === bVal ? 0 : 1;
                };
                var descending = function(a, b) {
                    var aVal = a[attrName];
                    var bVal = b[attrName];
                    if (aVal > bVal) {
                        return -1;
                    }
                    return aVal === bVal ? 0 : 1;
                };
                var isAscending = true;
                for (var iList = 1; iList < list.length; iList++) {
                    if (ascending(list[iList - 1], list[iList]) === 1) {
                        isAscending = false;
                    }
                }
                list.sort(isAscending ? descending : ascending);
            },
            loadPcbInfo: function() {
                $http.get("/pcb/s/pcb.json")
                    .then(response => {
                        service.pcb = response.data;
                        var bounds = service.pcb.bounds;
                        bounds.width = JsonUtil.round(bounds.r - bounds.l, 100);
                        bounds.height = JsonUtil.round(bounds.t - bounds.b, 100);
                        service.scale.x =
                            service.scale.y = service.model.png.width / (bounds.r - bounds.l);
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
                        service.loadPcbInfo();
                    })
                    .catch(function(err) {
                        var msg = "Upload failed: " + err;
                        alerts.danger(msg);
                        alerts.close(info);
                        alerts.taskEnd();
                    });
            },
            afterUpdate: function(diff) {
                if (service.model.fileFormat == null) {
                    service.setDefaults();
                }
            },
        };
        updateService.onAfterUpdate(service.afterUpdate);
        service.loadPcbInfo();

        return service;
    }
]);

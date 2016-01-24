'use strict';

var JsonUtil = require("./shared/JsonUtil");
var services = angular.module('firenodejs.services');

services.factory('firesight-service', ['$http', 'firestep-service',
    function($http, firestep) {
        var available = null;
        var service = {
            processCount: 0,
            results: {},
            location: function() {
                var mpo = firestep.model.mpo || {};
                return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
            },
            getResults: function() {
                return service.results[service.location()];
            },
            model: {
                calc: "CalcOffset",
                calcOffset: {
                    compareBy: "location",
                },
                calcFgRect: {
                    compareBy: "location",
                },
                calcGrid: {
                    rmseDanger: 0.0025, // 0.1 pixel in 40
                    rmseWarning: 0.0020, // 0.1 pixel in 50
                }
            },
            isAvailable: function() {
                return available === true;
            },
            calcOffsetClass: function(dim) {
                var loc = service.location();
                if (!service.results[loc]) {
                    return "";
                }
                if (service.results[loc].calcOffset[dim] === 0) {
                    return "success";
                } else if (Math.abs(service.results[loc].calcOffset[dim]) <= 1) {
                    return "warning";
                }
                return "danger";
            },
            calcGrid: function(camName) {
                var loc = service.location();
                service.results[loc] = service.results[loc] || {};
                service.results[loc].calcGrid = {
                    origin: "measuring...",
                    angle: "measuring...",
                    cellSize: "measuring...",
                    rmse: "measuring...",
                    class: {
                        x: "info", y: "info", xy: "info"
                    },
                };
                var rmseClass = function(rmse, base) {
                    if (rmse >= base * service.model.calcGrid.rmseDanger) {
                        return "danger";
                    }
                    if (rmse >= base * service.model.calcGrid.rmseWarning) {
                        return "warning";
                    }
                    return "success";
                }
                $.ajax({
                    url: "/firesight/" + camName + "/calc-grid",
                    success: function(outJson) {
                        console.log("calcGrid() ", outJson);
                        service.results[loc].calcGrid = outJson;
                        service.results[loc].calcGrid.class = {
                            x: rmseClass(outJson.rmse.x, outJson.cellSize.w),
                                y: rmseClass(outJson.rmse.y, outJson.cellSize.h),
                                xy: rmseClass(
                                    Math.max(outJson.rmse.x, outJson.rmse.y),
                                    Math.max(outJson.cellSize.w, outJson.cellSize.h)
                                ),
                        };
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.processCount++;
                        service.results[loc].calcGrid = {
                            origin: "(no match)",
                            angle: "(no match)",
                            cellSize: "(no match)",
                            rmse: "(no match)",
                            class: {
                                x: "danger", y: "danger", z: "danger"
                            },
                        };
                    }
                });
            },
            readQR: function(camName) {
                var loc = service.location();
                var noMatch = [{
                    x: "(no match)",
                    y: "(no match)",
                    text: "",
                }];
                service.results[loc] = service.results[loc] || {};
                service.results[loc].readQR = [{
                    x: "scanning...",
                    y: "scanning...",
                    text: "scanning...",
                }];
                $.ajax({
                    url: "/firesight/" + camName + "/read-qr",
                    success: function(outJson) {
                        console.log("readQR() ", outJson);
                        if (outJson.qrdata && outJson.qrdata.length > 0) {
                            service.results[loc].readQR = outJson.qrdata;
                        } else {
                            service.results[loc].readQR = noMatch;
                        }
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.processCount++;
                        service.results[loc].readQR = noMatch;
                    }
                });
            },
            calcFgRect: function(camName) {
                var loc = service.location();
                var noMatch = {
                    x: "(no match)",
                    y: "(no match)",
                    width: "(no match)",
                    height: "(no match)",
                    angle: "(no match)",
                    points: "(no match)",
                };
                var url = "/firesight/" + camName + "/calc-fg-rect";
                if (service.model.calcFgRect.compareBy === "name") {
                    url += "?savedImage=" + encodeURIComponent(service.model.calcFgRect.compareName);
                }
                service.results[loc] = service.results[loc] || {};
                service.results[loc].calcFgRect = {
                    x: "measuring...",
                    y: "measuring...",
                    width: "measuring...",
                    height: "measuring...",
                    angle: "measuring...",
                    points: "measuring...",
                };
                $.ajax({
                    url: url,
                    success: function(outJson) {
                        console.log("calcFgRect() ", outJson);
                        if (outJson.points) {
                            service.results[loc].calcFgRect = outJson;
                        } else {
                            service.results[loc].calcFgRect = noMatch;
                        }
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.processCount++;
                        service.results[loc].calcFgRect = noMatch;
                    }
                });
            },
            getSyncJson: function() {
                return service.model;
            },
            calcOffset: function(camName) {
                var loc = service.location();
                service.results[loc] = service.results[loc] || {};
                service.results[loc].calcOffset = {
                    dx: "measuring...",
                    dy: "measuring..."
                };
                var url = "/firesight/" + camName + "/calc-offset";
                if (service.model.calcOffset.compareBy === "name") {
                    url += "?savedImage=" + encodeURIComponent(service.model.calcOffset.compareName);
                }

                $.ajax({
                    url: url,
                    success: function(outJson) {
                        console.log("calcOffset() ", outJson);
                        service.results[loc].calcOffset = outJson;
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.results[loc].calcOffset = {
                            dx: "(no match)",
                            dy: "(no match)"
                        };
                        service.processCount++;
                        console.warn("calcOffset() failed:", jqXHR, ex);
                    }
                });
            }
        };

        $.ajax({
            url: "/firesight/model",
            success: function(data) {
                available = data && data.available;
                console.log("firesight available:", available);
                JsonUtil.applyJson(service.model, data);
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("firesight unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

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
                var co = service.results[loc].calcOffset;
                var vdim = co != null && co[dim];
                if (vdim == null) {
                    return "fn-no-data";
                }
                if (vdim === 0) {
                    return "success";
                } else if (Math.abs(vdim) <= 1) {
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
                    summary: "measuring...",
                };
                var rmseClass = function(rmse, base) {
                    if (typeof rmse !== "number" || typeof base !== "number") {
                        return "fn-no-data";
                    }
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
                            x: rmseClass(outJson.rmse && outJson.rmse.x, outJson.cellSize && outJson.cellSize.w),
                            y: rmseClass(outJson.rmse && outJson.rmse.y, outJson.cellSize && outJson.cellSize.h),
                            xy: rmseClass(
                                outJson.rmse && Math.max(outJson.rmse.x, outJson.rmse.y),
                                outJson.cellSize && Math.max(outJson.cellSize.w, outJson.cellSize.h)
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
                service.results[loc] = service.results[loc] || {};
                var result = service.results[loc].readQR = {
                    class:"fn-no-data",
                    summary: "scanning...",
                    qrdata:[{
                        x: "scanning...",
                        y: "scanning...",
                        text: "scanning...",
                    }]
                };
                $.ajax({
                    url: "/firesight/" + camName + "/read-qr",
                    success: function(outJson) {
                        console.log("readQR() ", outJson);
                        result = service.results[loc].readQR = outJson;
                        if (outJson.qrdata && outJson.qrdata.length > 0) {
                            result.class = "";
                        } else {
                            result.class = "fn-no-data";
                        }
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.processCount++;
                    }
                });
            },
            matchCDS: function(camName) {
                var loc = service.location();
                service.results[loc] = service.results[loc] || {};
                var result = service.results[loc].matchCDS = {
                    class:"fn-no-data",
                    summary: "scanning...",
                    matched:[],
                };
                $.ajax({
                    url: "/firesight/" + camName + "/match-cds",
                    success: function(outJson) {
                        console.log("matchCDS() ", outJson);
                        result = service.results[loc].matchCDS = outJson;
                        if (outJson.matched && outJson.matched.length > 0) {
                            result.class = "";
                        } else {
                            result.class = "fn-no-data";
                        }
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.processCount++;
                    }
                });
            },
            calcFgRect: function(camName) {
                var loc = service.location();
                var noMatch = {
                    x: "(no match)",
                    y: "(no match)",
                    width: "(no match)",
                    length: "(no match)",
                    height: "(no match)",
                    angle: "(no match)",
                    points: "(no match)",
                    summary: "(no match)",
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
                        service.results[loc].calcFgRect = outJson;
                        if (!outJson.points) {
                            service.results[loc].calcFgRect.class = "fn-no-data";
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
                var result =  service.results[loc].calcOffset = {
                    summary: "mesuring...",
                    class: "fn-no-data",
                    dx: "...",
                    dy: "..."
                };
                var url = "/firesight/" + camName + "/calc-offset";
                if (service.model.calcOffset.compareBy === "name") {
                    url += "?savedImage=" + encodeURIComponent(service.model.calcOffset.compareName);
                }

                $.ajax({
                    url: url,
                    success: function(outJson) {
                        console.log("calcOffset() ", outJson);
                        result = service.results[loc].calcOffset = outJson;
                        var matched = result.dx != null && result.dy != null;
                        result.summary = matched ? "Matched" : "No match";
                        result.class = matched ? "" : "fn-no-data";
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        service.results[loc].calcOffset = {
                            summary: ex.message,
                            class: "fn-no-data",
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

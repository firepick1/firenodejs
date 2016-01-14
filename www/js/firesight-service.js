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
                calcGrid: {
                    rmseDanger:  0.0023,
                    rmseWarning: 0.0019,
                }
            },
            isAvailable: function() {
                return available === true;
            },
            calcOffsetClass: function(dim) {
                var loc = service.location();
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
                    class:{x:"info",y:"info",xy:"info"},
                };
                var rmseClass = function(rmse) {
                    if (rmse >= rmse*service.model.calcGrid.rmseDanger) {
                        return "danger";
                    }
                    if (rmse >= rmse*service.model.calcGrid.rmseWarning) {
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
                            x:rmseClass(outJson.rmse.x),
                            y:rmseClass(outJson.rmse.y),
                            xy:rmseClass(Math.max(outJson.rmse.x, outJson.rmse.y)),
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
                            class:{x:"danger",y:"danger",z:"danger"},
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
                    url: "/firesight/" + camName + "/calc-fg-rect",
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
            calcOffset: function(camName) {
                var loc = service.location();
                service.results[loc] = service.results[loc] || {};
                service.results[loc].calcOffset = {
                    dx: "measuring...",
                    dy: "measuring..."
                };
                $.ajax({
                    url: "/firesight/" + camName + "/calc-offset",
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

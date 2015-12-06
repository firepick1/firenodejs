'use strict';

var services = angular.module('firenodejs.services');

services.factory('measure-service', [
    '$http', 'firestep-service', 'images-service', 'AlertService', 'firesight-service',
    function($http, firestep, images, alerts, firesight) {
        var available = null;
        var model = {
            rest: {
                lpp: {
                    z1: 30,
                    z2: 0
                },
            }
        };
        var service = {
            count: 0,
            nRandom: 2,
            radius: firestep.jog,
            results: {},
            location: function() {
                var mpo = firestep.model.mpo || {};
                return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
            },
            model: model,
            resultClass: function(result) {
                if (result.xErr === 0 && result.yErr === 0) {
                    return "success";
                } else if (result.xErr === "unknown" || result.yErr === "unknown") {
                    return "danger";
                } else if (Math.abs(result.xErr) >= 2 || Math.abs(result.yErr) >= 2) {
                    return "danger";
                } else {
                    return "warning";
                }
            },
            syncModel: function(data) {
                shared.applyJson(service.model, data);
                return service.model;
            },
            getSyncJson: function() {
                return {
                    rest: model.rest
                };
            },
            getResults: function() {
                return service.results[service.location()];
            },
            isAvailable: function() {
                return available === true;
            },
            jogPrecision: function(camName) {
                alerts.taskBegin();
                var url = "/measure/" + camName + "/jog-precision";
                var data = {
                    jog: firestep.getJog(1)
                };
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.debug("measure.jogPrecision(", data, " => ", response);
                    var loc = service.location();
                    service.results[loc] = service.results[loc] || {};
                    service.results[loc].jogPrecision = service.results[loc].jogPrecision || [];
                    service.results[loc].jogPrecision.push(response);
                    service.results[loc].jogStats = service.stats(service.results[loc].jogPrecision);
                    service.count++;
                    firesight.processCount++;
                    images.saveCount++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("measure.jogPrecision(", data, ") failed HTTP" + status);
                    images.saveCount++;
                    firesight.processCount++;
                    alerts.taskEnd();
                });
            },
            stats: function(values) {
                var summary = {
                    xErrMax: 0,
                    xErrMin: 0,
                    yErrMax: 0,
                    yErrMin: 0,
                    xErrAvg: 0,
                    yErrAvg: 0
                };
                for (var i = values.length; i-- > 0;) {
                    summary.xErrMin = Math.min(values[i].xErr, summary.xErrMin);
                    summary.xErrMax = Math.max(values[i].xErr, summary.xErrMax);
                    summary.yErrMin = Math.min(values[i].yErr, summary.yErrMin);
                    summary.yErrMax = Math.max(values[i].yErr, summary.yErrMax);
                    summary.xErrAvg += values[i].xErr;
                    summary.yErrAvg += values[i].yErr;
                }
                summary.xErrAvg = (summary.xErrAvg / values.length).toFixed(1);
                summary.yErrAvg = (summary.yErrAvg / values.length).toFixed(1);
                summary.isBeltLoose = values.length > 3 &&
                    Math.abs(summary.xErrAvg) > 1 ||
                    Math.abs(summary.yErrAvg) > 1;

                return summary;
            },
            lppPrecision: function(camName) {
                alerts.taskBegin();
                var url = "/measure/" + camName + "/lpp-precision";
                var data = {
                    jog: firestep.getJog(1),
                    z1: model.rest.lpp.z1,
                    z2: model.rest.lpp.z2,
                };
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.debug("measure.lppPrecision(", data, " => ", response);
                    var loc = service.location();
                    service.results[loc] = service.results[loc] || {};
                    service.results[loc].lppPrecision = service.results[loc].lppPrecision || [];
                    service.results[loc].lppPrecision.push(response);
                    service.results[loc].lppStats = service.stats(service.results[loc].lppPrecision);
                    service.count++;
                    firesight.processCount++;
                    images.saveCount++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("measure.lppPrecision(", data, ") failed HTTP" + status);
                    firesight.processCount++;
                    images.saveCount++;
                    alerts.taskEnd();
                });
            }
        };

        $.ajax({
            url: "/measure/model",
            success: function(data) {
                available = data && data.available;
                console.log("measure available:", available);
                service.syncModel(data);
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("measure unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

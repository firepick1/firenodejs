'use strict';

var services = angular.module('firenodejs.services');
var should = require("./should");
var JsonUtil = require("../shared/JsonUtil");

services.factory('firekue-service', ['$http', 'AlertService', 'firestep-service','$window',
    function($http, alerts, firestep, $window) {
        var client;
        var model = {
            name: "firekue-service",
            client: client,
        };
        var port = $window.location.port;
        var service = {
            isAvailable: function() {
                return service.model.rest && firestep.isAvailable();
            },
            client: client,
            jobs: [],
            model: model,
            isPlaying: false,
            step: function() {
                var url = "/firekue/step";
                alerts.taskBegin();
                $http.get(url).success(function(response, status, headers, config) {
                    console.log("firekue-service.step() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.log("firekue-service.step() => HTTP" + status, err);
                    service.refresh();
                    alerts.taskEnd();
                });
            },
            playPause: function() {
                service.isPlaying = !service.isPlaying;
                if (service.isPlaying) {
                    alert("not implemented");
                }
            },
            playPauseClass: function() {
                return service.isPlaying ? "btn-danger" : "btn-primary";
            },
            playPauseGlyph: function() {
                return service.isPlaying ? "pause" : "play";
            },
            deleteJob: function(id) {
                var url = "/firekue/job/" + id;
                alerts.taskBegin();
                $http.delete(url).success(function(response, status, headers, config) {
                    console.log("firekue-service.deleteJob() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.log("firekue-service.deleteJob() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                });
            },
            jobArray: function(job, attr) {
                return job[attr] instanceof Array ? job[attr] : [job[attr]];
            },
            postDataOf: function(req) {
                return req.postData ? JsonUtil.summarize(req.postData) : "";
            },
            resultSummary: function(result) {
                return typeof result === "object" ? JsonUtil.summarize(JSON.parse(angular.toJson(result))) : result;
            },
            addTestJob: function() {
                var url = "/firekue/job";
                var job = {
                    type: "REST",
                    data: [{
                        path: "/firestep",
                        port: port,
                        method: "POST",
                        postData: [{
                            hom: "",
                        }, {
                            mpo: "",
                        }]
                    }, {
                        path: "/firestep",
                        port: port,
                        method: "POST",
                        postData: [{
                            mov:{
                                x:50,
                                y:50,
                                z:-10,
                            },
                        }, {
                            mpo: "",
                        }]
                    }, {
                        path: "/firestep",
                        port: port,
                        method: "POST",
                        postData: [{
                            dpyds: 12,
                        }],
                    }],
                }
                alerts.taskBegin();
                $http.post(url, job).success(function(response, status, headers, config) {
                    console.log("firekue-service.addTestJob() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.log("firekue-service.addTestJob() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                });
            },
            syncModel: function(data) {
                if (client) {
                    if (data.hasOwnProperty("client")) {
                        console.log(model.name + "overriding saved client");
                        delete data.client;
                    }
                }
                JsonUtil.applyJson(model, data);
                if (!client) {
                    if (model.client) {
                        console.log(model.name + ":" + "restored saved client");
                        client = model.client;
                    } else {
                        console.log(model.name + ":" + "initializing client to default");
                        client = JSON.parse(JSON.stringify(clientDefault));;
                    }
                }
                service.client = model.client = client;
                return model;
            },
            tr_class: function(job) {
                if (job.state === "failed") {
                    return "danger";
                }
                if (job.state === "complete") {
                    return "info";
                }
                if (job.state === "active") {
                    return "success";
                }
                return "";
            },
            getSyncJson: function() {
                return service.model;
            },
            refresh: function() {
                var url = "/firekue/jobs/1..";
                alerts.taskBegin();
                $http.get(url).success(function(response, status, headers, config) {
                    service.available = true;
                    service.jobs = response;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    service.available = false;
                    console.warn("firekue unavailable :", ex);
                    alerts.taskEnd();
                });
            },
        };

        service.refresh();
        //var url = "/firekue/jobs/1..";
        //alerts.taskBegin();
        //$http.get(url).success(function(response, status, headers, config) {
        //service.available = true;
        //service.jobs = response;
        //alerts.taskEnd();
        //}).error(function(err, status, headers, config) {
        //service.available = false;
        //console.warn("firekue unavailable :", ex);
        //alerts.taskEnd();
        //});

        return service;
    }
]);

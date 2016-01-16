'use strict';

var services = angular.module('firenodejs.services');
var should = require("./should");

services.factory('firekue-service', ['$http', 'AlertService', 'firestep-service',
    function($http, alerts, firestep) {
        var client;
        var model = {
            name: "firekue-service",
            client: client,
        };
        var service = {
            isAvailable: function() {
                return service.model.rest && firestep.isAvailable();
            },
            client: client,
            jobs: [],
            model: model,
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
                    return "success";
                }
                if (job.state === "active") {
                    return "warning";
                }
                return "";
            },
            getSyncJson: function() {
                return service.model;
            },
        };

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

        return service;
    }
]);

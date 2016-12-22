'use strict';

var services = angular.module('firenodejs.services');
var should = require("./should");
var JsonUtil = require("../shared/JsonUtil");

services.factory('firekue-service', [
    '$http', 'AlertService', 'position-service', '$window', '$interval', 'RestSync',
    function($http, alerts, position, $window, $interval, restSync) {
        var client;
        var model = {
            name: "firekue-service",
            client: client,
        };
        var port = $window.location.port;
        var service = {
            isAvailable: function() {
                return service.model.rest && position.isAvailable();
            },
            client: client,
            jobs: [],
            model: model,
            isPlaying: false,
            show: {
                request: false,
                response: true,
            },
            step: function() {
                var url = "/firekue/step";
                alerts.taskBegin();
                $http.get(url).success(function(response, status, headers, config) {
                    console.log("firekue-service.step() => HTTP" + status);
                    restSync.setPollBase(true);
                    service.refresh();
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.log("firekue-service.step() => HTTP" + status, err);
                    service.refresh();
                    alerts.taskEnd();
                });
            },
            playPause: function() {
                service.msPlayPause = new Date();
                service.isPlaying = !service.isPlaying;
            },
            playPauseClass: function() {
                return service.isPlaying ? "btn-danger" : "btn-primary";
            },
            playPauseGlyph: function() {
                return service.isPlaying ? "pause" : "play";
            },
            deleteJob: function(id, onDeleted) {
                var url = "/firekue/job/" + id;
                alerts.taskBegin();
                $http.delete(url).success(function(response, status, headers, config) {
                    console.log("firekue-service.deleteJob() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                    onDeleted && onDeleted();
                }).error(function(err, status, headers, config) {
                    console.log("firekue-service.deleteJob() => HTTP" + status);
                    service.refresh();
                    alerts.taskEnd();
                });
            },
            deleteJobs: function(filter) {
                var delJobs = [];
                for (var i = 0; i < service.jobs.length; i++) {
                    var job = service.jobs[i];
                    if (filter[job.state]) {
                        delJobs.push(job.id);
                    } else {
                        console.log("skipping job:", job.id, " state:", job.state);
                    }
                }
                var deleter = function() {
                    console.log("Jobs to delete:", delJobs);
                    if (delJobs.length > 0) {
                        var id = delJobs[0];
                        delJobs = delJobs.slice(1);
                        console.log("Deleting job:", id);
                        service.deleteJob(id, deleter);
                    }
                }
                deleter();
            },
            jobArray: function(job, attr) {
                return job[attr] instanceof Array ? job[attr] : [job[attr]];
            },
            postDataOf: function(req) {
                return req.postData ? JsonUtil.summarize(req.postData) : "";
            },
            summarizeJob: function(job) {
                var data = service.jobArray(job, "data");
                var result = service.jobArray(job, "result");

                job.summary = [];
                for (var i = 0; i < data.length; i++) {
                    var res = i < result.length ? result[i] : null;
                    job.summary.push({
                        req: data[i].method + " " + data[i].path + " " + service.postDataOf(data[i]),
                        res: service.resultSummary(res),
                        link: (res != null && typeof res === "object" && res.url != null) ? res.url : null,
                    });
                }
            },
            resultSummary: function(result) {
                return result != null && typeof result === "object" ? JsonUtil.summarize(JSON.parse(angular.toJson(result))) : result;
            },
            playTitle: function() {
                var title = 'Use browser to interactively play/pause jobs step-by-step. ' +
                    'Browser tab must remain open during job execution. ';
                service.stats && (title += 'Jobs pending:' + (service.stats.inactive + service.stats.active));
                if (!position.isInitialized()) {
                    title += 'Job queue is disabled pending position initialization';
                }
                return title;
            },
            addRestRequest: function(job, path, postData, options) {
                options = options || {};
                job = job || {};
                job.type = 'REST';
                job.data = job.data || [];
                var req = {
                    path: path,
                    port: port,
                    method: options.method || (postData == null ? "GET" : "POST"),
                    postData: postData,
                };
                job.data.push(req);
                return job;
            },
            addJob_home_move_save: function(x, y, z) {
                var job = {};
                service.addRestRequest(job, "/position", [{
                    hom: "",
                }]);
                service.addRestRequest(job, "/position", [{
                    mov: {
                        x: x,
                        y: y,
                        z: z,
                    }
                }]);
                //service.addRestRequest(job, "/position", [{
                //dpyds: 12,
                //}]);
                service.addRestRequest(job, "/images/default/save");
                service.addJob(job);
            },
            addJob: function(job) {
                var promise = new Promise(function(resolve, reject) {
                    var url = "/firekue/job";
                    alerts.taskBegin();
                    $http.post(url, job).success(function(response, status, headers, config) {
                        console.log("firekue-service.addJob() => HTTP" + status);
                        service.refresh();
                        resolve(response);
                        alerts.taskEnd();
                    }).error(function(err, status, headers, config) {
                        var err = new Error("firekue-service.addJob() => HTTP" + status);
                        console.log(err);
                        reject(err);
                        service.refresh();
                        alerts.taskEnd();
                    });
                });
                return promise;
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
                    return "";
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
                    var stats = service.stats = {
                        complete: 0,
                        active: 0,
                        failed: 0,
                        inactive: 0,
                    };
                    for (var i = 0; i < service.jobs.length; i++) {
                        var job = service.jobs[i];
                        stats[job.state] = stats[job.state] == null ? 1 : (1 + stats[job.state]);
                        service.summarizeJob(job);
                    }
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    service.available = false;
                    console.warn("firekue unavailable :", err);
                    alerts.taskEnd();
                });
            },
            background: function() {
                if (service.isPlaying) {
                    service.step();
                    service.isPlaying = service.stats.active > 0 || service.stats.inactive > 0;
                    if (!service.isPlaying) {
                        var seconds = (new Date() - service.msPlayPause) / 1000;
                        alerts.info("Job queue is empty. Elapsed seconds:" + JsonUtil.round(seconds, 10));
                    }
                }
            },
            bgPromise: $interval(function() {
                service.background();
            }, 1000),
        };

        service.refresh();

        return service;
    }
]);

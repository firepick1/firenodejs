'use strict';

var services = services || angular.module('firenodejs.services', []);

services.factory('RestSync', ['$rootScope', '$http', 'AlertService',
    function($rootScope, $http, alerts) {
        var pollBase = false;
        var service = {
            synchronizer: null,
            bindModels: function(models) {
                service.synchronizer = new Synchronizer(models, {
                    beforeUpdate: function(diff) {
                        service.notifyBefore(diff);
                    },
                    afterUpdate: function(diff) {
                        service.notifyAfter(diff);
                    },
                });
            },
            buildSyncRequest: function(pollBase = true) {
                var postData = null;
                if (service.synchronizer) {
                    pollBase = pollBase || service.isPollBase();
                    if (pollBase) {
                        pollBase = !alerts.isBusy() && pollBase;
                        pollBase && service.setPollBase(false);
                    }
                    var postData = service.synchronizer.createSyncRequest({
                        pollBase: pollBase,
                    });
                    pollBase && console.log("postData:", postData);
                }
                return postData;
            },
            applySyncResponse: function(syncResponse) {
                return service.synchronizer && service.synchronizer.sync(syncResponse);
            },
            postSyncCount: 0,
            postSync: function(url, data) { // post data and synchronize models
                data = data || {};
                data.sync = service.buildSyncRequest();
                data = JSON.stringify(data);
                var promise = new Promise(function(resolve, reject) {
                    alerts.taskBegin("postSync:" + url);
                    //var sdata = angular.toJson(data) + "\n";
                    $http.post(url, data).then(response => {
                        console.debug("POST\t: " + url, data + " => ", response.data);
                        if (response.data.r && response.data.r.mpo) {
                            service.model.mpo = response.data.r.mpo;
                        }
                        if (response.data.sync) {
                            service.applySyncResponse(response.data.sync);
                        } else {
                            service.setPollBase(true);
                        }
                        resolve(response.data);
                        service.postSyncCount++;
                        alerts.taskEnd();
                    }, err => { //.error(function(err, status, headers, config) {
                        var message = "HTTP ERROR" + err.status + "(" + err.statusText + "): " +
                            ((err && err.data) && err.data.error || JSON.stringify(err.data)) + " POST:" + url;
                        console.warn(message);
                        alerts.danger(message);
                        service.setPollBase(true);
                        reject(err);
                        service.postSyncCount++;
                        alerts.taskEnd();
                    });
                });
                return promise;
            },
            onBeforeUpdate: function(beforeUpdate, scope) {
                var dtor_beforeUpdate = $rootScope.$on("beforeUpdate-event", function(event, diff) {
                    beforeUpdate && beforeUpdate(diff);
                });
                scope = scope || $rootScope;
                scope.$on("$destroy", dtor_beforeUpdate);
            },
            onAfterUpdate: function(afterUpdate, scope) {
                var dtor_afterUpdate = $rootScope.$on("afterUpdate-event", function(event, diff) {
                    afterUpdate && afterUpdate(diff);
                });
                scope = scope || $rootScope;
                scope.$on("$destroy", dtor_afterUpdate);
            },
            onIdleUpdate: function(idleUpdate, scope) {
                var dtor_idleUpdate = $rootScope.$on("idleUpdate-event", function(event, msIdle) {
                    idleUpdate && idleUpdate(msIdle);
                });
                scope = scope || $rootScope;
                scope.$on("$destroy", dtor_idleUpdate);
            },
            notifyBefore: function(diff) {
                $rootScope.$emit("beforeUpdate-event", diff);
            },
            notifyAfter: function(diff) {
                $rootScope.$emit("afterUpdate-event", diff);
            },
            notifyIdle: function(msIdle) {
                $rootScope.$emit("idleUpdate-event", msIdle);
            },
            isPollBase: function() {
                return pollBase;
            },
            setPollBase: function(value) {
                if (pollBase !== value) {
                    pollBase = value;
                }
                return pollBase;
            },
        };

        return service;
    }
]);

services.factory('AjaxAdapter', ['$http',
    function($http) {
        //console.log("Initializing AjaxAdapter");
        var ajaxAdapter = {
            autoRefresh: false,
            transmit: 1, // 0:error, 1:idle, >1:active-network-requests
            class: function(level) {
                return ajaxAdapter.transmit > level ? "fr-transmit-on" : "";
            },
            status: function() {
                switch (ajaxAdapter.transmit) {
                    case 0:
                        return "glyphicon-remove fr-transmit-dead";
                    case 1:
                        return "glyphicon-ok fr-transmit-idle";
                    default:
                        return "glyphicon-ok fr-transmit-active";
                }
            },
            icon: function() {
                return ajaxAdapter.autoRefresh ? "glyphicon-pause" : "glyphicon-repeat";
            },
            click: function() {
                ajaxAdapter.autoRefresh = !ajaxAdapter.autoRefresh;
            },
            clear: function() {
                ajaxAdapter.autoRefresh = false;
                ajaxAdapter.transmit = 1;
            },
            isIdle: function() {
                return ajaxAdapter.transmit == 1;
            },
            isBusy: function() {
                return ajaxAdapter.transmit > 1;
            },
            isError: function() {
                return ajaxAdapter.transmit == 0;
            },
            start: function() {
                ajaxAdapter.transmit = ajaxAdapter.transmit ? (ajaxAdapter.transmit + 1) : 2;
            },
            end: function(ok) {
                if (ok) {
                    ajaxAdapter.transmit = ajaxAdapter.transmit > 0 ? (ajaxAdapter.transmit - 1) : 0;
                } else {
                    ajaxAdapter.autoRefresh = false;
                    ajaxAdapter.transmit = 0;
                }
            }
        };
        return ajaxAdapter;
    }
]);

services.factory('ServiceConfig', ['$http', 'AjaxAdapter', '$location', '$q',
    function($http, transmit, location, $q) {
        console.log("Initializing ServiceConfig");
        var service = {
            server: location.host() || "unknownhost",
            port: location.port() || "unknownport",
            name: "/firenodejs",
            sync: "",
            expand: {},
            expand_icon: function(value) {
                return "glyphicon fr-collapse-icon glyphicon-wrench";
            },
            expand_toggle: function(value) {
                service.expand[value] = !service.expand[value];
            },
            service_url: function() {
                var port = service.port === "" ? "" : (":" + service.port);
                return "http://" + service.server + port + service.name;
            },
            config_url: function() {
                return service.service_url() + "/config.json";
            },
            isValidJSON: function(value) {
                try {
                    JSON.parse(value);
                } catch (e) {
                    console.log("JSON invalid:" + value);
                    return false;
                }
                return true;
            },
            load_config: function(scope, bg) {
                service.scope = scope;
                service.cv = scope.cv;
                var deferred = $q.defer();
                console.log("ServiceConfig.config_load(" + service.config_url() + ")");
                service.config = {
                    "status": "loading..."
                };
                transmit.start();
                deferred.notify("Sending service config.json request");
                $.ajax({
                    url: service.config_url(),
                    data: {},
                    success: function(data) {
                        transmit.end(true);
                        console.log("config_load() => " + JSON.stringify(data.firenodejs));
                        service.config = data;
                        service.cv && service.cv.on_load_config(data);
                        scope.config = service.config;
                        bg && (bg.worker = scope.worker);
                        deferred.resolve(service.config);
                    },
                    error: function(jqXHR, ex) {
                        scope.$apply(function() {
                            service.cv && service.cv.on_load_config(null);
                        });
                        console.error("ServiceConfig.config_load() ex:" + ex + "," + JSON.stringify(jqXHR));
                        transmit.end(false);
                        deferred.reject(ex);
                    }
                });
                return deferred.promise;
            }
        }
        return service;
    }
]);

services.factory('BackgroundThread', ['$http', '$interval', 'AjaxAdapter',
    function($http, $interval, transmit) {
        //console.log("Initializing BackgroundThread");
        var backgroundThread = {
            worker: function(ticks) {
                return true;
            },
            t: 0,
            error: null
        };

        var promise = $interval(function(ticks) {
            backgroundThread.t++;
            if (transmit.isIdle() && transmit.autoRefresh) {
                if (!backgroundThread.worker(ticks)) {
                    console.log("Background thread exiting. ticks:" + ticks);
                    $interval.cancel(promise);
                }
            }
        }, 200);

        return backgroundThread;
    }
]);

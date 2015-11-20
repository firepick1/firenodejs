'use strict';

var services = angular.module('firenodejs.services');

services.factory('firestep-service', ['$http', 'AlertService',
    function($http, alerts) {
        var available = null;
        var marks = [];
        var rest = {
            jog: 10,
            displayLevel: 128,
            marks: marks,
            startup: {},
        };
        var service = {
            model: {
                rest: rest
            },
            rest: rest,
            marks: marks,
            markMatrix:[[0,1],[2,3],[4,5]],
            startupClass: function() {
                try {
                    JSON.parse(rest.startup.json);
                    return "has-success";
                } catch (e) {
                    return "has-error";
                }
            },
            initialize: function() {
                service.send(rest.startup.json);
            },
            syncModel: function(data) {
                if (data) {
                    shared.applyJson(service.model, data);
                    if (rest.marks.hasOwnProperty("mark1")) {
                        console.log("ignoring legacy marks");
                        service.model.marks = marks;
                    }
                    service.onChangeStartupFlag();
                } else {
                    $http.get("/firestep/model").success(function(response, status, headers, config) {
                        console.debug("firestep.syncModel() => ", response);
                        service.syncModel(response);
                        alerts.taskEnd();
                    }).error(function(err, status, headers, config) {
                        console.warn("firestep.syncModel() failed HTTP" + status);
                        available = false;
                        alerts.taskEnd();
                    });
                }
                return service.model;
            },
            count: 0, // command count (changes imply model updated)
            isAvailable: function() {
                return available === true;
            },
            marks: marks,
            getSyncJson: function() {
                return {
                    rest: rest
                };
            },
            onChangeStartupFlag: function(flag) {
                console.log("startup flag:", flag);
                if (rest.startup.custom) {
                    if (rest.startup.jsonCustom) {
                        rest.startup.json = rest.startup.jsonCustom;
                    }
                } else {
                    rest.startup.jsonCustom = rest.startup.json;
                    var json = [];
                    if (rest.startup.id) {
                        json.push({
                            "id": ""
                        });
                    }
                    if (rest.startup.hom) {
                        json.push({
                            "hom": ""
                        });
                    }
                    if (rest.startup.mpo) {
                        json.push({
                            "mpo": ""
                        });
                    }
                    rest.startup.json = angular.toJson(json);
                }
            },
            getJog: function(n) {
                return n * Number(rest.jog);
            },
            mark: function(name) {
                marks[name] = marks[name] || {
                    x: 0,
                    y: 0,
                    z: 0
                };
                marks[name].x = service.model.mpo.x;
                marks[name].y = service.model.mpo.y;
                marks[name].z = service.model.mpo.z;
                return service;
            },
            goto: function(name) {
                marks[name] = marks[name] || {
                    x: 0,
                    y: 0,
                    z: 0
                };
                service.mov(marks[name]);
            },
            send: function(data) {
                var sdata = JSON.angular.toJson) + "\n";
                alerts.taskBegin();
                $http.post("/firestep", data).success(function(response, status, headers, config) {
                    console.debug("firestep.send(", data, " => ", response);
                    if (response.r.mpo) {
                        service.model.mpo = response.r.mpo;
                    }
                    service.count++;
                    alerts.taskEnd();
                    if (!service.model.initialized) {
                        service.syncModel();
                    }
                }).error(function(err, status, headers, config) {
                    console.warn("firestep.send(", data, ") failed HTTP" + status);
                    service.count++;
                    alerts.taskEnd();
                });
            },
            hom: function() {
                service.send([{
                    "dpydl": rest.displayLevel,
                    "hom": ""
                }, {
                    "mpo": "",
                    "dpyds": 12
                }]);
                return service;
            },
            movr: function(pos) {
                var args = {};
                var cmd = [{
                    "dpydl": rest.displayLevel,
                    "mov": args
                }, {
                    "mpo": "",
                    "dpyds": 12
                }];
                if (pos.hasOwnProperty("x")) {
                    args.xr = pos.x;
                }
                if (pos.hasOwnProperty("y")) {
                    args.yr = pos.y;
                }
                if (pos.hasOwnProperty("z")) {
                    args.zr = pos.z;
                }
                if (pos.hasOwnProperty("a")) {
                    args.ar = pos.a;
                }
                service.send(cmd);
                return service;
            },
            mov: function(pos) {
                var args = {};
                var cmd = [{
                    "dpydl": rest.displayLevel,
                    "mov": args
                }, {
                    "mpo": "",
                    "dpyds": 12
                }];
                if (pos.hasOwnProperty("x")) {
                    args.x = pos.x;
                }
                if (pos.hasOwnProperty("y")) {
                    args.y = pos.y;
                }
                if (pos.hasOwnProperty("z")) {
                    args.z = pos.z;
                }
                if (pos.hasOwnProperty("a")) {
                    args.a = pos.a;
                }
                service.send(cmd);
                return service;
            }
        };

        alerts.taskBegin();
        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                available = data && data.available;
                console.log("firestep available:", available);
                shared.applyJson(service.model, data);
                alerts.taskEnd();
                service.count++;
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("firestep not available");
                transmit.end();
                service.count++;
            }
        });
        return service;
    }
]);

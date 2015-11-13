'use strict';

var services = angular.module('firenodejs.services');

services.factory('firestep-service', ['$http', 'AlertService',
    function($http, alerts) {
        var available = null;
        var service = {
            model: {},
            getModel: function() {
                return service.model;
            },
            displayLevel:128,
            count: 0, // command count (changes imply model updated)
            jog: 10,
            isAvailable: function() {
                return available;
            },
            marks: {
                "mark1": {
                    x: 0,
                    y: 0,
                    z: 0
                },
                "mark2": {
                    x: 0,
                    y: 0,
                    z: 0
                },
                "mark3": {
                    x: 0,
                    y: 0,
                    z: 0
                }
            },
            getJog: function(n) {
                return n*Number(service.jog);
            },
            mark: function(name) {
                service.marks[name] = service.marks[name] || {
                    x: 0,
                    y: 0,
                    z: 0
                };
                service.marks[name].x = service.model.mpo.x;
                service.marks[name].y = service.model.mpo.y;
                service.marks[name].z = service.model.mpo.z;
                return service;
            },
            goto: function(name) {
                service.marks[name] = service.marks[name] || {
                    x: 0,
                    y: 0,
                    z: 0
                };
                service.mov(service.marks[name]);
            },
            send: function(data) {
                var sdata = JSON.stringify(data) + "\n";
                alerts.taskBegin();
                $http.post("/firestep", data).success(function(response, status, headers, config) {
                    console.debug("firestep.send(", data, " => ", response);
                    if (response.r.mpo) {
                        service.model.mpo = response.r.mpo;
                    }
                    service.count++;
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("firestep.send(", data, ") failed HTTP" + status);
                    service.count++;
                    alerts.taskEnd();
                });
            },
            hom: function() {
                service.send([{
                    "dpydl": service.displayLevel,
                    "hom": ""
                }, {
                    "mpo": "",
                    "dpyds": 12
                }]);
                service.model.homed = true;
                return service;
            },
            movr: function(pos) {
                var args = {};
                var cmd = [{
                    "dpydl": service.displayLevel,
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
                    "dpydl": service.displayLevel,
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
                service.model = data;
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

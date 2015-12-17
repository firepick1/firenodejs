'use strict';

var services = angular.module('firenodejs.services');
var DeltaCalculator = firepick.DeltaCalculator;

services.factory('firestep-service', ['$http', 'AlertService',
    function($http, alerts) {
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
            test: {},
            marks: marks,
            markMatrix: [
                [0, 1],
                [2, 3],
                [4, 5]
            ],
            position: function(coord) {
                var pos = service.model.mpo[coord];
                var posn = service.model.mpo[coord+"n"];
                return pos === posn ? pos : (pos + " (" + posn + ")");
            },
            startupClass: function() {
                try {
                    JSON.parse(rest.startup.json);
                    return "has-success";
                } catch (e) {
                    return "has-error";
                }
            },
            onTest: function() {
                if (service.test.enabled) {
                    service.test.enabled = false;
                    alerts.taskBegin();
                    $http.post("/firestep/test", service.test).success(function(response, status, headers, config) {
                        console.debug("firestep.send(", service.test, " => ", response);
                        if (response.mpo) {
                            service.model.mpo = response.mpo;
                        }
                        alerts.taskEnd();
                    }).error(function(err, status, headers, config) {
                        console.warn("firestep.send(", service.test, ") failed HTTP" + status);
                        alerts.taskEnd();
                    });
                }
            },
            initialize: function() {
                console.log("firestep-service.initialize()");
                service.send(rest.startup.json);
            },
            onChangeSerialPath: function() {
                var alert = alerts.info("Establishing connection to new serial path:" + service.model.rest.serialPath);
                service.model.initialized = null;
                service.model.available = null;
                setTimeout(function() {
                    console.info("INFO\t: refreshing model due to serialPath change:", service.model.rest.serialPath);
                    service.syncModel();
                    alerts.close(alert);
                }, 5000);
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
                    alerts.taskBegin();
                    $http.get("/firestep/model").success(function(response, status, headers, config) {
                        console.debug("firestep.syncModel() => ", response);
                        service.syncModel(response);
                        alerts.taskEnd();
                    }).error(function(err, status, headers, config) {
                        console.warn("firestep.syncModel() failed HTTP" + status);
                        service.model.available = false;
                        alerts.taskEnd();
                    });
                }
                return service.model;
            },
            count: 0, // command count (changes imply model updated)
            isAvailable: function() {
                return service.model.available;
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
                var m = marks[name] = marks[name] || {
                    x: 0,
                    y: 0,
                    z: 0
                };
                m.x = service.model.mpo.x;
                m.y = service.model.mpo.y;
                m.z = service.model.mpo.z;
                service.onMarkChanged(m);
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
            markClass: function(m) {
                if (!m) {
                    return "has-error";
                }
                if (!m.hasOwnProperty("class")) {
                    service.onMarkChanged(m);
                }
                return m.class;
            },
            onMarkChanged: function(m) {
                var options = {};
                if (!m) {
                    return;
                }
                var dim = service.model.dim;
                if (dim) {
                    options = {
                        e: dim.e,
                        f: dim.f,
                        gearRatio: dim.gr,
                        re: dim.re,
                        rf: dim.rf,
                        spa: dim.spa,
                        spr: dim.spr,
                        steps360: dim.st,
                        microsteps: dim.mi,
                        homeAngles: {
                            theta1: dim.ha,
                            theta2: dim.ha,
                            theta3: dim.ha,
                        }
                    };
                }
                var dc = new DeltaCalculator(options);
                var pulses = dc.calcPulses(m);
                var xyz = dc.calcXYZ(pulses);
                var mxyz = {
                    x: Math.round(xyz.x * 1000) / 1000,
                    y: Math.round(xyz.y * 1000) / 1000,
                    z: Math.round(xyz.z * 1000) / 1000,
                };
                if (m.x !== mxyz.x || m.y !== mxyz.y || m.z !== mxyz.z) {
                    m.title = "Mark should be on microstep grid for best precision";
                    m.class = "has-warning";
                    m.icon = "warning-sign";
                } else {
                    m.title = "Mark is on microstep grid";
                    m.class = "has-success";
                    m.icon = "ok";
                }
            },
            send: function(data) {
                var sdata = angular.toJson(data) + "\n";
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
                shared.applyJson(service.model, data);
                alerts.taskEnd();
                service.count++;
            },
            error: function(jqXHR, ex) {
                transmit.end();
                service.count++;
            }
        });
        return service;
    }
]);

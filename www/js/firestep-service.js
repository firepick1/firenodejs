'use strict';

var services = angular.module('firenodejs.services');
var MTO_FPD = require("./shared/MTO_FPD");
var MTO_XYZ = require("./shared/MTO_XYZ");
var JsonUtil = require("./shared/JsonUtil");

services.factory('firestep-service', ['$http', 'AlertService',
    function($http, alerts) {
        var marks = [];
        var rest = {
            jog: 10,
            displayLevel: 128,
            marks: marks,
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
                var posn = service.model.mpo[coord + "n"];
                return pos === posn ? pos : (pos + " (" + posn + ")");
            },
            onTest: function() {
                if (service.test.enabled) {
                    service.test.enabled = false;
                    service.post("/firestep/test", service.test);
                }
            },
            onChangeResetStr: function() {
                try {
                    delete service.model.beforeReset;
                    service.model.beforeReset = JSON.parse(service.resetStr);
                } catch (e) {
                    // bad JSON
                }
            },
            isResetStrValid: function() {
                try {
                    service.resetStr == null ||
                        service.resetStr === "" ||
                        JSON.parse(service.resetStr);
                    return true;
                } catch (e) {
                    return false;
                }
            },
            reset: function() {
                service.post("/firestep/reset", service.model.beforeReset);
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
                    JsonUtil.applyJson(service.model, data);
                    if (rest.marks.hasOwnProperty("mark1")) {
                        console.log("ignoring legacy marks");
                        service.model.marks = marks;
                    }
                    if (JsonUtil.isEmpty(service.model.beforeReset)) {
                        service.resetStr = "";
                    } else {
                        service.resetStr = JSON.stringify(service.model.beforeReset);
                    }
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
            kinematicModel: "Unknown",
            get_mto: function() {
                var mto;
                if (service.model.sys) {
                    switch (service.model.sys.to) {
                        case 2:
                            mto = new MTO_XYZ();
                            break;
                        case 1:
                            mto = new MTO_FPD();
                            break;
                    }
                }
                mto = mto || new MTO_FPD();
                service.kinematicModel = mto.kinematicModel;
                service.model.dim && mto.updateDimensions(service.model.dim);
                return mto;
            },
            onMarkChanged: function(m) {
                var options = {};
                if (!m || m.x == null || m.y == null || m.z == null) {
                    return;
                }
                var dim = service.model.dim;
                var mto = service.get_mto();
                var pulses = mto.calcPulses(m);
                var xyz = mto.calcXYZ(pulses);
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
            post: function(url, data) {
                alerts.taskBegin();
                //var sdata = angular.toJson(data) + "\n";
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.debug("firestep.post(", data, ") => ", response);
                    if (response.r.mpo) {
                        service.model.mpo = response.r.mpo;
                    }
                    service.count++;
                    alerts.taskEnd();
                    if (!service.model.initialized) {
                        service.syncModel();
                    }
                }).error(function(err, status, headers, config) {
                    console.warn("firestep.post(", data, ") failed HTTP" + status);
                    service.count++;
                    alerts.taskEnd();
                });
            },
            hom: function() {
                service.post("/firestep", [{
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
                service.post("/firestep", cmd);
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
                service.post("/firestep", cmd);
                return service;
            }
        };

        alerts.taskBegin();
        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                JsonUtil.applyJson(service.model, data);
                service.kinematicModel = service.get_mto().kinematicModel;
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

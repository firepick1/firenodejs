'use strict';

var services = angular.module('firenodejs.services');
var MTO_FPD = require("./shared/MTO_FPD");
var MTO_XYZ = require("./shared/MTO_XYZ");
var JsonUtil = require("./shared/JsonUtil");

services.factory('firestep-service', ['$http', 'AlertService', 'UpdateService',
    function($http, alerts, updateService) {
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
            alert: {},
            edit: {},
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
                    delete service.model.rest.beforeReset;
                    service.model.rest.beforeReset = JSON.parse(service.resetStr);
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
                service.post("/firestep/reset", service.model.rest.beforeReset);
            },
            applySerialPath: function(path) {
                service.model.rest.serialPath = path;
                service.alert.establishSerial && alerts.close(service.alert.establishSerial);
                service.alert.establishSerial = alerts.info("Establishing connection to new serial path:" + path);
                service.model.initialized = null;
                service.model.available = null;
            },
            //syncModel: function(data) {
                //if (data) {
                    //JsonUtil.applyJson(service.model, data);
                    //if (rest.marks.hasOwnProperty("mark1")) {
                        //console.log("ignoring legacy marks");
                        //service.model.marks = marks;
                    //}
                    //if (JsonUtil.isEmpty(service.model.rest.beforeReset)) {
                        //service.resetStr = "";
                    //} else {
                        //service.resetStr = JSON.stringify(service.model.rest.beforeReset);
                    //}
                //} else {
                    //alerts.taskBegin();
                    //$http.get("/firestep/model").success(function(response, status, headers, config) {
                        //console.debug("firestep.syncModel() => ", response);
                        //service.syncModel(response);
                        //alerts.taskEnd();
                    //}).error(function(err, status, headers, config) {
                        //console.warn("firestep.syncModel() failed HTTP" + status);
                        //service.model.available = false;
                        //alerts.taskEnd();
                    //});
                //}
                //return service.model;
            //},
            count: 0, // command count (changes imply model updated)
            isAvailable: function() {
                if (service.model.available == null) {
                    return service.pollRetries > 0 ? null : false;
                }
                return service.model.available;
            },
            getSyncJson: function() {
                return {
                    rest: rest
                };
            },
            getJog: function(n) {
                return n * Number(rest.jog);
            },
            mark: function(im) {
                var marks = service.rest.marks;
                var m = marks[im] = marks[im] || {
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
            goto: function(im) {
                var marks = service.rest.marks;
                marks[im] = marks[im] || {
                    x: 0,
                    y: 0,
                    z: 0
                };
                service.mov(marks[im]);
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
            polling: false,
            pollRetries: 3,
            beforeUpdate: function(diff) {
                //if (diff && service.alert.establishSerial) {
                    //if (diff.firestep.available === true) {
                        //alerts.close(service.alert.establishSerial);
                        //alerts.success("FireStep is available at serialPath:" + service.model.rest.serialPath);
                        //delete service.alert.establishSerial;
                    //} else if (diff.firestep.available === false) {
                        //alerts.close(service.alert.establishSerial);
                        //alerts.danger("FireStep is unavailable at serialPath:" + service.model.rest.serialPath);
                        //delete service.alert.establishSerial;
                    //}
                //}
            },
            afterUpdate: function(diff) {
                service.edit.serialPath = service.model.rest.serialPath;
            },
            idleUpdate: function(msIdle) {
                if (service.alert.establishSerial) {
                    if (service.model.available == null) {
                        // uninitialized
                        console.log("TODO================>idleUpdate");
                    } else if (service.model.available === true) {
                        alerts.close(service.alert.establishSerial);
                        alerts.success("FireStep is available at serialPath:" + service.model.rest.serialPath);
                        delete service.alert.establishSerial;
                    } else if (service.model.available === false) {
                        alerts.close(service.alert.establishSerial);
                        alerts.danger("FireStep is unavailable at serialPath:" + service.model.rest.serialPath);
                        delete service.alert.establishSerial;
                    }
                } else {
                    if (!service.model.available) {
                        if (service.pollRetries >= 0) {
                            if (!service.polling) {
                                service.pollRetries--;
                                if (service.pollRetries >= 0) {
                                    if (!service.alert.establishSerial && service.edit.serialPath) {
                                        service.alert.establishSerial = alerts.info("Establishing serial connection to device:" + service.model.rest.serialPath);
                                    }
                                    console.log("firestep: not available (retrying...)");
                                    alerts.taskBegin();
                                    service.polling = true;
                                    setTimeout(function() {
                                        alerts.taskEnd();
                                        updateService.setPollBase(true);
                                        service.polling = false;
                                    }, 3000);
                                } else {
                                    console.log("firestep: not available (timeout)");
                                }
                            }
                        }
                    } else {
                        updateService.setPollBase(false);
                        service.pollRetries = 0;
                    }
                }
                if (msIdle > 3000) {
                    if (service.edit.serialPath !== service.model.rest.serialPath) {
                        if (service.edit.serialPath) {
                            service.applySerialPath(service.edit.serialPath);
                        }
                    }
                }
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

        updateService.onBeforeUpdate(service.beforeUpdate);
        updateService.onAfterUpdate(service.afterUpdate);
        updateService.onIdleUpdate(service.idleUpdate);

        return service;
    }
]);

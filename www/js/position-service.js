'use strict';

var services = angular.module('firenodejs.services');
var MTO_FPD = require("./shared/MTO_FPD");
var MTO_XYZ = require("./shared/MTO_XYZ");
var JsonUtil = require("./shared/JsonUtil");
var MTO_C3 = require("./shared/MTO_C3");

services.factory('position-service', ['$http', 'AlertService', 'UpdateService',
    function($http, alerts, updateService) {
        var marks = [];
        var rest = {
            zCruise: 0,
            jog: 10,
            displayLevel: 128,
            marks: marks,
        };
        var service = {
            model: {
                rest: rest,
                kinematics: {},
            },
            moreGroup: "Config",
            rest: rest,
            test: {},
            marks: [],
            markMatrix: [
                [0, 1],
                [2, 3],
                [4, 5]
            ],
            moreGroupSel: function() {
                console.log("hello:", service.moreGroup);
            },
            alert: {},
            edit: {},
            kinematics: function() {
                var that = this;
                var currentType = service.model.kinematics.currentType;
                var kinematics = currentType && service.model.kinematics[currentType];
                return kinematics;
            },
            axisMmMicrosteps: function(axis) {
                var result = null;
                var kinematics = service.kinematics();
                if (kinematics && kinematics.type === 'MTO_C3') {
                    if (axis.drive === 'belt') {
                        axis.mmMicrosteps = MTO_C3.pulleyMmMicrosteps(axis.pitch, axis.teeth, axis.steps, axis.microsteps);
                    } else if (axis.drive === 'gear') {
                        var mmMsteps = MTO_C3.pulleyMmMicrosteps(axis.pitch, axis.teeth, axis.steps, axis.microsteps);
                        axis.mmMicrosteps = mmMsteps * axis.gearIn / axis.gearOut;
                    }
                    return axis.mmMicrosteps;
                }
                return null;
            },
            position: function(coord) {
                var pos = service.model.mpo[coord];
                var posn = service.model.mpo[coord + "n"];
                return pos === posn ? pos : (pos + " (" + posn + ")");
            },
            isXYDisabled: function() {
                return alerts.isBusy() || service.position("z") < service.model.rest.zCruise;
            },
            onTest: function() {
                if (service.test.enabled) {
                    service.test.enabled = false;
                    service.post("/position/test", service.test);
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
            reset: function(cmd) {
                var info = alerts.info("Resetting FireStep...");
                cmd = cmd || service.model.reset.beforeReset;
                service.post("/position/reset", cmd).then(mpo => {
                    setTimeout(function() { // wait for idle sync
                        alerts.close(info);
                    }, 2000);
                }, err => {
                    alerts.danger("Error:"+err);
                });
            },
            applySerialPath: function(path) {
                service.model.rest.serialPath = path;
                service.alert.establishSerial && alerts.close(service.alert.establishSerial);
                service.alert.establishSerial = alerts.info("Establishing connection to new serial path:" + path);
                service.model.initialized = null;
                service.model.available = null;
            },
            count: 0, // command count (changes imply model updated)
            isAvailable: function() {
                if (service.model.available == null) {
                    return service.pollRetries > 0 ? null : false;
                }
                return service.model.available;
            },
            getSyncJson: function() {
                console.warn("DEPRECATED getSyncJson");
                return {
                    rest: rest,
                    kinematics: service.model.kinematics,
                };
            },
            getJog: function(n) {
                return n * Number(rest.jog);
            },
            markButton: function(im) {
                var marks = service.marks;
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
            beforeUpdate: function(diff) {},
            afterUpdate: function(diff) {
                service.edit.serialPath = service.model.rest.serialPath;
                service.resetStr = service.resetStr || JSON.stringify(service.model.rest.beforeReset);
                for (var i = 0; i < service.marks.length && i < service.model.rest.marks.length; i++) {
                    var srcMark = service.model.rest.marks[i];
                    var dstMark = service.marks[i];
                    if (dstMark.name === "") {
                        // console.log("restoring saved mark:", srcMark.name);
                        delete srcMark.title; // legacy junk
                        delete srcMark.icon; // legacy junk
                        delete srcMark.class; // legacy junk
                        dstMark.name = srcMark.name;
                        dstMark.x = srcMark.x;
                        dstMark.y = srcMark.y;
                        dstMark.z = srcMark.z;
                        service.onMarkChanged(dstMark);
                    }
                }
            },
            pollRetries: 10,
            idleUpdate: function(msIdle) {
                if (service.alert.establishSerial) {
                    if (service.model.available == null) {
                        // TODO service unavailable
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
                                    console.log("position: not available (retrying...)");
                                    alerts.taskBegin();
                                    service.polling = true;
                                    setTimeout(function() {
                                        alerts.taskEnd();
                                        !service.model.available && updateService.setPollBase(true);
                                        service.polling = false;
                                    }, 1000);
                                } else {
                                    console.log("position: not available (timeout)");
                                }
                            }
                        }
                    } else {
                        service.pollRetries = 0;
                    }
                }
                if (msIdle > 2000) {
                    if (service.edit.serialPath !== service.model.rest.serialPath) {
                        if (service.edit.serialPath) {
                            service.applySerialPath(service.edit.serialPath);
                        }
                    }
                    for (var i = 0; i < service.marks.length; i++) {
                        // copy UI marks to model for archival
                        var srcMark = service.marks[i];
                        if (srcMark.name.length > 0) {
                            // initialized marks always overwrite server marks
                            var dstMark = service.model.rest.marks[i];
                            // dstMark.name != srcMark.name && console.log("archiving srcMark:", srcMark.name, "dstMark:", dstMark);
                            dstMark.name = srcMark.name;
                            dstMark.x = srcMark.x;
                            dstMark.y = srcMark.y;
                            dstMark.z = srcMark.z;
                        }
                    }
                }
            },
            isInitialized: function() {
                return service.model.initialized === true;
            },
            kinematicModel: "Unknown", // DEPRECATED
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
                if (typeof data === 'object') {
                    data = JSON.stringify(data);
                }
                var promise = new Promise(function(resolve, reject) {
                    alerts.taskBegin();
                    //var sdata = angular.toJson(data) + "\n";
                    $http.post(url, data).then( (response) => {
                        console.debug("POST\t: " + url, data + " => ", response);
                        if (response.r && response.r.mpo) {
                            service.model.mpo = response.r.mpo;
                        }
                        updateService.setPollBase(true);
                        resolve(response);
                        service.count++;
                        alerts.taskEnd();
                    }, err => { //.error(function(err, status, headers, config) {
                        var message = "HTTP ERROR" + err.status + "(" + err.statusText + "): " +    
                            ((err && err.data) && err.data.error || JSON.stringify(err.data)) + " POST:" + url;
                        console.warn(message);
                        alerts.danger(message);
                        updateService.setPollBase(true);
                        reject(err);
                        service.count++;
                        alerts.taskEnd();
                    });
                });
                return promise;
            },
            home: function(axisId) {
                var url = "/position/home" + (axisId ? ("/" + axisId) : "");
                return service.post(url, "");
            },
            move: function(xyz) {
                var url = "/position/move";
                return service.post(url, xyz);
            },
            hom: function(axisId) { // DEPRECATED
                var kinematics = service.kinematics();
                var cmds = [];
                cmds.push({
                    hom: "",
                });
                cmds.push({
                    "dpydl": rest.displayLevel,
                });
                cmds.push({
                    "mpo": "",
                });
                service.post("/position", cmds);
                return service;
            },
            movr: function(pos) { // DEPRECATED
                var args = {};
                var cmd = [{
                    "dpydl": rest.displayLevel,
                    "mov": args
                }, {
                    "mpo": "",
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
                service.post("/position", cmd);
                return service;
            },
            mov: function(pos) { // DEPRECATED
                var args = {};
                var cmd = [{
                    "dpydl": rest.displayLevel,
                    "mov": args
                }, {
                    "mpo": "",
                    //"dpyds": 12
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
                service.post("/position", cmd);
                return service;
            }
        };

        if (service.marks.length === 0) {
            // create placeholder marks for AngularJS data binding
            for (var i = 1; i <= 6; i++) {
                service.marks.push({
                    name: "",
                    x: 0,
                    y: 0,
                    z: 0,
                });
            }
        }

        updateService.onBeforeUpdate(service.beforeUpdate);
        updateService.onAfterUpdate(service.afterUpdate);
        updateService.onIdleUpdate(service.idleUpdate);

        return service;
    }
]);

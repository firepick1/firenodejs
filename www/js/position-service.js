'use strict';

var services = angular.module('firenodejs.services');
var JsonUtil = require("./shared/JsonUtil");
var MTO_Factory = require("./shared/MTO_Factory");
var MTO_FPD = require("./shared/MTO_FPD");
var MTO_XYZ = require("./shared/MTO_XYZ");
var MTO_C4 = require("./shared/MTO_C4");

services.factory('position-service', ['$http', 'AlertService', 'RestSync',
    function($http, alerts, restSync) {
        var marks = [];
        var rest = {
            zCruise: 0,
            jog: 10,
            displayLevel: 128,
            marks: marks,
        };
        var axisMap = null;
        var service = {
            model: {
                rest: rest,
                kinematics: {},
                cfgAxis: "X-axis",
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
            axisOfId: function(axisId) {
                var axes = service.kinematics().axes;
                if (axisMap == null) {
                    axisMap = {};
                    for (var iAxis = 0; iAxis < axes.length; iAxis++) {
                        var axis = axes[iAxis];
                        axisMap[axis.id] = axis;
                    }
                }
                return axisMap[axisId];
            },
            moreGroupSel: function() {
                console.log("hello:", service.moreGroup);
            },
            alert: {},
            edit: {},
            onChange_mstepPulses: function(axis, pulses) {
                var scale = pulses / axis.mstepPulses;
                axis.maxHz = Math.round(100 * axis.maxHz / scale) / 100;
                axis.tAccel = Math.round(100 * axis.tAccel * scale) / 100;
                axis.mstepPulses = pulses;
                service.kinematics(true);
            },
            mtoClass: function() {
                var currentType = service.model.kinematics.currentType;
                var mtoClass = null;
                mtoClass = mtoClass || (currentType === "MTO_C3" && MTO_C3);
                mtoClass = mtoClass || (currentType === "MTO_C4" && MTO_C4);
                return mtoClass;
            },
            calc_unitTravel: function(axis) {
                var travel = null; // unknown
                var mtoClass = service.mtoClass();
                if (mtoClass) {
                    var unitTravel = mtoClass.calc_unitTravel(axis);
                    //travel = Math.round(unitTravel*100)/100;
                    travel = unitTravel;
                }
                return travel;
            },
            onChangeEnabled: function(axis) {
                var kinematics = service.kinematics(true);
                axis === kinematics.axes[0] && (service.model.homed.x = false);
                axis === kinematics.axes[1] && (service.model.homed.y = false);
                axis === kinematics.axes[2] && (service.model.homed.z = false);
            },
            axes: function() {
                var kinematics = service.kinematics();
                var result = [];
                kinematics.axes[0] && result.push(kinematics.axes[0]);
                kinematics.axes[1] && result.push(kinematics.axes[1]);
                kinematics.axes[2] && result.push(kinematics.axes[2]);
                kinematics.axes[3] && result.push(kinematics.axes[3]);
                if (result.length) {
                    var cfgAxis = null;
                    for (var iAxis = 0; iAxis < result.length; iAxis++) {
                        if (service.model.cfgAxis === result[iAxis].name) {
                            cfgAxis = service.model.cfgAxis;
                            break;
                        }
                    }
                    service.model.cfgAxis = cfgAxis || result[0].name;
                }
                return result;
            },
            kinematics: function(resolve = false) {
                var currentType = service.model.kinematics.currentType;
                var kinematics = currentType && service.model.kinematics[currentType];
                if (resolve) {
                    var mtoClass = service.mtoClass();
                    if (mtoClass) {
                        new mtoClass({
                            model: kinematics
                        }).resolve();
                    } else {
                        alerts.danger("Error: unsupported kinematic model:" + currentType);
                    }
                }
                return kinematics;
            },
            axisLimits: function(axis) {
                var kinematics = service.kinematics();
                var unitTravel = axis.unitTravel;
                var pulses = (axis.mstepPulses * Math.pow(2, service.model.posBits - 1));
                var pos = pulses * unitTravel / axis.mstepPulses;
                pulses = Math.round(pulses * 100) / 100;
                pos = Math.trunc(pos * 100) / 100;
                return {
                    minPos: -pos,
                    maxPos: pos,
                    minPulses: -pulses,
                    maxPulses: pulses - 1,
                    unitTravel: Math.round(unitTravel * 100000) / 100, // position increment in microns
                }
            },
            position: function(axisId) {
                var actual = null;
                var nominal = null;
                var motor = null;
                var mpo = service.model.mpo;
                if (mpo) {
                    actual = mpo[axisId];
                    nominal = mpo[axisId + "n"];
                    var kinematics = service.kinematics();
                    var axis = service.axisOfId(axisId);
                    var unitTravel = axis.unitTravel;
                    var motor = Math.round(nominal / unitTravel);
                }
                return {
                    actual: actual,
                    nominal: nominal,
                    motor: motor,
                }
            },
            resetAxis: function(axisId) {
                var kinematics = service.kinematics(true);
                var axis = service.axisOfId(axisId);
                if (axis) {
                    var keys = Object.keys(axis);
                    for (var iKey = 0; iKey < keys.length; iKey++) {
                        axis[keys[iKey]] = null;
                    }
                }
                return service.kinematics(true);
            },
            motionRestrictions: function() {
                var restrictions = [];
                var kinematics = service.kinematics();
                if (!service.canCruiseXY()) {
                    restrictions.push("X/Y movement is restricted while Z-axis is below cruise height and Z-axis is enabled");
                }
                var axisRestrictions = function(axis) {
                    if (!axis.enabled) {
                        restrictions.push(axis.name + " is currently disabled");
                    }
                    if (axis.enabled && !service.canMoveAxis(axis.id) && service.canCruiseXY()) {
                        restrictions.push(axis.name + " motion is restricted until homed");
                    }
                }
                axisRestrictions(kinematics.axes[0]);
                axisRestrictions(kinematics.axes[1]);
                axisRestrictions(kinematics.axes[2]);
                return restrictions.length && restrictions;
            },
            isAxisEnabled: function(axisId) {
                var axis = service.axisOfId(axisId);
                return axis && axis.enabled;
            },
            canCruiseXY: function() {
                var kinematics = service.kinematics();
                return !kinematics.axes[2].enabled ||
                    service.model.homed.z && service.position("z").nominal >= service.model.rest.zCruise;
            },
            canHomeAxis: function(axisId) {
                var kinematics = service.kinematics();
                var canCruiseXY = service.canCruiseXY();
                if (axisId === 'a') {
                    return kinematics.axes[3].enabled;
                } else if (axisId === 'z') {
                    return kinematics.axes[2].enabled;
                } else if (axisId === 'y') {
                    return kinematics.axes[1].enabled && canCruiseXY;
                } else if (axisId === 'x') {
                    return kinematics.axes[0].enabled && canCruiseXY;
                }
                return false;
            },
            canMoveAxis: function(axisId) {
                var kinematics = service.kinematics();
                var canCruiseXY = service.canCruiseXY();
                if (axisId === 'z') {
                    return kinematics.axes[2].enabled && service.model.homed.z;
                } else if (axisId === 'y') {
                    return kinematics.axes[1].enabled && service.model.homed.y && canCruiseXY;
                } else if (axisId === 'x') {
                    return kinematics.axes[0].enabled && service.model.homed.x && canCruiseXY;
                }
                return false;
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
                    alerts.danger("Error:" + err);
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
                                    alerts.taskBegin("polling for available position REST service");
                                    service.polling = true;
                                    setTimeout(function() {
                                        alerts.taskEnd();
                                        !service.model.available && restSync.setPollBase(true);
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
            get_mto: function() { // DEPRECATED
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
                    alerts.taskBegin("POST " + url);
                    //var sdata = angular.toJson(data) + "\n";
                    $http.post(url, data).then((response) => {
                        console.debug("POST\t: " + url, data + " => ", response);
                        if (response.r && response.r.mpo) {
                            service.model.mpo = response.r.mpo;
                        }
                        if (response.sync) {
                            restSync.applySyncResponse(response.sync);
                        } else {
                            restSync.setPollBase(true);
                        }
                        resolve(response);
                        service.count++;
                        alerts.taskEnd();
                    }, err => { //.error(function(err, status, headers, config) {
                        var message = "HTTP ERROR" + err.status + "(" + err.statusText + "): " +
                            ((err && err.data) && err.data.error || JSON.stringify(err.data)) + " POST:" + url;
                        console.warn(message);
                        alerts.danger(message);
                        restSync.setPollBase(true);
                        reject(err);
                        service.count++;
                        alerts.taskEnd();
                    });
                });
                return promise;
            },
            home: function(axisId) {
                var url = "/position/home" + (axisId ? ("/" + axisId) : "");
                return restSync.postSync(url, {});
            },
            move: function(axisId, pos) {
                var url = "/position/move";
                if (typeof axisId === "object") {
                    var xyz = axisId;
                } else if (typeof axisId === "string") {
                    var xyz = {};
                    xyz[axisId] = pos;
                } else {
                    alerts.danger("move: invalid argument");
                }
                return restSync.postSync(url, xyz);
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

        restSync.onBeforeUpdate(service.beforeUpdate);
        restSync.onAfterUpdate(service.afterUpdate);
        restSync.onIdleUpdate(service.idleUpdate);

        return service;
    }
]);

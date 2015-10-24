'use strict';

var services = services || angular.module('FireREST.services', []);

services.factory('AlertService', ['$http', '$q',
    function($http, $q) {
        console.log("INFO	: Initializing AlertService");
        var alerts = [];
        var tasks = 0;
        var errors = 0;
        var warnings = 0;
        var createAlert = function(type, msg) {
            var count = alerts.push({
                type: type,
                msg: msg,
                date: new Date()
            });
            return alerts[count - 1];
        };
        var alertSvc = {
            progress: {
                class: function() {
                    if (tasks > 0) {
                        return "progress-striped active";
                    }
                    return "progress";
                },
                type: function() {
                    if (errors > 0) {
                        return "danger";
                    } else if (warnings > 0) {
                        return "warning";
                    } else {
                        return tasks ? "info" : "success";
                    }
                },
                text: function() {
                    if (errors > 0) {
                        return "errors:" + errors;
                    } else if (warnings > 0) {
                        return "warnings:" + warnings;
                    } else {
                        return tasks ? tasks : "Ready";
                    }
                },
                value: function() {
                    var result = 100;
                    for (var i = 0; i < tasks; i++) {
                        result = result * 0.8;
                    }
                    return result;
                }
            },
            taskBegin: function() {
                tasks++;
            },
            taskEnd: function() {
                if (tasks > 0) {
                    tasks--;
                } else {
                    console.log("TASK UNDERFLOW!!!");
                }
            },
            close: function(obj) {
                alerts.splice(alerts.indexOf(obj));
            },
            info: function(msg) {
                console.log("AlertService.info(" + msg + ")");
                return createAlert("info", msg);
            },
            danger: function(msg) {
                console.log("AlertService.danger(" + msg + ")");
                return createAlert("danger", msg);
            },
            success: function(msg) {
                console.log("AlertService.success(" + msg + ")");
                return createAlert("success", msg);
            },
            assertFail: function(msg, ex) {
                if (ex) {
                    console.log("AssertService.assertFail(" + msg + ") => " + (ex.stack || ex));
                } else {
                    console.log("AssertService.assertFail(" + msg + ")");
                }
                createAlert("danger", msg);
                assert.fail(msg);
            },
            assertOk: function(ok, msg) {
                if (ok) {
                    return true;
                }
                alertSvc.assertFail("AssertService.assertOk(" + msg + ")");
            },
            assertProperty: function(obj, property) {
                if (obj.hasOwnProperty(property)) {
                    return true;
                }
                alertSvc.assertFail("AssertService.assertProperty(" + property + ") missing in:" + JSON.stringify(obj, null, "  "));
            },
            list: function() {
                return alerts;
            }
        };
        return alertSvc;
    }
]); // AlertService

'use strict';

var services = services || angular.module('firenodejs.services', []);

services.factory('AlertService', ['$http', '$q',
    function($http, $q) {
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
        var service = {
            progress: {
                class: function() {
                    return tasks > 0 ? "fn-progress-active" : "";
                },
                width: 100,
                update: function() {
                    var result = 100;
                    for (var i = 0; i < tasks; i++) {
                        result = result * 0.8;
                    }
                    return service.progress.width = result;
                }
            },
            isBusy: function() {
                return tasks > 0;
            },
            taskBegin: function() {
                tasks++;
                service.progress.update();
            },
            taskEnd: function() {
                if (tasks > 0) {
                    tasks--;
                } else {
                    console.log("TASK UNDERFLOW!!!");
                }
                service.progress.update();
            },
            close: function(obj) {
                alerts.splice(alerts.indexOf(obj), 1);
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
                service.assertFail("AssertService.assertOk(" + msg + ")");
            },
            assertProperty: function(obj, property) {
                if (obj.hasOwnProperty(property)) {
                    return true;
                }
                service.assertFail("AssertService.assertProperty(" + property + ") missing in:" + JSON.stringify(obj, null, "  "));
            },
            list: function() {
                return alerts;
            }
        };
        return service;
    }
]); // AlertService

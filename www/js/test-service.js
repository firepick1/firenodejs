'use strict';

var services = services || angular.module('FireREST.services', []);

services.factory('TestService', ['$http', '$timeout', 'AlertService', '$q',
    function($http, $timeout, alerts, $q) {
        console.log("INFO	: Initializing TestService");
        var runTest = function(testName, testType, testDescription, testFunction) {
            alerts.taskBegin();
            var result = {
                name: testName,
                type: testType,
                description: testDescription,
                outcome: null
            };
            try {
                console.log(testName + "() BEGIN");
                testFunction(result);
                if (result.outcome === null) {
                    console.log(testName + "() in progress");
                } else if (result.outcome === true) {
                    console.log(testName + "() PASS");
                } else {
                    console.log(testName + "() " + result.outcome);
                }
            } catch (ex) {
                console.log("ERROR	: " + ex);
                console.log(ex.stack);
                result.outcome = "FAIL:" + JSON.stringify(ex);
            }
            alerts.taskEnd();
            return result;
        };
        var httpRequests = 0;
        var testGET = function(url, result, testFunction) {
            alerts.taskBegin();
            $timeout(function() {
                $http.get(url).
                success(function(data, status, headers, config) {
                    httpRequests--;
                    try {
                        console.log("testGet() ok");
                        testFunction(data);
                        result.outcome = true;
                    } catch (ex) {
                        console.log("ERROR	: " + ex);
                        console.log(ex.stack);
                        result.outcome = "FAIL:" + JSON.stringify(ex);
                    }
                    alerts.taskEnd();
                }).
                error(function(data, status, headers, config) {
                    console.log("ERROR	: HTTP" + status + " " + JSON.stringify(config));
                    result.outcome = "FAIL: HTTP" + status;
                    httpRequests--;
                    alerts.taskEnd();
                });
            }, httpRequests * 1000);
            httpRequests++;
            console.log("httpRequests:" + httpRequests);
        };
        var testPOST = function(url, data, result, testFunction) {
            alerts.taskBegin();
            $timeout(function() {
                $http.post(url, data).
                success(function(response, status, headers, config) {
                    httpRequests--;
                    console.log("testPOST() success:" + JSON.stringify(response));
                    try {
                        testFunction(response);
                        result.outcome = true;
                    } catch (ex) {
                        console.log("ERROR	: " + ex);
                        console.log(ex.stack);
                        result.outcome = "FAIL:" + JSON.stringify(ex);
                    }
                    alerts.taskEnd();
                }).
                error(function(response, status, headers, config) {
                    console.log("ERROR	: HTTP" + status + " " + JSON.stringify(config));
                    result.outcome = "FAIL: HTTP" + status;
                    httpRequests--;
                    alerts.taskEnd();
                });
            }, httpRequests * 500);
            httpRequests++;
            console.log("httpRequests:" + httpRequests);
        };
        var testSvc = {
            testAll: function(scope) {
                alerts.taskBegin();
                var results = [];
                results.push(firepick.SpiralIteratorTest());
                results.push(firepick.DeltaModelTest());
                results.push(runTest("EvolveTest", "browser",
                    "Derive prime number < 100 using genetic algorithm",
                    function(result) {
                        firepick.EvolveTest.testAll(result, scope);
                    }));
                alerts.taskEnd();
                return results;
            },
        };
        return testSvc;
    }
]);

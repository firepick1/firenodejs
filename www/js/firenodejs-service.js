'use strict';

var services = angular.module('FireREST.services');

services.factory('firenodejs-service', ['$http', 'ServiceConfig', '$interpolate', 'AjaxAdapter',
    function($http, service, interpolate, transmit) {
        console.log("INFO\t: initializing firenodejs-service");
        var fnjs = {
            resource_XHR: function(resource, classname, response, ok) {
                service.scope.$apply(function() {
                    console.log('resource_XHR' + resource + response);
                    fnjs.resource_response[resource] = response;
                    fnjs.resource_classname[resource] = classname;
                    transmit.end(true);
                });
            },
            camera: { 
                isAvailable: null
            },
            firestep: {
                isAvailable: null
            },
            firesight: {
                isAvailable: null
            },
            iconTest: function(test) {
                if (test === true) {
                    return "glyphicon glyphicon-ok fr-test-pass";
                } else if (test === null) {
                    return "glyphicon glyphicon-transfer fr-test-tbd";
                } else {
                    return "glyphicon glyphicon-remove fr-test-fail";
                }
            },
            resource_GET: function(resource) {
                console.log("GET " + resource);
                transmit.start();
                $.ajax({
                    url: fnjs.resource_url(resource),
                    data: {
                        r: Math.floor(Math.random() * 1000000)
                    },
                    success: function(data) {
                        if (typeof data === 'object') {
                            data = JSON.stringify(data);
                        }
                        data = ("" + data).trim();
                        fnjs.resource_XHR(resource, "fr-postdata-ok", data, true);
                    },
                    error: function(jqXHR, ex) {
                        fnjs.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
                    }
                });
            },
            resource_POST: function(url, data) {
                transmit.start();
                console.log("POST:" + data);
                $http.post(url, data).success(function(response, status, headers, config) {
                    console.log("resource_POST: OK");
                }).error(function(err, status, headers, config) {
                    console.log("resource_POST: FAIL");
                });
            }
        };
        $.ajax({
            url: "/camera/default/image.jpg",
            success: function(data) {
                fnjs.camera.isAvailable = true;
            },
            error: function(jqXHR, ex) {
                fnjs.camera.isAvailable = false;
            }
        });
        $.ajax({
            url: "/firestep/model",
            success: function(data) {
                fnjs.firestep.isAvailable = data && data.isAvailable;
                fnjs.firestep.model = data;
            },
            error: function(jqXHR, ex) {
                fnjs.firestep.isAvailable = false;
            }
        });
        $.ajax({
            url: "/firesight/model",
            success: function(data) {
                fnjs.firesight.isAvailable = data && data.isAvailable;
                fnjs.firesight.model = data;
            },
            error: function(jqXHR, ex) {
                fnjs.firesight.isAvailable = false;
            }
        });
        console.log("INFO\t: firenodejs-service loaded");

        return fnjs;
    }
]);

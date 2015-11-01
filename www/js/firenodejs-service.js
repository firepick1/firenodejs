'use strict';

var services = angular.module('FireREST.services');

services.factory('firenodejs-service', [
    '$http', 'ServiceConfig', '$interpolate', 'AjaxAdapter', 
    'firestep-service', 
    'camera-service',
    'firesight-service',
    function($http, service, interpolate, transmit, firestep, camera, firesight) {
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
            camera: camera,
            firestep: firestep,
            firesight: firesight,
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
            }
        };
        console.log("INFO\t: firenodejs-service loaded firestep:" + fnjs.firestep);

        return fnjs;
    }
]);

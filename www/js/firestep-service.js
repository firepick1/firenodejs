'use strict';

var services = angular.module('FireREST.services');

services.factory('FireStepService', ['$http', 'ServiceConfig', '$interpolate', 'AjaxAdapter',
    function($http, service, interpolate, transmit) {
        var firestep = {
            resource_XHR: function(resource, classname, response, ok) {
                service.scope.$apply(function() {
                    console.log('resource_XHR' + resource + response);
                    firestep.resource_response[resource] = response;
                    firestep.resource_classname[resource] = classname;
                    firestep.cv && firestep.cv.invalidate_image('camera.jpg');
                    firestep.cv && firestep.cv.invalidate_image('monitor.jpg');
                    transmit.end(true);
                });
            },
            resource_GET: function(resource) {
                console.log("GET " + resource);
                transmit.start();
                $.ajax({
                    url: firestep.resource_url(resource),
                    data: {
                        r: Math.floor(Math.random() * 1000000)
                    },
                    success: function(data) {
                        if (typeof data === 'object') {
                            data = JSON.stringify(data);
                        }
                        data = ("" + data).trim();
                        firestep.resource_XHR(resource, "fr-postdata-ok", data, true);
                    },
                    error: function(jqXHR, ex) {
                        firestep.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
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
        return firestep;
    }
]);

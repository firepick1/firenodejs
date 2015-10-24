'use strict';

var services = angular.module('FireREST.services');

services.factory('CvService', ['$http', '$interval', 'AjaxAdapter', 'ServiceConfig',
    function($http, $interval, transmit, service) {
        console.log("INFO	: Initializing CvService");
        var cv = {
            resources: ['save.fire', 'process.fire'],
            image: [],
            post_data: {},
            image_instances: {},
            image_style: {},
            on_load_config: function(config) {
                cv.camera_names = ["camera n/a"];
                if (config && typeof config.cv === 'object') {
                    cv.camera_names = Object.keys(config.cv.camera_map);
                    cv.camera_name = cv.camera_names[0];
                    cv.image = ['monitor.jpg'];
                    cv.profile_names = cv.camera_name && Object.keys(config.cv.camera_map[cv.camera_name].profile_map);
                    cv.profile_name = cv.profile_names[0];
                    cv.cve_name = cv.cve_names()[0] || "no-CVE";
                }
                cv.clear_results();
            },
            camera_url: function() {
                return service.service_url() + service.sync + "/cv/" + cv.camera_name + "/";
            },
            cve_names: function() {
                var camera = cv.camera_name && service.config.cv.camera_map[cv.camera_name];
                var profile = camera && camera.profile_map[cv.profile_name];
                return profile && profile.cve_names || [];
            },
            image_path: function(image) {
                var r = cv.image_instances[image] || 0;
                if (image === 'saved.png') {
                    return "/cv/" + cv.camera_name + "/" + cv.profile_name + "/cve/" + cv.cve_name + "/" + image + "?r=" + r;
                } else {
                    return "/cv/" + cv.camera_name + "/" + image + "?r=" + r;
                }
            },
            image_url: function(image) {
                var r = cv.image_instances[image] || 0;
                if (image === 'saved.png') {
                    return cv.camera_url() + cv.profile_name + "/cve/" + cv.cve_name + "/" + image + "?r=" + r;
                } else {
                    return cv.camera_url() + image + "?r=" + r;
                }
            },
            image_class: function(image) {
                return cv.image_style[image] || "fr-img-sm";
            },
            image_click: function(image) {
                if ("fr-img-sm" === cv.image_style[image]) {
                    cv.image_style[image] = "fr-img-md";
                } else if ("fr-img-md" === cv.image_style[image]) {
                    cv.image_style[image] = "fr-img-lg";
                } else if ("fr-img-lg" === cv.image_style[image]) {
                    cv.image_style[image] = "fr-img-sm";
                } else { // initial state
                    cv.image_style[image] = "fr-img-md";
                }
                console.log(cv.image_style[image]);
            },
            image_GET: function(image) {
                cv.image_instances[image] = Math.floor(Math.random() * 1000000);
            },
            image_GET_icon: function(image) {
                return transmit.autoRefresh && (image === "camera.jpg" || image === 'monitor.jpg') ?
                    "glyphicon glyphicon-repeat" : "";
            },
            resource_text: function(resource) {
                return cv.resource_response[resource] || " ";
            },
            resource_path: function(resource) {
                return "/cv/" + cv.camera_name + "/" + cv.profile_name + "/cve/" + cv.cve_name + "/" + resource;
            },
            resource_url: function(resource) {
                return cv.camera_url() + cv.profile_name + "/cve/" + cv.cve_name + "/" + resource;
            },
            resource_class: function(resource) {
                return cv.resource_classname[resource] || "fr-postdata-ok";
            },
            invalidate_image: function(image, t) {
                t = t || Math.floor(Math.random() * 1000000);
                cv.image_instances[image] = t;
                return t;
            },
            resource_XHR: function(resource, classname, response, ok) {
                service.scope.$apply(function() {
                    console.log('resource_XHR' + resource + response);
                    cv.resource_response[resource] = response;
                    cv.resource_classname[resource] = classname;
                    if (resource === 'save.fire' || resource === 'process.fire') {
                        var t = cv.invalidate_image('monitor.jpg');
                        resource === 'save.fire' && cv.invalidate_image('saved.png');
                        resource === 'process.fire' && cv.invalidate_image('output.jpg');
                    }

                    transmit.end(true);
                });
            },
            clear_results: function() {
                cv.resource_response = {};
                cv.resource_classname = {};
            },
            resource_GET_icon: function(action) {
                return transmit.autoRefresh && (action === "process.fire") ?
                    "glyphicon glyphicon-repeat" : "";
            },
            resource_GET: function(resource) {
                console.log("GET " + resource);
                transmit.start();
                $.ajax({
                    url: cv.resource_url(resource),
                    data: {
                        r: Math.floor(Math.random() * 1000000)
                    },
                    success: function(data) {
                        if (typeof data === 'object') {
                            data = JSON.stringify(data);
                        }
                        data = ("" + data).trim();
                        cv.resource_XHR(resource, "fr-postdata-ok", data, true);
                    },
                    error: function(jqXHR, ex) {
                        cv.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
                    }
                });
            },
            resource_POST: function(resource) {
                transmit.start();
                var data = cv.post_data[resource];
                $.ajax({
                    type: "POST",
                    url: cv.resource_url(resource),
                    data: data,
                    success: function() {
                        cv.resource_XHR(resource, "fr-postdata-ok", data, true);
                    },
                    error: function(jqXHR, ex) {
                        cv.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
                    }
                });
            },
            resource_isPOST: function(resource) {
                return resource === 'properties.json';
            }
        };
        return cv;
    }
]);

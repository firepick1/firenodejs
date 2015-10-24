'use strict';

var services = angular.module('FireREST.services');

services.factory('CncService', ['$http', 'ServiceConfig', '$interpolate', 'AjaxAdapter',
    function($http, service, interpolate, transmit) {
        var cnc = {
            resources: ['gcode.fire'],
            controls: ['move', 'home', 'delta'],
            post_data: {},
            dce_names: ["(no DCE's)"],
            dce_list: {},
            dce: {
                axes: [{
                    id: '(none)',
                    value: 0,
                    jog: 1,
                    resolution: 0.001,
                    min: 0,
                    max: 1,
                    scale: 1,
                    units: "mm",
                    enabled: false
                }, ]
            },
            magic: function() {
                return 1 + Math.pow(Math.sin(30.0), 2);
            },
            on_focus: function(tag, key, clearArmed) {
                cnc.focus = tag + key;
                if (clearArmed) {
                    cnc.armed = null;
                }
            },
            is_focus: function(tag, key) {
                return cnc.focus === tag + key;
            },
            gcode_context: function() {
                var context = {
                    axis_scale: "",
                    home_scale: ""
                };
                cnc.dce.axes.forEach(function(axis) {
                    var home_type = typeof axis.home;
                    if (axis.enabled) {
                        var id = axis.id;
                        context.axis = axis;
                        if (axis.hasOwnProperty('home')) {
                            context.home_scale += " ";
                            context.home_scale += id;
                            context.home_scale += axis.home * axis.scale;
                        }
                        context.axis_scale += " ";
                        context.axis_scale += id;
                        context.axis_scale += axis.value * axis.scale;
                    }
                });
                return context;
            },
            gcode_home: function() {
                var home = cnc.dce && cnc.dce.gcode && cnc.dce.gcode.home || "G0{{home_scale}}";
                return interpolate(home)(cnc.gcode_context());
            },
            gcode_move: function() {
                var move = cnc.dce && cnc.dce.gcode && cnc.dce.gcode.move || "G0{{axis_scale}}";
                return interpolate(move)(cnc.gcode_context());
            },
            axis_class: function(axis, value) {
                var result = axis.enabled ? "" : "fr-axis-disabled ";
                if (typeof axis.min === "number" && value < axis.min) {
                    result = "fr-axis-error-min";
                } else if (typeof axis.max === "number" && axis.max < value) {
                    result += "fr-axis-error-max";
                }
                return result;
            },
            jog: function(axis, key, value, armed) {
                console.log(key, ':', axis[key], "+=", value);
                axis[key] = Number(axis[key]) + Number(value);
                cnc.armed = armed;
                if (axis.resolution < 1) {
                    var divisor = Math.round(1 / axis.resolution);
                    axis[key] = Math.round(axis[key] / axis.resolution) * 1.0 / divisor;
                }
            },
            resource_text: function(resource) {
                return cnc.resource_response[resource] || " ";
            },
            resource_path: function(resource) {
                return "/cnc/" + cnc.dce_name + "/" + resource;
            },
            resource_url: function(resource) {
                return service.service_url() + "/cnc/" + cnc.dce_name + "/" + resource;
            },
            resource_class: function(resource) {
                return cnc.resource_classname[resource] || "fr-postdata-ok";
            },
            resource_XHR: function(resource, classname, response, ok) {
                service.scope.$apply(function() {
                    console.log('resource_XHR' + resource + response);
                    cnc.resource_response[resource] = response;
                    cnc.resource_classname[resource] = classname;
                    cnc.cv && cnc.cv.invalidate_image('camera.jpg');
                    cnc.cv && cnc.cv.invalidate_image('monitor.jpg');
                    transmit.end(true);
                });
            },
            dce_change: function() {
                cnc.dce = cnc.dce_list[cnc.dce_name]
            },
            clear_results: function() {
                cnc.resource_response = {};
                cnc.resource_classname = {};
                cnc.dce_names = [];
                cnc.dce_list = {};
            },
            resource_GET_icon: function(action) {
                return transmit.autoRefresh && (action === "gcode.fire") ? "glyphicon glyphicon-repeat" : "";
            },
            resource_GET: function(resource) {
                console.log("GET " + resource);
                transmit.start();
                $.ajax({
                    url: cnc.resource_url(resource),
                    data: {
                        r: Math.floor(Math.random() * 1000000)
                    },
                    success: function(data) {
                        if (typeof data === 'object') {
                            data = JSON.stringify(data);
                        }
                        data = ("" + data).trim();
                        cnc.resource_XHR(resource, "fr-postdata-ok", data, true);
                    },
                    error: function(jqXHR, ex) {
                        cnc.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
                    }
                });
            },
            resource_armed_class: function(armed) {
                return cnc.armed === armed ? "btn-warning" : "btn-primary";
            },
            resource_POST: function(resource, armed) {
                if (cnc.armed === armed) {
                    transmit.start();
                    var data = "(" + armed + "?)";
                    if (armed === 'move') {
                        data = cnc.gcode_move();
                    } else if (armed === 'home') {
                        data = cnc.gcode_home();
                    } else if (armed === 'gcode') {
                        data = cnc.post_data[armed];
                    }
                    console.log("POST:" + data);
                    $.ajax({
                        type: "POST",
                        url: cnc.resource_url(resource),
                        data: data,
                        success: function() {
                            cnc.resource_XHR(resource, "fr-postdata-ok", data, true);
                        },
                        error: function(jqXHR, ex) {
                            cnc.resource_XHR(resource, "fr-postdata-err", JSON.stringify(jqXHR), false);
                        }
                    });
                    cnc.armed = null;
                } else {
                    cnc.armed = armed;
                }
            },
            resource_isPOST: function(resource) {
                return resource === 'gcode.fire';
            },
            config_loaded: function(config) {
                cnc.dce_names = [];
                for (var dce_name in config.cnc) {
                    if (config.cnc.hasOwnProperty(dce_name)) {
                        var dce = config.cnc[dce_name];
                        console.log("dce " + dce_name + ":" + JSON.stringify(dce));
                        dce.name = dce_name;
                        cnc.dce_names.push(dce_name);
                        cnc.dce_list[dce_name] = dce;
                        cnc.dce_name = dce_name;
                        cnc.dce = dce;
                        console.log("configured DCE " + dce.name);
                    }
                }
            }
        };
        return cnc;
    }
]);

'use strict';

var controllers = angular.module('firenodejs.controllers', []);

controllers.controller('firenodejs-ctrl', ['$scope', 'AlertService', 'BackgroundThread', 'firenodejs-service','SyncService',
    function(scope, alerts, bg, firenodejs, syncService) {
        scope.view = {
            mainTab: "view-main"
        };
        scope.flags = {};
        scope.onMore = function(key) {
            scope.flags[key] = !scope.flags[key];
        }
        scope.alerts = alerts;
        firenodejs.bind(scope);
        syncService.subscribe(scope, function(event, arg) {
            console.log("SyncService requested by:" + arg);
            firenodejs.syncModels();
        });
        scope.viewTabClass = function(tab) {
            return tab === scope.view.mainTab ? "active" : "";
        }
        scope.viewTabContentClass = function(tab) {
            return tab === scope.view.mainTab ? "fr-navbar-active" : "";
        }
        console.log("firenodejs-ctrl loaded");
    }
]);

controllers.controller('HomeCtrl', ['$scope', 'firenodejs-service',
    function(scope, firenodejs) {
        scope.view.mainTab = "view-home";
        firenodejs.bind(scope);
    }
]);

controllers.controller('CalibrateCtrl', ['$scope', 'firenodejs-service',
    function(scope, firenodejs) {
        scope.view.mainTab = "view-calibrate";
        firenodejs.bind(scope);
    }
]);

controllers.controller('JobsCtrl', ['$scope', 'firenodejs-service',
    function(scope, firenodejs) {
        scope.view.mainTab = "view-jobs";
        firenodejs.bind(scope);
    }
]);

controllers.controller('DeltaCtrl', ['$scope', '$location', 'BackgroundThread', 'ServiceConfig', 'AjaxAdapter', '$interpolate',
    'DeltaDeprecated', 'DeltaRenderer',
    function(scope, location, bg, service, transmit, interpolate, delta, render) {
        console.log("DeltaCtrl");
        scope.view.mainTab = "view-delta";
        transmit.clear();
        scope.transmit = transmit;
        scope.service = service;
        scope.config = {};
        scope.delta = delta;

        var cnc = {
            resources: ['gcode.fire'],
            controls: ['move', 'home', 'delta'],
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
            on_focus: function(tag, key) {
                cnc.focus = tag + key;
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
                        var id = axis.id.toLowerCase();
                        context.axis = axis;
                        if (axis.hasOwnProperty('home')) {
                            context.home_scale += "\u2009";
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
                return interpolate(cnc.dce.gcode.home)(cnc.gcode_context());
            },
            gcode_move: function() {
                return interpolate(cnc.dce.gcode.move)(cnc.gcode_context());
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
            jog: function(axis, key, value) {
                console.log(key, ':', axis[key], "+=", value);
                axis[key] = Number(axis[key]) + Number(value);
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
                    transmit.end(true);
                });
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
                    var data = "(no-data)";
                    if (armed === 'move') {
                        data = cnc.gcode_move();
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
            }
        };
        scope.cnc = cnc;

        scope.worker = function(ticks) {
            if ((ticks % 5) === 0) {
                cnc.resources.indexOf('gcode.fire') >= 0 && cnc.resource_GET('gcode.fire');
            }
            return true;
        }

        cnc.clear_results();
        /*
    service.load_config(scope).then( function(config) {
      console.log("processing config.json" );
      scope.config = config;
      if (typeof config.cnc === 'object') {
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
	    console.log("configured DCE " + dce.name );
	  }
	}
	bg.worker = scope.worker;
      }
    }, function(ex) {
      // no action
    }, function(notify) {
      console.log("promise notify " + notify);
    });
    */

        render();

    }
]);

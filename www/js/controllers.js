'use strict';

var controllers = angular.module('firenodejs.controllers', []);
var Hilbert = require("./shared/Hilbert");

controllers.controller('dashes-ctrl', [
    '$scope',
    'AlertService',
    'BackgroundThread',
    'firenodejs-service',
    'UpdateService',
    '$window',
    function(scope, alerts, bg, firenodejs, updateService, $window) {
        scope.view = {
            mainTab: "view-main"
        };
        scope.flags = {};
        scope.openTab = function(url) {
            return window.open(url);
        }
        scope.onMore = function(key) {
            scope.flags[key] = !scope.flags[key];
        }
        scope.alerts = alerts;
        firenodejs.bind(scope);
        scope.viewTabClass = function(tab) {
            return tab === scope.view.mainTab ? "active" : "";
        }
        scope.viewTabContentClass = function(tab) {
                return tab === scope.view.mainTab ? "fr-navbar-active" : "";
            }
            //console.log("firenodejs-ctrl loaded");
        var order = 6;
        scope.hb = new Hilbert(order);
        scope.hbPts = scope.hb.points({scale:2.5*Math.pow(2,6-order)});
        var nPts = scope.hbPts.length;
        var deg = Math.PI/180;
        for (var i=0; i< nPts; i++) {
            var pt = scope.hbPts[i];
            var v1Angle = Math.floor(i/16) * deg * 19;
            var dist = 0.5  + Math.floor(i%4)*0.75;
            pt.v1x = pt.x + dist * Math.cos(v1Angle);
            pt.v1y = pt.y + dist * Math.sin(v1Angle);
            pt.opacity = i%2 === 0 ? 0.5 : 0.25;
        }
    }
]);

controllers.controller('parallax-ctrl', [
    '$scope',
    'AlertService',
    'BackgroundThread',
    'firenodejs-service',
    'UpdateService',
    '$window',
    function(scope, alerts, bg, firenodejs, updateService, $window) {
        scope.view = {
            mainTab: "view-main"
        };
        scope.flags = {};
        scope.openTab = function(url) {
            return window.open(url);
        }
        scope.onMore = function(key) {
            scope.flags[key] = !scope.flags[key];
        }
        scope.alerts = alerts;
        firenodejs.bind(scope);
        scope.viewTabClass = function(tab) {
            return tab === scope.view.mainTab ? "active" : "";
        }
        scope.viewTabContentClass = function(tab) {
                return tab === scope.view.mainTab ? "fr-navbar-active" : "";
            }
            //console.log("firenodejs-ctrl loaded");
        var parallax = scope.parallax = {
            strokeW: 0.25, // mm
            imgW: 160, // mm
            imgH: 160, // mm
            rects: [],
        }
        var nRects = (Math.max(parallax.imgW,parallax.imgH)/2) / parallax.strokeW;
        var hex=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F"];
        var red = hex[Math.floor((Math.random() * 16))];
        var green = hex[Math.floor((Math.random() * 16))];
        var blue = hex[Math.floor((Math.random() * 16))];
        for (var i = 1; i <= nRects; i++) {
            if ((i % 16) === 1) {
                red = hex[Math.floor((Math.random() * 16))];
                green = hex[Math.floor((Math.random() * 16))];
                blue = hex[Math.floor((Math.random() * 16))];
            }
            var grayCoarse = hex[Math.floor((Math.random(0) * 16))];
            var w = parallax.imgW*i/nRects;
            var h = parallax.imgH*i/nRects;
            parallax.rects.push({
                x: -w/2,
                y: -h/2,
                w: w,
                h: h,
                rgb: "#" + 
                    red  + grayCoarse +
                    green  + grayCoarse +
                    blue + grayCoarse,
            });
        }
    }
]);

controllers.controller('hilbert-ctrl', [
    '$scope',
    'AlertService',
    'BackgroundThread',
    'firenodejs-service',
    'UpdateService',
    '$window',
    function(scope, alerts, bg, firenodejs, updateService, $window) {
        scope.view = {
            mainTab: "view-main"
        };
        scope.flags = {};
        scope.openTab = function(url) {
            return window.open(url);
        }
        scope.onMore = function(key) {
            scope.flags[key] = !scope.flags[key];
        }
        scope.alerts = alerts;
        firenodejs.bind(scope);
        scope.viewTabClass = function(tab) {
            return tab === scope.view.mainTab ? "active" : "";
        }
        scope.viewTabContentClass = function(tab) {
                return tab === scope.view.mainTab ? "fr-navbar-active" : "";
            }
            //console.log("firenodejs-ctrl loaded");
        var order = 6;
        scope.hb = new Hilbert(order);
        scope.hbPts = scope.hb.points({scale:2.5*Math.pow(2,6-order)});
    }
]);

controllers.controller('firenodejs-ctrl', [
    '$scope',
    'AlertService',
    'BackgroundThread',
    'firenodejs-service',
    'UpdateService',
    '$window',
    function(scope, alerts, bg, firenodejs, updateService, $window) {
        scope.view = {
            mainTab: "view-main"
        };
        scope.flags = {};
        scope.openTab = function(url) {
            return window.open(url);
        }
        scope.onMore = function(key) {
            scope.flags[key] = !scope.flags[key];
        }
        scope.alerts = alerts;
        firenodejs.bind(scope);
        scope.viewTabClass = function(tab) {
            return tab === scope.view.mainTab ? "active" : "";
        }
        scope.viewTabContentClass = function(tab) {
                return tab === scope.view.mainTab ? "fr-navbar-active" : "";
            }
            //console.log("firenodejs-ctrl loaded");
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

controllers.controller('PcbCtrl', ['$scope', 'firenodejs-service', 'AlertService','$interval','$http', 'PcbService',
    function(scope, firenodejs, alerts, $interval,$http, pcbsvc) {
        scope.view.mainTab = "view-pcb";
        firenodejs.bind(scope);

        scope.pcbFormat = "SparkFun";
        scope.pcbsvc = pcbsvc;
        scope.onChangeFile = function(element, fileDescName) {
            if (fileDescName) {
                scope[fileDescName] = element.files[0];
                console.log(fileDescName + ":", scope[fileDescName]);
            }
        }
        scope.fileClick = function(selector) {
            document.querySelector(selector).click();
        }
        scope.fileChooseClass = function(fileDesc) {
            return fileDesc == null ? "btn-primary" : "btn-default";
        }
        scope.uploadFile = function(fileDesc, fileType) {
            var msg = "Uploading " + fileDesc.name + " as " + fileType;
            var info = alerts.info(msg);
            var fd = new FormData();
            //console.log("uploadFile GKO:" + scope.gkoFile);
            //console.log("uploadFile GTP:" + scope.gtpFile);
            //console.log("uploadFile BRD:" + scope.brdFile);
            fd.append('file', fileDesc);
            var seconds = 0;
            alerts.taskBegin();
            $interval(function() {
                info.msg = msg + " [" + (++seconds) + "...]";
            }, 1000, seconds);
            var url = "/pcb/file/" + fileType + "/" + fileDesc.name;
            $http.post(url, fd, {
                    transformRequest: angular.identity,
                    headers: {
                        'Content-Type': undefined
                    }
                })
                .success(function(data) {
                    alerts.close(info);
                    alerts.taskEnd();
                    alerts.success(data);
            //        $window.location.href = "/login.html?restart";
                })
                .error(function(err) {
                    var msg = fileDesc.name + " upload failed: " + err;
                    alerts.danger(msg);
                    alerts.close(info);
                    alerts.taskEnd();
                });
        }
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

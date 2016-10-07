'use strict';

var services = angular.module('firenodejs.services');
var should = require("./should");
var DeltaMesh = require("./shared/DeltaMesh");
var XYZ = require("./shared/XYZ");
var XML = require("./shared/XML");

services.factory('mesh-service', [
    '$http',
    'AlertService',
    'firestep-service',
    'camera-service',
    '$document',
    'UpdateService',
    '$rootScope',
    'firekue-service',
    '$timeout',
    function($http, alerts, firestep, camera, $document, updateService, $rootScope, firekue, $timeout) {
        var pal_brewer10spectral = [
            '#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b',
            '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'
        ];
        var pal_brewer11RdYlBu = [
            '#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090',
            '#ffffbf',
            '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'
        ];
        var pal_brewer9YlOrRd = [
            '#ffffcc', '#ffeda0', '#fed976', '#feb24c',
            '#fd8d3c',
            '#fc4e2a', '#e31a1c', '#bd0026', '#800026'
        ];
        var pal_brewer9YlOrBr = [
            '#ffffe5', '#fff7bc', '#fee391', '#fec44f',
            '#fe9929',
            '#ec7014', '#cc4c02', '#993404', '#662506'
        ];
        var pal_brewer9PuRd = [
            '#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7',
            '#df65b0',
            '#e7298a', '#ce1256', '#980043', '#67001f'
        ];
        var pal5Diverging = [
            pal_brewer11RdYlBu[10],
            pal_brewer11RdYlBu[7],
            pal_brewer11RdYlBu[5],
            pal_brewer11RdYlBu[3],
            pal_brewer11RdYlBu[0],
        ];
        var pal5Sequential = [
            pal_brewer9PuRd[0],
            pal_brewer9PuRd[1],
            pal_brewer9PuRd[2],
            pal_brewer9PuRd[4],
            pal_brewer9PuRd[5],
        ];
        var pal5Tolerance = [
            pal_brewer9YlOrBr[0],
            pal_brewer9YlOrBr[2],
            pal_brewer9YlOrBr[4],
            pal_brewer9YlOrBr[6],
            pal_brewer9YlOrBr[8],
        ];

        var propInfo = {
            x: {
                id: "x",
                name: "VertexX",
                title: "effector location X-coordinate",
                palette: pal5Diverging,
                units: "mm",
            },
            y: {
                id: "y",
                name: "VertexY",
                title: "effector location X-coordinate",
                palette: pal5Diverging,
                units: "mm",
            },
            z: {
                id: "z",
                name: "VertexZ",
                title: "effector location X-coordinate",
                palette: pal5Diverging,
                units: "mm",
            },
            gcw: {
                id: "gcw",
                name: "GridCellW",
                title: "horizontal pixel separation of vertical grid lines",
                palette: pal5Diverging,
                units: "pixel",
            },
            gch: {
                id: "gch",
                name: "GridCellH",
                title: "vertical pixel separation of horizontal grid lines",
                palette: pal5Diverging,
                units: "pixel",
            },
            ga: {
                id: "ga",
                name: "GridAngle",
                title: "counter-clockwise angle in degrees between image x-axis and grid horizontal axis",
                palette: pal5Diverging,
                mnits: "degree",
            },
            gex: {
                id: "gex",
                name: "GridErrorX",
                title: "root mean square error of x-positions with respect to calculated grid",
                palette: pal5Sequential,
                units: "pixel",
            },
            gey: {
                id: "gey",
                name: "GridErrorY",
                title: "root mean square error of y-positions with respect to calculated grid",
                palette: pal5Sequential,
                units: "pixel",
            },
            dgcw: {
                id: "dgcw",
                name: "\u0394GridCellW",
                title: "Calculated change in GridCellW between vertex zplane and distant zplane (i.e., 0 or 1)",
                palette: pal5Diverging,
                calc: true,
                units: "pixel",
            },
            dgch: {
                id: "dgch",
                name: "\u0394GridCellH",
                title: "Calculated change in GridCellH between vertex zplane and distant zplane (i.e., 0 or 1)",
                palette: pal5Diverging,
                units: "pixel",
                calc: true,
            },
            ezw: {
                id: "ezw",
                name: "ZErrorW",
                title: "Z error calculated using GridCellW",
                palette: pal5Diverging,
                units: "mm",
                calc: true,
            },
            ezh: {
                id: "ezh",
                name: "ZErrorH",
                title: "Z error calculated using GridCellH",
                palette: pal5Diverging,
                units: "mm",
                calc: true,
            },
            ox: {
                id: "ox",
                name: "OffsetX",
                title: "Horizontal pixel offset given by CalcOffset for two moves to same position",
                palette: pal5Diverging,
                units: "pixel",
            },
            oy: {
                id: "oy",
                name: "OffsetY",
                title: "Vertical pixel offset given by CalcOffset for two moves to same position",
                palette: pal5Diverging,
                units: "pixel",
            },
            xyp: {
                id: "xyp",
                name: "XYPrecision",
                title: "Square root of the mean of the squared OffsetX and OffsetY values converted to mm",
                palette: pal5Tolerance,
                units: "mm",
                calc: true,
            },
        };
        var clientDefault = {
            comment: "",
            scanPlanes: [true, true],
            viewPlane: "0",
            roi: {
                type: "rect",
                cx: 0,
                cy: 0,
                width: 150,
                height: 150,
            },
            printer: {
                mm80w: 80,
                mm80h: 80,
            },
            props: {
                gcw: true,
                gch: true,
                dgcw: true,
                dgch: true,
                ga: true,
                ox: false,
                oy: false,
                xyp: true,
                gex: true,
                gey: true,
                ezw: true,
                ezh: true,
            },
            propInfo: {
                gcw: {
                    display: true,
                },
                gch: {
                    display: true,
                },
                dgcw: {
                    display: true,
                },
                dgch: {
                    display: true,
                },
                ga: {
                    display: true,
                },
                ox: {
                    display: false,
                },
                oy: {
                    display: false,
                },
                xyp: {
                    display: true,
                    tolerance: 0.2,
                },
                gex: {
                    display: true,
                },
                gey: {
                    display: true,
                },
                ezw: {
                    display: true,
                },
                ezh: {
                    display: true,
                },
            }
        };
        var model = {
            name: "mesh-service",
            client: JSON.parse(JSON.stringify(clientDefault)),
        };
        var service = {
            pal5Tolerance: pal5Tolerance,
            isAvailable: function() {
                return service.model.rest && firestep.isAvailable();
            },
            color: {
                vertexStrokeSelected: "#ccf",
                vertexStrokeActive: "#000",
                vertexStrokeInactive: "#aaa",
                vertexFillSelected: "#ff0",
                vertexFillDefault: "none",
                vertexFillDataMean: "#4c4",
                vertexFillDataHigh: "#c44",
                vertexFillDataLow: "#44c",
                meshFill: "#eee",
                roiFill: "#888",
            },
            model: model,
            propNames: Object.keys(clientDefault.props),
            propInfo: propInfo,
            svgScale: function() {
                var hScale = JsonUtil.round(80 / model.client.printer.mm80w, 10000);
                var vScale = JsonUtil.round(80 / model.client.printer.mm80h, 10000);
                return hScale + "," + vScale;
            },
            data_tr_class: function(data) {
                var v = data && service.mesh.vertexAtXYZ(data);
                return v && service.selection.length && v === service.selection[0] ?
                    "fn-data-selected" : "";
            },
            prop_td_class: function(prop) {
                var pi = propInfo[prop];
                return pi && pi.calc ? "fn-prop-calc" : "";
            },
            grid_label_rc: function(v) {
                var viewPlaneIndex = Number(model.client.viewPlane);
                var zPlane = service.mesh.getZPlane(viewPlaneIndex);
                return zPlane.hash(v);
            },
            grid_label_xy: function(v) {
                return "x" + JsonUtil.round(v.x, 1) + "y" + JsonUtil.round(v.y, 1);
            },
            grid_label_xyz: function(v) {
                var scale = 100;
                return "x:" + JsonUtil.round(v.x, scale) + " " +
                    "y:" + JsonUtil.round(v.y, scale) + " " +
                    "z:" + JsonUtil.round(v.z, scale);
            },
            grid_coords_x: function() {
                var cellW = service.model.grid && service.model.grid.cellW || 5;
                return service.grid_coords(cellW, 150);
            },
            grid_coords_y: function() {
                var cellH = service.model.grid && service.model.grid.cellH || 5;
                return service.grid_coords(cellH, 200);
            },
            grid_coords: function(inc, max) {
                var coords = [];
                coords.push(0);
                for (var c = inc; c <= max; c += inc) {
                    coords.push(Number(-c));
                    coords.push(Number(c));
                }
                return coords.sort(function(a, b) {
                    return a - b;
                });
            },
            view: {
                scale: {
                    x: 1.8,
                    y: 1.8,
                },
                config: {},
            },
            roi: {
                type: "rect",
                cx: 0,
                cy: 0,
                width: 150,
                height: 150,
            },
            roiSummary: function() {
                var roi = model.client.roi;
                return roi.type + ":" + roi.width + "x" + roi.height + " center:" + roi.cx + "," + roi.cy + " vertices:" +
                    (service.roiVertices.length ? service.roiVertices.length : "none");
            },
            paletteTitle: function(index) {
                if (propInfo[service.dataKey].palette === pal5Tolerance) {
                    var clientInfo = service.model.client.propInfo[service.dataKey];
                    switch (index) {
                        case 4:
                            return ">\u00a0" + (4 * clientInfo.tolerance);
                        case 3:
                            return ">\u00a0" + (2 * clientInfo.tolerance);
                        case 2:
                            return ">\u00a0" + (clientInfo.tolerance);
                        case 1:
                            return "\u2264\u00a0" + (clientInfo.tolerance / 1);
                        case 0:
                            return "\u2264\u00a0" + (clientInfo.tolerance / 2);
                    }
                } else {
                    switch (index) {
                        case 4:
                            return ">\u00a0\u00a0\u03bc+\u03c3";
                        case 3:
                            return ">\u00a0\u00a0\u03bc+\u03c3/4";
                        case 2:
                            return "\u2245\u00a0\u03bc";
                        case 1:
                            return "<\u00a0\u03bc-\u03c3/4";
                        case 0:
                            return "<\u00a0\u03bc-\u03c3";
                    }
                }
                return "(TBD)";
            },
            dataHdrIndicator: function(prop) {
                if (prop !== service.dataKey) {
                    return "";
                }
                return " " + (service.dataKeyOrder === 1 ? "\u25be" : "\u25b4");
            },
            dataHdrClass: function(prop) {
                if (prop !== service.dataKey) {
                    return "";
                }
                return "glyphicon glyphicon-" + (service.dataKeyOrder === 1 ?
                    "chevron-up" : "chevron-down"
                );
            },
            onClickDataHdr: function(prop) {
                if (service.dataKey === prop) {
                    service.dataKeyOrder = -service.dataKeyOrder;
                } else {
                    service.dataKeyOrder = 1;
                }
                service.setDataKey(prop);
                service.validate();
            },
            setDataKey: function(prop) {
                var key1 = service.dataKey = prop;
                var key2 = key1 === 'x' ? 'y' : 'x';
                var key3 = key2 === 'x' ? 'y' : 'x';
                var key4 = 'z';
                service.dataKeyOrder = service.dataKeyOrder || 1;

                service.dataComparator = function(a, b) {
                    var va = isNaN(a[key1]) ? -Number.MAX_VALUE : a[key1];
                    var vb = isNaN(b[key1]) ? -Number.MAX_VALUE : b[key1];
                    var cmp = va - vb;
                    if (cmp) {
                        return cmp * service.dataKeyOrder;
                    }
                    va = isNaN(a[key2]) ? -Number.MAX_VALUE : a[key2];
                    vb = isNaN(b[key2]) ? -Number.MAX_VALUE : b[key2];
                    cmp = va - vb;
                    if (cmp) {
                        return cmp * service.dataKeyOrder;
                    }
                    va = isNaN(a[key3]) ? -Number.MAX_VALUE : a[key3];
                    vb = isNaN(b[key3]) ? -Number.MAX_VALUE : b[key3];
                    cmp = va - vb;
                    if (cmp) {
                        return cmp * service.dataKeyOrder;
                    }
                    va = isNaN(a[key4]) ? -Number.MAX_VALUE : a[key4];
                    vb = isNaN(b[key4]) ? -Number.MAX_VALUE : b[key4];
                    cmp = va - vb;
                    return cmp * service.dataKeyOrder;
                }
                return service.dataComparator;
            },
            onClickData: function(data) {
                var v = data && service.mesh.vertexAtXYZ(data);
                service.selectVertex(v);
            },
            vertexMiscInfo: function(v) {
                var zpi = service.mesh.zPlaneIndex(v.z);
                var zpiDistal = zpi ? 0 : 1;
                var zDistal = service.mesh.zPlaneZ(zpiDistal);
                var xyzDistal = new XYZ(v.x, v.y, zDistal);
                return JsonUtil.summarize({
                    xyz: xyzDistal,
                    gcw: service.mesh.interpolate(xyzDistal, "gcw"),
                    gch: service.mesh.interpolate(xyzDistal, "gch"),
                })
            },
            afterUpdate: function(diff) {
                if (!diff) {
                    return;
                }
                JsonUtil.applyJson(service.view.config, model.config);
                // copy data so we can decorate or change it
                service.view.config.data = service.view.config.data || [];
                service.view.config.data = JSON.parse(JSON.stringify(service.view.config.data));
                if (service.mesh && diff.mesh && diff.mesh.config && diff.mesh.config.data) {
                    // update mesh data
                    for (var i = diff.mesh.config.data.length; i-- > 0;) {
                        var data = diff.mesh.config.data[i];
                        var v = service.mesh.vertexAtXYZ(data);
                        if (v) {
                            for (var j = service.propNames.length; j-- > 0;) {
                                var prop = service.propNames[j];
                                if (model.client.props[prop] && data[prop] != null) {
                                    v[prop] = data[prop];
                                }
                            }
                            v.summary = data.summary;
                        }
                    }
                }
                service.validate();
            },
            ponoko_p1_corner_holes: function(openTab) {
                var tabWindow = openTab && openTab("about:blank");
                var url = "/mesh/ponoko/p1_corner_holes";
                var postData = {
                    roi: model.client.roi,
                };
                alerts.taskBegin();
                $http.post(url, postData).success(function(response, status, headers, config) {
                    if (!tabWindow) {
                        alerts.danger("mesh_service.ponoko_p1_corner_holes() could not open URL:" + response);
                    } else {
                        console.log("mesh_service.ponoko_p1_corner_holes() =>", response);
                        tabWindow.location = response;
                    }
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    alerts.danger("mesh_service.ponoko_p1_corner_holes() failed HTTP" + status + ": " + err);
                    alerts.close(alert);
                    alerts.taskEnd();
                });
            },
            ponoko_p1_xygrid: function(openTab) {
                var tabWindow = openTab && openTab("about:blank");
                var url = "/mesh/ponoko/p1_xygrid";
                var postData = {
                    roi: model.client.roi,
                };
                alerts.taskBegin();
                $http.post(url, postData).success(function(response, status, headers, config) {
                    if (!tabWindow) {
                        alerts.danger("mesh_service.ponoko_p1_xygrid() could not open URL:" + response);
                    } else {
                        console.log("mesh_service.ponoko_p1_xygrid() =>", response);
                        tabWindow.location = response;
                    }
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    alerts.danger("mesh_service.ponoko_p1_xygrid() failed HTTP" + status + ": " + err);
                    alerts.close(alert);
                    alerts.taskEnd();
                });
            },
            mend: function() {
                alerts.taskBegin();
                var alert = alerts.warning("Mending DeltaMesh using property. Please do not interrupt.");
                var url = "/mesh/mend";
                var postData = {
                    props: ["gcw", "gch"],
                };
                $http.post(url, postData).success(function(response, status, headers, config) {
                    console.log("mesh-service.mend() ", response);
                    alerts.taskEnd();
                    setTimeout(function() {
                        alerts.close(alert);
                        alerts.success("Missing DeltaMesh data has been interpolated and mended.");
                    }, 1000);
                    updateService.setPollBase(true);
                }).error(function(err, status, headers, config) {
                    alerts.danger("mesh-service.mend() failed HTTP" + status + ": " + err);
                    alerts.close(alert);
                    alerts.taskEnd();
                });
            },
            calcProps: function() {
                alerts.taskBegin();
                var calcProps = [];
                var propKeys = Object.keys(propInfo);
                for (var i = 0; i < propKeys.length; i++) {
                    var propName = propKeys[i];
                    if (model.client.props[propName] && propInfo[propName].calc) {
                        calcProps.push(propName);
                    }
                }
                var alert = alerts.warning("Calculating ROI vertex properties:" + calcProps.join() + " This takes up to a minute. Please do not interrupt!");
                var url = "/mesh/calc-props";
                var postData = {
                    props: calcProps,
                };
                $http.post(url, postData).success(function(response, status, headers, config) {
                    console.log("mesh-service.calc-props() ", response);
                    alerts.taskEnd();
                    setTimeout(function() {
                        alerts.close(alert);
                        alerts.success("DeltaMesh properties have been calculated.");
                    }, 1000);
                    updateService.setPollBase(true);
                }).error(function(err, status, headers, config) {
                    alerts.danger("mesh-service.calc-props() failed HTTP" + status + ": " + err);
                    alerts.close(alert);
                    alerts.taskEnd();
                });
            },
            moveToVertex: function(v, isCorrected) {
                alerts.taskBegin();
                var url = "/firestep/";
                var ez = v.ezh == null ? v.ezw : (v.ezw == null ? null : (v.ezw + v.ezh) / 2);
                var cz = (isCorrected && ez != null) ? -ez : 0;
                var postData = [{
                    mov: {
                        x: v.x,
                        y: v.y,
                        z: v.z + cz,
                    },
                }];
                model.client && (postData.props = model.client.props);
                $http.post(url, postData).success(function(response, status, headers, config) {
                    console.log("mesh-service.moveToVertex() ", response);
                    //alerts.info(JSON.stringify(response));
                    alerts.taskEnd();
                    updateService.setPollBase(true);
                }).error(function(err, status, headers, config) {
                    console.warn("mesh-service.moveToVertex() failed HTTP" + status, err);
                    alerts.taskEnd();
                });
            },
            scanVertex: function(v) {
                alerts.taskBegin();
                var camName = camera.model.selected;
                var url = "/mesh/" + camName + "/scan/vertex";
                var postData = {
                    pt: {
                        x: v.x,
                        y: v.y,
                        z: v.z,
                    },
                    maxError: model.client && model.client.maxRMSE, // null: no error limit
                };
                model.client && (postData.props = model.client.props);
                $http.post(url, postData).success(function(response, status, headers, config) {
                    console.log("mesh-service.scanVertex(" + camName + ") ", response);
                    //alerts.info(JSON.stringify(response));
                    alerts.taskEnd();
                    updateService.setPollBase(true);
                }).error(function(err, status, headers, config) {
                    console.warn("mesh-service.scanVertex(" + camName + ") failed HTTP" + status, err);
                    alerts.taskEnd();
                });
            },
            scanROI: function() {
                var camName = camera.model.selected;
                var url = "/mesh/" + camName + "/scan/vertex";
                var job = {};
                var hom = {
                    hom: ""
                };
                var jobs = [];
                var promise;
                var info = alerts.info("Creating ROI scanning job(s)");
                model.client.comment = "ScanROI: " + new Date().toLocaleString();

                // set roiVertices
                var roiVertices = [];
                var scanVertices = [];
                var opts = {
                    includeExternal: false,
                };
                for (var i = 0; i < 2; i++) {
                    model.client.scanPlanes[i] && (scanVertices = scanVertices.concat(service.mesh.zPlaneVertices(i, opts)));
                }
                for (var i = 0; i < scanVertices.length; i++) {
                    var v = scanVertices[i];
                    DeltaMesh.isVertexROI(v, model.client.roi) && roiVertices.push(v);
                }
                roiVertices.sort(XYZ.precisionDriftComparator);

                firekue.addRestRequest(job, "/firestep", hom); // precise starting point
                for (var i = 0; i < roiVertices.length; i++) {
                    var v = roiVertices[i];
                    var postData = {
                        pt: {
                            x: v.x,
                            y: v.y,
                            z: v.z,
                        },
                        maxError: model.client && model.client.maxRMSE, // null: no error limit
                    };
                    postData.props = model.client.props;
                    firekue.addRestRequest(job, url, postData);
                    var jobSize = 5; // keep jobs small
                    if (job.data.length >= jobSize) {
                        promise = firekue.addJob(job);
                        promise.then(function(result) {
                            jobs.push(result.id);
                        });
                        job = {};
                    }
                }
                if (job.data && job.data.length >= jobSize) {
                    promise = firekue.addJob(job);
                }
                service.confirm_scanROI = false;
                promise.then(function(result) {
                    alerts.close(info);
                    var info = alerts.info('Select Jobs tab and click "\u25b6" to start scanning jobs: ' + jobs);
                    setTimeout(function() {
                        alerts.close(info);
                    }, 10000);
                });
                promise.catch(function(result) {
                    alerts.error("Could not create ROI scanning jobs. Error:" + error);
                });
                return promise;
            },
            saveROI: function() {
                var camName = camera.model.selected;
                var url = "/images/" + camName + "/save";
                var job = {};
                var hom = {
                    hom: ""
                };
                var jobs = [];
                var promise;
                var info = alerts.info("Creating jobs to save ROI image(s)");
                model.client.comment = "SaveROI: " + new Date().toLocaleString();

                // set roiVertices
                var roiVertices = [];
                var saveVertices = [];
                var opts = {
                    includeExternal: false,
                };
                for (var i = 0; i < 2; i++) {
                    model.client.scanPlanes[i] && (saveVertices = saveVertices.concat(service.mesh.zPlaneVertices(i, opts)));
                }
                for (var i = 0; i < saveVertices.length; i++) {
                    var v = saveVertices[i];
                    DeltaMesh.isVertexROI(v, model.client.roi) && roiVertices.push(v);
                }
                roiVertices.sort(XYZ.precisionDriftComparator);

                firekue.addRestRequest(job, "/firestep", hom); // precise starting point
                for (var i = 0; i < roiVertices.length; i++) {
                    var v = roiVertices[i];
                    var postData = {
                        x: v.x,
                        y: v.y,
                        z: v.z,
                    };
                    firekue.addRestRequest(job, url, postData);
                    var jobSize = 5; // keep jobs small
                    if (job.data.length >= jobSize) {
                        promise = firekue.addJob(job);
                        promise.then(function(result) {
                            jobs.push(result.id);
                        });
                        job = {};
                    }
                }
                if (job.data && job.data.length >= jobSize) {
                    promise = firekue.addJob(job);
                }
                service.confirm_saveROI = false;
                promise.then(function(result) {
                    alerts.close(info);
                    var info = alerts.info('Select Jobs tab and click "\u25b6" to start saving images: ' + jobs);
                    setTimeout(function() {
                        alerts.close(info);
                    }, 10000);
                });
                promise.catch(function(result) {
                    alerts.error("Could not create jobs to save ROI images. Error:" + error);
                });
                return promise;
            },
            cancel: function() {
                JsonUtil.applyJson(service.view.config, model.config);
            },
            viewHasChanged: function() {
                return service.view.config.zMin !== model.config.zMin ||
                    service.view.config.zMax !== model.config.zMax ||
                    service.view.config.rIn !== model.config.rIn ||
                    service.view.config.zPlanes !== model.config.zPlanes;
            },
            actionName: function() {
                return service.viewHasChanged() ? "Apply" : "Reset";
            },
            stats: {},
            dataStats: function(data, propNames) {
                var stats = {};
                for (var ip = 0; ip < propNames.length; ip++) {
                    var prop = propNames[ip];
                    stats[prop] = {
                        sumVariance: 0,
                        sum: 0,
                        count: 0,
                    }
                }
                var viewPlaneIndex = Number(model.client.viewPlane);
                for (var i = 0; i < data.length; i++) {
                    var d = data[i];
                    if (service.mesh.zPlaneIndex(d.z) === viewPlaneIndex) {
                        for (var ip = 0; ip < propNames.length; ip++) {
                            var prop = propNames[ip];
                            if (d[prop] != null) {
                                stats[prop].sum += d[prop];
                                stats[prop].count++;
                            }
                        }
                    }
                }
                for (var ip = 0; ip < propNames.length; ip++) {
                    var prop = propNames[ip];
                    var propStat = stats[prop];
                    propStat.count && (propStat.mean = propStat.sum / propStat.count);
                }
                for (var i = data.length; i-- > 0;) {
                    var d = data[i];
                    if (service.mesh.zPlaneIndex(d.z) === viewPlaneIndex) {
                        for (var ip = 0; ip < propNames.length; ip++) {
                            var prop = propNames[ip];
                            if (d[prop] != null) {
                                var diff = d[prop] - stats[prop].mean;
                                stats[prop].sumVariance += diff * diff;
                            }
                        }
                    }
                }
                for (var ip = 0; ip < propNames.length; ip++) {
                    var prop = propNames[ip];
                    var propStat = stats[prop];
                    if (propStat.count) {
                        propStat.stdDev = Math.sqrt(propStat.sumVariance / propStat.count);
                        propStat.stdDev = Math.round(propStat.stdDev * 1000) / 1000;
                        propStat.mean = Math.round(propStat.mean * 1000) / 1000;
                        delete propStat.sumVariance; // just clutter
                        delete propStat.sum; // just clutter
                    }
                }
                return stats;
            },
            validViewPlanes: ['1', '0'],
            validate: function() {
                //var msStart = new Date();
                var mesh = service.mesh;
                var config = model.config;
                if (mesh == null ||
                    mesh.rIn !== config.rIn ||
                    mesh.zMin !== config.zMin ||
                    mesh.zPlanes !== config.zPlanes) {
                    mesh = service.mesh = new DeltaMesh(config);
                }
                for (var i = service.validViewPlanes.length; i-- > 0;) {
                    if (model.client.viewPlane === service.validViewPlanes[i]) {
                        break;
                    }
                    i === 0 && (model.client.viewPlane = '0'); // overwrite invalid value
                }
                var nLevels = mesh.zPlanes - 2;
                service.levels = [];
                for (var i = nLevels; i > 0; i--) {
                    service.levels.push(i);
                }
                var opts = {
                    includeExternal: false,
                };
                var plane = Number(model.client.viewPlane);
                service.vertices = mesh.zPlaneVertices(plane, opts);
                var propNames = ['x', 'y', 'z']; // include location in roiStats
                var defaultDataKey = null;
                for (var ip = 0; ip < service.propNames.length; ip++) {
                    var prop = service.propNames[ip];
                    if (model.client.props[prop]) {
                        propNames.push(prop);
                        defaultDataKey = defaultDataKey || prop;
                    }
                }
                defaultDataKey = defaultDataKey || 'x';
                service.roiVertices = [];
                var selFound = false;
                for (var i = 0; i < service.vertices.length; i++) {
                    var v = service.vertices[i];
                    DeltaMesh.isVertexROI(v, model.client.roi) && service.roiVertices.push(v);
                    selFound = selFound || v === service.selection[0];
                }
                if (!selFound) {
                    service.selection = [];
                }
                service.roiData = [];
                for (var i = 0; i < service.view.config.data.length; i++) {
                    var d = service.view.config.data[i];
                    var v = service.mesh.vertexAtXYZ(d);
                    if (v) {
                        if (DeltaMesh.isVertexROI(v, model.client.roi)) {
                            service.roiData.push(d);
                            v.data = d;
                        } else {
                            delete v.data;
                        }
                    }
                }
                service.roiStats = service.dataStats(service.roiData, propNames);
                service.dataComparator = service.dataComparator || service.setDataKey(defaultDataKey);
                service.roiData.sort(service.dataComparator);
                //console.log("validate:", new Date()-msStart, "ms");

                return service;
            },
            selection: [ // single-selection now; multi-selection TBD
            ],
            isDataVisible: function(data) {
                var zplane = Number(model.client.viewPlane);
                if (service.mesh.zPlaneIndex(data.z) !== zplane) {
                    return false;
                }
                var v = service.mesh.vertexAtXYZ(data);
                return DeltaMesh.isVertexROI(v, model.client.roi);
            },
            isAtVertex: function() {
                var v = firestep.model.mpo && service.mesh.vertexAtXYZ(firestep.model.mpo);
                var atVertex = v && service.selection[0] && v === service.selection[0];
                return atVertex;
            },
            svgMouseXY: function(evt) {
                var elt = $document.find('svg').parent()[0];
                var dx = 0;
                var dy = 0;
                for (var op = elt; op != null; op = op.offsetParent) {
                    dx += op.offsetLeft;
                    dy += op.offsetTop;
                }
                var cx = elt.offsetWidth / 2;
                var cy = elt.offsetHeight / 2;
                var x = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - dx;
                x = x - cx;
                var y = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop - dy;
                y = y - cy;
                return {
                    x: x / service.view.scale.x,
                    y: -y / service.view.scale.y,
                }
            },
            selectVertex: function(v) {
                service.view.vertexInfo = service.vertexMiscInfo(v);
                if (service.selection.length === 0) {
                    service.selection.push(v);
                } else {
                    service.selection[0] = v;
                }
                var viewPlane = service.mesh.zPlaneIndex(v.z) + '';
                if (viewPlane != model.client.viewPlane) {
                    service.model.client.viewPlane = viewPlane;
                    //console.log("selectVertex v:", v, "viewPlane:", viewPlane);
                    service.validate();
                }
            },
            onMouseDown: function(evt) {
                var mouse = service.svgMouseXY(evt);
                var dMax = 5;
                for (var i = service.vertices.length; i-- > 0;) {
                    var v = service.vertices[i];
                    if (v == null) {
                        continue;
                    }
                    if (Math.abs(v.x - mouse.x) < dMax && Math.abs(v.y - mouse.y) < dMax) {
                        mouse.vertex = v;
                        service.selectVertex(v);
                        break;
                    }
                }
            },
            onMouseMove: function(evt) {
                var elt = $document.find('svg').parent()[0];
                var cx = elt.offsetWidth / 2;
                var cy = elt.offsetHeight / 2;
                var dx = 0;
                var dy = 0;
                for (var op = elt; op != null; op = op.offsetParent) {
                    dx += op.offsetLeft;
                    dy += op.offsetTop;
                }
                var selection = service.selection.length > 0 ? service.selection[0] : null;
                if (selection == null) {
                    selection = {};
                    service.selection.push(selection);
                }
                selection.x = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - dx;
                selection.y = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop - dy;
                selection.x = cx - selection.x;
                selection.y = selection.y - cy;
                var dMax = 7;
                for (var i = service.vertices.length; i-- > 0;) {
                    var v = service.vertices[i];
                    if (v == null) {
                        continue;
                    }
                    if (Math.abs(v.x - selection.x) < dMax && Math.abs(v.y - selection.y) < dMax) {
                        selection.vertex = v;
                        break;
                    }
                }
            },
            vertexRadius: function(v) {
                return 4;
            },
            vertexStroke: function(v) {
                //if (DeltaMesh.isVertexROI(v, model.client.roi)) {
                if (v && v.data) {
                    return service.color.vertexStrokeActive;
                } else {
                    return service.color.vertexStrokeInactive;
                }
            },
            vertexFill: function(v) {
                var value = v && v.data && v.data[service.dataKey];
                return service.dataFill(value);
            },
            dataFill: function(value) {
                var stats = service.roiStats[service.dataKey];
                if (value == null || stats == null) {
                    return service.color.vertexFillDefault;
                }
                var serviceInfo = propInfo[service.dataKey];
                var clientInfo = service.model.client.propInfo[service.dataKey];
                var pal5 = serviceInfo.palette;
                if (pal5 === pal5Tolerance) {
                    if (value < 0.5 * clientInfo.tolerance) {
                        return pal5[0];
                    } else if (value <= clientInfo.tolerance) {
                        return pal5[1];
                    } else if (value <= 2 * clientInfo.tolerance) {
                        return pal5[2];
                    } else if (value <= 4 * clientInfo.tolerance) {
                        return pal5[3];
                    } else {
                        return pal5[4];
                    }
                } else {
                    if (value < stats.mean - stats.stdDev) {
                        return pal5[0];
                    } else if (value <= stats.mean - stats.stdDev / 4) {
                        return pal5[1];
                    } else if (value <= stats.mean + stats.stdDev / 4) {
                        return pal5[2];
                    } else if (value <= stats.mean + stats.stdDev) {
                        return pal5[3];
                    } else {
                        return pal5[4];
                    }
                }
            },
            configure: function(onDone) {
                var config = model.config;
                service.mesh = null;
                JsonUtil.applyJson(config, service.view.config);
                service.validate();
                config.rIn = service.mesh.rIn;
                config.data = [];
                model.client.comment = new Date().toLocaleString();

                alerts.taskBegin();
                var url = "/mesh/configure";
                $http.post(url, config).success(function(response, status, headers, config) {
                    console.log("mesh-service.configure() ", response);
                    onDone && onDone();
                    alerts.taskEnd();
                }).error(function(err, status, headers, config) {
                    console.warn("mesh-service.configure() failed HTTP" + status, err);
                    alerts.taskEnd();
                });
            },
            onChangeLevel: function() {
                service.validate();
            },
        };
        updateService.onAfterUpdate(service.afterUpdate);

        return service;
    }
]);

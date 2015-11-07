'use strict';

var services = angular.module('firenodejs.services');

services.factory('measure-service', ['$http','firestep-service','images-service',
    function($http, firestep, images) {
        var available = null;
        var service = {
            processCount: 0,
            lpp: {z1:30, z2:-30},
            nRandom: 2,
            radius: firestep.jog,
            results: {},
            location: function() {
                var mpo = firestep.model.mpo || {};
                return "X" + mpo.x + "Y" + mpo.y + "Z" + mpo.z;
            },
            getResults: function() {
                return service.results[service.location()];
            },
            isAvailable: function() {
                return available;
            },
            jogPrecision: function(camera) {
                images.save(camera.selected, function(err) {
                    var x = firestep.model.mpo.x;
                    var y = firestep.model.mpo.y;
                    var z = firestep.model.mpo.z;
                    var cmd = [];

                    //for (var i=0; i<service.nRandom; i++) {
                        //var dx = Math.random()*service.radius*2 - 1;
                        //var dy = Math.random()*service.radius*2 - 1;
                        //cmd.push({mov:{x:x+dx,y:y+dy,z:z}});
                    //}
                    var dx = firestep.getJog(Math.random<0.5?-1:1);
                    var dy = firestep.getJog(Math.random<0.5?-1:1);
                    cmd.push({movxr:dx});
                    cmd.push({movxr:dx});
                    cmd.push({movyr:dy});
                    cmd.push({movyr:dy});
                    cmd.push({mov:{x:x,y:y,z:z}});
                    cmd.push({mpo:"",dpyds:12});
                    firestep.send(cmd);
                });
            },
            calcOffset: function(camera) {
                $.ajax({
                    url: "/measure/" + camera + "/calc-offset",
                    success: function(outJson) {
                        console.log("calcOffset() ", outJson);
                        var loc = service.location();
                        service.results[loc] = service.results[loc] || {};
                        service.results[loc].calcOffset = outJson;
                        service.processCount++;
                    },
                    error: function(jqXHR, ex) {
                        console.warn("calcOffset() failed:", jqXHR, ex);
                    }
                });
            }
        };

        $.ajax({
            url: "/measure/model",
            success: function(data) {
                available = data && data.available;
                console.log("measure available:", available);
                service.model = data;
            },
            error: function(jqXHR, ex) {
                available = false;
                console.warn("measure unavailable :", jqXHR, ex);
            }
        });

        return service;
    }
]);

'use strict';

var DeltaCalculator = firepick.DeltaCalculator;
console.log("DeltaCalculator:" + typeof(DeltaCalculator));

var services = angular.module('firenodejs.services');

services.factory('delta-service', ['$http', 'firestep-service',
    function($http, firestep) {
        var service = {
            calculator: function() {
                var options = {};
                var dim = firestep.model.dim;
                if (firestep.model.dim) {
                    options = {
                        e: dim.e,
                        f: dim.f,
                        gearRatio: dim.gr,
                        re: dim.re,
                        rf: dim.rf,
                        spa: dim.spa,
                        spr: dim.spr,
                        steps360: dim.st,
                        microsteps: dim.mi,
                        homeAngles: {
                            theta1: dim.ha,
                            theta2: dim.ha,
                            theta3: dim.ha,
                        }
                    };
                }
                return new DeltaCalculator(options);
            },
            calcPulses: function(xyz) {
                return service.calculator().calcXYZ(pulses);
            },
            calcXYZ: function(pulses) {
                return service.calculator().calcXYZ(pulses);
            }
        };

        return service;
    }
]);

services.factory('DeltaDeprecated', ['delta-service',
    function(dsvc) {
        console.log("Initializing DeltaDeprecated");
        var sqrt3 = Math.sqrt(3.0);
        var pi = Math.PI;
        var sin120 = sqrt3 / 2.0;
        var cos120 = -0.5;
        var tan60 = sqrt3;
        var sin30 = 0.5;
        var tan30 = 1 / sqrt3;
        var tan30_half = tan30 / 2.0;
        var dtr = pi / 180.0;
        var delta = {
            e: 115.0, // end effector
            f: 457.3, // base
            re: 232.0,
            rf: 112.0,
            ok: true,
            X: 0,
            Y: 0,
            Z: -100,
            theta1: 0,
            theta2: 0,
            theta3: 0,
            orbit_camera: false,
            nicenum: function(value) {
                var factor = 1000.0;
                return Math.round(value * factor) / factor;
            },
            calcForward: function() {
                delta.ok = false;
                var t = (delta.f - delta.e) * tan30 / 2;
                var theta1 = delta.theta1 * dtr;
                var theta2 = delta.theta2 * dtr;
                var theta3 = delta.theta3 * dtr;
                var y1 = -(t + delta.rf * Math.cos(theta1));
                var z1 = -delta.rf * Math.sin(theta1);
                var y2 = (t + delta.rf * Math.cos(theta2)) * sin30;
                var x2 = y2 * tan60;
                var z2 = -delta.rf * Math.sin(theta2);
                var y3 = (t + delta.rf * Math.cos(theta3)) * sin30;
                var x3 = -y3 * tan60;
                var z3 = -delta.rf * Math.sin(theta3);
                var dnm = (y2 - y1) * x3 - (y3 - y1) * x2;
                var w1 = y1 * y1 + z1 * z1;
                var w2 = x2 * x2 + y2 * y2 + z2 * z2;
                var w3 = x3 * x3 + y3 * y3 + z3 * z3;
                // x = (a1*z + b1)/dnm
                var a1 = (z2 - z1) * (y3 - y1) - (z3 - z1) * (y2 - y1);
                var b1 = -((w2 - w1) * (y3 - y1) - (w3 - w1) * (y2 - y1)) / 2.0;
                // y = (a2*z + b2)/dnm
                var a2 = -(z2 - z1) * x3 + (z3 - z1) * x2;
                var b2 = ((w2 - w1) * x3 - (w3 - w1) * x2) / 2.0;
                // a*z^2 + b*z + c = 0
                var a = a1 * a1 + a2 * a2 + dnm * dnm;
                var b = 2.0 * (a1 * b1 + a2 * (b2 - y1 * dnm) - z1 * dnm * dnm);
                var c = (b2 - y1 * dnm) * (b2 - y1 * dnm) + b1 * b1 + dnm * dnm * (z1 * z1 - delta.re * delta.re);
                // discriminant
                var d = b * b - 4.0 * a * c;
                if (d < 0) { // point exists
                    delta.ok = false;
                } else {
                    delta.Z = delta.nicenum(-0.5 * (b + Math.sqrt(d)) / a);
                    delta.X = delta.nicenum((a1 * delta.Z + b1) / dnm);
                    delta.Y = delta.nicenum((a2 * delta.Z + b2) / dnm);
                    delta.ok = true;
                }
                return delta.ok;
            },

            // inverse kinematics
            // helper functions, calculates angle theta1 (for YZ-pane)
            calcAngleYZ: function(X, Y, Z) {
                var y1 = -tan30_half * delta.f; // f/2 * tg 30
                Y -= tan30_half * delta.e; // shift center to edge
                // z = a + b*y
                var a = (X * X + Y * Y + Z * Z + delta.rf * delta.rf - delta.re * delta.re - y1 * y1) / (2.0 * Z);
                var b = (y1 - Y) / Z;
                // discriminant
                var d = -(a + b * y1) * (a + b * y1) + delta.rf * (b * b * delta.rf + delta.rf);
                if (d < 0) {
                    delta.ok = false;
                } else {
                    delta.ok = true;
                    var yj = (y1 - a * b - Math.sqrt(d)) / (b * b + 1.0); // choosing outer point
                    var zj = a + b * yj;
                    return 180.0 * Math.atan(-zj / (y1 - yj)) / pi + ((yj > y1) ? 180.0 : 0.0);
                }
                return -1;
            },

            // inverse kinematics: (X, Y, Z) -> (theta1, theta2, theta3)
            // returned status: 0=OK, -1=non-existing position
            calcInverse: function() {
                var theta1 = delta.calcAngleYZ(delta.X, delta.Y, delta.Z);
                var theta2 = delta.theta2;
                var theta3 = delta.theta3;
                if (delta.ok) {
                    theta2 = delta.calcAngleYZ(delta.X * cos120 + delta.Y * sin120, delta.Y * cos120 - delta.X * sin120, delta.Z); // rotate coords to +120 deg
                }
                if (delta.ok) {
                    theta3 = delta.calcAngleYZ(delta.X * cos120 - delta.Y * sin120, delta.Y * cos120 + delta.X * sin120, delta.Z); // rotate coords to -120 deg
                }
                if (delta.ok) {
                    delta.theta1 = theta1;
                    delta.theta2 = theta2;
                    delta.theta3 = theta3;
                }
                return delta.ok;
            },

            testInverse: function() {
                var X = delta.X;
                var Y = delta.Y;
                var Z = delta.Z;
                delta.calcInverse();
                if (delta.ok) {
                    delta.calcForward();
                    delta.errX = delta.X - X;
                    delta.errY = delta.Y - Y;
                    delta.errZ = delta.Z - Z;
                    delta.X = X;
                    delta.Y = Y;
                    delta.Z = Z;
                }
            },
            testForward: function() {
                var theta1 = delta.theta1;
                var theta2 = delta.theta2;
                var theta3 = delta.theta3;
                delta.calcForward();
                if (delta.ok) {
                    delta.calcInverse();
                    delta.errTheta1 = delta.theta1 - theta1;
                    delta.errTheta2 = delta.theta2 - theta2;
                    delta.errTheta3 = delta.theta3 - theta3;
                    delta.theta1 = theta1;
                    delta.theta2 = theta2;
                    delta.theta3 = theta3;
                }
            }

        };

        return delta;
    }
]);

services.factory('DeltaRenderer', ['$http',
    function($http) {
        var render = function() {
            console.log("DeltaRenderer");

            function makeTextSprite(message, parameters) {
                parameters = parameters || {
                    fontsize: 32,
                    backgroundColor: {
                        r: 255,
                        g: 255,
                        b: 100,
                        a: .5
                    }
                };

                var fontface = parameters.fontface || "Arial";
                var fontsize = parameters.fontsize || 32;
                var borderThickness = parameters.borderThickness !== undefined ? parameters.borderThickness : 4;
                var borderColor = parameters.borderColor || {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 1.0
                };
                var backgroundColor = parameters.backgroundColor || {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 0.0
                };
                var canvas = document.createElement('canvas');
                canvas.width = 150;
                canvas.height = 150;

                var context = canvas.getContext('2d');
                context.font = fontsize + "px " + fontface;

                // get size data (height depends only on font size)
                var textPad = fontsize / 4;
                var metrics = context.measureText(message);
                var textWidth = metrics.width + textPad + textPad;
                var lineHeight = fontsize; // * 1.4; // 1.4 is extra height factor for text below baseline: g,j,p,q.
                var textX = (canvas.width - textWidth) / 2;
                var textTopY = (canvas.height - lineHeight) / 2;

                context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
                context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";
                context.lineWidth = borderThickness;
                var boxW = textWidth + borderThickness;
                var boxH = lineHeight + borderThickness;
                roundRect(context, textX - borderThickness / 2, textTopY - borderThickness / 2,
                    textWidth + borderThickness, lineHeight + borderThickness, 6);

                // text color
                context.fillStyle = "rgba(0, 0, 0, 1.0)";
                context.fillText(message, textX + textPad, textTopY + lineHeight * .8);

                // canvas contents will be used for a texture
                var texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;

                var spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    useScreenCoordinates: false
                });
                var sprite = new THREE.Sprite(spriteMaterial);
                //sprite.scale.set(80,boxH,1.0);
                sprite.scale.multiplyScalar(boxH);
                return sprite;
            }

            // function for drawing rounded rectangles
            function roundRect(ctx, x, y, w, h, r) {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w - r, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                ctx.lineTo(x + w, y + h - r);
                ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                ctx.lineTo(x + r, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            var scene = new THREE.Scene();
            var aspectW = 1;
            var aspectH = 1;
            var renderer = new THREE.WebGLRenderer();
            renderer.setSize(500, 500);

            console.log("creating viewport");
            var viewport = document.getElementById("viewport1");
            console.log("viewport is:" + viewport);
            viewport.appendChild(renderer.domElement);

            var machineSize = new THREE.Vector3(300, 300, 300);
            var rf = 90;
            var f = 190.536;
            var e = 115;
            var thetaMin = -80 * 2 * Math.PI / 360;
            var thetaMax = 80 * 2 * Math.PI / 360;

            var bgBoxGeometry = new THREE.BoxGeometry(2000, 2000, 2000);
            var bgBoxMaterial = new THREE.MeshBasicMaterial({
                color: 0x202020,
                side: THREE.BackSide
            });
            var bgBox = new THREE.Mesh(bgBoxGeometry, bgBoxMaterial);
            scene.add(bgBox);

            var spriteX = makeTextSprite("X");
            spriteX.position.x += machineSize.x / 2;
            scene.add(spriteX);
            var spriteY = makeTextSprite("Y");
            spriteY.position.y += machineSize.y / 2;
            scene.add(spriteY);
            for (var z = -0; z > -machineSize.z; z -= 50) {
                var spriteZ = makeTextSprite("" + z);
                spriteZ.position.z += z;
                spriteZ.position.x += machineSize.x / 2 - 5;
                spriteZ.position.y += machineSize.y / 2 - 5;
                scene.add(spriteZ);
            }

            var jointMat = new THREE.MeshBasicMaterial({
                color: 0xFFA62F
            });
            var guideMat = new THREE.LineDashedMaterial({
                color: 0x004400,
                linewidth: 2,
                dashSize: 3,
                gapSize: 3
            });

            var applyProps = function(props, customProps) {
                    for (var key in customProps) {
                        if (props.hasOwnProperty(key)) {
                            props[key] = customProps[key];
                        }
                    }
                    return props;
                }
                //console.log(JSON.stringify(applyProps({a:1,b:2,d:null},{a:11,c:33,d:44})));
            var createArm = function(length, detail) {
                var self = {
                    jointRadius: 3,
                    jointMat: null,
                    jointGeom: null,
                    armRadius: 1.5,
                    armGeom: null,
                    armMat: null,
                    offset: 0
                }
                applyProps(self, detail);
                var position1 = new THREE.Vector3(0, 0, 0);
                var position2 = new THREE.Vector3(length, 0, 0);
                self.jointMat = self.jointMat || new THREE.MeshBasicMaterial({
                        color: 0xFFA62F
                    }),
                    self.jointGeom = self.jointGeom || new THREE.IcosahedronGeometry(self.jointRadius),
                    self.armMat = self.armMat || new THREE.LineBasicMaterial({
                        color: 0x444488,
                        linewidth: 10
                    });
                self.armGeom = self.armGeom || new THREE.CylinderGeometry(self.armRadius, self.armRadius, length, 24);
                self.joint = new THREE.Mesh(self.jointGeom, self.jointMat);
                self.joint.position = position1;
                self.tip = new THREE.Mesh(self.jointGeom, self.jointMat);
                self.tip.position = position2;
                self.tip.userData.world = new THREE.Vector3();
                self.armMesh = new THREE.Mesh(self.armGeom, self.armMat);
                self.armMesh.rotation.z -= Math.PI / 2;
                self.armMesh.position.x += length / 2;
                self.arm = new THREE.Object3D();
                self.arm.add(self.armMesh);
                self.arm.add(self.joint);
                self.arm.add(self.tip);
                self.offsetGroup = new THREE.Object3D();
                self.offsetGroup.add(self.arm);
                self.offsetGroup.position.x += self.offset;
                self.group = new THREE.Object3D();
                self.group.userData = self;
                self.group.add(self.offsetGroup);
                self.updateWorld = function() {
                    self.tip.userData.world.setFromMatrixPosition(self.tip.matrixWorld);
                }
                self.group.updateMatrixWorld();
                return self;
            }; // createArm

            var createDeltaBase = function(f, rf, detail) {
                var self = {
                    base: null, // base THREE.Object3D
                    triangleMat: null, // THREE.Material for default triangle guideline
                    triangleGeom: null, // THREE.Geometry for default triangle guideline
                    f: f, // side length of equilateral triangle that defines the base
                    rf: rf, // arm length
                    geometry: null, // default base THREE.Geometry
                    height: 5, // default base thickness 
                    material: null, // default base THREE.Material
                    sides: 6, // default base number of sides
                };
                applyProps(self, detail);
                self.group = new THREE.Object3D();
                self.group.userData = self;
                var radiusIn = 0.5 * f / Math.sqrt(3); // radius of inscribed circle
                self.arms = [
                    createArm(rf, {
                        offset: radiusIn
                    }),
                    createArm(rf, {
                        offset: radiusIn
                    }),
                    createArm(rf, {
                        offset: radiusIn
                    }),
                ];
                var angle = -Math.PI / 2;
                self.arms.forEach(function(arm) {
                    arm.group.rotation.z = angle;
                    angle += 2 * Math.PI / 3;
                    self.group.add(arm.group);
                });

                self.radiusOut = 2 * radiusIn; // radius of circumscribed circle
                angle = Math.PI / 2;
                self.triangleMat = self.triangleMat || new THREE.LineDashedMaterial({
                    color: 0x008800,
                    linewidth: 1,
                    gapsize: 40
                });
                self.triangleGeom = self.triangleGeom || new THREE.Geometry();
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                angle += 2 * Math.PI / 3;
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                angle += 2 * Math.PI / 3;
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                angle += 2 * Math.PI / 3;
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                self.triangle = new THREE.Line(self.triangleGeom, self.triangleMat);
                self.group.add(self.triangle);

                self.material = self.baseMat || new THREE.MeshLambertMaterial({});
                self.geometry = self.geometry || new THREE.CylinderGeometry(radiusIn, radiusIn, self.height, self.sides);
                if (!self.base) {
                    self.base = new THREE.Mesh(self.geometry, self.material);
                    if (self.sides % 2 === 0) {
                        self.base.rotation.y += Math.PI / self.sides;
                    }
                    self.base.rotation.x += Math.PI / 2;
                }
                self.group.add(self.base);
                self.labels = [];
                for (var i = 0; i < self.arms.length; i++) {
                    self.labels[i] = makeTextSprite("" + (1 + i));
                    self.group.add(self.labels[i]);
                }
                self.updateWorld = function() {
                    for (var i = 0; i < self.arms.length; i++) {
                        self.arms[i].updateWorld();
                        var label = self.labels[i];
                        label.position.copy(self.arms[i].tip.userData.world);
                        label.position.z += 10;
                    }
                };
                self.group.updateMatrixWorld();
                return self;
            }; // createDeltaBase

            var createDeltaEffector = function(e, base, detail) {
                var self = {
                    effector: null, // effector THREE.Object3D
                    jointRadius: 3, // radius for default effector arm joint
                    jointMat: null, // THREE.Material for default effector arm joint
                    jointGeom: null, // THREE.Geometry for default effector arm joint
                    triangleMat: null, // THREE.Material for default triangle guideline
                    triangleGeom: null, // THREE.Geometry for default triangle guideline
                    armMat: null, // THREE.Material for default effector arm
                    e: e, // side length of equilateral triangle that defines the effector
                    joints: [], // array of three Object3D for arm joints
                    geometry: null, // default effector THREE.Geometry
                    height: 5, // default effector thickness 
                    material: null, // default effector THREE.Material
                    sides: 6, // default effector number of sides
                };
                applyProps(self, detail);
                self.group = new THREE.Object3D();
                self.group.userData = self;
                self.base = base;
                self.jointMat = self.jointMat || new THREE.MeshBasicMaterial({
                        color: 0xFFA62F
                    }),
                    self.jointGeom = self.jointGeom || new THREE.IcosahedronGeometry(self.jointRadius),
                    self.joints = self.joints.size || [
                        new THREE.Mesh(self.jointGeom, self.jointMat),
                        new THREE.Mesh(self.jointGeom, self.jointMat),
                        new THREE.Mesh(self.jointGeom, self.jointMat)
                    ];
                var radiusIn = 0.5 * e / Math.sqrt(3); // radius of inscribed circle
                var angle = -Math.PI / 2;
                self.joints[0].position.set(radiusIn * Math.cos(angle), radiusIn * Math.sin(angle), 0);
                angle += 2 * Math.PI / 3;
                self.joints[1].position.set(radiusIn * Math.cos(angle), radiusIn * Math.sin(angle), 0);
                angle += 2 * Math.PI / 3;
                self.joints[2].position.set(radiusIn * Math.cos(angle), radiusIn * Math.sin(angle), 0);
                self.material = self.effectorMat || new THREE.MeshLambertMaterial({});
                self.joints.forEach(function(joint) {
                    self.group.add(joint)
                    joint.userData.world = new THREE.Vector3();
                });

                angle = Math.PI / 2;
                self.radiusOut = 2 * radiusIn; // radius of circumscribed circle
                self.triangleMat = self.triangleMat || new THREE.LineDashedMaterial({
                    color: 0x008800,
                    linewidth: 1,
                    gapsize: 40
                });
                self.triangleGeom = self.triangleGeom || new THREE.Geometry();
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                angle += 2 * Math.PI / 3;
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                angle += 2 * Math.PI / 3;
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                angle += 2 * Math.PI / 3;
                self.triangleGeom.vertices.push(new THREE.Vector3(self.radiusOut * Math.cos(angle), self.radiusOut * Math.sin(angle), 0));
                self.triangle = new THREE.Line(self.triangleGeom, self.triangleMat);
                self.group.add(self.triangle);

                self.geometry = self.geometry || new THREE.CylinderGeometry(radiusIn, radiusIn, self.height, self.sides);
                if (!self.effector) {
                    self.effector = new THREE.Mesh(self.geometry, self.material);
                    if (self.sides % 2 === 0) {
                        self.effector.rotation.y += Math.PI / self.sides;
                    }
                    self.effector.rotation.x += Math.PI / 2;
                }
                self.group.add(self.effector);

                var light = new THREE.PointLight(0xffffff, 1, 200);
                self.group.add(light);

                self.updateWorld = function() {
                    self.joints.forEach(function(joint) {
                        joint.userData.world.setFromMatrixPosition(joint.matrixWorld);
                    });
                }
                self.group.updateMatrixWorld();
                return self;
            }; // createDeltaEffector

            var createDeltaSimulator = function(f, e, rf, details) {
                var self = {
                    effector: null, // effector simulation
                    base: null, // base simulation
                };
                self.group = new THREE.Object3D();
                self.group.userData = self;
                self.base = self.base || createDeltaBase(f, rf, details);
                self.group.add(self.base.group);
                self.effector = self.effector || createDeltaEffector(e, self.base, details);
                self.group.add(self.effector.group);
                self.armMat = self.armMat || new THREE.LineBasicMaterial({
                    color: 0x444488,
                    linewidth: 5
                });
                self.arms = [];
                for (var i = 0; i < 3; i++) {
                    var armGeom = new THREE.Geometry();
                    armGeom.vertices.push(self.base.arms[i].tip.userData.world);
                    armGeom.vertices.push(self.effector.joints[i].userData.world);
                    self.arms[i] = new THREE.Line(armGeom, self.armMat);
                    self.group.add(self.arms[i]);
                }

                self.updateWorld = function() {
                    self.base.updateWorld();
                    self.effector.updateWorld();
                    for (var i = 0; i < 3; i++) {
                        self.arms[i].geometry.verticesNeedUpdate = true;
                    }
                }
                return self;
            }; // createDeltaSimulator

            scene.add(baseGuide);

            var simulator = createDeltaSimulator(f, e, rf, {});
            scene.add(simulator.group);

            var baseGuide = new THREE.Object3D();
            var baseGuideGeom = new THREE.CircleGeometry(simulator.base.radiusOut, 36);
            var baseGuideLine = new THREE.Line(baseGuideGeom, guideMat);
            baseGuide.add(baseGuideLine);

            var coordMat = new THREE.LineBasicMaterial({
                color: 0xff00ff,
                linewidth: 1
            });
            var xAxisGeom = new THREE.Geometry();
            xAxisGeom.vertices.push(new THREE.Vector3(-machineSize.x / 2, 0, 0));
            xAxisGeom.vertices.push(new THREE.Vector3(machineSize.x / 2, 0, 0));
            var xAxis = new THREE.Line(xAxisGeom, coordMat);
            scene.add(xAxis);
            var yAxisGeom = new THREE.Geometry();
            yAxisGeom.vertices.push(new THREE.Vector3(0, -machineSize.x / 2, 0));
            yAxisGeom.vertices.push(new THREE.Vector3(0, machineSize.x / 2, 0));
            var yAxis = new THREE.Line(yAxisGeom, coordMat);
            scene.add(yAxis);
            var zAxisGeom = new THREE.Geometry();
            zAxisGeom.vertices.push(new THREE.Vector3(0, 0, 0));
            zAxisGeom.vertices.push(new THREE.Vector3(0, 0, -machineSize.x));
            var zAxis = new THREE.Line(zAxisGeom, coordMat);
            scene.add(zAxis);

            var imgBaseMat = new THREE.MeshPhongMaterial({
                map: THREE.ImageUtils.loadTexture('/firenodejs/img/FirePick-Delta-base.jpg')
            });
            var imgNoneMat = new THREE.MeshPhongMaterial({
                map: THREE.ImageUtils.loadTexture('/firenodejs/img/no-image.png')
            });
            var machineBaseGeom = new THREE.PlaneGeometry(machineSize.x, machineSize.y);
            var machineBase = new THREE.Mesh(machineBaseGeom, imgBaseMat);
            machineBase.position.z = -machineSize.z;
            machineBase.rotation.z -= Math.PI / 2;
            scene.add(machineBase);

            var machine = new THREE.BoxHelper();
            //machine.material = imgMat;
            machine.material.color.setRGB(1, 0, 0);
            machine.scale.set(machineSize.x / 2, machineSize.y / 2, machineSize.z / 2);
            machine.position.z -= machineSize.z / 2;
            scene.add(machine);

            var currentZGeom = new THREE.Geometry();
            currentZGeom.vertices.push(new THREE.Vector3(machineSize.x / 2, -machineSize.x / 2, 0));
            currentZGeom.vertices.push(new THREE.Vector3(machineSize.x / 2, machineSize.x / 2, 0));
            currentZGeom.vertices.push(new THREE.Vector3(-machineSize.x / 2, machineSize.x / 2, 0));
            currentZGeom.vertices.push(new THREE.Vector3(-machineSize.x / 2, -machineSize.x / 2, 0));
            currentZGeom.vertices.push(new THREE.Vector3(machineSize.x / 2, -machineSize.x / 2, 0));
            var currentZMat = new THREE.LineBasicMaterial({
                color: 0x0ffff00
            });
            var currentZ = new THREE.Line(currentZGeom, currentZMat);
            scene.add(currentZ);

            var ambient = new THREE.AmbientLight(0x404040);
            scene.add(ambient);

            var light1 = new THREE.PointLight(0x88ff88, 1.6, 200);
            light1.position.set(0, 0, -50);
            scene.add(light1);
            var ringLight1 = new THREE.PointLight(0xff0000, 1, 200);
            var angle = -Math.PI / 2;
            ringLight1.position.set(100 * Math.cos(angle), 100 * Math.sin(angle), -50);
            scene.add(ringLight1);
            angle += 2 * Math.PI / 3;
            var ringLight2 = new THREE.PointLight(0xff0000, 1, 200);
            ringLight2.position.set(100 * Math.cos(angle), 100 * Math.sin(angle), -50);
            scene.add(ringLight2);
            angle += 2 * Math.PI / 3;
            var ringLight3 = new THREE.PointLight(0xff0000, 1, 200);
            ringLight3.position.set(100 * Math.cos(angle), 100 * Math.sin(angle), -50);
            scene.add(ringLight3);

            var camera = new THREE.PerspectiveCamera(50, aspectW / aspectH, 1.05 * machineSize.x, 1000);
            camera.position.z = -machineSize.z / 4;
            camera.up = new THREE.Vector3(0, 0, 1);
            var cameraR = 1.6 * machineSize.x;
            var cameraAngle = Math.PI / 6;
            camera.position.x = cameraR * Math.cos(cameraAngle);
            camera.position.y = cameraR * Math.sin(cameraAngle);
            camera.lookAt(new THREE.Vector3(0, 0, -3 * machineSize.z / 5));

            var on_render = function() {
                var deltaDivElt = document.getElementById('delta-div');
                if (deltaDivElt) {
                    var deltaDivScope = angular.element(deltaDivElt).scope();
                    assert.ok(deltaDivScope);
                    requestAnimationFrame(on_render);
                    if ('object' === typeof deltaDivScope) {
                        if (deltaDivScope.delta.orbit_camera) {
                            cameraAngle += 0.01;
                            camera.position.x = cameraR * Math.sin(cameraAngle);
                            camera.position.y = cameraR * Math.cos(cameraAngle);
                            camera.lookAt(new THREE.Vector3(0, 0, -3 * machineSize.z / 5));
                        }
                        simulator.effector.group.position.set(deltaDivScope.delta.X, deltaDivScope.delta.Y, deltaDivScope.delta.Z);
                        simulator.base.arms[0].arm.rotation.y = deltaDivScope.delta.theta1 * Math.PI / 180;
                        simulator.base.arms[1].arm.rotation.y = deltaDivScope.delta.theta2 * Math.PI / 180;
                        simulator.base.arms[2].arm.rotation.y = deltaDivScope.delta.theta3 * Math.PI / 180;
                        currentZ.position.z = deltaDivScope.delta.Z;
                    }
                    simulator.updateWorld();
                    renderer.render(scene, camera);
                }
            };

            on_render();
        }

        return render;

    }
]);

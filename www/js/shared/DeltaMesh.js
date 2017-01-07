var should = require("should");
var Logger = require("./Logger");
var Mat3x3 = require("./Mat3x3");
var XYZ = require("./XYZ");
var Barycentric3 = require("./Barycentric3");
var Tetrahedron = require("./Tetrahedron");
var MTO_FPD = require("./MTO_FPD");
var JsonUtil = require("./JsonUtil");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });
    var deg60 = Math.PI / 3;
    var deg30 = Math.PI / 6;
    var SIN60 = Math.sin(deg60);
    var COS60 = Math.cos(deg60);
    var TAN30 = Math.tan(deg30);
    var CHARCODE0 = "0".charCodeAt(0);

    function ZPlane(mesh, zPlaneIndex, options) {
        var that = this;

        that.zpi = zPlaneIndex;
        that.vertices = mesh.zPlaneVertices(that.zpi, options);
        that.vertices.sort(function(a, b) {
            var cmp = Math.round(a.y) - Math.round(b.y);
            cmp != 0 || (cmp = Math.round(a.x) - Math.round(b.x));
            return cmp;
        });
        // find first positive y
        var i = Math.round(that.vertices.length / 2);
        var v;
        var x0yNeg = null;
        do {
            v = that.vertices[i];
            v.y < 0 && Math.round(v.x) === 0 && (x0yNeg = v.y);
        } while (x0yNeg == null && i-- > 0);
        i++;
        var x0yPos = null;
        do {
            v = that.vertices[i];
            if (v.y >= 0) {
                Math.round(v.x) === 0 && (x0yPos = v.y);
                that.rowH == null && (that.rowH = v.y - that.vertices[i - 1].y);
            }
        } while ((that.rowH == null || x0yPos == null) && ++i < that.vertices.length);
        that.yOffset = Math.abs(x0yNeg) < Math.abs(x0yPos) ? x0yNeg : x0yPos;
        var x = Math.round(that.vertices[i].x);
        that.colW = that.vertices[i + 1].x - x;
        that.map = {};
        for (var i = 0; i < that.vertices.length; i++) {
            var v = that.vertices[i];
            that.map[that.hash(v)] = v;
        }

        return that;
    }
    ZPlane.prototype.vertexAtRC = function(r, c) {
        var that = this;
        var hash = "r" + r + "c" + c;
        return that.map[hash];
    }
    ZPlane.prototype.hash = function(xy) {
        var that = this;
        var yRow = xy.y - that.yOffset;
        var xCol = xy.x - yRow * TAN30;
        var r = Math.round(yRow / that.rowH);
        var c = Math.round(xCol / that.colW);
        return "r" + r + "c" + c;
    }
    ZPlane.prototype.vertexAtXY = function(xy) {
        var that = this;
        var hash = that.hash(xy);
        return that.map[hash];
    }
    ZPlane.prototype.xyNeighbors = function(v) {
        var that = this;
        var yRow = v.y - that.yOffset;
        var xCol = v.x - yRow * TAN30;
        var r = Math.round(yRow / that.rowH);
        var c = Math.round(xCol / that.colW);
        var neighbors = [];
        neighbors.push(that.vertexAtRC(r, c + 1));
        neighbors.push(that.vertexAtRC(r + 1, c));
        neighbors.push(that.vertexAtRC(r + 1, c - 1));
        neighbors.push(that.vertexAtRC(r, c - 1));
        neighbors.push(that.vertexAtRC(r - 1, c));
        neighbors.push(that.vertexAtRC(r - 1, c + 1));
        return neighbors;
    }

    ////////////////// constructor
    function DeltaMesh(options) {
        var that = this;

        options = options || {};
        that.import(options);

        return that;
    }
    DeltaMesh.prototype.clear = function(options) {
        var that = this;
        var keys = Object.keys[that];
        if (keys) {
            for (var i = 0; i < keys.length; i++) {
                delete that[keys[i]];
            }
        }

        options = options || {};

        that.zMin = options.zMin == null ? -50 : options.zMin;
        if (options.zMax != null) {
            that.zMax = options.zMax;
            that.height = that.zMax - that.zMin;
            that.rIn = options.rIn == null ? Tetrahedron.heightToBaseInRadius(that.height) : options.rIn;
        } else if (options.height != null) {
            that.height = options.height;
            that.rIn = options.rIn == null ? Tetrahedron.heightToBaseInRadius(that.height) : options.rIn;
            that.zMax = that.zMin + that.height;
        } else {
            that.rIn = options.rIn || 195;
            that.height = options.height == null ? Tetrahedron.baseInRadiusToHeight(that.rIn) : options.height;
            that.zMax = that.zMin + that.height;
        }
        that.rOut = 2 * that.rIn;
        that.maxXYNorm2 = that.rIn * that.rIn * 1.05;
        that.xyzVertexMap = {};

        if (options.verbose) {
            that.verbose = options.verbose;
        }

        var xBase = that.rOut * SIN60;
        var yBase = -that.rOut * COS60;
        that.root = new Tetrahedron(
            addVertex(that, 0, new XYZ(0, that.rOut, that.zMin, options)),
            addVertex(that, 0, new XYZ(xBase, yBase, that.zMin, options)),
            addVertex(that, 0, new XYZ(-xBase, yBase, that.zMin, options)),
            addVertex(that, 0, new XYZ(0, 0, that.zMax, options)),
            options
        );
        that.root.coord = "0";
        that.levelTetras = [
            [that.root]
        ];
        that.zPlanes = Math.max(2, options.zPlanes || 5);
        should && that.zPlanes.should.above(2);
        that._refineZPlanes(that.zPlanes);
        that.mto = options.mto;
        if (that.mto) {
            var digOptions = {
                zOffset: 0,
            };
            if (that.pulseOffset == null) {
                var xyz0 = new XYZ(0, 0, 0);
                var xyz1 = new XYZ(0, 0, -1);
                var pz0 = that.mto.calcPulses(xyz0);
                var pz1 = that.mto.calcPulses(xyz1);
                var dpz = {
                    p1: pz1.p1 - pz0.p1,
                    p2: pz1.p2 - pz0.p2,
                    p3: pz1.p3 - pz0.p3
                };
                var scale = 2 / (Math.max(dpz.p1, dpz.p2, dpz.p3));
                dpz.p1 = Math.round(dpz.p1 * scale);
                dpz.p2 = Math.round(dpz.p2 * scale);
                dpz.p3 = Math.round(dpz.p3 * scale);
                var dxyz = that.mto.calcXYZ(dpz);
                digOptions.zOffset = dxyz.z;
                //that.verbose && verboseLogger.debug("dxyz:", XYZ.of(dxyz).toString());
            }
            that.digitizeZPlane(0, digOptions);
            for (var i = 1; i < that.zPlanes; i++) {
                that.digitizeZPlane(i);
            }
        }
        that.vertexSeparation = 2 * xBase / Math.pow(2, that.zPlanes - 2);
        //console.log("vsep:", that.vertexSeparation, "zPlanes:", that.zPlanes, "2xBase:", 2*xBase);
        that.vertexProps = JSON.parse(JSON.stringify(that.root.t[0]));
        that.vertexProps = {
            x: true,
            y: true,
            z: true,
            l: true,
            external: true,
        }
    }
    DeltaMesh.prototype.getZPlane = function(zPlaneIndex) {
        var that = this;
        that.zPlaneMap = that.zPlaneMap || {}
        var zPlane = that.zPlaneMap[zPlaneIndex];
        if (zPlane == null) {
            zPlane = new DeltaMesh.ZPlane(that, zPlaneIndex);
            that.zPlaneMap[zPlaneIndex] = zPlane;
        }
        return zPlane;
    }
    DeltaMesh.prototype.mendZPlane_balanced = function(zpi, vertices, propName, patched, scale) {
        var that = this;
        var nHoles = 0;
        var nPatched = 0;
        var zPlane = that.getZPlane(zpi);
        for (var i = vertices.length; i-- > 0;) {
            var v = vertices[i];
            if (v[propName] == null) {
                var neighbors = zPlane.xyNeighbors(v);
                var sumBalanced = 0;
                var nBalanced = 0;
                for (var dir = 0; dir < 3; dir++) {
                    var vnA = neighbors[dir];
                    var vnB = neighbors[dir + 3];
                    if (vnA && vnB && vnA[propName] != null && vnB[propName] != null) {
                        // only average balanced neighbors
                        sumBalanced += vnA[propName] + vnB[propName];
                        nBalanced += 2;
                        nPatched++;
                    }
                }
                if (nBalanced) {
                    v[propName] = JsonUtil.round(sumBalanced / nBalanced, scale);
                    patched.push(v);
                    nPatched++;
                } else {
                    nHoles++;
                }
            }
        }
        return {
            nHoles: nHoles,
            nPatched: nPatched,
        }
    }
    DeltaMesh.prototype.mendZPlane_averaged = function(zpi, vertices, propName, patched, scale) {
        var that = this;
        var nHoles = 0;
        var nPatched = 0;
        var zPlane = that.getZPlane(zpi);
        for (var i = vertices.length; i-- > 0;) {
            var v = vertices[i];
            if (v[propName] == null) {
                var sum = 0;
                var n = 0;
                var neighbors = zPlane.xyNeighbors(v);
                for (var dir = 0; dir < 6; dir++) {
                    var vn = neighbors[dir];
                    if (vn && vn[propName] != null) {
                        sum += vn[propName]
                        n++;
                    }
                }
                if (n) {
                    v[propName] = sum / n;
                    patched.push(v);
                    nPatched++;
                } else {
                    nHoles++;
                }
            }
        }
        return {
            nHoles: nHoles,
            nPatched: nPatched,
        }
    }
    DeltaMesh.prototype.mendZPlane = function(zpi, propName, options) {
        var that = this;
        options = options || {};
        var scale = options.scale || 100;
        var vertices = that.zPlaneVertices(zpi, options);
        var patched = [];
        var status;

        do {
            status = that.mendZPlane_balanced(zpi, vertices, propName, patched, scale);
        } while (status.nHoles && status.nPatched);
        if (status.nHoles) {
            do {
                status = that.mendZPlane_averaged(zpi, vertices, propName, patched, scale);
            } while (status.nHoles && status.nPatched);
        }

        return patched;
    }
    DeltaMesh.prototype.xyNeighbor = function(vertex, direction, options) {
        var that = this;
        options = options || {};
        if (vertex == null || typeof direction !== 'number') {
            return null;
        }
        var angle = direction * Math.PI / 3;
        var r = 1.00000000001 * that.vertexSeparation; // Make sure we snap to other vertices
        var xyz = {
            x: vertex.x + r * Math.cos(angle),
            y: vertex.y + r * Math.sin(angle),
            z: vertex.z,
        };
        //console.log("xyNeighbor xyz:", xyz.x, xyz.y);
        var neighbor = that.vertexAtXYZ(xyz, options);
        return neighbor === vertex ? null : neighbor;
    }
    DeltaMesh.prototype.zPlaneIndex = function(z) {
        var that = this;
        var zkeys = that.zKeys();
        var zplane = 0;
        var z = Number(z);
        var dz = Math.abs(z - Number(zkeys[zplane]));
        for (var i = 1; i < zkeys.length; i++) {
            var diz = Math.abs(z - Number(zkeys[i]));
            //console.log("vzp i:", i, "dz:", dz, "diz:", diz, "zkey:", zkeys[i], "z:", z);
            if (diz > dz) {
                break;
            }
            dz = diz;
            zplane = i;
        }
        return zplane;
    }
    DeltaMesh.prototype.export = function(options) {
        var that = this;
        options = options || {};
        var tolerance = options.tolerance || 0.0001;
        var scale = 1 / tolerance;
        var self = {
            type: "DeltaMesh",
            rIn: that.rIn,
            height: that.height,
            zPlanes: that.zPlanes,
            zMin: that.zMin,
            zMax: that.zMax,
            data: [],
        };
        var vpo = {
            includeExternal: true
        };
        var vp = that.vertexProps;
        var nProps = Object.keys(vp).length;
        for (var zp = 0; zp < that.zPlanes; zp++) {
            var pv = that.zPlaneVertices(zp, vpo);
            for (var i = 0; i < pv.length; i++) {
                var v = pv[i];
                var props = Object.keys(v);
                //if (props.length > nProps) 
                {
                    var vsave = null;
                    for (var j = 0; j < props.length; j++) {
                        var prop = props[j];
                        if (!vp[prop]) {
                            vsave = vsave || {};
                            vsave[prop] = v[prop];
                        }
                    }
                    if (vsave) {
                        vsave.x = JsonUtil.round(v.x, scale);
                        vsave.y = JsonUtil.round(v.y, scale);
                        vsave.z = JsonUtil.round(v.z, scale);
                        self.data.push(vsave);
                    }
                }
            }
        }
        return self;
    }
    DeltaMesh.prototype.import = function(self, options) {
        var that = this;
        options = options || {};
        that.clear(self);
        var strict = options.strict || false;
        var ok = true;
        if (typeof self === 'string') {
            self = JSON.parse(self);
        }
        if (self.data) {
            var data = self.data;
            for (var i = 0; i < data.length; i++) {
                var d = data[i];
                var props = Object.keys(d);
                for (var j = 0; j < props.length; j++) {
                    var prop = props[j];
                    var v = that.vertexAtXYZ(d);
                    if (!v) {
                        var msg = "DeltaMesh.import() could not import:" + JSON.stringify(d);
                        if (strict) {
                            throw new Error(msg);
                        } else {
                            verboseLogger.warn(msg);
                        }
                    } else if (v && !v.hasOwnProperty(prop)) {
                        v[prop] = d[prop];
                    }
                }
            }
        }
        return ok;
    }
    DeltaMesh.prototype.tetrasInROI = function(roi) {
        var that = this;
        var tetras = [];
        var traverse = function(tetra) {
            for (var i = tetra.partitions.length; i-- > 0;) {
                var subTetra = tetra.partitions[i];
                if (subTetra) {
                    if (subTetra.partitions && subTetra.partitions.length) {
                        traverse(subTetra);
                    } else {
                        if (DeltaMesh.isTetraROI(subTetra, roi)) {
                            tetras.push(subTetra);
                        }
                    }
                }
            }
        }
        if (that.root.partitions && that.root.partitions.length) {
            traverse(that.root);
        } else {
            DeltaMesh.isTetraROI(that.root, roi) && tetras.push(that.root);
        }
        return tetras;
    }
    DeltaMesh.prototype.interpolatorAtXYZ = function(xyz, propName) {
        var that = this;
        if (!that.root.contains(xyz)) {
            return that.root.interpolates(propName) ? that.root : null;
        }
        var interpolator = null;
        if (that.root.partitions) {
            var traverse = function(tetra) {
                for (var i = tetra.partitions.length; i-- > 0;) {
                    var subTetra = tetra.partitions[i];
                    if (subTetra && subTetra.contains(xyz)) {
                        subTetra.partitions && traverse(subTetra);
                        if (interpolator == null && subTetra.interpolates(propName)) {
                            interpolator = subTetra;
                            break;
                        }
                    }
                }
            }
            traverse(that.root);
        }
        return interpolator || that.root.interpolates(propName) && that.root || null;
    }
    DeltaMesh.prototype.tetrasContainingXYZ = function(xyz) {
        var that = this;
        var tetras = [];
        that.root.contains(xyz) && tetras.push(that.root);
        if (that.root.partitions) {
            var traverse = function(tetra) {
                for (var i = tetra.partitions.length; i-- > 0;) {
                    var subTetra = tetra.partitions[i];
                    if (subTetra && subTetra.contains(xyz)) {
                        tetras.push(subTetra);
                        subTetra.partitions && traverse(subTetra);
                    }
                }
            }
            traverse(that.root);
        }
        return tetras;
    }
    DeltaMesh.prototype.classifyTetra = function(tetra, zMax, visitor) {
        var that = this;
        var nA = 1;
        var nB = 0;
        var category = null;
        var vA = tetra.t[0];
        var zA = Math.round(vA.z);
        var xSum = vA.x;
        var ySum = vA.y;
        var zB = null;
        if (zA > zMax) {
            return null;
        }
        var nExternal = vA.external ? 1 : 0;
        for (var i = 1; i < 4; i++) {
            var v = tetra.t[i];
            v.external && nExternal++;
            xSum += v.x;
            ySum += v.y;
            var z = Math.round(v.z);
            if (z > zMax) {
                return null;
            }

            if (z === zA) {
                nA++;
            } else {
                if (zB === null) {
                    zB = z;
                    nB = 1;
                    vB = v;
                } else if (zB === z) {
                    nB++;
                } else {
                    category = "zzzz";
                    break;
                }
            }
        }
        if (category == null) {
            var v1 = null;
            if (nA === nB) {
                category = "0011";
            } else if (zA < zB) {
                if (nA === 1) {
                    category = "0111";
                    v1 = vA;
                } else {
                    category = "1000";
                    v1 = vB;
                }
            } else {
                if (nB === 1) {
                    category = "0111";
                    v1 = vB;
                } else {
                    category = "1000";
                    v1 = vA;
                }
            }
        }
        category && visitor(tetra, category, nExternal);
        return category;
    }
    DeltaMesh.prototype.classifyBottomTetras = function(visitor) {
        var that = this;
        var zMax = that.zPlaneZ(1) + 1; // add 1 for mto compensation
        var traverse = function(tetra) {
            for (var i = tetra.partitions.length; i-- > 0;) {
                var subTetra = tetra.partitions[i];
                if (subTetra) {
                    if (subTetra.partitions) {
                        traverse(subTetra);
                    } else {
                        that.classifyTetra(subTetra, zMax, visitor);
                    }
                }
            }
        }
        traverse(that.root);
        return that;
    }
    DeltaMesh.prototype.tetrasAtVertex = function(v, options, tetra, tetras) {
        var that = this;
        if (tetras) {
            for (var i = tetra.t.length; i-- > 0;) {
                if (tetra.t[i] === v) {
                    tetras.push(tetra);
                }
            }
            if (tetra.partitions) {
                for (var i = tetra.partitions.length; i-- > 0;) {
                    var subTetra = tetra.partitions[i];
                    subTetra && that.tetrasAtVertex(v, options, subTetra, tetras);
                }
            }
        } else {
            tetras = [];
            that.tetrasAtVertex(v, options, that.root, tetras);
        }
        return tetras;
    }
    DeltaMesh.prototype.vertexAtXYZ = function(xyz, options) {
        var that = this;
        options = options || {};
        var zpi = that.zPlaneIndex(xyz.z);
        if (zpi <= 1) {
            var zPlane = that.getZPlane(zpi);
            var v = zPlane.vertexAtXY(xyz);
            if (v) {
                return v;
            }
        }
        var vertices = that.zPlaneVertices(zpi, options);
        var v = vertices[0];
        var dx = xyz.x - v.x;
        var dy = xyz.y - v.y;
        var d2 = dx * dx + dy * dy;
        for (var i = vertices.length; i-- > 1;) { // TODO: make faster
            var vi = vertices[i];
            var dxi = xyz.x - vi.x;
            var dyi = xyz.y - vi.y;
            var d2i = dxi * dxi + dyi * dyi;
            if (d2i < d2) {
                d2 = d2i;
                v = vi;
            }
        }
        return v;
    }
    DeltaMesh.prototype.digitizeZPlane = function(zPlane, options) {
        var that = this;
        options = options || {};
        zPlane = zPlane == null ? that.zPlanes - 1 : zPlane;
        should &&
            zPlane.should.within(0, that.zPlanes - 1) &&
            should.exist(that.mto);
        var mto = that.mto;
        var zpv = that.zPlaneVertices(zPlane);
        var dz = options.zOffset || 0;
        for (var i = 0; i < zpv.length; i++) {
            var v = zpv[i];
            var pulses = mto.calcPulses({
                x: v.x,
                y: v.y,
                z: v.z + dz
            });
            if (pulses == null) { // point does not satisfy mto constraint
                v.external = true;
                //that.verbose && verboseLogger.debug("DeltaMesh.digitizeZPlane() mto excluded point:",v.toString());
            } else {
                var vNew = mto.calcXYZ(pulses);
                v.x = vNew.x;
                v.y = vNew.y;
                v.z = vNew.z;
            }
        }
        return that;
    }
    DeltaMesh.prototype.zfloor = function(z, level) {
        var that = this;
        if (z < that.zMin) {
            return null;
        }
        if (that.zMax < z) {
            return null;
        }
        var zceil = that.zMax;
        var zfloor = that.zMin;
        while (level-- > 0) {
            var zAvg = (zceil + zfloor) / 2;
            if (z < zAvg) {
                zceil = zAvg;
            } else {
                zfloor = zAvg;
            }
        }
        return zfloor;
    }
    DeltaMesh.prototype._refineZPlanes = function(zPlaneCount) {
        var that = this;
        var zMin = that.zMin;
        that.nRefine = 0;
        should && zPlaneCount.should.Number;
        level = zPlaneCount - 2;
        for (var l = 0; l < level; l++) {
            var lpartitions = that.levelTetras[l];
            if (that.levelTetras.length <= l + 1) {
                that.levelTetras.push([]);
            }
            var l1map = that.levelTetras[l + 1];
            if (l1map.length === 0) {
                for (var i = 0; i < lpartitions.length; i++) {
                    var tetra = lpartitions[i];
                    that.refineRed(tetra);
                    for (var j = 0; j < tetra.partitions.length; j++) {
                        var subtetra = tetra.partitions[j];
                        if (subtetra && subtetra.zMin() === zMin) {
                            l1map.push(subtetra);
                        } else {
                            // skip null placeholder for rejected refinement
                        }
                    }
                }
                //that.verbose && verboseLogger.debug("refined partition level:", l + 1, " partitions:", l1map.length);
            }
        }
        return that.levelTetras[level];
    }
    DeltaMesh.prototype.refineRed = function(tetra) {
        var that = this;
        that.nRefine++;
        var t = tetra.t;
        if (tetra.partitions) {
            return tetra.partitions;
        }
        var level = tetra.coord.length;
        var pt03 = addVertex(that, level, t[3].interpolate(t[0], 0.5)); // [0] tip midpoint #7
        var pt13 = addVertex(that, level, t[3].interpolate(t[1], 0.5)); // [1] tip midpoint #9
        var pt23 = addVertex(that, level, t[3].interpolate(t[2], 0.5)); // [2] tip midpoint #10
        var pt01 = addVertex(that, level, t[0].interpolate(t[1], 0.5)); // [3] base midpoint #5
        var pt12 = addVertex(that, level, t[1].interpolate(t[2], 0.5)); // [4] base midpoint #8
        var pt02 = addVertex(that, level, t[2].interpolate(t[0], 0.5)); // [5] base midpoint #6

        tetra.partitions = [];
        if (t[2].z === t[3].z) {
            addSubTetra(that, 0, tetra, pt03, pt13, pt23, t[3]); // MMHH
            addSubTetra(that, 1, tetra, pt02, pt12, t[2], pt23); // MMHH
            addSubTetra(that, 2, tetra, pt02, pt03, pt01, t[0]); // MMLL
            addSubTetra(that, 3, tetra, pt12, pt13, t[1], pt01); // MMLL
            addSubTetra(that, 4, tetra, pt12, pt02, pt13, pt23); // MMMH
            addSubTetra(that, 5, tetra, pt13, pt02, pt03, pt01); // MMML
            addSubTetra(that, 6, tetra, pt13, pt02, pt03, pt23); // MMMH
            addSubTetra(that, 7, tetra, pt12, pt02, pt13, pt01); // MMML
        } else {
            addSubTetra(that, 0, tetra, pt03, pt13, pt23, t[3]); // LLLH
            addSubTetra(that, 1, tetra, t[0], pt01, pt02, pt03); // LLLH
            addSubTetra(that, 2, tetra, t[1], pt12, pt01, pt13); // LLLH
            addSubTetra(that, 3, tetra, t[2], pt02, pt12, pt23); // LLLH
            addSubTetra(that, 4, tetra, pt23, pt13, pt03, pt02); // HHHL
            addSubTetra(that, 5, tetra, pt12, pt02, pt01, pt13); // LLLH
            addSubTetra(that, 6, tetra, pt01, pt02, pt13, pt03); // LLHH
            addSubTetra(that, 7, tetra, pt12, pt02, pt13, pt23); // LLHH
        }
        return tetra.partitions;
    }

    DeltaMesh.prototype.zPlaneZ = function(zPlane) {
        var that = this;
        var zmap = that.zVertexMap();
        var zkeys = Object.keys(zmap);
        for (var i = 0; i < zkeys.length; i++) {
            zkeys[i] = Number(zkeys[i]);
        }
        zkeys = zkeys.sort(function(a, b) {
            return a - b;
        });
        if (zPlane < 0 || zkeys.length - 1 <= zPlane) {
            return null;
        }
        return zkeys[zPlane];
    }
    DeltaMesh.prototype.zPlaneHeight = function(zpi) {
        var that = this;
        var zmap = that.zVertexMap();
        var zkeys = Object.keys(zmap);
        for (var i = 0; i < zkeys.length; i++) {
            zkeys[i] = Number(zkeys[i]);
        }
        zkeys = zkeys.sort(function(a, b) {
            return a - b;
        });
        if (zpi < 0 || zkeys.length - 1 <= zpi) {
            return 0;
        }
        return zkeys[zpi + 1] - zkeys[zpi];
    }
    DeltaMesh.prototype.zVertexMap = function() {
        var that = this;
        if (that._zVertexMap == null) {
            var zmap = that._zVertexMap = {};
            var xyzKeys = Object.keys(that.xyzVertexMap);
            for (var i = 0; i < xyzKeys.length; i++) {
                var v = that.xyzVertexMap[xyzKeys[i]];
                if (zmap.hasOwnProperty(v.z)) {
                    zmap[v.z].push(v);
                } else {
                    zmap[v.z] = [v];
                }
            }
        }
        return that._zVertexMap;
    }
    DeltaMesh.prototype.zKeys = function() {
        var that = this;
        var zmap = that.zVertexMap();
        //console.log("zVertexMap keys:", Object.keys(zmap));
        var zkeys = Object.keys(zmap);
        zkeys = Object.keys(zmap).sort(function(a, b) {
            return Number(a) - Number(b);
        });
        return zkeys;
    }
    DeltaMesh.prototype.zPlaneVertices = function(zPlane, options) {
        var that = this;
        options = options || {};
        var maxLevel = options.maxLevel;
        var includeExternal = options.includeExternal == null ? false : options.includeExternal;
        var zmap = that.zVertexMap();
        var zkeys = that.zKeys();
        zPlane = zPlane == null ? that.zPlanes - 1 : zPlane;
        should && zPlane.should.within(0, zkeys.length - 1);
        //console.log("zPlane:", zPlane, " zkeys:", zkeys[zPlane]);
        var vertices = zmap[zkeys[zPlane]];
        maxLevel = maxLevel == null ? that.zPlanes - 1 : Math.min(that.zPlanes - 1, maxLevel);
        should && maxLevel.should.not.below(0);
        var result = [];
        for (var i = vertices.length; i-- > 0;) {
            var v = vertices[i];
            if (v.l <= maxLevel) {
                if (includeExternal || !v.external) {
                    if (DeltaMesh.isVertexROI(v, options.roi)) {
                        result.push(v);
                    }
                }
            }
        }
        if (options.sort) {
            var keys = options.sort.split(",");
            result = result.sort(function(a, b) {
                var cmp = a[keys[0]] - b[keys[0]];
                for (var i = 1; cmp === 0 && i < keys.length; i++) {
                    cmp = a[keys[i]] - b[keys[i]];
                }
                return cmp;
            });
        }

        return result;
    }
    DeltaMesh.prototype.subTetras = function(parent, result) {
        var that = this;
        parent = parent || that.root;
        result = result || [];
        if (parent.partitions) {
            for (var i = 0; i < parent.partitions.length; i++) {
                var kid = parent.partitions[i];
                if (kid) {
                    result.push(kid);
                    that.subTetras(kid, result);
                }
            }
        }

        return result;
    }
    DeltaMesh.prototype.tetraAtCoord = function(coord, tetra) {
        var that = this;
        var subtetra;
        if (tetra) {
            var index = coord.charCodeAt(0) - CHARCODE0;
            subtetra = tetra.partitions ? tetra.partitions[index] : null;
        } else {
            subtetra = that.root;
        }
        if (coord.length === 1 || subtetra == null) {
            return subtetra;
        }
        return that.tetraAtCoord(coord.substring(1), subtetra);
    }
    DeltaMesh.prototype.interpolate = function(xyz, propName) {
        var that = this;
        //var tetra = that.tetraAtXYZ(xyz);
        var tetra = that.interpolatorAtXYZ(xyz, propName);
        if (tetra == null) {
            //console.log("DeltaMesh.interpolate(" + propName + ") no interpolator at xyz:", JsonUtil.summarize(xyz));
            return null;
        }
        return tetra.interpolate(xyz, propName);
    }
    DeltaMesh.prototype.tetraAtXYZ = function(xyz, level) {
        var that = this;
        var probes = 1;
        level = level == null ? (that.zPlanes - 2) : level;
        if (xyz.z === that.zMin) {
            var eRounding = 0.0000000001; // ensure smallest tetra at zMin
            xyz = new XYZ(xyz.x, xyz.y, xyz.z + eRounding, that);
        } else {
            xyz = XYZ.of(xyz, that);
        }
        var result = {
            xyz: xyz,
            coord: "0",
            tetra: that.root
        };
        var contains = that.root.contains(xyz);
        if (contains) {
            location(that, result, level);
        }
        return result.tetra;
    }

    /////////// Class ///////
    DeltaMesh.isVertexROI = function(v, roi) {
        if (v == null) {
            return false;
        }
        if (roi && roi.type === "rect") {
            //should && v.x.should.exist && v.y.should.exist;
            var left = roi.cx - roi.width / 2;
            var top = roi.cy - roi.height / 2;
            if (v.x < left || left + roi.width < v.x) {
                return false;
            }
            if (v.y < top || top + roi.height < v.y) {
                return false;
            }
            if (roi.zMax != null && roi.zMax < v.z) {
                return false;
            }
        }
        return true;
    }
    DeltaMesh.isTetraROI = function(tetra, roi) {
        for (var i = 4; i-- > 0;) {
            if (DeltaMesh.isVertexROI(tetra.t[i], roi)) { // any vertex in XY roi 
                if (roi.zMax != null) { // and ALL vertices in Z roi
                    for (var j = 4; j-- > 0;) {
                        if (roi.zMax < tetra.t[j].z) {
                            return false;
                        }
                    }
                }
                return true;
            }
        }
        return false;
    }

    //////////// PRIVATE
    function location(that, result, level) {
        var xyz = result.xyz;
        var tetra = result.tetra;
        should &&
            xyz.z.should.Number &&
            should.exist(tetra) &&
            tetra.contains(xyz).should.True;
        var nContains = 0;
        for (var i = 0; tetra.partitions && i < tetra.partitions.length; i++) {
            var subtetra = tetra.partitions[i];
            if (subtetra && subtetra.contains(xyz)) {
                nContains++;
                //that.verbose && verboseLogger.debug("DeltaMesh location in i:", i, " level:", level, " subtetra:", subtetra.t);
                result.coord = result.coord + i;
                result.tetra = subtetra;
                if (level <= 1) {
                    //that.verbose && verboseLogger.debug("DeltaMesh location matched i:", i, " level:", level);
                    return result;
                }
                //that.verbose && verboseLogger.debug("DeltaMesh scanning child i:", i, " subtetra:", subtetra.t);
                return location(that, result, level - 1);
            } else if (subtetra) {
                false && that.verbose && verboseLogger.debug("DeltaMesh.location(" +
                    xyz.x + "," + xyz.y + "," + xyz.z +
                    ") not found in subtetra:", subtetra.coord,
                    " t:", subtetra.vertices(),
                    " partitions:", (subtetra.partitions ? subtetra.partitions.length : 0));
            } else {
                false && that.verbose && verboseLogger.debug("DeltaMesh.location(" +
                    xyz.x + "," + xyz.y + "," + xyz.z +
                    ") not found in unrefined mesh at coord:", tetra.coord, " partition:", i);
            }
        }
        false && nContains == 0 && tetra.partitions && that.verbose && verboseLogger.debug("DeltaMesh.location(" +
            xyz.x + "," + xyz.y + "," + xyz.z +
            ") not found in any partition at coord:", result.coord,
            " partitions:", (tetra.partitions ? tetra.partitions.length : null));
        return result;
    }

    function addVertex(that, level, xyz) {
        var key = xyz.x + "_" + xyz.y + "_" + xyz.z;
        if (that.xyzVertexMap.hasOwnProperty(key)) {
            // vertex is already in
        } else {
            that.xyzVertexMap[key] = xyz;
            xyz.l = level;
            if ((xyz.x * xyz.x + xyz.y * xyz.y) > that.maxXYNorm2) {
                xyz.external = true;
            }
        }
        return that.xyzVertexMap[key];
    }

    function addSubTetra(that, index, tetra, t0, t1, t2, t3) {
        var include = tetra == that.root || !t0.external || !t1.external || !t2.external || !t3.external;
        var subtetra = null;
        if (include) {
            subtetra = new Tetrahedron(t0, t1, t2, t3, tetra);
            subtetra.coord = tetra.coord + index;
        }
        tetra.partitions.push(subtetra);
        if (include) {
            return subtetra;
        }
        return null;
    }

    DeltaMesh.ZPlane = ZPlane;

    module.exports = exports.DeltaMesh = DeltaMesh;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("DeltaMesh", function() {
    var DeltaMesh = require("./DeltaMesh");
    var options = {
        logLevel: "info",
        verbose: true,
        rIn: 195,
        zMin: -50,
        zPlanes: 5,
    };
    var logger = new Logger(options);

    it("new DeltaMesh() should create a delta tetrahedral mesh 100 units high", function() {
        var mesh = new DeltaMesh(options);
        //logger.debug(mesh.root);
        var n1 = mesh.root.t[0].norm();
        var e = 0.0000000000001;
        should(mesh.root.t[1].norm()).within(n1 - e, n1 + e);
        should(mesh.root.t[2].norm()).within(n1 - e, n1 + e);
    })
    it("zfloor(z,level) returns z lower bound at the given 0-based partition refinement level", function() {
        var mesh = new DeltaMesh({
            height: 100,
        });
        var zMax = mesh.zMax;
        should(mesh.zfloor(zMax + 1, 0) == null).True;
        should(mesh.zfloor(-zMax - 1, 0) == null).True;
        mesh.zfloor(zMax, 0).should.equal(-50);
        mesh.zfloor(0, 0).should.equal(-50);
        mesh.zfloor(-zMax, 0).should.equal(-50);
        mesh.zfloor(zMax, 1).should.equal(0);
        mesh.zfloor(0, 1).should.equal(0);
        mesh.zfloor(-zMax, 1).should.equal(-50);
        mesh.zfloor(zMax, 2).should.equal(25);
        mesh.zfloor(1, 2).should.equal(0);
        mesh.zfloor(0, 2).should.equal(0);
        mesh.zfloor(-1, 2).should.equal(-25);
        mesh.zfloor(-zMax, 3).should.equal(-50);
        mesh.zfloor(zMax, 3).should.equal(37.5);
        mesh.zfloor(1, 3).should.equal(0);
        mesh.zfloor(0, 3).should.equal(0);
        mesh.zfloor(-1, 3).should.equal(-12.5);
        mesh.zfloor(-zMax, 3).should.equal(-50);
        mesh.zfloor(zMax, 4).should.equal(43.75);
        mesh.zfloor(1, 4).should.equal(0);
        mesh.zfloor(0, 4).should.equal(0);
        mesh.zfloor(-1, 4).should.equal(-6.25);
        mesh.zfloor(-zMax, 4).should.equal(-50);
    })
    it("_refineZPlanes(nLevels) refines the mesh to have at least given level count (INTERNAL)", function() {
        var mesh = new DeltaMesh({
            verbose: true,
            maxSkewness: 0.3
        });
        var lvl0 = mesh._refineZPlanes(2);
        lvl0.length.should.equal(1);
        lvl0[0].should.equal(mesh.root);
        var lvl3l = mesh._refineZPlanes(5);
        lvl3l.length.should.above(144); // 175 without maxXYNorm2
    })
    it("tetraAtXYZ(xyz) returns best matching tetrahedron for xyz", function() {
        var mesh = new DeltaMesh({
            verbose: true,
            height: 100,
        });
        var e = 0.01;
        var v = mesh.root.t;
        var m = [ // tetrahedron midpoints
            v[0].interpolate(v[1], 0.5), // bottom
            v[0].interpolate(v[2], 0.5), // bottom
            v[1].interpolate(v[2], 0.5), // bottom
            v[0].interpolate(v[3], 0.5), // middle
            v[1].interpolate(v[3], 0.5), // middle
            v[2].interpolate(v[3], 0.5), // middle
        ];
        var c = [ // core interior points
            m[0].interpolate(m[1], 0.1), // bottom
            m[0].interpolate(m[1], 0.9), // bottom
            m[1].interpolate(m[2], 0.1), // bottom
            m[1].interpolate(m[2], 0.9), // bottom
            m[2].interpolate(m[0], 0.1), // bottom
            m[2].interpolate(m[0], 0.9), // bottom
            m[3].interpolate(m[4], 0.1), // middle
            m[3].interpolate(m[4], 0.9), // middle
            m[4].interpolate(m[5], 0.1), // middle
            m[4].interpolate(m[5], 0.9), // middle
            m[5].interpolate(m[3], 0.1), // middle
            m[5].interpolate(m[3], 0.9), // middle
        ];
        for (var i = 0; i < m.length; i++) {
            m[i].x.should.Number;
            m[i].y.should.Number;
            m[i].z.should.Number;
        }
        v[3].z.should.equal(mesh.zMax);
        var dz = 1; //0.0000000000001;
        var midz = (mesh.zMax + mesh.zMin) / 2;
        var botz = mesh.zMin;
        var tetras = [
            // very sparse
            mesh.tetraAtXYZ(new XYZ(0, 0, 0.9 * mesh.zMax, options)), // top tetra
            mesh.tetraAtXYZ(new XYZ(v[0].x * 0.9, v[0].y * 0.9, v[0].z, options)), // bottom tetra
            mesh.tetraAtXYZ(new XYZ(v[1].x * 0.9, v[1].y * 0.9, v[1].z, options)), // bottom tetra
            mesh.tetraAtXYZ(new XYZ(v[2].x * 0.9, v[2].y * 0.9, v[2].z, options)), // bottom tetra
            // sparse
            mesh.tetraAtXYZ(new XYZ(c[6].x, c[6].y, midz - dz, options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[7].x, c[7].y, midz - dz, options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[8].x, c[8].y, midz - dz, options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[9].x, c[9].y, midz - dz, options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[10].x, c[10].y, midz - dz, options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[11].x, c[11].y, midz - dz, options)), // core tetra middle
            // dense
            mesh.tetraAtXYZ(new XYZ(c[0].x, c[0].y, botz + dz, options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[1].x, c[1].y, botz + dz, options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[2].x, c[2].y, botz + dz, options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[3].x, c[3].y, botz + dz, options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[4].x, c[4].y, botz + dz, options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[5].x, c[5].y, botz + dz, options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(0, 0, botz + dz, options)), // core tetra origin bottom
        ];
        for (var i = 0; i < tetras.length; i++) {
            should.exist(tetras[i]); // we found it
            tetras[i].coord.length.should.above(1); // very sparse
            i > 3 && tetras[i].coord.length.should.above(2); //sparse
            i > 9 && tetras[i].coord.length.should.above(3); //dense
            logger.debug("tetraAtXYZ OK:", i, " coord:", tetras[i].coord);
        }

        // Rounding error should not affect zMin locations
        var e = 0.0000001;
        mesh.tetraAtXYZ(new XYZ(c[5].x, c[5].y, botz + e, options)).coord.should.equal("0531");
        mesh.tetraAtXYZ(new XYZ(c[5].x, c[5].y, botz + 0, options)).coord.should.equal("0531");
    })
    it("tetraAtCoord(coord) returns tetrahedron at tetra-coord", function() {
        var testOptions = JSON.parse(JSON.stringify(options));
        testOptions.height = 100;
        delete testOptions.rIn;
        var mesh = new DeltaMesh(testOptions);
        var xyz = new XYZ(20, 5, -40, options);
        var tetra = mesh.tetraAtXYZ(xyz);
        tetra.coord.should.equal("0534");
        mesh.tetraAtCoord("0534").should.equal(tetra);
        mesh.tetraAtCoord("053").coord.should.equal("053");
        mesh.tetraAtCoord("05").coord.should.equal("05");
        mesh.tetraAtCoord("0").coord.should.equal("0");
        mesh.tetraAtCoord("0").should.equal(mesh.root);
        // tetra-coords are nested. 
        mesh.tetraAtCoord("34", mesh.tetraAtCoord("05")).coord.should.equal("0534");
        // tetra-coord prefixes identify enclosing parents
        mesh.tetraAtCoord("0").contains(xyz).should.True; // largest enclosing
        mesh.tetraAtCoord("05").contains(xyz).should.True;
        mesh.tetraAtCoord("053").contains(xyz).should.True;
        mesh.tetraAtCoord("0534").contains(xyz).should.True; // smallest enclosing 
    })
    it("vertices are xyz unique and shared by adjacent tetrahedra", function() {
        var options = {
            verbose: true
        };
        var mesh = new DeltaMesh(options);
        var xyz = new XYZ(20, 5, -40, options);
        var tetra = mesh.tetraAtXYZ(xyz);
        var map = {};

        function addXYZ(xyz, map) {
            var key = xyz.x + "_" + xyz.y + "_" + xyz.z;
            if (map.hasOwnProperty(key)) {
                should(map[key] === xyz).True;
            } else {
                map[key] = xyz;
            }
        }

        function checker(tetra, map) {
            addXYZ(tetra.t[0], map);
            addXYZ(tetra.t[1], map);
            addXYZ(tetra.t[2], map);
            addXYZ(tetra.t[3], map);
            if (tetra.partitions) {
                for (var i = 0; i < tetra.partitions.length; i++) {
                    var subtetra = tetra.partitions[i];
                    if (subtetra) {
                        checker(subtetra, map);
                    }
                }
            }
        }
        checker(mesh.root, map);
        Object.keys(mesh.xyzVertexMap).length.should.equal(107);
    })
    it("zPlaneVertices(zPlane, options) returns vertices for zPlane indexed from bottom", function() {
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 195,
            zMin: -50,
            zPlanes: 7,
        });
        var zPlanes = [
            mesh.zPlaneVertices(0), // lowest z-plane
            mesh.zPlaneVertices(1),
            mesh.zPlaneVertices(2),
            mesh.zPlaneVertices(3),
            mesh.zPlaneVertices(4),
            mesh.zPlaneVertices(5),
            mesh.zPlaneVertices(6), // degenerate top-most z-plane
        ];
        zPlanes[0].length.should.equal(327);
        zPlanes[1].length.should.equal(327);
        zPlanes[2].length.should.equal(313);
        zPlanes[3].length.should.equal(84);
        zPlanes[4].length.should.equal(19);
        zPlanes[5].length.should.equal(6);
        zPlanes[6].length.should.equal(1);
        for (var i = 0; i < zPlanes.length; i++) {
            var zplane = zPlanes[i];
            for (var j = 0; j < zplane.length; j++) {
                var v = zplane[j];
                mesh.zPlaneIndex(v.z).should.equal(i);
            }
        }
        mesh.zPlaneIndex(zPlanes[0][0].z).should.equal(0);
        mesh.zPlaneIndex(zPlanes[1][0].z).should.equal(1);
        mesh.zPlaneIndex(zPlanes[6][0].z).should.equal(6);
        var z0 = zPlanes[0][0].z;
        var z1 = zPlanes[1][0].z;
        for (var i = 0; i < zPlanes[0].length; i++) {
            var xyz = zPlanes[0][i];
            xyz.z.should.equal(z0);
        }
        for (var i = 1; i < zPlanes[1].length; i++) {
            var xyz = zPlanes[1][i];
            xyz.z.should.equal(z1);
        }

        // optional maxRefinementLevel will return a coarser grid for lower numbers
        var z0_levels = [
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 0
            }), // root tetrahedon
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 1
            }), // root + immediate children
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 2
            }),
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 3
            }),
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 4
            }),
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 5
            }), // finest resolution for a 7-plane mesh
            mesh.zPlaneVertices(0, {
                includeExternal: true,
                maxLevel: 6
            }), // (same as 5)
        ];
        z0_levels[0].length.should.equal(3);
        z0_levels[1].length.should.equal(6);
        z0_levels[2].length.should.equal(15);
        z0_levels[3].length.should.equal(39);
        z0_levels[4].length.should.equal(126);
        z0_levels[5].length.should.equal(420);
        z0_levels[6].length.should.equal(420);

        // ROI filtering
        var zpvROI = mesh.zPlaneVertices(0, {
            roi: {
                type: "rect",
                cx: 0,
                cy: -10,
                width: 10,
                height: 10,
            },
            includeExternal: true,
            maxLevel: 5
        });
        zpvROI.length.should.equal(1);
        zpvROI[0].x.should.equal(0);
        zpvROI[0].y.should.within(-12.19, -12.18);

    })
    it("zPlaneVertices(zPlane, options) can be used to print a scatterplot of sample points by level", function() {
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 195,
            zMin: -50,
            zPlanes: 7,
        });
        var zPlanes = [
            mesh.zPlaneVertices(0, {
                maxLevel: 2,
                includeExternal: false,
                sort: "x,y"
            }), // lowest z-plane
            mesh.zPlaneVertices(0, {
                maxLevel: 3,
                includeExternal: false,
                sort: "x,y"
            }),
            mesh.zPlaneVertices(0, {
                maxLevel: 4,
                includeExternal: false,
                sort: "x,y"
            }),
        ];
        var printPlot = false; // change this to true to print plot data
        printPlot && logger.info("z\tlevel\tx\ty@lvl2\ty@lvl3\ty@lvl4");
        for (var i = 0; i < zPlanes[0].length; i++) {
            var xyz = zPlanes[0][i];
            printPlot && logger.info(xyz.z, "\t", xyz.l, "\t", xyz.x, "\t", xyz.y);
        }
        for (var i = 0; i < zPlanes[1].length; i++) {
            var xyz = zPlanes[1][i];
            printPlot && logger.info(xyz.z, "\t", xyz.l, "\t", xyz.x, "\t\t", xyz.y);
        }
        for (var i = 0; i < zPlanes[2].length; i++) {
            var xyz = zPlanes[2][i];
            printPlot && logger.info(xyz.z, "\t", xyz.l, "\t", xyz.x, "\t\t\t", xyz.y);
        }
        zPlanes[0].length.should.equal(6);
        zPlanes[1].length.should.equal(21);
        zPlanes[2].length.should.equal(84);

        // zPlaneVertices are all in the same plane regardless of level
        zPlanes[0][0].z.should.equal(-50);
        zPlanes[1][0].z.should.equal(-50);
        zPlanes[2][0].z.should.equal(-50);
    })
    it("digitizeZPlane(zPlane, options) snap zPlane vertices to actual machine positions", function() {
        var zPlanes = 5;
        var mesha = new DeltaMesh({
            verbose: options.verbose,
            rIn: options.rIn,
            zMin: options.zMin,
            zPlanes: zPlanes,
        });
        var mto = new MTO_FPD();
        var meshd = new DeltaMesh({
            mto: mto,
            verbose: options.verbose,
            rIn: options.rIn,
            zMin: options.zMin,
            zPlanes: zPlanes,
        });
        // bottom most vertices should be below non-digitized vertices
        var va0 = mesha.zPlaneVertices(0, {
            includeExternal: true
        });
        var vd0 = meshd.zPlaneVertices(0, {
            includeExternal: true
        });
        va0.length.should.equal(vd0.length);
        var nBelow = 0;
        var nEqual = 0;
        for (var i = 0; i < va0.length; i++) {
            if (!vd0[i].external) {
                if (vd0[i].z === va0[i].z) {
                    logger.info("z=== va0:", va0[i].toString(), " vd0:", vd0[i].toString());
                    should(vd0[i].x !== va0[i].x || vd0[i].y !== va0[i].y).be.True;
                    nEqual++;
                } else {
                    logger.debug("va0:", va0[i].toString(), " vd0:", vd0[i].toString());
                    vd0[i].z.should.below(va0[i].z);
                    nBelow++;
                }
            }
        }
        should(nBelow).not.below(18);
        should(nEqual).equal(0);

        // internal nodes should snap to machine positions
        var va1 = mesha.zPlaneVertices(1, {
            includeExternal: true
        });
        var vd1 = meshd.zPlaneVertices(1, {
            includeExternal: true
        });
        va1.length.should.equal(vd1.length);
        for (var i = 0; i < va1.length; i++) {
            if (!vd1[i].external) {
                if (vd1[i].z === va1[i].z) {
                    logger.info("vertex did not snap to machine positionz va1:", va1[i].toString(), " vd1:", vd1[i].toString());
                    should(vd1[i].x !== va1[i].x || vd1[i].y !== va1[i].y).be.True;
                }
            }
        }

        // z-vertex map should not change
        var azvm = mesha.zVertexMap();
        var dzvm = meshd.zVertexMap();
        should.deepEqual(Object.keys(azvm), Object.keys(dzvm));

        // zPlaneVertices should be same
        var zpva0 = mesha.zPlaneVertices(0, {
            includeExternal: false
        });
        var zpvd0 = meshd.zPlaneVertices(0, {
            includeExternal: false
        });
        zpva0.length.should.equal(21);
        zpvd0.length.should.equal(18); // digitization excludes 3 unreachable points
        var zpva1 = mesha.zPlaneVertices(1, {
            includeExternal: false
        });
        var zpvd1 = meshd.zPlaneVertices(1, {
            includeExternal: false
        });
        zpva1.length.should.equal(21);
        zpvd1.length.should.equal(21);
    })
    it("subTetras(parent) returns children of parent", function() {
        var mesh = new DeltaMesh();
        var sub0 = mesh.subTetras();
        sub0.length.should.equal(318);
        var sub01 = mesh.subTetras(mesh.tetraAtCoord("01"));
        sub01.length.should.equal(50);
        var sub02 = mesh.subTetras(mesh.tetraAtCoord("02"));
        sub02.length.should.equal(50);
        var sub010 = mesh.subTetras(mesh.tetraAtCoord("010"));
        sub010.length.should.equal(0);
        var sub04 = mesh.subTetras(mesh.tetraAtCoord("04"));
        sub04.length.should.equal(16);
        for (var i = 0; i < sub04.length; i++) {
            sub04[i].coord.substr(0, 2).should.equal("04");
        }
    })
    it("export(options) returns a string that can be used to restore a DeltaMesh", function() {
        var mesh = new DeltaMesh();
        var s1 = mesh.export();
        should.deepEqual(s1, {
            type: "DeltaMesh",
            rIn: mesh.rIn,
            height: mesh.height,
            zPlanes: mesh.zPlanes,
            zMin: mesh.zMin,
            zMax: mesh.zMax,
            data: []
        });
        var bottomTetra = mesh.tetraAtXYZ({
            x: 0,
            y: 0,
            z: mesh.zMin
        });
        bottomTetra.t[0].temp = 50;
        bottomTetra.t[1].humidity = 60;
        bottomTetra.t[2].temp = 70;
        bottomTetra.t[2].humidity = 80;
        var s2 = mesh.export();
        should.deepEqual(s2, {
            type: "DeltaMesh",
            rIn: 195,
            height: 551.5432893255071,
            zPlanes: 5,
            zMin: -50,
            zMax: 501.5432893255071,
            data: [{
                x: 42.2187,
                y: 24.375,
                z: -50,
                humidity: 80,
                temp: 70
            }, {
                x: -42.2187,
                y: 24.375,
                z: -50,
                humidity: 60
            }, {
                x: 0,
                y: -48.75,
                z: -50,
                temp: 50
            }]
        });
    })
    it("import(self) restores saved DeltaMesh", function() {
        var mesh = new DeltaMesh({
            rIn: 100,
            zMin: -10,
            zMax: 2,
            zPlanes: 3,
        });
        mesh.rIn.should.equal(100);
        var s2 = {
            type: "DeltaMesh",
            rIn: 195,
            height: 551.5432893255071,
            zPlanes: 5,
            zMin: -50,
            zMax: 501.5432893255071,
            data: [{
                x: 42.2187,
                y: 24.375,
                z: -50,
                humidity: 80,
                temp: 70
            }, {
                x: -42.2187,
                y: 24.375,
                z: -50,
                humidity: 60
            }, {
                x: 0,
                y: -48.75,
                z: -50,
                temp: 50
            }]
        };
        mesh.import(s2);
        mesh.rIn.should.equal(195);
        var s3 = mesh.export();
        should.deepEqual(s3, s2);
        mesh.import(JSON.stringify(s2));
        mesh.rIn.should.equal(195);
        var s3 = mesh.export();
        //console.log("mesh.export() => ", s3);
        should.deepEqual(s3, s2);

        var mesh2 = new DeltaMesh(s2);
        should.deepEqual(mesh2.export(), s2);
    })
    it("vertexAtXYZ(xyz) returns nearest vertex", function() {
        var mesh = new DeltaMesh(options);
        var t = mesh.root.t;
        // below
        var opts = {
            includeExternal: true,
        }
        should(mesh.vertexAtXYZ(new XYZ(t[0].x, t[0].y, t[0].z), opts)).equal(t[0]);
        should(mesh.vertexAtXYZ(new XYZ(t[0].x, t[0].y, t[0].z - 10), opts)).equal(t[0]);
        should(mesh.vertexAtXYZ(new XYZ(t[0].x, t[0].y, t[0].z - 100), opts)).equal(t[0]);
        //above
        should(mesh.vertexAtXYZ(new XYZ(t[3].x, t[3].y, t[3].z))).equal(t[3]);
        should(mesh.vertexAtXYZ(new XYZ(t[3].x, t[3].y, t[3].z + 10))).equal(t[3]);
        should(mesh.vertexAtXYZ(new XYZ(t[3].x, t[3].y, t[3].z + 100))).equal(t[3]);
        // below center
        var tetra00 = mesh.tetraAtXYZ(new XYZ(1, 0, mesh.zMin));
        //console.log(JsonUtil.summarize(tetra00.t));
        var tb = tetra00.t;
        var e = 0.00000001;
        var v = tb[2];
        should(mesh.vertexAtXYZ(new XYZ(1 + e, -e, v.z))).equal(v);
        should(mesh.vertexAtXYZ(new XYZ(v.x, v.y, v.z))).equal(v);
        should(mesh.vertexAtXYZ(new XYZ(v.x, v.y, v.z - 10))).equal(v);
        should(mesh.vertexAtXYZ(new XYZ(v.x, v.y, v.z - 100))).equal(v);
        // center
        var vc = mesh.vertexAtXYZ(new XYZ(0, 20, 0));
        should.exist(vc);
        e = 0.01;
        vc.x.should.within(0 - e, 0 + e);
        vc.y.should.within(48.75 - e, 48.75 + e);
        vc.z.should.within(18.94 - e, 18.94 + e);
    });
    it("zPlaneHeight(zPlane) returns nominal height of zplane", function() {
        var mesh = new DeltaMesh(options);
        var e = 0.01;
        mesh.zPlaneHeight(-1).should.equal(0);
        mesh.zPlaneHeight(0).should.within(68.94 - e, 68.94 + e);
        mesh.zPlaneHeight(1).should.within(68.94 - e, 68.94 + e);
        mesh.zPlaneHeight(2).should.within(137.89 - e, 137.89 + e);
        mesh.zPlaneHeight(3).should.within(275.77 - e, 275.77 + e);
        mesh.zPlaneHeight(4).should.equal(0);
        var opts = JSON.parse(JSON.stringify(options));
        opts.height = 100;
        var shortmesh = new DeltaMesh(opts);
        var e = 0.01;
        shortmesh.zPlaneHeight(-1).should.equal(0);
        shortmesh.zPlaneHeight(0).should.within(12.5 - e, 12.5 + e);
        shortmesh.zPlaneHeight(1).should.within(12.5 - e, 12.5 + e);
        shortmesh.zPlaneHeight(2).should.within(25 - e, 25 + e);
        shortmesh.zPlaneHeight(3).should.within(50 - e, 50 + e);
        shortmesh.zPlaneHeight(4).should.equal(0);
    });
    it("isVertexROI(v, roi) returns true if vertex is in region of interest", function() {
        var roi = {
            type: "rect",
            cx: 10,
            cy: -10,
            width: 2, // even
            height: 1, // odd
        };
        DeltaMesh.isVertexROI(null, null).should.False;
        DeltaMesh.isVertexROI(null, roi).should.False;
        DeltaMesh.isVertexROI({
            x: -100,
            y: -100
        }, null).should.True;
        DeltaMesh.isVertexROI({
            x: 8,
            y: -10
        }, roi).should.False;
        DeltaMesh.isVertexROI({
            x: 9,
            y: -10,
        }, roi).should.True;
        DeltaMesh.isVertexROI({
            x: 10,
            y: -10,
        }, roi).should.True;
        DeltaMesh.isVertexROI({
            x: 11,
            y: -10,
        }, roi).should.True;
        DeltaMesh.isVertexROI({
            x: 12,
            y: -10,
        }, roi).should.false;
        DeltaMesh.isVertexROI({
            x: 10,
            y: -9,
        }, roi).should.false;
        DeltaMesh.isVertexROI({
            x: 10,
            y: -11,
        }, roi).should.false;
    });
    it("zPlaneVertices(zPlane, options) and vertexAtXYZ should agree", function() {
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 195,
            zMax: 60,
            zMin: -49,
            zPlanes: 7,
        });
        var zPlanes = [
            mesh.zPlaneVertices(0, {
                includeExternal: false,
            }), // lowest z-plane
            mesh.zPlaneVertices(1, {
                includeExternal: false,
            }),
        ];
        var v = zPlanes[0][114];
        mesh.zPlaneIndex(v.z).should.equal(0);
        var xyz = {
            x: v.x,
            y: v.y,
            z: v.z,
        };
        should.deepEqual(mesh.vertexAtXYZ(xyz), v);
        var msStart = new Date();
        for (var i = 0; i < zPlanes.length; i++) {
            var zplane = zPlanes[i];
            for (var j = 0; j < zplane.length; j++) {
                var v = zplane[j];
                v.i = i;
                v.j = j;
                var xyz = {
                    x: v.x,
                    y: v.y,
                    z: v.z,
                };
                should.deepEqual(mesh.vertexAtXYZ(xyz), v);
            }
        }
        var msElapsed = new Date() - msStart;
        //console.log("msElapsed:", msElapsed);
    })
    it("xyNeighbor(vertex, direction) returns nearest neighbor in given direction or null", function() {
        var mesh = new DeltaMesh();
        var opts = {
            includeExternal: true,
        }
        for (var dir = 0; dir < 6; dir++) {
            var vn = mesh.xyNeighbor(mesh.root.t[3], dir, opts);
            should(vn).Null; // top node has no neighbors
        }
        var e = 0.1;
        var pt = mesh.root.t[0];
        //console.log("t[0]:", pt.x, pt.y, pt.z);
        for (var dir = 0; dir < 6; dir++) {
            var vn = mesh.xyNeighbor(pt, dir, opts);
            //vn && console.log("dir:", dir, "vn:", vn.x, vn.y, vn.z);
            if (dir === 4) {
                Math.round(vn.x).should.equal(-84);
                Math.round(vn.y).should.equal(244);
                mesh.xyNeighbor(vn, dir + 3, opts).should.equal(pt);
            } else if (dir === 5) {
                Math.round(vn.x).should.equal(84);
                Math.round(vn.y).should.equal(244);
                mesh.xyNeighbor(vn, dir + 3, opts).should.equal(pt);
            } else {
                should(vn).Null;
            }
        }
        pt = mesh.root.t[1];
        //console.log("t[1]:", pt.x, pt.y, pt.z);
        for (var dir = 0; dir < 6; dir++) {
            var vn = mesh.xyNeighbor(pt, dir, opts);
            //vn && console.log("dir:", dir, "vn:", vn.x, vn.y, vn.z);
            if (dir === 2) {
                Math.round(vn.x).should.equal(253);
                Math.round(vn.y).should.equal(-49);
                mesh.xyNeighbor(vn, dir + 3, opts).should.equal(pt);
            } else if (dir === 3) {
                Math.round(vn.x).should.equal(169);
                Math.round(vn.y).should.equal(-195);
                mesh.xyNeighbor(vn, dir + 3, opts).should.equal(pt);
            } else {
                should(vn).Null;
            }
        }
        pt = mesh.root.t[2];
        //console.log("t[2]:", pt.x, pt.y, pt.z);
        for (var dir = 0; dir < 6; dir++) {
            var vn = mesh.xyNeighbor(pt, dir, opts);
            //vn && console.log("dir:", dir, "vn:", vn.x, vn.y, vn.z);
            if (dir === 0) {
                Math.round(vn.x).should.equal(-169);
                Math.round(vn.y).should.equal(-195);
                mesh.xyNeighbor(vn, dir + 3, opts).should.equal(pt);
            } else if (dir === 1) {
                Math.round(vn.x).should.equal(-253);
                Math.round(vn.y).should.equal(-49);
                mesh.xyNeighbor(vn, dir + 3, opts).should.equal(pt);
            } else {
                should(vn).Null;
            }
        }
        //var vertices = mesh.zPlaneVertices(0,opts).sort(function(a,b) { return a.y - b.y; });
        //for (var i=0; i< vertices.length; i++){
        //var v = vertices[i];
        //Math.round(v.y) == -195 && console.log("i:",i, "vx:", v.x, "vy:", v.y);
        //}
    })
    it("mendZPlane(zp, propName, options) interpolates missing property values in given z-plane", function() {
        var mesh = new DeltaMesh();
        var propName = "temp";
        var zp0 = mesh.zPlaneVertices(0);
        for (var i = 0; i < zp0.length; i++) {
            var v = zp0[i];
            v[propName] = 100;
        }
        var zp1 = mesh.zPlaneVertices(1);
        for (var i = 0; i < zp1.length; i++) {
            var v = zp1[i];
            v[propName] = 50;
        }
        var xyz1 = new XYZ(0, 0, zp1[0].z);
        var v1 = mesh.vertexAtXYZ(xyz1);
        var vn = [];
        for (var dir = 0; dir < 6; dir++) {
            vn.push(mesh.xyNeighbor(v1, dir));
            should.exist(vn[dir]);
        }
        var val1 = mesh.interpolate(xyz1, propName);
        var e = 0.001;
        val1.should.within(50 - e, 50 + e);

        // A single hole should be repaired
        delete v1[propName];
        val1 = mesh.interpolate(xyz1, propName);
        should(val1).Null; // holes are bad
        //val1.should.;
        //val1.should.within(33.333-e,33.333+e); // holes are bad
        delete v1[propName];
        var patched = mesh.mendZPlane(1, propName);
        val1 = mesh.interpolate(xyz1, propName);
        val1.should.within(50 - e, 50 + e); // mended
        patched.length.should.equal(1);
        patched[0].should.equal(v1);

        // A big hole should be repaired
        delete v1[propName];
        for (var dir = 0; dir < 6; dir++) {
            delete vn[dir][propName];
        }
        var patched = mesh.mendZPlane(1, propName);
        patched.length.should.equal(7);
        val1 = mesh.interpolate(xyz1, propName);
        val1.should.within(50 - e, 50 + e); // mended
    })
    it("tetrasContainingXYZ(xyz) returns mesh tetrahedra enclosing given point", function() {
        var mesh = new DeltaMesh();

        // root vertices
        var rt = new Tetrahedron(mesh.root.t);
        rt.contains(rt.t[0]).should.True;
        mesh.root.contains(mesh.root.t[0]).should.True;
        var tetras = mesh.tetrasContainingXYZ(mesh.root.t[0]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("01");
        var tetras = mesh.tetrasContainingXYZ(mesh.root.t[1]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("02");
        var tetras = mesh.tetrasContainingXYZ(mesh.root.t[2]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("03");
        var tetras = mesh.tetrasContainingXYZ(mesh.root.t[3]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("00");

        // internal vertex
        var tetra = mesh.tetraAtCoord("0123");
        should.exist(tetra);
        var tetras = mesh.tetrasContainingXYZ(tetra.t[0]);
        tetras.length.should.equal(7);
        var i = 0;
        tetras[i++].coord.should.equal("0");
        tetras[i++].coord.should.equal("01");
        tetras[i++].coord.should.equal("016");
        tetras[i++].coord.should.equal("015");
        tetras[i++].coord.should.equal("0153");
        tetras[i++].coord.should.equal("012");
        tetras[i++].coord.should.equal("0123");
        var tetras = mesh.tetrasContainingXYZ(tetra.t[1]);
        tetras.length.should.equal(9);
        i = 0;
        tetras[i++].coord.should.equal("0");
        tetras[i++].coord.should.equal("01");
        tetras[i++].coord.should.equal("012");
        tetras[i++].coord.should.equal("0127");
        tetras[i++].coord.should.equal("0126");
        tetras[i++].coord.should.equal("0125");
        tetras[i++].coord.should.equal("0124");
        tetras[i++].coord.should.equal("0123");
        tetras[i++].coord.should.equal("0121");
    })
    it("tetrasAtVertex(v) returns mesh tetrahedra having given vertex", function() {
        var mesh = new DeltaMesh();

        // root vertices
        var tetras = mesh.tetrasAtVertex(mesh.root.t[0]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("01");
        var tetras = mesh.tetrasAtVertex(mesh.root.t[1]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("02");
        var tetras = mesh.tetrasAtVertex(mesh.root.t[2]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("03");
        var tetras = mesh.tetrasAtVertex(mesh.root.t[3]);
        tetras.length.should.equal(2);
        tetras[0].coord.should.equal("0");
        tetras[1].coord.should.equal("00");

        // internal vertex
        var tetra = mesh.tetraAtCoord("0123");
        should.exist(tetra);
        var tetras = mesh.tetrasAtVertex(tetra.t[0]);
        tetras.length.should.equal(5);
        tetras[0].coord.should.equal("016");
        tetras[1].coord.should.equal("015");
        tetras[2].coord.should.equal("0153");
        tetras[3].coord.should.equal("012");
        tetras[4].coord.should.equal("0123");
        var tetras = mesh.tetrasAtVertex(tetra.t[1]);
        tetras.length.should.equal(6);
        tetras[0].coord.should.equal("0127");
        tetras[1].coord.should.equal("0126");
        tetras[2].coord.should.equal("0125");
        tetras[3].coord.should.equal("0124");
        tetras[4].coord.should.equal("0123");
        tetras[5].coord.should.equal("0121");
    })
    it("interpolatorAtXYZ(xyz, propName) returns tetrahedron interpolator for given point and property", function() {
        var mesh = new DeltaMesh({
            rIn: 195,
            zMax: 60,
            zMin: -49,
            zPlanes: 7,
        });
        var options = {
            roi: {
                type: "rect",
                cx: 0,
                cy: 0,
                width: 180,
                height: 200,
            }
        };
        var propName = "_PROP_";
        var zp0 = mesh.zPlaneVertices(0);
        var val0 = 100;
        for (var i = 0; i < zp0.length; i++) {
            var v = zp0[i];
            v[propName] = val0;
        }
        var zp1 = mesh.zPlaneVertices(1);
        var val1 = 80;
        for (var i = 0; i < zp1.length; i++) {
            var v = zp1[i];
            v[propName] = val1;
        }
        var z0 = mesh.zMin;
        var z1 = mesh.zMin + mesh.zPlaneHeight(0);
        var e = 0.001;
        var errors = 0;
        var zp0roi = mesh.zPlaneVertices(0, options);

        for (var i = 0; i < zp0roi.length; i++) {
            var v = zp0roi[i];
            var xyz = new XYZ(v.x, v.y, z1);
            var tetra = mesh.tetraAtXYZ(xyz);
            var interpolator = mesh.interpolatorAtXYZ(xyz, propName);
            if (tetra !== interpolator) {
                // overlapping tetras
                //console.log("tetra:",JsonUtil.summarize(tetra.t), "leaf:", !tetra.t.partitions, "bary:", tetra.toBarycentric(xyz));
                //console.log("inter:",JsonUtil.summarize(interpolator.t), "leaf:", !interpolator.t.partitions, "bary:", interpolator.toBarycentric(xyz));
                tetra.contains(xyz).should.True;
                interpolator.contains(xyz).should.True;
            }
            var propVal = interpolator.interpolate(xyz, propName);
            propVal.should.within(val1 - e, val1 + e);
        }
    });
    it("interpolate(xyz, propName) interpolates mended grid", function() {
        var mesh = new DeltaMesh({
            rIn: 195,
            zMax: 60,
            zMin: -49,
            zPlanes: 7,
        });
        var options = {
            roi: {
                type: "rect",
                cx: 0,
                cy: 0,
                width: 180,
                height: 200,
            }
        };
        var propName = "_PROP_";
        var zp0 = mesh.zPlaneVertices(0);
        var val0 = 100;
        for (var i = 0; i < zp0.length; i++) {
            var v = zp0[i];
            v[propName] = val0;
        }
        var zp1 = mesh.zPlaneVertices(1);
        var val1 = 80;
        for (var i = 0; i < zp1.length; i++) {
            var v = zp1[i];
            v[propName] = val1;
        }
        var z0 = mesh.zMin;
        var z1 = mesh.zMin + mesh.zPlaneHeight(0);
        var e = 0.001;
        var errors = 0;
        var zp0roi = mesh.zPlaneVertices(0, options);

        for (var i = 0; i < zp0roi.length; i++) {
            var v = zp0roi[i];
            var xyz = new XYZ(v.x, v.y, z1);
            var propVal = mesh.interpolate(xyz, propName);
            propVal.should.within(val1 - e, val1 + e);
        }
    });
    it("tetrasInROI(roi) return array of leaf tetrahedrons having at least one vertex in ROI", function() {
        var mesh = new DeltaMesh({
            rIn: 195,
            zMax: 60,
            zMin: -49,
            zPlanes: 7,
        });
        var propName = "_PROP_";
        var zp0 = mesh.zPlaneVertices(0);
        var val0 = 100;
        for (var i = 0; i < zp0.length; i++) {
            var v = zp0[i];
            v[propName] = val0;
        }
        var zp1 = mesh.zPlaneVertices(1);
        var val1 = 80;
        for (var i = 0; i < zp1.length; i++) {
            var v = zp1[i];
            v[propName] = val1;
        }

        var roi = {
            type: "rect",
            cx: 0,
            cy: 0,
            zMax: (mesh.zPlaneZ(1) + mesh.zPlaneZ(2)) / 2,
            width: 180,
            height: 200,
        };
        var troi = mesh.tetrasInROI(roi);
        troi.length.should.equal(700);
    });
    it("getZPlane(zPlaneIndex) returns ZPlane at given index", function() {
        var mesh = new DeltaMesh({
            rIn: 195,
            zMax: 60,
            zMin: -49,
            zPlanes: 7,
        });

        var e = 0.01;
        var testRowColumnMap = function(zp) {
            // row/column grid should be 1-to-1 with vertices
            var xyUnique = {};
            for (var r = -5; r < 5; r++) {
                for (var c = -5; c < 5; c++) {
                    var hash = "r" + r + "c" + c;
                    var v = zp.vertexAtRC(r, c);
                    should.exist(v);
                    var xykey = v.x + "_" + v.y;
                    should(xyUnique[xykey] == null).True;
                    xyUnique[xykey] = v;
                    zp.vertexAtXY(v).should.equal(v);
                }
            }
        }

        var zp0 = mesh.getZPlane(0);
        zp0.rowH.should.within(18.28 - e, 18.28 + e);
        zp0.colW.should.within(21.11 - e, 21.11 + e);
        zp0.yOffset.should.within(-12.19 - e, -12.19 + e);
        testRowColumnMap(zp0);

        var zp1 = mesh.getZPlane(1);
        zp1.rowH.should.within(18.28 - e, 18.28 + e);
        zp1.colW.should.within(21.11 - e, 21.11 + e);
        zp1.yOffset.should.within(12.19 - e, 12.19 + e);
        testRowColumnMap(zp1);
    });
    it("classifyBottomTetras() classifies bottom layer tetrahedra", function() {
        var msStart = new Date();
        var mesh = new DeltaMesh({
            rIn: 195,
            zMax: 60,
            zMin: -49,
            zPlanes: 7,
        });
        //console.log("DeltaMesh ctor msElapsed:", new Date() - msStart);
        var msStart = new Date();
        var stats = {};
        mesh.classifyBottomTetras(function(tetra, category, nExternal) {
            var key = category + "x" + nExternal;
            stats[key] = stats[key] || 0;
            stats[key]++;
        });
        //console.log("DeltaMesh classifyBottomTetras msElapsed:", new Date() - msStart, stats);
        should.deepEqual(stats, {
            "0111x0": 580,
            "0111x1": 39,
            "0111x2": 24,
            "0111x3": 42,
            "0011x0": 593,
            "0011x1": 30,
            "0011x2": 30,
            "0011x3": 30,
            "1000x0": 589,
            "1000x1": 42,
            "1000x2": 30,
            "1000x3": 30,
        });
    });
})

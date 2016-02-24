var should = require("should");
var Logger = require("./Logger");
var Mat3x3 = require("./Mat3x3");
var XYZ = require("./XYZ");
var Barycentric3 = require("./Barycentric3");
var Tetrahedron = require("./Tetrahedron");
var MTO_FPD = require("./MTO_FPD");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });
    var deg60 = Math.PI / 3;
    var SIN60 = Math.sin(deg60);
    var COS60 = Math.cos(deg60);
    var CHARCODE0 = "0".charCodeAt(0);

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
        if (options.maxSkewness) {
            that.maxSkewness = options.maxSkewness;
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
        that.zPlanes = options.zPlanes || 5;
        should && that.zPlanes.should.above(2);
        that.refineZPlanes(that.zPlanes);
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
        that.vertexProps = JSON.parse(JSON.stringify(that.root.t[0]));
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
            includeExtenal: true
        };
        var vp = that.vertexProps;
        var nProps = Object.keys(vp).length;
        for (var zp = 0; zp < that.zPlanes; zp++) {
            var pv = that.zPlaneVertices(zp, vpo);
            for (var i = 0; i < pv.length; i++) {
                var v = pv[i];
                var props = Object.keys(v);
                if (props.length > nProps) {
                    var vsave = {
                        x: Math.round(scale * v.x) / scale,
                        y: Math.round(scale * v.y) / scale,
                        z: Math.round(scale * v.z) / scale,
                    };
                    for (var j = 0; j < props.length; j++) {
                        var prop = props[j];
                        if (!vp.hasOwnProperty(prop)) {
                            vsave[prop] = v[prop];
                        }
                    }
                    self.data.push(vsave);
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
    DeltaMesh.prototype.vertexAtXYZ = function(xyz, options) {
        var that = this;
        options = options || {};
        var sd = options.snapDistance || that.height / Math.pow(2, that.zPlanes);
        xyz = XYZ.of(xyz);
        if (xyz.z < that.zMin) {
            xyz = new XYZ(xyz.x, xyz.y, that.zMin);
        } else if (that.zMax < xyz.z) {
            xyz = new XYZ(xyz.x, xyz.y, that.zMax);
        }
        var tetra = that.tetraAtXYZ(xyz);
        if (tetra.coord.length < that.zPlanes - 2) {}
        var t = tetra.t;
        for (var i = 0; i < 4; i++) {
            var v = t[i];
            if (v.x - sd <= xyz.x && xyz.x <= v.x + sd &&
                v.y - sd <= xyz.y && xyz.y <= v.y + sd &&
                v.z - sd <= xyz.z && xyz.z <= v.z + sd) {
                return v;
            }
        }
        return xyz.nearest(
            xyz.nearest(t[0], t[1]),
            xyz.nearest(t[2], t[3])
        );
    }
    DeltaMesh.prototype.extrapolate_planar = function(propName, options) {
        var that = this;
        options = options || {};
        var vn = []; // vertices with no property (aggregate)
        for (var zp = 0; zp < that.zPlanes; zp++) {
            var pv = that.zPlaneVertices(zp, {
                includeExternal: true
            });
            var vnp = []; // vertices with no property in plane
            var propertyPlane = false;
            for (var i = 0; i < pv.length; i++) {
                var v = pv[i];
                if (v.hasOwnProperty(propName)) {
                    propertyPlane = true;
                } else {
                    vnp.push(v);
                }
            }
            if (propertyPlane) {
                vn = vn.concat(vnp);
            }
        }
        var tetras = that.subTetras(that.root, [that.root]);
        tetras.sort(extrapolation_comparator(propName));
        var passes = 0;
        var maxPasses = options.maxPasses || 1;
        var expAvg = options.expAvg || 0.5;
        var nExtrapolated = 0;
        for (var i = 0; passes < maxPasses && i < tetras.length; i++) {
            var tetra = tetras[i];
            if (tetra.propCount(propName) < 3) {
                continue;
            }
            passes++;
            for (var j = 0; j < vn.length; j++) {
                var v = vn[j];
                var value = tetra.interpolate(v, propName);
                nExtrapolated++;
                if (v.hasOwnProperty(propName)) {
                    v[propName] = expAvg * value + (1 - expAvg) * v[propName];
                } else {
                    v[propName] = value;
                }
            }
        }

        return nExtrapolated;
    }
    DeltaMesh.prototype.extrapolate = function(propName, options) {
        var that = this;
        var extrapolated = 0;
        extrapolated += that.extrapolate_planar(propName, options);
        extrapolated += that.extrapolate_locally(propName, options);
        return extrapolated;
    }
    DeltaMesh.prototype.extrapolate_locally = function(propName, options) {
        var that = this;
        options = options || {};
        var tetras = that.subTetras(that.root, [that.root]);
        var maxPasses = options.maxPasses || tetras.length;
        var nExtrapolated = 0;
        var nUpdated = 0;
        var nDone = 0;
        var passes = 0;
        while (nUpdated + nDone != tetras.length && passes++ < maxPasses) {
            tetras.sort(extrapolation_comparator(propName));
            nUpdated = 0;
            nDone = 0;
            for (var i = 0; i < tetras.length; i++) {
                var t = tetras[i].t;
                var vn = [];
                var sum = 0;
                for (var j = 0; j < 4; j++) {
                    if (t[j].hasOwnProperty(propName)) {
                        sum += t[j][propName];
                    } else {
                        vn.push(t[j]);
                    }
                }
                switch (vn.length) {
                    case 0:
                        nDone++;
                        break;
                    case 1:
                        nUpdated++;
                        vn[0][propName] = sum / 3;
                        break;
                }
            }
            nExtrapolated += nUpdated;
            if (nUpdated + nDone == tetras.length) {
                break;
            }
            if (nUpdated === 0) {
                throw new Error("DeltaMesh.extrapolate() insufficient data");
            }
        }

        return nExtrapolated;
    }
    DeltaMesh.prototype.digitizeZPlane = function(zPlane, options) {
        var that = this;
        options = options || {};
        zPlane = zPlane == null ? that.zPlanes - 1 : zPlane;
        should &&
            zPlane.should.within(0, that.zPlanes - 1) &&
            that.mto.should.exist;
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
                v.internal = false;
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
    DeltaMesh.prototype.refineZPlanes = function(zPlaneCount) {
        var that = this;
        var zMin = that.zMin;
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

    DeltaMesh.prototype.zPlaneHeight = function(zPlane) {
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
            return 0;
        }
        return zkeys[zPlane + 1] - zkeys[zPlane];
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
    DeltaMesh.prototype.zPlaneVertices = function(zPlane, options) {
        var that = this;
        options = options || {};
        var maxLevel = options.maxLevel;
        var includeExternal = options.includeExternal == null ? false : options.includeExternal;
        var zmap = that.zVertexMap();
        var zkeys = Object.keys(zmap).sort(function(a, b) {
            return Number(a) - Number(b);
        });
        zPlane = zPlane == null ? that.zPlanes - 1 : zPlane;
        should && zPlane.should.within(0, zkeys.length - 1);
        var vertices = zmap[zkeys[zPlane]];
        maxLevel = maxLevel == null ? that.zPlanes - 1 : Math.min(that.zPlanes - 1, maxLevel);
        should && maxLevel.should.not.below(0);
        var result = [];
        for (var i = vertices.length; i-- > 0;) {
            var v = vertices[i];
            if (v.level <= maxLevel) {
                if (includeExternal || v.internal) {
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
        var tetra = that.tetraAtXYZ(xyz);
        should && tetra.should.exist;
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
            should && v.x.should.exist && v.y.should.exist;
            var left = roi.cx - roi.width / 2;
            var top = roi.cy - roi.height / 2;
            if (v.x < left || left + roi.width < v.x || v.y < top || top + roi.height < v.y) {
                return false;
            }
        }
        return true;
    }

    //////////// PRIVATE
    function location(that, result, level) {
        var xyz = result.xyz;
        var tetra = result.tetra;
        should &&
            xyz.z.should.Number &&
            tetra.should.exist &&
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
            //that.xyzVertexMap[key].hasOwnProperty("internal").should.True;
        } else {
            that.xyzVertexMap[key] = xyz;
            xyz.level = level;
            xyz.internal = (xyz.x * xyz.x + xyz.y * xyz.y) <= that.maxXYNorm2;
            //xyz.hasOwnProperty("internal").should.True;
        }
        return that.xyzVertexMap[key];
    }

    function addSubTetra(that, index, tetra, t0, t1, t2, t3) {
        var include = tetra == that.root || t0.internal || t1.internal || t2.internal || t3.internal;
        var subtetra = null;
        if (include) {
            subtetra = new Tetrahedron(t0, t1, t2, t3, tetra);
            subtetra.coord = tetra.coord + index;
            if (that.maxSkewness != null && subtetra.skewness() > that.maxSkewness) {
                include = false;
            }
        }
        tetra.partitions.push(subtetra);
        if (include) {
            return subtetra;
        }
        return null;
    }

    function extrapolation_comparator(propName) {
        return function(a, b) {
            var cmp = b.propCount(propName) - a.propCount(propName);
            if (cmp === 0) {
                cmp = a.coord.length - b.coord.length;
            }
            if (cmp === 0) {
                cmp = (b.internal ? 1 : 0) - (a.internal ? 1 : 0);
            }
            return cmp;
        };
    }

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
    it("refineZPlanes(nLevels) refines the mesh to have at least given level count", function() {
        var mesh = new DeltaMesh({
            verbose: true,
            maxSkewness: 0.3
        });
        var lvl0 = mesh.refineZPlanes(2);
        lvl0.length.should.equal(1);
        lvl0[0].should.equal(mesh.root);
        var lvl3l = mesh.refineZPlanes(5);
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
            tetras[i].should.exist; // we found it
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
            printPlot && logger.info(xyz.z, "\t", xyz.level, "\t", xyz.x, "\t", xyz.y);
        }
        for (var i = 0; i < zPlanes[1].length; i++) {
            var xyz = zPlanes[1][i];
            printPlot && logger.info(xyz.z, "\t", xyz.level, "\t", xyz.x, "\t\t", xyz.y);
        }
        for (var i = 0; i < zPlanes[2].length; i++) {
            var xyz = zPlanes[2][i];
            printPlot && logger.info(xyz.z, "\t", xyz.level, "\t", xyz.x, "\t\t\t", xyz.y);
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
            if (vd0[i].internal) {
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
            if (vd1[i].internal) {
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
    it("extrapolate(propName) sets undefined vertex properties from existing values", function() {
        var mesh = new DeltaMesh();
        var zMin = mesh.zMin;
        var tetras = mesh.subTetras(mesh.root, [mesh.root]);
        tetras.length.should.equal(319);
        var bottomTetra = mesh.tetraAtXYZ({
            x: 0,
            y: 0,
            z: zMin
        });
        bottomTetra.coord.should.equal("0555");
        var dataTetra = mesh.tetraAtCoord("055");
        dataTetra.t[0].z.should.equal(zMin);
        dataTetra.t[1].z.should.equal(zMin);
        dataTetra.t[2].z.should.equal(zMin);
        dataTetra.t[3].z.should.above(zMin);
        dataTetra.t[0].temp = 50;
        dataTetra.t[1].temp = 60;
        dataTetra.t[2].temp = 70;
        var e = 0.01;
        dataTetra.interpolate(mesh.root.t[0], "temp").should.equal(20);
        dataTetra.interpolate(mesh.root.t[1], "temp").should.within(60 - e, 60 + e);
        dataTetra.interpolate(mesh.root.t[2], "temp").should.within(100 - e, 100 + e);
        var pt1 = mesh.root.t[1];
        mesh.interpolate(pt1, "temp").should.equal(0);
        mesh.extrapolate("temp").should.equal(101); // only data planes included

        // extrapolation should update data-planar internal vertices
        bottomTetra.t[0].temp.should.within(65 + -e, 65 + e);
        bottomTetra.t[1].temp.should.within(60 - e, 60 + e);
        bottomTetra.t[2].temp.should.within(55 - e, 55 + e);
        bottomTetra.t[3].temp.should.within(60 - e, 60 + e);

        // extrapolated vertices should match dataTetra interpolation
        dataTetra.interpolate(mesh.root.t[0], "temp").should.within(20 - e, 20 + e);
        dataTetra.interpolate(mesh.root.t[1], "temp").should.within(60 - e, 60 + e);
        dataTetra.interpolate(mesh.root.t[2], "temp").should.within(100 - e, 100 + e);
        mesh.interpolate(mesh.root.t[0], "temp").should.within(20 - e, 20 + e);
        mesh.interpolate(mesh.root.t[1], "temp").should.within(60 - e, 60 + e);
        mesh.interpolate(mesh.root.t[2], "temp").should.within(100 - e, 100 + e);

        // data extrapolation should be linear
        var pts = [];
        var N = 10;
        for (var i = 0; i <= N; i++) {
            var p = i / N;
            var pt = dataTetra.t[0].interpolate(pt1, p);
            pts.push(pt);
        }
        var temps = [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, ];
        for (var i = 0; i < pts.length; i++) {
            mesh.interpolate(pts[i], "temp").should.within(temps[i] - e, temps[i] + e);
        }

        // extrapolation to non-data planes should be by local average
        mesh.root.t[3].temp.should.within(60 - e, 60 + e);
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
        should(mesh.vertexAtXYZ(new XYZ(t[0].x, t[0].y, t[0].z))).equal(t[0]);
        should(mesh.vertexAtXYZ(new XYZ(t[0].x, t[0].y, t[0].z - 10))).equal(t[0]);
        should(mesh.vertexAtXYZ(new XYZ(t[0].x, t[0].y, t[0].z - 100))).equal(t[0]);
        //above
        should(mesh.vertexAtXYZ(new XYZ(t[3].x, t[3].y, t[3].z))).equal(t[3]);
        should(mesh.vertexAtXYZ(new XYZ(t[3].x, t[3].y, t[3].z + 10))).equal(t[3]);
        should(mesh.vertexAtXYZ(new XYZ(t[3].x, t[3].y, t[3].z + 100))).equal(t[3]);
        // below center
        var tetra00 = mesh.tetraAtXYZ(new XYZ(0, 0, mesh.zMin));
        var tb = tetra00.t;
        var e = 0.00000001;
        should(mesh.vertexAtXYZ(new XYZ(e, -e, tb[0].z))).equal(tb[0]);
        should(mesh.vertexAtXYZ(new XYZ(tb[0].x, tb[0].y, tb[0].z))).equal(tb[0]);
        should(mesh.vertexAtXYZ(new XYZ(tb[0].x, tb[0].y, tb[0].z - 10))).equal(tb[0]);
        should(mesh.vertexAtXYZ(new XYZ(tb[0].x, tb[0].y, tb[0].z - 100))).equal(tb[0]);
        // center
        var vc = mesh.vertexAtXYZ(new XYZ(0, 0, 0));
        vc.should.exist;
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
})

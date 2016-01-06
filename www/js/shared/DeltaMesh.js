var should = require("should");
var Logger = require("./Logger");
var Mat3x3 = require("./Mat3x3");
var XYZ = require("./XYZ");
var Barycentric3 = require("./Barycentric3");
var Tetrahedron = require("./Tetrahedron");
//var DeltaCalculator = require("./DeltaCalculator");

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

        if (options.rIn != null) {
            that.rIn = options.rIn;
            that.height = options.height == null ? Tetrahedron.baseInRadiusToHeight(that.rIn) : options.height;
        } else {
            that.height = options.height == null ? 100 : options.height;
            that.rIn = options.rIn == null ? Tetrahedron.heightToBaseInRadius(that.height) : options.rIn;
        }
        that.zMin = options.zMin == null ? -50 : options.zMin;
        that.zMax = options.zMax == null ? that.zMin + that.height : options.zMax;
        that.rOut = 2 * that.rIn;
        that.maxXYNorm2 = that.rIn * that.rIn * 1.00000001;
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
            addVertex(that, new XYZ(0, that.rOut, that.zMin, options)),
            addVertex(that, new XYZ(xBase, yBase, that.zMin, options)),
            addVertex(that, new XYZ(-xBase, yBase, that.zMin, options)),
            addVertex(that, new XYZ(0, 0, that.zMax, options)),
            options
        );
        that.root.coord = "0";
        that.levelTetras = [[that.root]];
        that.nPlanes = options.nPlanes || 5;
        that.nPlanes.should.above(2);
        that.refineZ(that.nPlanes);

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
    DeltaMesh.prototype.refineZ = function(zPlaneCount) {
        var that = this;
        var zMin = that.zMin;
        zPlaneCount.should.Number;
        level = zPlaneCount-2;
        for (var l = 0; l < level; l++) {
            var lpartitions = that.levelTetras[l];
            var l1map;
            if (l + 1 < that.levelTetras.length) {
                l1map = that.levelTetras[l + 1];
            } else {
                l1map = [];
                that.levelTetras.push(l1map);
            }
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
        var pt03 = addVertex(that, t[3].interpolate(t[0], 0.5)); // [0] tip midpoint #7
        var pt13 = addVertex(that, t[3].interpolate(t[1], 0.5)); // [1] tip midpoint #9
        var pt23 = addVertex(that, t[3].interpolate(t[2], 0.5)); // [2] tip midpoint #10
        var pt01 = addVertex(that, t[0].interpolate(t[1], 0.5)); // [3] base midpoint #5
        var pt12 = addVertex(that, t[1].interpolate(t[2], 0.5)); // [4] base midpoint #8
        var pt02 = addVertex(that, t[2].interpolate(t[0], 0.5)); // [5] base midpoint #6

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
    DeltaMesh.prototype.describeZPlanes = function() {
        var that = this;
        var zmap = that.zVertexMap();
        var result = [];
        var zKeys = Object.keys(zmap);
        for (var i = 0; i < zKeys.length; i++) {
            result.push({
                z: Number(zKeys[i]),
                v: zmap[zKeys[i]].length,
            });
        }
        return result.sort(function(a, b) {
            return a.z - b.z;
        });
    }
    DeltaMesh.prototype.zPlaneVertices = function(zPlane) {
        var that = this;
        var zmap = that.zVertexMap();
        var zkeys = Object.keys(zmap).sort(function(a,b){
            return Number(a) - Number(b);
        });
        zPlane.should.within(0, zkeys.length-1);
        return zmap[zkeys[zPlane]];
    }
    DeltaMesh.prototype.tetraZVertices = function(z, level) {
        var that = this;
        var tetras = that.refineZ(level+2);
        var vertexMap = {};
        var zvertices = [];
        for (var i = 0; i < tetras.length; i++) {
            var t = tetras[i].t;
            for (var j = 0; j < 4; j++) {
                var tj = t[j];
                var key = tj.x + "," + tj.y + "," + tj.z;
                if (!vertexMap.hasOwnProperty(key)) {
                    vertexMap[key] = tj;
                    zvertices.push(tj);
                }
            }
        }
        return zvertices;
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
    DeltaMesh.prototype.tetraAtXYZ = function(xyz, level) {
        var that = this;
        var probes = 1;
        level = level == null ? 3 : level;
        xyz = XYZ.of(xyz, that);
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

    //////////// PRIVATE
    function location(that, result, level) {
        var xyz = result.xyz;
        var tetra = result.tetra;
        should(tetra).exist;
        tetra.contains(xyz).should.True;
        for (var i = 0; i < tetra.partitions.length; i++) {
            var subtetra = tetra.partitions[i];
            if (subtetra && subtetra.contains(xyz)) {
                //that.verbose && verboseLogger.debug("DeltaMesh location in i:", i, " level:", level, " subtetra:", subtetra.t);
                result.coord = result.coord + i;
                result.tetra = subtetra;
                if (level <= 1) {
                    //that.verbose && verboseLogger.debug("DeltaMesh location matched i:", i, " level:", level);
                    return result;
                }
                //that.verbose && verboseLogger.debug("DeltaMesh scanning child i:", i, " subtetra:", subtetra.t);
                return location(that, result, level - 1);
            }
        }
        that.verbose && verboseLogger.debug("DeltaMesh.location() not found in unrefined mesh at coord:", result.coord,
            " partitions:", tetra.partitions.length);
        return result;
    }
    function addVertex(that, xyz) {
        var key = xyz.x + "_" + xyz.y + "_" + xyz.z;
        if (!that.xyzVertexMap.hasOwnProperty(key)) {
            that.xyzVertexMap[key] = xyz;
        }
        return that.xyzVertexMap[key];
    }

    function addSubTetra(that, index, tetra, t0, t1, t2, t3) {
        var include = tetra == that.root ||
            t0.x * t0.x + t0.y * t0.y <= that.maxXYNorm2 ||
            t1.x * t1.x + t1.y * t1.y <= that.maxXYNorm2 ||
            t2.x * t2.x + t2.y * t2.y <= that.maxXYNorm2 ||
            t3.x * t3.x + t3.y * t3.y <= that.maxXYNorm2;
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
            t0.internal = t0.internal ? (t0.internal + 1) : 1;
            t1.internal = t1.internal ? (t1.internal + 1) : 1;
            t2.internal = t2.internal ? (t2.internal + 1) : 1;
            t3.internal = t3.internal ? (t3.internal + 1) : 1;
            return subtetra;
        }
        return null;
    }


    module.exports = exports.DeltaMesh = DeltaMesh;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("DeltaMesh", function() {
    var DeltaMesh = require("./DeltaMesh");
    var options = {
        logLevel: "debug",
        verbose: true
    };
    var logger = new Logger(options);

    it("new DeltaMesh() should create a delta tetrahedral mesh 100 units high", function() {
        var mesh = new DeltaMesh();
        //logger.debug(mesh.root);
        var n1 = mesh.root.t[0].norm();
        var e = 0.00000000000001;
        should(mesh.root.t[1].norm()).within(n1 - e, n1 + e);
        should(mesh.root.t[2].norm()).within(n1 - e, n1 + e);
    })
    it("zfloor(z,level) returns z lower bound at the given 0-based partition refinement level", function() {
        var mesh = new DeltaMesh();
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
    it("refineZ(nLevels) refines the mesh to have at least given level count", function() {
        var mesh = new DeltaMesh({
            verbose: true,
            maxSkewness: 0.3
        });
        var lvl0 = mesh.refineZ(2);
        lvl0.length.should.equal(1);
        lvl0[0].should.equal(mesh.root);
        var lvl3l = mesh.refineZ(5);
        lvl3l.length.should.above(144); // 175 without maxXYNorm2
    })
    it("tetraAtXYZ(xyz) returns best matching tetrahedron for xyz", function() {
        var maxSkewness = null; //0.30;
        var options = {};
        maxSkewness != null && (options.maxSkewness = maxSkewness);
        var mesh = new DeltaMesh(options);
        var e = 0.01;
        mesh.rOut.should.within(70.71 - e, 70.71 + e);
        var xyz = {
            x: 20,
            y: 5,
            z: -40
        };
        var tetra = mesh.tetraAtXYZ(xyz, 3);
        tetra.contains(xyz).should.True;
        maxSkewness != null && tetra.skewness().should.within(0, maxSkewness);
        var bounds = tetra.bounds();
        var e = 0.01;
        xyz.x.should.within(bounds.min.x, bounds.max.x);
        xyz.y.should.within(bounds.min.y, bounds.max.y);
        xyz.z.should.within(bounds.min.z, bounds.max.z);
        tetra.coord.should.equal("0534");
        maxSkewness == null && tetra.hasOwnProperty("maxSkewness").should.False;
    })
    it("tetraZVertices(z,level) returns vertices of smallest tetraheda intersecting given z-plane", function() {
        var level = 5;
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 200,
            zMin: -50,
            nPlanes: level+2,
        });
        var printScatterPlot = false;
        var zv = mesh.tetraZVertices(mesh.zMin, level);
        level === 5 && zv.length.should.not.below(732);
        level === 4 && zv.length.should.not.below(217);
        level === 3 && zv.length.should.not.below(66);
        zv.length.should.not.below(22);
        var colMap = {};
        var cols = 0;
        printScatterPlot && console.log("#\tz\tx\tz1\tz2");
        for (var i = 0; i < zv.length; i++) {
            var xyz = zv[i];
            level === 5 && xyz.z.should.within(-50, -32);
            level === 4 && xyz.z.should.within(-50, -14.6);
            level === 3 && xyz.z.should.within(-50, 20.8);
            xyz.z.should.within(-50, 91.5);
            var zkey = "z:" + xyz.z;
            if (colMap[zkey] == null) {
                cols++;
                colMap[zkey] = "";
                for (var j = 0; j < cols; j++) {
                    colMap[zkey] += "\t";
                }
            }
            printScatterPlot && console.log((i + 1) + "\t", xyz.z + "\t", xyz.x + colMap[zkey], xyz.y);
        }
        var vertexKeys = Object.keys(mesh.xyzVertexMap);
        var inVertices = 0;
        for (var i = vertexKeys.length; i-- > 0;) {
            var vertex = mesh.xyzVertexMap[vertexKeys[i]];
            if (vertex.internal > 0) {
                inVertices++;
            }
        }
        level === 2 && inVertices.should.equal(32);
        level === 2 && vertexKeys.length.should.equal(32);
        level === 3 && inVertices.should.equal(104);
        level === 3 && vertexKeys.length.should.equal(107);
        level === 4 && inVertices.should.equal(360);
        level === 4 && vertexKeys.length.should.equal(378);
        level === 5 && inVertices.should.equal(1269);
        level === 5 && vertexKeys.length.should.equal(1350);
    })
    it("tetraAtCoord(coord) returns tetrahedron at tetra-coord", function() {
        var options = {
            verbose: true
        };
        var mesh = new DeltaMesh(options);
        var xyz = new XYZ(20, 5, -40, options);
        var tetra = mesh.tetraAtXYZ(xyz, 3);
        tetra.coord.should.equal("0534");
        mesh.tetraAtCoord("0534").should.equal(tetra);
        mesh.tetraAtCoord("053").coord.should.equal("053");
        mesh.tetraAtCoord("05").coord.should.equal("05");
        mesh.tetraAtCoord("0").coord.should.equal("0");
        mesh.tetraAtCoord("0").should.equal(mesh.root);
        mesh.tetraAtCoord("34", mesh.tetraAtCoord("05")).coord.should.equal("0534");
    })
    it("vertices are xyz unique and shared by adjacent tetrahedra", function() {
        var options = {
            verbose: true
        };
        var mesh = new DeltaMesh(options);
        var xyz = new XYZ(20, 5, -40, options);
        var tetra = mesh.tetraAtXYZ(xyz, 3);
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
    it("zPlaneVertices(plane) returns vertices for z-plane indexed from bottom", function() {
        var level = 5;
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 200,
            nPlanes: level+2,
        });
        var printScatterPlot = false;
        var planes = [
            mesh.zPlaneVertices(0),
            mesh.zPlaneVertices(1),
            mesh.zPlaneVertices(2),
            mesh.zPlaneVertices(3),
            mesh.zPlaneVertices(4),
            mesh.zPlaneVertices(5),
            mesh.zPlaneVertices(6),
        ];
        planes[0].length.should.equal(420);
        planes[1].length.should.equal(396);
        planes[2].length.should.equal(394);
        planes[3].length.should.equal(105);
        planes[4].length.should.equal(28);
        planes[5].length.should.equal(6);
        planes[6].length.should.equal(1);
        var z0 = planes[0][0].z;
        var z1 = planes[1][0].z;
        printScatterPlot && console.log("z\tx\ty@z"+z0+"\ty@z"+Math.round(z1*10)/10);
        for (var i = 1; i < planes[0].length; i++) {
            var xyz = planes[0][i];
            xyz.z.should.equal(z0);
            printScatterPlot && console.log(xyz.z + "\t", xyz.x + "\t", xyz.y);
        }
        for (var i = 1; i < planes[1].length; i++) {
            var xyz = planes[1][i];
            xyz.z.should.equal(z1);
            printScatterPlot && console.log(xyz.z + "\t", xyz.x + "\t\t", xyz.y);
        }
    })
})

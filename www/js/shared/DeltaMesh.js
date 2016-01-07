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
        that.maxXYNorm2 = that.rIn * that.rIn * 1.1;
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
        that.levelTetras = [[that.root]];
        that.zPlanes = options.zPlanes || 5;
        that.zPlanes.should.above(2);
        that.refineZPlanes(that.zPlanes);

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
        zPlaneCount.should.Number;
        level = zPlaneCount-2;
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
        var showExternal = options.showExternal == null ? true : options.showExternal;
        var zmap = that.zVertexMap();
        var zkeys = Object.keys(zmap).sort(function(a,b){
            return Number(a) - Number(b);
        });
        zPlane.should.within(0, zkeys.length-1);
        var vertices = zmap[zkeys[zPlane]];
        if (maxLevel == null || maxLevel >= that.zPlanes - 1) {
            return vertices;
        }
        var result = [];
        for (var i=vertices.length; i-- > 0; ) {
            var v = vertices[i];
            if (v.level <= maxLevel) {
                if (showExternal || ((v.x*v.x+v.y*v.y)<=that.maxXYNorm2)) {
                    result.push(v);
                }
            }
        }
        if (options.sort) {
            var keys = options.sort.split(",");
            result = result.sort(function(a,b) {
                var cmp = a[keys[0]] - b[keys[0]];
                for (var i=1; cmp === 0 && i<keys.length; i++) {
                    cmp = a[keys[i]] - b[keys[i]];
                }
                return cmp;
            });
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
    DeltaMesh.prototype.tetraAtXYZ = function(xyz, level) {
        var that = this;
        var probes = 1;
        level = level == null ? (that.zPlanes-2) : level;
        if (xyz.z === that.zMin) {
            var eRounding = 0.0000000001; // ensure smallest tetra at zMin
            xyz = new XYZ(xyz.x, xyz.y, xyz.z+eRounding, that);
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

    //////////// PRIVATE
    function location(that, result, level) {
        var xyz = result.xyz;
        xyz.z.should.Number;
        var tetra = result.tetra;
        should(tetra).exist;
        tetra.contains(xyz).should.True;
        var nContains = 0;
        for (var i = 0; tetra.partitions && i<tetra.partitions.length; i++) {
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
                    " t:",subtetra.vertices(),
                    " partitions:", (subtetra.partitions ? subtetra.partitions.length:0));
            } else {
                false && that.verbose && verboseLogger.debug("DeltaMesh.location(" +
                    xyz.x + "," + xyz.y + "," + xyz.z + 
                    ") not found in unrefined mesh at coord:", tetra.coord, " partition:", i);
            }
        }
        false && nContains==0 && tetra.partitions && that.verbose && verboseLogger.debug("DeltaMesh.location(" +
            xyz.x + "," + xyz.y + "," + xyz.z + 
            ") not found in any partition at coord:", result.coord,
            " partitions:", (tetra.partitions ? tetra.partitions.length : null));
        return result;
    }
    function addVertex(that, level, xyz) {
        var key = xyz.x + "_" + xyz.y + "_" + xyz.z;
        if (!that.xyzVertexMap.hasOwnProperty(key)) {
            that.xyzVertexMap[key] = xyz;
            xyz.level = level;
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
        logLevel: "info",
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
            verbose:true,
            zMin:-50,
            height:100,
            zPlanes:5,
        });
        var e = 0.01;
        var v = mesh.root.t;
        var m = [ // tetrahedron midpoints
            v[0].interpolate(v[1],0.5), // bottom
            v[0].interpolate(v[2],0.5), // bottom
            v[1].interpolate(v[2],0.5), // bottom
            v[0].interpolate(v[3],0.5), // middle
            v[1].interpolate(v[3],0.5), // middle
            v[2].interpolate(v[3],0.5), // middle
        ];
        var c = [ // core interior points
            m[0].interpolate(m[1],0.1), // bottom
            m[0].interpolate(m[1],0.9), // bottom
            m[1].interpolate(m[2],0.1), // bottom
            m[1].interpolate(m[2],0.9), // bottom
            m[2].interpolate(m[0],0.1), // bottom
            m[2].interpolate(m[0],0.9), // bottom
            m[3].interpolate(m[4],0.1), // middle
            m[3].interpolate(m[4],0.9), // middle
            m[4].interpolate(m[5],0.1), // middle
            m[4].interpolate(m[5],0.9), // middle
            m[5].interpolate(m[3],0.1), // middle
            m[5].interpolate(m[3],0.9), // middle
        ];
        for (var i=0; i<m.length; i++) {
            m[i].x.should.Number;
            m[i].y.should.Number;
            m[i].z.should.Number;
        }
        v[3].z.should.equal(mesh.zMax);
        var dz = 1;//0.0000000000001;
        var midz = (mesh.zMax+mesh.zMin)/2;
        var botz = mesh.zMin;
        var tetras = [
            // very sparse
            mesh.tetraAtXYZ(new XYZ(0,0,0.9*mesh.zMax,options)), // top tetra
            mesh.tetraAtXYZ(new XYZ(v[0].x*0.9,v[0].y*0.9,v[0].z,options)), // bottom tetra
            mesh.tetraAtXYZ(new XYZ(v[1].x*0.9,v[1].y*0.9,v[1].z,options)), // bottom tetra
            mesh.tetraAtXYZ(new XYZ(v[2].x*0.9,v[2].y*0.9,v[2].z,options)), // bottom tetra
            // sparse
            mesh.tetraAtXYZ(new XYZ(c[6].x,c[6].y,midz-dz,options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[7].x,c[7].y,midz-dz,options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[8].x,c[8].y,midz-dz,options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[9].x,c[9].y,midz-dz,options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[10].x,c[10].y,midz-dz,options)), // core tetra middle
            mesh.tetraAtXYZ(new XYZ(c[11].x,c[11].y,midz-dz,options)), // core tetra middle
            // dense
            mesh.tetraAtXYZ(new XYZ(c[0].x,c[0].y,botz+dz,options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[1].x,c[1].y,botz+dz,options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[2].x,c[2].y,botz+dz,options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[3].x,c[3].y,botz+dz,options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[4].x,c[4].y,botz+dz,options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(c[5].x,c[5].y,botz+dz,options)), // core tetra bottom
            mesh.tetraAtXYZ(new XYZ(0,0,botz+dz,options)), // core tetra origin bottom
        ];
        for (var i=0; i<tetras.length; i++) {
            tetras[i].should.exist; // we found it
            tetras[i].coord.length.should.above(1); // very sparse
            i>3 && tetras[i].coord.length.should.above(2); //sparse
            i>9 && tetras[i].coord.length.should.above(3); //dense
            logger.debug("tetraAtXYZ OK:", i, " coord:", tetras[i].coord);
        }

        // Rounding error should not affect zMin locations
        var e = 0.0000001; 
        mesh.tetraAtXYZ(new XYZ(c[5].x,c[5].y,botz+e,options)).coord.should.equal("0531");
        mesh.tetraAtXYZ(new XYZ(c[5].x,c[5].y,botz+0,options)).coord.should.equal("0531");
    })
    it("tetraAtCoord(coord) returns tetrahedron at tetra-coord", function() {
        var mesh = new DeltaMesh(options);
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
    it("zPlaneVertices(plane, options) returns vertices for z-plane indexed from bottom", function() {
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 200,
            zMin: -50,
            zPlanes: 7,
        });
        var planes = [
            mesh.zPlaneVertices(0), // lowest z-plane
            mesh.zPlaneVertices(1),
            mesh.zPlaneVertices(2),
            mesh.zPlaneVertices(3),
            mesh.zPlaneVertices(4),
            mesh.zPlaneVertices(5),
            mesh.zPlaneVertices(6), // degenerate top-most z-plane
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
        for (var i = 0; i < planes[0].length; i++) {
            var xyz = planes[0][i];
            xyz.z.should.equal(z0);
        }
        for (var i = 1; i < planes[1].length; i++) {
            var xyz = planes[1][i];
            xyz.z.should.equal(z1);
        }

        // optional maxRefinementLevel will return a coarser grid for lower numbers
        var z0_levels = [
            mesh.zPlaneVertices(0,{maxLevel:0}), // root tetrahedon
            mesh.zPlaneVertices(0,{maxLevel:1}), // root + immediate children
            mesh.zPlaneVertices(0,{maxLevel:2}),
            mesh.zPlaneVertices(0,{maxLevel:3}),
            mesh.zPlaneVertices(0,{maxLevel:4}),
            mesh.zPlaneVertices(0,{maxLevel:5}), // finest resolution for a 7-plane mesh
            mesh.zPlaneVertices(0,{maxLevel:6}), // (same as 5)
        ];
        z0_levels[0].length.should.equal(3);
        z0_levels[1].length.should.equal(6);
        z0_levels[2].length.should.equal(15);
        z0_levels[3].length.should.equal(39);
        z0_levels[4].length.should.equal(126);
        z0_levels[5].length.should.equal(420);
        z0_levels[6].length.should.equal(420);
    })
    it("zPlaneVertices(plane, options) can be used to print a scatterplot of sample points by level", function() {
        var mesh = new DeltaMesh({
            verbose: options.verbose,
            rIn: 200,
            zMin: -50,
            zPlanes: 7,
        });
        var planes = [
            mesh.zPlaneVertices(0,{maxLevel:2,showExternal:false,sort:"x,y"}), // lowest z-plane
            mesh.zPlaneVertices(0,{maxLevel:3,showExternal:false,sort:"x,y"}),
            mesh.zPlaneVertices(0,{maxLevel:4,showExternal:false,sort:"x,y"}),
        ];
        var printPlot = false; // change this to true to print plot data
        printPlot && logger.info("z\tlevel\tx\ty@lvl2\ty@lvl3\ty@lvl4");
        for (var i = 0; i < planes[0].length; i++) {
            var xyz = planes[0][i];
            printPlot && logger.info(xyz.z, "\t", xyz.level, "\t", xyz.x, "\t", xyz.y);
        }
        for (var i = 0; i < planes[1].length; i++) {
            var xyz = planes[1][i];
            printPlot && logger.info(xyz.z, "\t", xyz.level, "\t", xyz.x, "\t\t", xyz.y);
        }
        for (var i = 0; i < planes[2].length; i++) {
            var xyz = planes[2][i];
            printPlot && logger.info(xyz.z, "\t", xyz.level, "\t", xyz.x, "\t\t\t", xyz.y);
        }
        planes[0].length.should.equal(6);
        planes[1].length.should.equal(21);
        planes[2].length.should.equal(84);
    })
})

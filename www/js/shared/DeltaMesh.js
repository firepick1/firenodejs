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
        that.zMax = options.zMax == null ? that.zMin+that.height : options.zMax;
        that.rOut = 2*that.rIn;
        that.maxXYNorm2 = that.rIn*that.rIn * 1.00000001;

        if (options.verbose) {
            that.verbose = options.verbose;
        }
        if (options.maxSkewness) {
            that.maxSkewness = options.maxSkewness;
        }

        var xBase = that.rOut * SIN60;
        var yBase = -that.rOut * COS60;
        that.root = new Tetrahedron(
            new XYZ(0, that.rOut, that.zMin, options),
            new XYZ(xBase, yBase, that.zMin, options),
            new XYZ(-xBase, yBase, that.zMin, options),
            new XYZ(0, 0, that.zMax, options),
            options
        );
        that.root.coord = "0";
        var rootMap = {};
        rootMap[that.zfloor(that.zMin, 0)] = [that.root];
        that.levels = [rootMap];

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
    DeltaMesh.prototype.refineZ = function(z, level) {
        var that = this;
        var zfloor = that.zfloor(z, level);
        z.should.Number;
        level.should.Number;
        for (var l = 0; l < level; l++) {
            var lpartitions = that.levels[l][that.zfloor(z, l)];
            var l1map;
            if (l + 1 < that.levels.length) {
                l1map = that.levels[l + 1];
            } else {
                l1map = {};
                that.levels.push(l1map);
            }
            var zfl1 = that.zfloor(z, l + 1);
            if (!l1map.hasOwnProperty(zfl1)) {
                l1map[zfl1] = l1map[zfl1] || [];
                for (var i = 0; i < lpartitions.length; i++) {
                    var tetra = lpartitions[i];
                    var zavg = (tetra.zMin() + tetra.zMax()) / 2;
                    l1map[zavg] = l1map[zavg] || [];
                    that.refineRed(tetra);
                    for (var j = 0; j < tetra.partitions.length; j++) {
                        var subtetra = tetra.partitions[j];
                        if (subtetra) { 
                            if (subtetra.zMin() === zfl1) {
                                l1map[zfl1].push(subtetra);
                            } else {
                                l1map[zavg].push(subtetra);
                            }
                        } else {
                            // skip null placeholder for rejected refinement
                        }
                    }
                }
                //that.verbose && verboseLogger.debug("refined partition level:", l + 1, " zfl1:", zfl1, " partitions:", l1map[zfl1].length);
            }
        }
        return that.levels[level][zfloor];
    }
    DeltaMesh.prototype.refineRed = function(tetra) {
        var that = this;
        var t = tetra.t;
        if (tetra.partitions) {
            return tetra.partitions;
        }
        var pt03 = t[3].interpolate(t[0], 0.5); // [0] tip midpoint #7
        var pt13 = t[3].interpolate(t[1], 0.5); // [1] tip midpoint #9
        var pt23 = t[3].interpolate(t[2], 0.5); // [2] tip midpoint #10
        var pt01 = t[0].interpolate(t[1], 0.5); // [3] base midpoint #5
        var pt12 = t[1].interpolate(t[2], 0.5); // [4] base midpoint #8
        var pt02 = t[2].interpolate(t[0], 0.5); // [5] base midpoint #6

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
    DeltaMesh.prototype.tetraZVertices = function(z, level) {
        var that = this;
        var tetras = that.refineZ(z, level);
        var vertexMap = {};
        var zvertices = [];
        for (var i=0; i < tetras.length; i++) {
            var t = tetras[i].t;
            //if (that.verbose) {
                //var tetra = tetras[i];
                //var bounds = tetra.bounds();
                //verboseLogger.debug("tetraZVertices(" + tetra.coord + ")" + " minz:", bounds.min.z, " maxz:", bounds.max.z);
                //if (tetra.coord === "012734") {
                    //verboseLogger.debug(tetra.coord, tetra.t);
                //}
            //}
            for (var j=0; j<4; j++) {
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
    DeltaMesh.prototype.tetraAt = function(xyz, level) {
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
            var partitions = that.refineZ(xyz.z, level);
            location(that, result, level);
        }
        if (that.verbose) {
            var t = result.tetra.t;
            verboseLogger.debug("DeltaMesh.tetraAt(", xyz, ") ",
                (contains ? "internal" : "external")+"point coord:", 
                result.coord, " tetra:", [
                    [t[0].x,t[0].y,t[0].z],
                    [t[1].x,t[1].y,t[1].z],
                    [t[2].x,t[2].y,t[2].z],
                    [t[3].x,t[3].y,t[3].z],
                ]);
        }
        return result.tetra;
    }
    //////////// PRIVATE
    function addSubTetra(that,index, tetra,t0,t1,t2,t3) {
        var include = tetra == that.root ||
            t0.x*t0.x + t0.y*t0.y <= that.maxXYNorm2 ||
            t1.x*t1.x + t1.y*t1.y <= that.maxXYNorm2 ||
            t2.x*t2.x + t2.y*t2.y <= that.maxXYNorm2 ||
            t3.x*t3.x + t3.y*t3.y <= that.maxXYNorm2;
        var subtetra = null;
        if (include) {
            subtetra = new Tetrahedron(t0,t1,t2,t3, tetra);
            subtetra.coord = tetra.coord + index;
            if (that.maxSkewness != null && subtetra.skewness() > that.maxSkewness) {
                include = false;
            }
        }
        tetra.partitions.push(subtetra);
        return include ? subtetra : null;
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
    it("refineZ(z,level) refines the mesh at the given Z to the given level", function() {
        var mesh = new DeltaMesh({verbose:true, maxSkewness:0.3});
        var lvl0 = mesh.refineZ(0, 0);
        lvl0.length.should.equal(1);
        lvl0[0].should.equal(mesh.root);
        var lvl3l = mesh.refineZ(-40, 3);
        lvl3l.length.should.above(144); // 175 without maxXYNorm2
    })
    it("tetraAt(xyz) returns best matching tetrahedron for xyz", function() {
        var maxSkewness = null; //0.30;
        var options = {};
        maxSkewness != null && (options.maxSkewness = maxSkewness);
        var mesh = new DeltaMesh(options);
        var e = 0.01;
        mesh.rOut.should.within(70.71-e,70.71+e);
        var xyz = {
            x: 20,
            y: 5,
            z: -40
        };
        var tetra = mesh.tetraAt(xyz, 3);
        tetra.contains(xyz).should.True;
        maxSkewness != null && tetra.skewness().should.within(0,maxSkewness);
        var bounds = tetra.bounds();
        var e = 0.01;
        xyz.x.should.within(bounds.min.x, bounds.max.x);
        xyz.y.should.within(bounds.min.y, bounds.max.y);
        xyz.z.should.within(bounds.min.z, bounds.max.z);
        tetra.coord.should.equal("0534");
        maxSkewness == null && tetra.hasOwnProperty("maxSkewness").should.False;
    })
    it("tetraZVertices(z,level) returns vertices of smallest tetraheda intersecting given z-plane", function() {
        var mesh = new DeltaMesh({
            verbose:options.verbose, 
            rIn:200,
            zMin:-50,
        });
        var printScatterPlot = false;
        var zv = mesh.tetraZVertices(-40, 5);
        zv.length.should.above(730);
        var colMap = {};
        var cols = 0;
        printScatterPlot && console.log("#\tz\tx\tz1\tz2");
        for (var i=0; i<zv.length; i++) {
            var xyz = zv[i];
            xyz.z.should.within(-50,-32);
            var zkey = "z:" + xyz.z;
            if (colMap[zkey] == null) {
                cols++;
                colMap[zkey] = "";
                for (var j=0; j<cols; j++) {
                    colMap[zkey] += "\t";
                }
            }
            printScatterPlot && console.log((i+1)+"\t", xyz.z+"\t", xyz.x + colMap[zkey],xyz.y);
        }
    })
})

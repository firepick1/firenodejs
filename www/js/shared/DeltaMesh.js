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

    ////////////////// constructor
    function DeltaMesh(zMax, zMin, rBase, options) {
        var that = this;

        that.zMin = typeof zMin === "number" ? zMin : -50;
        that.zMax = typeof zMax === "number" ? zMax : -that.zMin;;
        that.rBase = typeof zBase === "number" ? rBase : that.zMax - that.zMin;

        options = options ||
            (typeof zMin === "object" && zMin) ||
            (typeof zMax === "object" && zMax) ||
            (typeof rBase === "object" && rBase) || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }
        that.maxSkewness = options.maxSkewness || 0.3;
        that.logger = options.logger || new Logger(options);

        var xBase = that.rBase * Math.sin(deg60);
        var yBase = -that.rBase * Math.cos(deg60);
        that.root = new Tetrahedron(
            new XYZ(0, that.rBase, that.zMin, options),
            new XYZ(xBase, yBase, that.zMin, options),
            new XYZ(xBase, -yBase, that.zMin, options),
            new XYZ(0, 0, that.zMax, options),
            options
        );
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
                    var bounds = tetra.bounds();
                    var zavg = (bounds.min.z + bounds.max.z) / 2;
                    l1map[zavg] = l1map[zavg] || [];
                    that.refineRed(tetra);
                    for (var j = 0; j < tetra.partitions.length; j++) {
                        var subtetra = tetra.partitions[j];
                        if (subtetra) { // null placeholder for rejected refinement
                            var subbounds = subtetra.bounds();
                            if (subbounds.min.z === zfl1) {
                                l1map[zfl1].push(subtetra);
                                //that.logger.debug("extending partition zfl1:", zfl1, " tetra:", subtetra.t);
                            } else {
                                l1map[zavg].push(subtetra);
                                //that.logger.debug("extending partition zavg:", zavg, " tetra:", subtetra.t);
                            }
                        }
                    }
                }
                that.logger.debug("refined partition level:", l + 1, " zfl1:", zfl1, " partitions:", l1map[zfl1].length);
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
        var midpts = [
            t[3].interpolate(t[0], 0.5), // [0] tip midpoint #7
            t[3].interpolate(t[1], 0.5), // [1] tip midpoint #9
            t[3].interpolate(t[2], 0.5), // [2] tip midpoint #10
            t[0].interpolate(t[1], 0.5), // [3] base midpoint #5
            t[1].interpolate(t[2], 0.5), // [4] base midpoint #8
            t[2].interpolate(t[0], 0.5), // [5] base midpoint #6
        ];

        tetra.partitions = [];
        var maxSkew = that.maxSkewness;
        addSubTetra(that, tetra, new Tetrahedron(midpts[0], midpts[1], midpts[2], t[3], tetra), maxSkew);
        addSubTetra(that, tetra, new Tetrahedron(t[0], midpts[3], midpts[5], midpts[0], tetra), maxSkew);
        addSubTetra(that, tetra, new Tetrahedron(t[1], midpts[4], midpts[3], midpts[1], tetra), maxSkew);
        addSubTetra(that, tetra, new Tetrahedron(t[2], midpts[5], midpts[4], midpts[2], tetra), maxSkew);
        addSubTetra(that, tetra, new Tetrahedron(midpts[0], midpts[2], midpts[1], midpts[5], tetra), maxSkew); // #7,10,9,6
        addSubTetra(that, tetra, new Tetrahedron(midpts[4], midpts[5], midpts[3], midpts[1], tetra), maxSkew); // #8,6,5,8,9
        addSubTetra(that, tetra, new Tetrahedron(midpts[3], midpts[5], midpts[0], midpts[1], tetra), maxSkew); // #5,6,7,9
        addSubTetra(that, tetra, new Tetrahedron(midpts[2], midpts[4], midpts[5], midpts[1], tetra), maxSkew); // #9,8,6,10
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
    DeltaMesh.prototype.tetraVertices = function(xyz, level) {
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
        if (that.root.contains(xyz)) {
            var partitions = that.refineZ(xyz.z, level);
            location(that, result, level);
            if (that.verbose) {
                var t = result.tetra.t;
                verboseLogger.debug("DeltaMesh.tetraAt(", xyz, ") coord:", 
                    result.coord, " skew:", result.tetra.skewness(), " tetra:", [
                        [t[0].x,t[0].y,t[0].z],
                        [t[1].x,t[1].y,t[1].z],
                        [t[2].x,t[2].y,t[2].z],
                        [t[3].x,t[3].y,t[3].z],
                    ]);
            }
        } else {
            if (that.verbose) {
                var t = result.tetra.t;
                verboseLogger.debug("DeltaMesh.tetraAt(", xyz, ") external point coord:", 
                    result.coord, " skew:", result.tetra.skewness(), " tetra:", [
                        [t[0].x,t[0].y,t[0].z],
                        [t[1].x,t[1].y,t[1].z],
                        [t[2].x,t[2].y,t[2].z],
                        [t[3].x,t[3].y,t[3].z],
                    ]);
            }
        }
        return result;
    }
    //////////// PRIVATE
    function addSubTetra(that, tetra, subtetra, maxSkewness) {
        var skew = subtetra.skewness();
        if (skew > maxSkewness) {
            //that.verbose && verboseLogger.debug("addSubTetra rejected skew:", skew, " subtetra:", subtetra.t);
            tetra.partitions.push(null);
            return null;
        }
        tetra.partitions.push(subtetra);
        return subtetra;
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
        var maxSkewness = 0.3;
        var mesh = new DeltaMesh({verbose:true, maxSkewness:maxSkewness});
        var lvl0 = mesh.refineZ(0, 0);
        lvl0.length.should.equal(1);
        lvl0[0].should.equal(mesh.root);
        var lvl3l = mesh.refineZ(-40, 3);
        lvl3l.length.should.equal(53); // restricted by maxSkewness
        //var root = mesh.root;
        //for (var i = 0; i < root.partitions.length; i++) {
            //var tetra = root.partitions[i];
            //logger.debug(i, root.toBarycentric(tetra.centroid()));
        //}
    })
    it("tetraAt(xyz) returns best matching tetrahedron for xyz", function() {
        var maxSkewness = 0.44;
        var mesh = new DeltaMesh({
            maxSkewness:maxSkewness,
        });
        var xyz = {
            x: 50,
            y: 5,
            z: -40
        };
        var result = mesh.tetraAt(xyz, 3);
        var tetra = result.tetra;
        tetra.contains(xyz).should.True;
        tetra.skewness().should.within(0,maxSkewness);
        var bounds = tetra.bounds();
        var e = 0.01;
        xyz.x.should.within(bounds.min.x, bounds.max.x);
        xyz.y.should.within(bounds.min.y, bounds.max.y);
        xyz.z.should.within(bounds.min.z, bounds.max.z);
        result.coord.should.equal("0236");

        var mesh2 = new DeltaMesh({maxSkewness:0.43});
        var result2 = mesh2.tetraAt(xyz, 3);
        var tetra2 = result2.tetra;
        tetra2.contains(xyz).should.True;
        tetra2.skewness().should.within(0,maxSkewness);
        var bounds2 = tetra2.bounds();
        var e = 0.01;
        xyz.x.should.within(bounds2.min.x, bounds2.max.x);
        xyz.y.should.within(bounds2.min.y, bounds2.max.y);
        xyz.z.should.within(bounds2.min.z, bounds2.max.z);
        result2.coord.should.equal("023"); // coord prefix is independent of skewness
    })
})

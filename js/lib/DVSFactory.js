var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("../../www/js/shared/Logger.js");
DataSeries = require("./DataSeries");
DeltaCalculator = require("../../www/js/shared/DeltaCalculator.js");

(function(firepick) {
    var byteHex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

    function DVSFactory(options) {
        var that = this;

        options = options || {};
        that.vMax = options.vMax || 18000; // pulses per second
        that.maxPath = options.maxPath || 90; // maximum number of path segments
        that.tvMax = options.tvMax || 0.7; // seconds to reach max velocity
        that.acceleration = that.vMax / that.tvMax;
        that.delta = options.delta || new DeltaCalculator();
        that.logger = options.logger || new Logger(options);

        return that;
    };

    ///////////////// INSTANCE API ///////////////

    DVSFactory.prototype.createDVS = function(pulses) {
        var that = this;
        var N = pulses.length - 1;
        var ds = new DataSeries();
        var diff1 = ds.diff(pulses, "p1");
        var diff2 = ds.diff(pulses, "p2");
        var diff3 = ds.diff(pulses, "p3");
        var diffMax = math.max(
            math.abs(diff1.max),
            math.abs(diff2.max),
            math.abs(diff3.max),
            math.abs(diff1.min),
            math.abs(diff2.min),
            math.abs(diff3.min)
        );
        that.logger.debug("diffMax:", diffMax, "\t", diff1, "\t", diff2, "\t", diff3);
        var scale = math.round(diffMax / 127 + 0.5);
        var startPulses = {
            p1: Math.round(pulses[0].p1 / scale),
            p2: Math.round(pulses[0].p2 / scale),
            p3: Math.round(pulses[0].p3 / scale),
        };
        var rPrev = startPulses;
        var v = {
            p1: 0,
            p2: 0,
            p3: 0
        };
        var p = {
            p1: "",
            p2: "",
            p3: ""
        };
        var r;
        var vMax = {
            p1: 0,
            p2: 0,
            p3: 0
        };
        for (var i = 1; i <= N; i++) {
            r = {
                p1: Math.round(pulses[i].p1 / scale),
                p2: Math.round(pulses[i].p2 / scale),
                p3: Math.round(pulses[i].p3 / scale),
            };
            var dr = {
                p1: r.p1 - rPrev.p1,
                p2: r.p2 - rPrev.p2,
                p3: r.p3 - rPrev.p3,
            };
            var dv = {
                p1: dr.p1 - v.p1,
                p2: dr.p2 - v.p2,
                p3: dr.p3 - v.p3,
            };
            p.p1 += DVSFactory.byteToHex(dv.p1);
            p.p2 += DVSFactory.byteToHex(dv.p2);
            p.p3 += DVSFactory.byteToHex(dv.p3);
            v.p1 += dv.p1;
            v.p2 += dv.p2;
            v.p3 += dv.p3;
            vMax.p1 = math.max(math.abs(v.p1));
            vMax.p2 = math.max(math.abs(v.p2));
            vMax.p3 = math.max(math.abs(v.p3));
            rPrev = r;
        }
        that.logger.debug("p:", p);
        var dEndPos = [
            Math.round(pulses[N].p1 - pulses[0].p1),
            Math.round(pulses[N].p2 - pulses[0].p2),
            Math.round(pulses[N].p3 - pulses[0].p3),
        ];
        var tTotal;
        if (pulses[0].t != null) { // client provides timing
            tTotal = math.max(pulses[0].t, pulses[pulses.length - 1].t);
        } else { // calculate time assuming simple accelerate-cruise-decelerate model
            var lengthMax = math.max(
                diff1.sumAbs,
                diff2.sumAbs,
                diff3.sumAbs
            );
            // limit maximum velocity overall
            var sCruise = lengthMax - that.vMax;
            var tTotal = 0;
            if (sCruise > 0) {
                tTotal = 2 * that.tvMax + sCruise / that.vMax;
            } else {
                tTotal = 2 * math.sqrt(lengthMax / that.acceleration);
            }
            that.logger.debug({
                N: N,
                sCruise: sCruise,
                lengthMax: lengthMax,
                usSeg: math.round(1000000 * tTotal / N),
                tCruise: sCruise / that.vMax,
                tTotal: tTotal
            });
        }

        var dvs = {
            'dvs': {
                'sc': scale,
                'us': math.round(tTotal * 1000000),
                'dp': dEndPos,
                '1': p.p1,
                '2': p.p2,
                '3': p.p3,
            }
        };
        return dvs;
    }

    ///////////////// CLASS //////////
    DVSFactory.byteToHex = function(byte) {
        should(byte).within(-127, 255);
        return byteHex[(byte >> 4) & 0xf] + byteHex[byte & 0xf];
    }

    Logger.logger.debug("loaded firepick.DVSFactory");
    module.exports = firepick.DVSFactory = DVSFactory;
})(firepick || (firepick = {}));


(typeof describe === 'function') && describe("firepick.DVSFactory", function() {
    var logger = new Logger({
        nPlaces: 1,
        logLevel: "info"
    });
    var DVSFactory = firepick.DVSFactory;
    var pt1 = {
        x: 10,
        y: 20,
        z: -50
    };
    var pt2 = {
        x: -90,
        y: 21,
        z: -60
    };
    var e = 0.000001;
    var testOut = "";
    var testWrite = function(msg) {
        testOut += msg;
    };

    function testCmd(cmd, expected) {
        testOut = "";
        cmd();
        testOut.should.equal(expected);
    }
    it("byteToHex() should return hex string of byte", function() {
        DVSFactory.byteToHex(0x00).should.equal("00");
        DVSFactory.byteToHex(0x10).should.equal("10");
        DVSFactory.byteToHex(0x02).should.equal("02");
        DVSFactory.byteToHex(0x30).should.equal("30");
        DVSFactory.byteToHex(0x04).should.equal("04");
        DVSFactory.byteToHex(0x50).should.equal("50");
        DVSFactory.byteToHex(0x06).should.equal("06");
        DVSFactory.byteToHex(0x70).should.equal("70");
        DVSFactory.byteToHex(0x08).should.equal("08");
        DVSFactory.byteToHex(0x90).should.equal("90");
        DVSFactory.byteToHex(0x0A).should.equal("0A");
        DVSFactory.byteToHex(0xB0).should.equal("B0");
        DVSFactory.byteToHex(0x0C).should.equal("0C");
        DVSFactory.byteToHex(0xD0).should.equal("D0");
        DVSFactory.byteToHex(0x0E).should.equal("0E");
        DVSFactory.byteToHex(0xFF).should.equal("FF");
        DVSFactory.byteToHex(-1).should.equal("FF");
        DVSFactory.byteToHex(-2).should.equal("FE");
    });
    it("createDVS(pts) should create a Delta Velocity Stroke FireStep command", function() {
        var dvsf = new DVSFactory();
        var pts = [];
        var arbitrary = 1234;
        for (var i = 0; i < 5; i++) {
            pts.push({
                p1: arbitrary,
                p2: i + arbitrary,
                p3: i * i + arbitrary
            });
        }

        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs: {
                1: "00000000", // constant position
                2: "01000000", // constant velocity
                3: "01020202", // constant acceleration
                dp: [0, 4, 16],
                sc: 1,
                us: 49889,
            }
        });
    });
    it("createDVS(pts) should use timed path information if available", function() {
        var dvsf = new DVSFactory();
        var pts = [];
        var arbitrary = 1234;
        for (var i = 0; i < 5; i++) {
            pts.push({
                t: i * 0.025,
                p1: arbitrary,
                p2: i + arbitrary,
                p3: i * i + arbitrary
            });
        }


        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs: {
                1: "00000000", // constant position
                2: "01000000", // constant velocity
                3: "01020202", // constant acceleration
                dp: [0, 4, 16],
                sc: 1,
                us: 100000,
            }
        });
    });
    it("createDVS(pts) should scale automatically", function() {
        var dvsf = new DVSFactory();
        var pts = [];
        pts.push({
            p1: 0,
            p2: 0,
            p3: 0
        });
        pts.push({
            p1: 127,
            p2: 128,
            p3: -128
        });

        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs: {
                1: "40",
                2: "40",
                3: "C0",
                dp: [127, 128, -128],
                sc: 2,
                us: 141107,
            }
        });
    });
    it("createDVS(pts) should calculate traversal time", function() {
        var dvsf = new DVSFactory({
            tvMax: 0.7,
            vMax: 18000
        });
        var a = 18000 / 0.7;
        dvsf.tvMax.should.equal(0.7);
        dvsf.vMax.should.equal(18000);
        dvsf.acceleration.should.equal(a);
        var pts = [];
        pts.push({
            p1: 0,
            p2: 0,
            p3: 0
        });
        pts.push({
            p1: 0,
            p2: -a / 2,
            p3: a / 2
        }); // accel distance is half acceleration

        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs: {
                1: "00",
                2: "82",
                3: "7E",
                dp: [0, -12857, 12857],
                sc: 102,
                us: 1414214,
            }
        });
    });
    it("createDVS(pts) should cap maximum velocity", function() {
        var vMax = 18000;
        var tvMax = 0.7;
        var dvsf = new DVSFactory({
            tvMax: tvMax,
            vMax: vMax,
        });
        var a = vMax / tvMax;
        dvsf.tvMax.should.equal(tvMax);
        dvsf.vMax.should.equal(vMax);
        dvsf.acceleration.should.equal(a);
        var pts = [];
        var s = vMax * 2;
        pts.push({
            p1: 0,
            p2: 0,
            p3: 0
        });
        pts.push({
            p1: 0,
            p2: -s,
            p3: s
        });

        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs: {
                1: "00",
                2: "81",
                3: "7F",
                dp: [0, -s, s],
                sc: 284,
                us: (2 * tvMax + 1) * 1000000,
            }
        });
    });
})

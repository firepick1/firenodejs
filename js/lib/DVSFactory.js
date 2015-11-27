var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
DataSeries = require("./DataSeries");
DeltaCalculator = require("./DeltaCalculator");

(function(firepick) {
	var byteHex = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];

    function DVSFactory(options) {
		var that = this;

		options = options || {};
        that.vMax = options.vMax || 18000; // pulses per second
        that.maxPath = options.maxPath || 90; // maximum number of path segments
        that.tvMax = options.tvMax || 0.7; // seconds to reach max velocity
        that.delta = options.delta || new DeltaCalculator();
		that.logger = options.logger || new Logger(options);
        that.logger.info("OOG");

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
            diff1.max-diff1.min, 
            diff2.max-diff2.min, 
            diff3.max-diff3.min
        );
        that.logger.info("diffMax:", diffMax, "\t", diff1, "\t", diff2, "\t", diff3); 
        var scale = math.round(diffMax / 127 + 0.5);
		var startPulses = {
			p1: Math.round(pulses[0].p1/scale),
			p2: Math.round(pulses[0].p2/scale),
			p3: Math.round(pulses[0].p3/scale),
		};
		var rPrev = startPulses;
		var v = {p1:0, p2:0, p3:0};
		var p = {p1:"", p2:"", p3:""};
		var r;
		for (var i=1; i<=N; i++) {
			r = {
				p1: Math.round(pulses[i].p1/scale),
				p2: Math.round(pulses[i].p2/scale),
				p3: Math.round(pulses[i].p3/scale),
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
			rPrev = r;
		}
		that.logger.debug("p:", p);
		var dvs = {'dvs':{
			'sc':scale,
			'us':1234,
			'dp':{
				'1':Math.round(pulses[N].p1-pulses[0].p1),
				'2':Math.round(pulses[N].p2-pulses[0].p2),
				'3':Math.round(pulses[N].p3-pulses[0].p3),
				},
			'1':p.p1,
			'2':p.p2,
			'3':p.p3,
		}};
		return dvs;
	}

	///////////////// CLASS //////////
	DVSFactory.byteToHex = function(byte) {
		return byteHex[(byte>>4)&0xf] + byteHex[byte&0xf];
	}

    Logger.logger.debug("loaded firepick.DVSFactory");
    module.exports = firepick.DVSFactory = DVSFactory;
})(firepick || (firepick = {}));


(typeof describe === 'function') && describe("firepick.DVSFactory", function() {
	var logger = new Logger({
		nPlaces:1,
		logLevel:"info"
	});
	var DVSFactory = firepick.DVSFactory;
	var pt1 = {x:10, y:20, z:-50};
	var pt2 = {x:-90, y:21, z:-60};
	var e = 0.000001;
	var testOut = "";
	var testWrite = function(msg) {testOut += msg;};

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
	});
	it("TESTTESTcreaeDVS(pts) should create a Delta Velocity Stroke FireStep command", function() {
		var dvsf = new DVSFactory();
        var pts = [];
        for (var i=0; i < 5; i++) {
            pts.push({p1:101,p2:i,p3:i*i});
        }

        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs:{
                1:"00000000",
                2:"01000000",
                3:"01020202",
                dp:{
                    1:0,
                    2:4,
                    3:16
                },
                sc:1,
                us:1234
            }});
	});
	it("TESTTESTcreaeDVS(pts) should create a Delta Velocity Stroke FireStep command", function() {
		var dvsf = new DVSFactory();
        var pts = [];
        pts.push({p1:0,p2:0,p3:0});
        pts.push({p1:0,p2:0,p3:1}); // +1, +1
        pts.push({p1:0,p2:0,p3:4}); // +3, +2
        pts.push({p1:0,p2:0,p3:9}); // +5, +2
        pts.push({p1:0,p2:0,p3:16}); // +7, +2

        var cmd = dvsf.createDVS(pts);
        should.deepEqual(cmd, {
            dvs:{
                1:"00000000",
                2:"00000000",
                3:"01020202",
                dp:{
                    1:0,
                    2:0,
                    3:16
                },
                sc:1,
                us:1234
            }});
	});
})

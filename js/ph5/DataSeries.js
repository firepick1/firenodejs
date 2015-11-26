var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
PHFeed = require("./PHFeed");
PH5Curve = require("./PH5Curve");
PHFactory = require("./PHFactory");
DeltaCalculator = require("./DeltaCalculator");
math = require("mathjs");

(function(firepick) {
    function DataSeries(options) {
		var that = this;
		options = options || {};
        that.round = options.round || false;
        that.start = options.start || 0;
        that.end = options.end || 0;
		that.logger = options.logger || new Logger(options);
		return that;
    };

    ///////////////// INSTANCE ///////////////
    DataSeries.prototype.blur = function(pts, key) {
        var that = this;
        var start = that.start;
        var end = that.end;
        if (end <= 0) {
            end = pts.length + end;
        }
        should(end).within(1, pts.length);
        should(start).within(0,end-1);
        var v0 = pts[pts.length-1][key];
        var v1 = v0;
        var v2 = v1;
        var v3 = v2;
        var v4 = v3;
        var start3 = start3;
        for (var i=end; i-- > start; ) {
            var pt = pts[i];
            v4 = v3;
            v3 = v2;
            v2 = v1;
            v1 = v0;
            v0 = pt[key];
            if (start === i || i === end-1) {
                // do nothing
            } else if (3 < i && i < pts.length-4) {
                pt[key] = (
                    pts[i-4][key] +
                    8*pts[i-3][key] +
                    28*pts[i-2][key] +
                    56*pts[i-1][key] +
                    70*v0 +
                    56*v1 +
                    28*v2 +
                    8*v3 +
                    v4
                    )/256;
            } else {
                var vm1 = 0 < i ? pts[i-1][key] : v0;
                var vm2 = 1 < i ? pts[i-2][key] : vm1;
                var vm3 = 2 < i ? pts[i-3][key] : vm2;
                var vm4 = 3 < i ? pts[i-4][key] : vm3;
                pt[key] = (
                    vm4 +
                    7*vm3 +
                    21*vm2 +
                    35*vm1 +
                    35*v1 +
                    21*v2 +
                    7*v3 +
                    v4)/128;
            }
            if (that.round) {
                pt[key] = math.round(pt[key]);
            }
        }
        return pts;
    }

	///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.DataSeries");
    module.exports = firepick.DataSeries = DataSeries;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.DataSeries", function() {
	var logger = new Logger({
		nPlaces:4,
		logLevel:"info"
	});
	var DataSeries = firepick.DataSeries;
    it("blur(pts, key) should blur key values", function() {
        var ds = new DataSeries(); 
        var pts = [];
        pts.push({a:1,b:1});
        pts.push({a:1,b:1});
        pts.push({a:1,b:1});
        pts.push({a:1,b:1});
        pts.push({a:-1,b:-1});
        pts.push({a:-1,b:-1});
        pts.push({a:-1,b:-1});
        pts.push({a:-1,b:-1});
        ds.blur(pts, "b");
        
        // key a should not change
        var i = 0;
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(-1);
        pts[i++].a.should.equal(-1);
        pts[i++].a.should.equal(-1);
        pts[i++].a.should.equal(-1);

        // key b should be blurred
        math.round(pts[0].b,5).should.equal(1);
        math.round(pts[1].b,5).should.equal(0.875);
        math.round(pts[2].b,5).should.equal(0.54688);
        math.round(pts[3].b,5).should.equal(0);
        math.round(pts[4].b,5).should.equal(-0);
        math.round(pts[5].b,5).should.equal(-0.54688);
        math.round(pts[6].b,5).should.equal(-0.875);
        math.round(pts[7].b,5).should.equal(-1);
    });
    it("blur(pts, key) should blur and round key values", function() {
        var ds = new DataSeries({round:true}); 
        var pts = [];
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:10});
        pts.push({b:10});
        pts.push({b:10});

        ds.blur(pts, "b");
        
        // key b should be blurred
        math.round(pts[0].b,5).should.equal(-10);
        math.round(pts[1].b,5).should.equal(-5);
        math.round(pts[2].b,5).should.equal(0);
        math.round(pts[3].b,5).should.equal(0);
        math.round(pts[4].b,5).should.equal(5);
        math.round(pts[5].b,5).should.equal(10);
    });
    it("blur(pts, key) should blur more", function() {
        var ds = new DataSeries({round:true}); 
        var pts = [];
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:10});
        pts.push({b:10});
        pts.push({b:10});

        ds.blur(pts, "b");
        ds.blur(pts, "b");
        
        // key b should be blurred
        math.round(pts[0].b,5).should.equal(-10);
        math.round(pts[1].b,5).should.equal(-5);
        math.round(pts[2].b,5).should.equal(-2);
        math.round(pts[3].b,5).should.equal(2);
        math.round(pts[4].b,5).should.equal(5);
        math.round(pts[5].b,5).should.equal(10);
    });
    it("TESTTESTblur(pts, key) should blur sub-series", function() {
        var ds = new DataSeries({round:true, start:1, end:-1}); 
        var pts = [];
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:-10});
        pts.push({b:10});
        pts.push({b:10});
        pts.push({b:10});
        pts.push({b:10});

        ds.blur(pts, "b");
        
        // key b should be blurred
        var i = 0;
        math.round(pts[i++].b,5).should.equal(-10);
        math.round(pts[i++].b,5).should.equal(-10);
        math.round(pts[i++].b,5).should.equal(-5);
        math.round(pts[i++].b,5).should.equal(0);
        math.round(pts[i++].b,5).should.equal(-0);
        math.round(pts[i++].b,5).should.equal(5);
        math.round(pts[i++].b,5).should.equal(10);
        math.round(pts[i++].b,5).should.equal(10);
    });
})

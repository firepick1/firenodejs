var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
PHFeed = require("./PHFeed");
Laplace = require("./Laplace");
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
        that.laplaceFade = options.laplaceFade || 1;
        that.expFade = options.expFade || 0.8;
        that.end = options.end || 0;
        that.logger = options.logger || new Logger(options);
        return that;
    };

    ///////////////// INSTANCE ///////////////
    DataSeries.prototype.fadeIn = function(pts, key, value, n) {
        var that = this;
        var lap = new Laplace({b:that.laplaceFade});
        var n1 = math.round(n==null ? pts.length/4 : n-1);
        var expFade = that.expFade;
        for (var i=0; i <= n1; i++) {
            var k = lap.transition( i/n1 );
            var vOld = pts[i][key];
            var v = k * vOld + (1-k)*value;
            value = expFade * value + (1-expFade) * vOld;
            pts[i][key] = that.round ? math.round(v) : v;
        }
        return that;
    }
    DataSeries.prototype.map = function(pts, key, visitor) {
        var that = this;
        should.exist(pts, "Expected pts");
        should.exist(key, "Expected key");
        should(typeof visitor).equal("function");
        pts.length.should.above(0);
        visitor(null);
        for (var i = 0; i < pts.length; i++) {
            visitor(pts[i][key]);
        }
        return that;
    }
    DataSeries.prototype.min = function(pts, key) {
        var that = this;
        var result;
        that.map(pts, key, function(val) {
            result = result == null ? val : math.min(result, val);
        });
        return result;
    }
    DataSeries.prototype.diff = function(pts, key) {
        var that = this;
        var result = {};
        var prevVal;
        that.map(pts, key, function(val) {
            if (prevVal != null) {
                var diff = val - prevVal;
                result.min = result.min == null ? diff : math.min(result.min, diff);
                result.max = result.max == null ? diff : math.max(result.max, diff);
                result.sum = result.sum == null ? diff : result.sum + diff;
                result.sumAbs = math.abs(diff) + (result.sumAbs == null ? 0 : result.sumAbs);
            }
            prevVal = val;
        });
        result.avg = result.sum / pts.length;
        return result;
    }
    DataSeries.prototype.max = function(pts, key) {
        var that = this;
        var result;
        that.map(pts, key, function(val) {
            result = result == null ? val : math.max(result, val);
        });
        return result;
    }
    DataSeries.prototype.blur = function(pts, key) {
        var that = this;
        var start = that.start;
        var end = that.end;
        if (end <= 0) {
            end = pts.length + end;
        }
        should(end).within(1, pts.length);
        should(start).within(0, end - 1);
        var v0 = pts[pts.length - 1][key];
        var v1 = v0;
        var v2 = v1;
        var v3 = v2;
        var v4 = v3;
        var start3 = start3;
        for (var i = end; i-- > start;) {
            var pt = pts[i];
            v4 = v3;
            v3 = v2;
            v2 = v1;
            v1 = v0;
            v0 = pt[key];
            if (start === i || i === end - 1) {
                // do nothing
            } else if (3 < i && i < pts.length - 4) {
                pt[key] = (
                    pts[i - 4][key] +
                    8 * pts[i - 3][key] +
                    28 * pts[i - 2][key] +
                    56 * pts[i - 1][key] +
                    70 * v0 +
                    56 * v1 +
                    28 * v2 +
                    8 * v3 +
                    v4
                ) / 256;
            } else {
                var vm1 = 0 < i ? pts[i - 1][key] : v0;
                var vm2 = 1 < i ? pts[i - 2][key] : vm1;
                var vm3 = 2 < i ? pts[i - 3][key] : vm2;
                var vm4 = 3 < i ? pts[i - 4][key] : vm3;
                pt[key] = (
                    vm4 +
                    8 * vm3 +
                    28 * vm2 +
                    56 * vm1 +
                    70 * v0 +
                    56 * v1 +
                    28 * v2 +
                    8 * v3 +
                    v4
                ) / 256;
                that.logger.debug("blur pts i:", i,
                    "\t", vm4,
                    "\t", vm2,
                    "\t", vm2,
                    "\t", vm1,
                    "\t", v0,
                    "\t", v1,
                    "\t", v2,
                    "\t", v3,
                    "\t", v4,
                    "");
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
        nPlaces: 4,
        logLevel: "info"
    });
    var DataSeries = firepick.DataSeries;
    it("blur(pts, key) should blur key values", function() {
        var ds = new DataSeries();
        var pts = [];
        pts.push({
            a: 1,
            b: 1
        });
        pts.push({
            a: 1,
            b: 1
        });
        pts.push({
            a: 1,
            b: 1
        });
        pts.push({
            a: 1,
            b: 1
        });
        pts.push({
            a: -1,
            b: -1
        });
        pts.push({
            a: -1,
            b: -1
        });
        pts.push({
            a: -1,
            b: -1
        });
        pts.push({
            a: -1,
            b: -1
        });
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
        math.round(pts[0].b, 5).should.equal(1);
        math.round(pts[1].b, 5).should.equal(0.92969);
        math.round(pts[2].b, 5).should.equal(0.71094);
        math.round(pts[3].b, 5).should.equal(0.27344);
        math.round(pts[4].b, 5).should.equal(-0.27344);
        math.round(pts[5].b, 5).should.equal(-0.71094);
        math.round(pts[6].b, 5).should.equal(-0.92969);
        math.round(pts[7].b, 5).should.equal(-1);
    });
    it("blur(pts, key) should blur and round key values", function() {
        var ds = new DataSeries({
            round: true
        });
        var pts = [];
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });

        ds.blur(pts, "b");

        // key b should be blurred
        math.round(pts[0].b, 5).should.equal(-10);
        math.round(pts[1].b, 5).should.equal(-7);
        math.round(pts[2].b, 5).should.equal(-3);
        math.round(pts[3].b, 5).should.equal(3);
        math.round(pts[4].b, 5).should.equal(7);
        math.round(pts[5].b, 5).should.equal(10);
    });
    it("blur(pts, key) should blur more", function() {
        var ds = new DataSeries({
            round: true
        });
        var pts = [];
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });

        ds.blur(pts, "b");
        ds.blur(pts, "b");

        // key b should be blurred
        math.round(pts[0].b, 5).should.equal(-10);
        math.round(pts[1].b, 5).should.equal(-6);
        math.round(pts[2].b, 5).should.equal(-2);
        math.round(pts[3].b, 5).should.equal(2);
        math.round(pts[4].b, 5).should.equal(6);
        math.round(pts[5].b, 5).should.equal(10);
    });
    it("blur(pts, key) should blur sub-series", function() {
        var ds = new DataSeries({
            round: true,
            start: 1,
            end: -1
        });
        var pts = [];
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: -10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });
        pts.push({
            b: 10
        });

        ds.blur(pts, "b");

        // key b should be blurred
        var i = 0;
        math.round(pts[i++].b, 5).should.equal(-10);
        math.round(pts[i++].b, 5).should.equal(-10);
        math.round(pts[i++].b, 5).should.equal(-7);
        math.round(pts[i++].b, 5).should.equal(-3);
        math.round(pts[i++].b, 5).should.equal(3);
        math.round(pts[i++].b, 5).should.equal(7);
        math.round(pts[i++].b, 5).should.equal(10);
        math.round(pts[i++].b, 5).should.equal(10);
    });
    it("min(pts)/max(pts) should return minimum/maximum value", function() {
        var ds = new DataSeries();
        var pts = [];
        pts.push({
            a: 1,
            b: 3
        });
        pts.push({
            a: 1,
            b: -2
        });
        pts.push({
            a: 1,
            b: 1
        });
        pts.push({
            a: 1,
            b: 1.618
        });

        should(ds.min(pts, "b")).equal(-2);
        should(ds.max(pts, "b")).equal(3);

        // key a should not change
        var i = 0;
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
    });
    it("diff(pts) should return difference statistics", function() {
        var ds = new DataSeries();
        var pts = [];
        pts.push({
            a: 1,
            b: 3
        });
        pts.push({
            a: 1,
            b: -2
        }); // -5
        pts.push({
            a: 1,
            b: 1
        }); // 3
        pts.push({
            a: 1,
            b: 1.618
        }); // 0.618

        var diff = ds.diff(pts, "b");

        // key a should not change
        var i = 0;
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);
        pts[i++].a.should.equal(1);

        diff.min.should.equal(-5);
        diff.max.should.equal(3);
        diff.sum.should.equal(-1.382);
        diff.avg.should.equal(-1.382 / 4);
        diff.sumAbs.should.equal(8.618);

    });
    it("TESTTESTfadeIn(pts,key,value) should transition from value to at start of pts", function() {
        var pts = [];
        for (var i=0; i < 20; i++) {
            pts.push({a:100,b:100,c:100,d:100});
        }
        var e = 0.001;

        var ds= new DataSeries();
        ds.fadeIn(pts, "a", 0);
        var dsRound = new DataSeries({round:true,expFade:1});
        dsRound.fadeIn(pts, "b", -100, 8);
        var dsLap = new DataSeries({laplaceFade:2,expFade:1});
        dsLap.fadeIn(pts, "c", 0);
        var dsExp = new DataSeries({expFade:1});
        dsExp.fadeIn(pts, "d", 0);

        pts[0].a.should.equal(0);
        pts[1].a.should.within(33.652-e,33.652+e);
        pts[2].a.should.within(60.261-e,60.261+e);
        pts[3].a.should.within(80.591-e,80.591+e);
        pts[4].a.should.within(93.010-e,93.010+e);
        pts[5].a.should.equal(100);
        pts[6].a.should.equal(100);

        pts[0].b.should.equal(-100);
        pts[1].b.should.within(-76-e,-76+e);
        pts[2].b.should.within(-49-e,-49+e);
        pts[3].b.should.within(-18-e,-18+e);
        pts[4].b.should.within(18-e,18+e);
        pts[5].b.should.within(49-e,49+e);
        pts[6].b.should.within(76-e,76+e);
        pts[7].b.should.equal(100);
        pts[8].b.should.equal(100);

        pts[0].c.should.equal(0);
        pts[1].c.should.within(18.514-e,18.514+e);
        pts[2].c.should.within(38.976-e,38.976+e);
        pts[3].c.should.within(61.024-e,61.024+e);
        pts[4].c.should.within(81.486-e,81.486+e);
        pts[5].c.should.equal(100);
        pts[6].c.should.equal(100);

        pts[0].d.should.equal(0);
        pts[1].d.should.within(17.064-e,17.064+e);
        pts[2].d.should.within(37.907-e,37.907+e);
        pts[3].d.should.within(62.093-e,62.093+e);
        pts[4].d.should.within(82.935-e,82.935+e);
        pts[5].d.should.equal(100);
        pts[6].d.should.equal(100);

    });
})

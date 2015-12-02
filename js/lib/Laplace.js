var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("./Logger");
math = require("mathjs");

(function(firepick) {
    function Laplace(options) {
        var that = this;
        options = options || {};
        that.b = options.b || 1;
        that.u = options.u == null ? 0 : options.u;
        that.logger = options.logger || new Logger(options);
        return that;
    };

    ///////////////// INSTANCE ///////////////
    Laplace.prototype.cdf = function(tau) {
        var that = this;
        if (tau < that.u) {
            return 1/2 * math.exp((tau - that.u)/that.b);
        } else {
            return 1 - 1/2 * math.exp(-(tau - that.u)/that.b);
        }
    }

    ///////////////// CLASS //////////

    Logger.logger.debug("loaded firepick.Laplace");
    module.exports = firepick.Laplace = Laplace;
})(firepick || (firepick = {}));

(typeof describe === 'function') && describe("firepick.Laplace", function() {
    var logger = new Logger({
        nPlaces: 4,
        logLevel: "info"
    });
    var Laplace = firepick.Laplace;
    it("TESTTESTcdf(tau) should calculate cumulative distribution (b:1, u:0)", function() {
        var lap = new Laplace();
        var e = 0.00000001;
        lap.cdf(-10).should.within(0.0000227-e, 0.0000227+e);
        lap.cdf(0).should.equal(0.5);
        lap.cdf(10).should.within(0.9999773-e, 0.9999773+e);
    });
    it("TESTTESTcdf(tau) should calculate cumulative distribution (b:4, u:4)", function() {
        var lap = new Laplace({b:4,u:4});
        var e = 0.0000001;
        lap.cdf(-10).should.within(0.0150987-e, 0.0150987+e);
        lap.cdf(0).should.within(0.1839397-e,0.1839397+e);
        lap.cdf(10).should.within(0.8884349-e, 0.8884349+e);
    });
})

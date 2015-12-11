var should = require("should"),
    module = module || {},
    firepick = firepick || {};
Logger = require("../../www/js/shared/Logger.js");
Util = require("./Util");

(function(firepick) {
    var logger = new Logger();

    function Bernstein(n, options) {
        var that = this;
        options = options || {};
        should.exist(n);
        n.should.be.above(0);
        that.n = n;
        that.n2 = Math.ceil(n / 2);
        return that;
    };

    ///////////////// INSTANCE ///////////////
    Bernstein.prototype.coefficient = function(k, t) {
        var that = this;
        return Bernstein.coefficient(that.n, k, t);
    };

    ///////////////// CLASS //////////
    Bernstein.coefficient_nocheck = function(n, k, t) {
        var result = Util.choose(n, k);
        var t1 = (1 - t);
        for (var i = 0; i < n - k; i++) {
            result = result * t1;
        }
        for (var i = 0; i < k; i++) {
            result = result * t;
        }
        return result;
    };

    Bernstein.coefficient = function(n, k, t) {
        n.should.not.below(0);
        k.should.within(0, n);
        t.should.be.within(0, 1);
        return Bernstein.coefficient_nocheck(n, k, t);
    };

    logger.debug("loaded firepick.Bernstein");
    module.exports = firepick.Bernstein = Bernstein;
})(firepick || (firepick = {}));


(typeof describe === 'function') && describe("firepick.Bernstein", function() {
    var Bernstein = firepick.Bernstein;
    it("new Bernstein(5) should create a 5-degree Bernstein instance", function() {
        var b5 = new Bernstein(5);
        b5.should.have.properties({
            n: 5,
            n2: 3
        });
    });
    it("coefficient(k,t) should return Bernstein coefficient", function() {
        var b5 = new Bernstein(5);
        b5.coefficient(5, 0).should.equal(0);
        b5.coefficient(5, 0.5).should.equal(0.03125);
        b5.coefficient(5, 1).should.equal(1);
        b5.coefficient(0, 0).should.equal(1);
        b5.coefficient(0, 0.5).should.equal(0.03125);
        b5.coefficient(0, 1).should.equal(0);
        b5.coefficient(1, 0).should.equal(0);
        b5.coefficient(1, 0.5).should.equal(0.15625);
        b5.coefficient(1, 1).should.equal(0);
        b5.coefficient(2, 0).should.equal(0);
        b5.coefficient(2, 0.5).should.equal(0.3125);
        b5.coefficient(2, 1).should.equal(0);
        b5.coefficient(3, 0).should.equal(0);
        b5.coefficient(3, 0.5).should.equal(0.3125);
        b5.coefficient(3, 1).should.equal(0);
        b5.coefficient(4, 0).should.equal(0);
        b5.coefficient(4, 0.5).should.equal(0.15625);
        b5.coefficient(4, 1).should.equal(0);
    });
    it("Bernstein.coefficient(n,k,t) should return Bernstein coefficient", function() {
        Bernstein.coefficient(5, 5, 0).should.equal(0);
        Bernstein.coefficient(5, 5, 0.5).should.equal(0.03125);
        Bernstein.coefficient(5, 5, 1).should.equal(1);
        Bernstein.coefficient(5, 0, 0).should.equal(1);
        Bernstein.coefficient(5, 0, 0.5).should.equal(0.03125);
        Bernstein.coefficient(5, 0, 1).should.equal(0);
        Bernstein.coefficient(5, 1, 0).should.equal(0);
        Bernstein.coefficient(5, 1, 0.5).should.equal(0.15625);
        Bernstein.coefficient(5, 1, 1).should.equal(0);
        Bernstein.coefficient(5, 2, 0).should.equal(0);
        Bernstein.coefficient(5, 2, 0.5).should.equal(0.3125);
        Bernstein.coefficient(5, 2, 1).should.equal(0);
        Bernstein.coefficient(5, 3, 0).should.equal(0);
        Bernstein.coefficient(5, 3, 0.5).should.equal(0.3125);
        Bernstein.coefficient(5, 3, 1).should.equal(0);
        Bernstein.coefficient(5, 4, 0).should.equal(0);
        Bernstein.coefficient(5, 4, 0.5).should.equal(0.15625);
        Bernstein.coefficient(5, 4, 1).should.equal(0);
    });
})

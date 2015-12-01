var should = require("should"),
    module = module || {},
    firepick = firepick || {};
var Logger = require("./Logger");

(function(firepick) {
    var that = {};
    var id = 0;
    that.id = id++;
    var fibSequence = [0, 1];
    var pascal = {
        0: [1]
    };

    function Util(solver, options) {
        this.id = id++;
        return this;
    };

    ///////////////// INSTANCE ///////////////
    Util.prototype.thisId = function() {
        return this.id;
    }
    Util.prototype.thatId = function() {
        return that.id;
    }
    Util.prototype.id = function() {
        return id;
    }

    ///////////////// CLASS //////////
    Util.millis = function() {
        var hrt = process.hrtime();
        var ms = hrt[0] * 1000 + hrt[1] / 1000000;
        return ms;
    }
    Util.choose = function(n, k) {
        //k.should.equal(Math.round(k));
        if (pascal[n] == null) {
            n.should.be.above(0);
            k.should.not.be.above(n);
            n.should.equal(Math.round(n));
            for (var i = 1; i <= n; i++) {
                if (pascal[i] == null) {
                    var pascalPrev = pascal[i - 1];
                    var pascalNew = [1];
                    pascal[i] = pascalNew;
                    for (var j = 1; j < i; j++) {
                        pascalNew.push(pascalPrev[j - 1] + pascalPrev[j]);
                        pascalNew[pascalNew.length - 1].should.not.be.NaN;
                    }
                    pascalNew.push(1);
                }
            }
            pascal[n].length.should.equal(n + 1);
        }
        //console.log("n:",n," k:", k, " ", JSON.stringify(pascal[n]));
        var result = pascal[n][k];
        if (result == null) {
            n.should.not.be.below(0);
            k.should.not.be.below(0);
            k.should.not.be.above(n);
            n.should.be.Number;
            n.should.not.be.NaN;
            k.should.be.Number;
            k.should.not.be.NaN;
            n.should.equal(Math.round(n));
            k.should.equal(Math.round(k));
        }
        return result;
    };
    Util.id = function() {
        return id;
    };
    Util.roundN = function(value, places) {
        places = places || 0;
        var result;
        if (places > 0) {
            result = +(Math.round(value + "e+" + places) + "e-" + places);
        }
        if (isNaN(result)) {
            result = Math.round(value);
        }
        return result;
    };
    Util.fibonacci = function(n) {
        while (fibSequence.length <= n) {
            fibSequence.push(
                fibSequence[fibSequence.length - 2] +
                fibSequence[fibSequence.length - 1]);
        }
        if (n < fibSequence.length) {
            return fibSequence[n];
        }
    };
    Util.lagrange = function(x, pts) {
        should.exist(pts, "expected lagrange(x,[{x,y},...])");
        pts.length.should.be.equal(3); // for now...
        var p1 = pts[0];
        var p2 = pts[1];
        var p3 = pts[2];
        return p1.y * (x - p2.x) * (x - p3.x) / ((p1.x - p2.x) * (p1.x - p3.x)) + p2.y * (x - p1.x) * (x - p3.x) / ((p2.x - p1.x) * (p2.x - p3.x)) + p3.y * (x - p1.x) * (x - p2.x) / ((p3.x - p1.x) * (p3.x - p2.x));
    };
    Util.polyFit = function(pts) {
        should.exist(pts, "expected polyFit([{x,y},...])");
        pts.length.should.be.equal(3); // for now...
        var p1 = pts[0];
        var p2 = pts[1];
        var p3 = pts[2];
        var dx12 = p1.x - p2.x;
        var dx21 = -dx12;
        var dx13 = p1.x - p3.x;
        var dx31 = -dx13;
        var dx23 = p2.x - p3.x;
        var dx32 = -dx23;
        var dx1213 = dx12 * dx13;
        var dx2123 = dx21 * dx23;
        var dx3132 = dx31 * dx32;
        return [
            p1.y / ((dx12) * (dx13)) +
            p2.y / ((dx21) * (dx23)) +
            p3.y / ((dx31) * (dx32)),

            -p1.y * (p2.x + p3.x) / dx1213 - p2.y * (p1.x + p3.x) / dx2123 - p3.y * (p1.x + p2.x) / dx3132,

            p1.y * p2.x * p3.x / dx1213 + p2.y * p1.x * p3.x / dx2123 + p3.y * p1.x * p2.x / dx3132
        ];
    };
    Util.criticalPoints = function(pts) {
        should.exist(pts, "expected criticalPoints([{x,y},...])");
        pts.length.should.be.equal(3); // for now...
        var abc = Util.polyFit(pts);
        var x0 = -abc[1] / (2 * abc[0]); // -b/2a
        return [x0];
    };
    Util.sample = function(xMin, xMax, xStep, fx) {
        xMin.should.be.a.Number;
        xMax.should.be.a.Number;
        xMin.should.be.below(xMax);
        var xySum = 0;
        var ySum = 0;
        var n = 0;
        for (var x = xMin; x <= xMax; x += xStep) {
            var y = fx(x);
            xySum += x * y;
            ySum += y;
            n++;
        }
        return {
            yAvg: ySum / n,
            xAvg: xySum / ySum
        }
    }

    Logger.logger.debug("loaded firepick.Util");
    module.exports = firepick.Util = Util;
})(firepick || (firepick = {}));

(function(firepick) {
    function Caller(callee) {
        this.callee = callee;
        return this;
    };
    Caller.prototype.invoke = function(eThat, eThis) {
        should.equal(this.callee.thatId(), eThat);
        should.equal(this.callee.thisId(), eThis);
    };
    firepick.Caller = Caller;
})(firepick);

(typeof describe === 'function') && describe("firepick.Util", function() {
    it("should roundN(3.14159,2) to two places", function() {
        should(firepick.Util.roundN(3.14159, 2)).equal(3.14);
    });
    it("should roundN(3.14159) to zero places", function() {
        should(firepick.Util.roundN(3)).equal(3);
    });
    it("should roundN(1.3e-8,2) to zero", function() {
        should(firepick.Util.roundN(1.3e-8, 2)).equal(0);
    });
    it("should do this and that", function() {
        var util1 = new firepick.Util();
        var util2 = new firepick.Util();
        should.equal(util1.thatId(), 0);
        should.equal(util1.thisId(), 1);
        should.equal(util2.thatId(), 0);
        should.equal(util2.thisId(), 2);
        var caller1 = new firepick.Caller(util1);
        var caller2 = new firepick.Caller(util2);
        caller1.invoke(0, 1);
        caller2.invoke(0, 2);
    });
    var quadratic = function(x, a, b, c) {
        return a * x * x + b * x + c;
    };
    var fx = function(x) {
        return quadratic(x, 1, 2, 3);
    };
    var epsilon = 0.000001;
    it("lagrange(x,pts) should compute the Lagrange polynomial for 3 points", function() {
        var pts = [{
            x: 1,
            y: fx(1)
        }, {
            x: 3,
            y: fx(3)
        }, {
            x: 5,
            y: fx(5)
        }];
        should(firepick.Util.lagrange(1, pts)).be.within(6 - epsilon, 6 + epsilon);
        should(firepick.Util.lagrange(3, pts)).be.within(18 - epsilon, 18 + epsilon);
        should(firepick.Util.lagrange(2, pts)).be.within(11 - epsilon, 11 + epsilon);
    });
    it("polyFit(pts) should calculate the polynomial coefficients for 3 points", function() {
        var pts = [{
            x: 1,
            y: fx(1)
        }, {
            x: 3,
            y: fx(3)
        }, {
            x: 5,
            y: fx(5)
        }];
        var abc = firepick.Util.polyFit(pts);
        should(abc.length).equal(3);
        should(abc[0]).be.equal(1);
        should(abc[1]).be.equal(2);
        should(abc[2]).be.equal(3);
    });
    it("criticalPoints(pts) calculates critical points for a 3 data point polynomial", function() {
        var pts = [{
            x: 1,
            y: fx(1)
        }, {
            x: 3,
            y: fx(3)
        }, {
            x: 5,
            y: fx(5)
        }];
        var crit = firepick.Util.criticalPoints(pts);
        crit.should.be.within(-1 - epsilon, -1 + epsilon);
        firepick.Util.lagrange(crit + epsilon, pts).should.be.above(firepick.Util.lagrange(crit, pts));
        firepick.Util.lagrange(crit - epsilon, pts).should.be.above(firepick.Util.lagrange(crit, pts));
    });
    it("fibonacci(n) should return the nth Fibonacci number", function() {
        firepick.Util.fibonacci(0).should.be.equal(0);
        firepick.Util.fibonacci(1).should.be.equal(1);
        firepick.Util.fibonacci(2).should.be.equal(1);
        firepick.Util.fibonacci(3).should.be.equal(2);
        firepick.Util.fibonacci(4).should.be.equal(3);
        firepick.Util.fibonacci(5).should.be.equal(5);
        firepick.Util.fibonacci(6).should.be.equal(8);
        firepick.Util.fibonacci(7).should.be.equal(13);
    });
    it("choose(n,k) should return binomial coefficient", function() {
        Util.choose(4, 4).should.equal(1);
        Util.choose(0, 0).should.equal(1);
        Util.choose(1, 0).should.equal(1);
        Util.choose(1, 1).should.equal(1);
        Util.choose(2, 0).should.equal(1);
        Util.choose(2, 1).should.equal(2);
        Util.choose(2, 2).should.equal(1);
        Util.choose(3, 0).should.equal(1);
        Util.choose(3, 1).should.equal(3);
        Util.choose(3, 2).should.equal(3);
        Util.choose(3, 3).should.equal(1);
        Util.choose(4, 0).should.equal(1);
        Util.choose(4, 1).should.equal(4);
        Util.choose(4, 2).should.equal(6);
        Util.choose(4, 3).should.equal(4);
    });
    it("choose(n,k) should only accept valid arguments", function() {
        should.ok(function() {
            try {
                Util.choose(-1, 0)
            } catch (ex) {
                return ex;
            }
            return false;
        }());
        should.ok(function() {
            try {
                Util.choose(0, -1)
            } catch (ex) {
                return ex;
            }
            return false;
        }());
        should.ok(function() {
            try {
                Util.choose(5, 1.5);
            } catch (ex) {
                return ex;
            }
            return false;
        }());
    });
})

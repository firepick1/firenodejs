
var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");
var mathjs = require("mathjs");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Learn() {
        var that = this;

        return that;
    }

    Learn.prototype.process = function(inputs) {
        var that = this;
        var sum = 0;
        for (var i = 0; i < that.weights.length; i++) {
            sum += that.weights[i] * inputs[i];
        }
        return 1 / (1 + Math.exp(-sum - that.bias));
    }

    Learn.prototype.error = function(actual, expected) {
        var that = this;
        var diff = mathjs.subtract(expected, actual);
        var square = mathjs.dotMultiply(diff, diff);
        var sum = 0;
        for (var i = square.length; i-- > 0; ) {
            sum += square[i];
        }
        return sum/2;
    }
    Learn.prototype.randomGaussian = function(n=1, sigma=1, mu=0) {
        var that = this;
        var list = [];
        while (list.length < n) {
            do {
                var x1 = 2.0 * mathjs.random() - 1.0;
                var x2 = 2.0 * mathjs.random() - 1.0;
                var w = x1 * x1 + x2 * x2;
            } while ( w >= 1.0 );
            w = mathjs.sqrt( (-2.0 * mathjs.log( w ) ) / w );
            list.push(x1 * w * sigma + mu);
            list.length < n && list.push(x2 * w * sigma + mu);
        }
        return list;
    }

    module.exports = exports.Learn = Learn;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Learn", function() {
    var Learn = exports.Learn; // require("./Learn");
    it("TESTTESTerror(actual, expected) computes (norm(difference)^2 / 2) ", function() {
        var learn = new Learn();
        var expected = [1,2,3];
        learn.error(expected, expected).should.equal(0); // identity
        learn.error([2, 2, 3], expected).should.equal(0.5); // single value
        learn.error([2, 0, 6], expected).should.equal(7); // delta [1, -2, 3]
        learn.error(expected, [2, 0, 6]).should.equal(7); // commutative
    })
    it("TESTTESTderivative", function() {
        var fun = "a*x^2+b";
        var node = mathjs.parse(fun);
        var dfun = mathjs.derivative(fun,'x');
        dfun.toString().should.equal("2 * a * x + 0");
        dfun.eval({x:3, a:1.5}).should.equal(9);
    })
    it("TESTTESTrandomGaussian(n, sigma, mu) returns n random numbers with Gaussian distribution", function() {
        var learn = new Learn();
        var list = learn.randomGaussian(1000);
        mathjs.mean(list).should.approximately(0, 0.06);
        mathjs.std(list).should.approximately(1, 0.04);
        var list = learn.randomGaussian(1000, 2, 3);
        mathjs.mean(list).should.approximately(3, 0.1);
        mathjs.std(list).should.approximately(2, 0.08);
    })
})

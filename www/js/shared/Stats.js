var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Stats(options) {
        var that = this;

        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }
        if (options.fractionalDigits) {
            that.scale = 1;
            for (var i = 0; i < options.fractionalDigits; i++) {
                that.scale *= 10;
            }
        } else {
            that.scale = 1000;
        }

        return that;
    }
    Stats.prototype.calcProp = function(data, propName) {
        var that = this;
        var count = 0;
        var sum = 0;
        var minVal = null;
        var maxVal = null;
        for (var i = data.length; i-- > 0;) {
            var d = data[i];
            var value = d && d[propName];
            if (value != null) {
                (minVal == null || value < minVal) && (minVal = value);
                (maxVal == null || maxVal < value) && (maxVal = value);
                sum += value;
                count++;
            }
        }
        var result = {
            sum: JsonUtil.round(sum, that.scale),
            count: JsonUtil.round(count, that.scale),
            min: JsonUtil.round(minVal, that.scale),
            max: JsonUtil.round(maxVal, that.scale),
        };
        if (count != null && sum != null) {
            result.mean = JsonUtil.round(sum / count, that.scale);
            var sumSquaredError = 0;
            for (var i = data.length; i-- > 0;) {
                var d = data[i];
                var value = d && d[propName];
                if (value != null) {
                    var dValue = value - result.mean;
                    sumSquaredError += dValue * dValue;
                }
            }
            result.sd = JsonUtil.round(Math.sqrt(sumSquaredError / result.count), that.scale);
        }
        return result;
    }

    module.exports = exports.Stats = Stats;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Stats", function() {
    var Stats = exports.Stats; // require("./Stats");
    console.log(typeof Stats);
    var options = {
        verbose: true
    };
    it("calcProp(values, propName) should calculate statistics for given property", function() {
        var stats = new Stats();
        var data = [{
            temp: 100,
        }, {
            temp: 90,
        }, {
            temp: 91,
        }, {
            length: 55,
        }, {
            temp: 89,
        }];
        should.deepEqual(stats.calcProp(data, "temp"), {
            count: 4,
            max: 100,
            min: 89,
            sd: 4.387,
            mean: 92.5,
            sum: 370,
        });
    })
})

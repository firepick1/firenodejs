var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Neuron(weights, bias) {
        var that = this;

        that.weights = weights;
        that.bias = bias;

        return that;
    }

    Neuron.prototype.process = function(inputs) {
        var that = this;
        var sum = 0;
        for (var i = 0; i < that.weights.length; i++) {
            sum += that.weights[i] * inputs[i];
        }
        return 1 / (1 + Math.exp(-sum - that.bias));
    }

    module.exports = exports.Neuron = Neuron;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Neuron", function() {
    var Neuron = exports.Neuron; // require("./Neuron");
    console.log(typeof Neuron);
    var options = {
        verbose: true
    };

    function testNeuron(neuron, input, expected) {
        var result = neuron.process(input);
        console.log("\t", JSON.stringify(input), ":", result);
        if (expected) {
            result.should.not.below(.5);
        } else {
            result.should.below(.5);
        }
        return result;
    }
    it("TESTTEST sigmoid neuron has weights and bias", function() {
        var neuron = new Neuron([1, 2], 3);
        neuron.should.properties({
            weights: [1, 2],
            bias: 3,
        });
    });
    it("sigmoid neuron should implement NAND", function() {
        var nand = new Neuron([-2, -2], 2);
        testNeuron(nand, [0, 0], true);
        testNeuron(nand, [1, 0], true);
        testNeuron(nand, [0, 1], true);
        testNeuron(nand, [1, 1], false);
        testNeuron(nand, [.499, .499], true);
        testNeuron(nand, [.501, .501], false);
    });
    it("sigmoid neuron should implement OR", function() {
        var or = new Neuron([2, 2], -2);
        testNeuron(or, [0, 0], false);
        testNeuron(or, [1, 0], true);
        testNeuron(or, [0, 1], true);
        testNeuron(or, [1, 1], true);
        testNeuron(or, [.499, .499], false);
        testNeuron(or, [.499, .501], true);
        testNeuron(or, [.501, .499], true);
        testNeuron(or, [.501, .501], true);
    });
    it("sigmoid neuron should implement ge", function() {
        var ge = new Neuron([1, -1], 0);
        testNeuron(ge, [0, 0], true);
        testNeuron(ge, [1, 0], true);
        testNeuron(ge, [0, 1], false);
        testNeuron(ge, [1, 1], true);
        testNeuron(ge, [.499, .501], false);
        testNeuron(ge, [.499, .499], true);
        testNeuron(ge, [.501, .499], true);
        testNeuron(ge, [.501, .501], true);
        testNeuron(ge, [.501, .501], true);
        testNeuron(ge, [.001, .002], false);
        testNeuron(ge, [.002, .001], true);
    });

})

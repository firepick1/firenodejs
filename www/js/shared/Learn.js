var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");
var mathjs = require("mathjs");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Learn(model) {
        var that = this;
        return that;
    }

    Learn.weight = (layer, row, col) => {
        return col == null ?
            "w" + layer + "b" + row :               // offset
            "w" + layer + "r" + row + "c" + col;    // matrix weight
    }

    ///////////// Model
    Learn.Model = function() {
        var that = this;
        return that;
    }
    Learn.Model.prototype.cost = function(inputs, options={}) {
        var that = this;
        var cost = "";
        var exprs = that.expressions(inputs);
        var metric = options.metric || "quadratic"; 
        if (metric === "quadratic") {
            for (var iOut = 0; iOut < exprs.length; iOut++) {
                cost.length && (cost += "+");
                cost += "(" + exprs[iOut] + "-y" + iOut + ")^2"
            }
            cost = "(" + cost + ")/2"; // 2 disappears with derivative
        } else {
            throw new Error("Unsupported cost metric:" + metric);
        }
        return cost; 
    }

    ///////////// Sequential
    Learn.Sequential = function(options={}) {
        var that = this;
        that.super = Object.getPrototypeOf(Object.getPrototypeOf(that)); // TODO: use ECMAScript 2015 super 
        that.super.constructor.call(that, options);

        that.layers = [];
        return that;
    }
    Learn.Sequential.prototype = Object.create(Learn.Model.prototype);
    Learn.Sequential.prototype.add = function(layer) {
        var that = this;
        var lastLayer = that.layers.length ? that.layers[that.layers.length-1] : null;
        if (lastLayer) {
            if (lastLayer.nOut != layer.nIn) {
                throw new Error("layer inputs:" + layer.nIn
                    + " does not match previous layer outputs:" + lastLayer.nOut);
            }
        }
        that.layers.push(layer);
    }
    Learn.Sequential.prototype.expressions = function(inputs) {
        var that = this;
        var layers = that.layers;
        var inOut = inputs;
        for (var iLayer = 0; iLayer < layers.length; iLayer++) {
            inOut = layers[iLayer].expressions(inOut);
        }
        return inOut;
    }
    Learn.Sequential.prototype.activate = function(inputs) {
        var that = this;
        if (that.activations == null) {
            throw new Error("initialize() and compile() are prerequisites for activate()");
        }
        return that.activations.map( (fun) => fun.eval(scope) );
    }

    //////////// Layer
    Learn.Layer = function(nIn=2, nOut=2, id=0, options={}) {
        var that = this;
        that.id = id;
        that.nIn = nIn;
        that.nOut = nOut;
        that.activation = options.activation || "identity";
        that.weights = {};
        return that;
    }
    Learn.Layer.prototype.initialize = function(options={}) {
        var that = this;

        var weights = options.weights || {};
        var xavier = 2 / (that.nIn + that.nOut);
        var wInit = Learn.randomGaussian((that.nIn + 1)*that.nOut, xavier);
        var iInit = 0;
        for (var r = 0; r < that.nOut; r++) {
            var key = Learn.weight(that.id, r);
            weights[key] == null && (weights[key] = wInit[iInit++]);
            for (var c = 0; c < that.nIn; c++) {
                var key = Learn.weight(that.id, r, c); 
                weights[key] == null && (weights[key] = wInit[iInit++]);
            }
        }

        return that.weights = weights;
    };
    Learn.Layer.prototype.expressions = function(inputs) {
        var that = this;
        var outputs = [];
        if (typeof inputs === "function") {
            inputs = inputs();
        }
        if (!inputs instanceof Array) {
            throw new Error("Expected input expression vector");
        }
        if (inputs.length !== that.nIn) { // 
            throw new Error("Layer[" + that.id + "] inputs expected:" + that.nIn + " actual:" + inputs.length);
        }
        for (var r = 0; r < that.nOut; r++) {
            var dot = Learn.weight(that.id, r);
            for (var c = 0; c < that.nIn; c++) {
                dot.length && (dot += "+");
                if (inputs[c].indexOf("1/(1+exp(-(") === 0) { // logistic optimization
                    dot += Learn.weight(that.id, r, c) + inputs[c].substring(1);
                } else {
                    dot += Learn.weight(that.id, r, c) + "*" + inputs[c];
                }
            }
            outputs.push(dot);
        }
        if (that.activation === "logistic") {
            outputs = outputs.map((expr) => "1/(1+exp(-(" + expr + ")))");
        } else if (that.activation === "softmax") {
            outputs = outputs.map((expr) => "exp(" + expr + ")");
            var denominator = "(" + outputs.join("+") + ")";
            outputs = outputs.map((expr) => expr + "/" + denominator);
        } else if (that.activation === "identity") {
            // done
        } else {
            throw new Error("Unknown activation:" + that.activation);
        }
        return outputs; // output activation expressions
    }
    Learn.Layer.prototype.compile = function(inputs, options={}) {
        var that = this;
        var funs = [];
        var exprs = that.expressions(inputs);
        return that.activations = exprs.map( (expr) => mathjs.compile(expr));
    }
    Learn.Layer.prototype.activate = function(scope) {
        var that = this;
        if (that.activations == null) {
            throw new Error("initialize() and compile() are prerequisites for activate()");
        }
        return that.activations.map( (fun) => fun.eval(scope) );
    }

    Learn.prototype.softmax = function(v) {
        var sum = 0;
        var result = [];
        for (var iv = 0; iv < v.length; iv++) {
            var ev = mathjs.exp(v[iv]);
            sum += ev;
            result.push(ev);
        }
        for (var iv = 0; iv < v.length; iv++) {
            result[iv] /= sum;
        }
        return result;
    }
    Learn.randomGaussian = function(n = 1, sigma = 1, mu = 0) {
        var that = this;
        var list = [];
        while (list.length < n) {
            do {
                var x1 = 2.0 * mathjs.random() - 1.0;
                var x2 = 2.0 * mathjs.random() - 1.0;
                var w = x1 * x1 + x2 * x2;
            } while (w >= 1.0);
            w = mathjs.sqrt((-2.0 * mathjs.log(w)) / w);
            list.push(x1 * w * sigma + mu);
            list.length < n && list.push(x2 * w * sigma + mu);
        }
        return list;
    }

    ///////////////// class ////////////////////
    Learn.simplifyTree = function(root, options = {}) { // TODO
        const precedence = {
            "unaryMinus": 2,
            "subtract": 4,
            "add": 4,
        }
        var simplify = function(node, path, parent) {
            if (0) {
                node.isConstantNode && console.log(node.type, node.value, path);
                node.isFunctionNode && console.log(node.type, node.fn.name, path);
                node.isOperatorNode && console.log(node.type, node.op, node.fn, node.args.length, path);
                node.isParenthesisNode && console.log(node.type, path);
                node.isSymbolNode && console.log(node.type, node.name);
            }
            if (node.isOperatorNode) {
                if (node.fn === "add") {
                    if (node.args[0].isConstantNode && node.args[0].value === "0") {
                        var arg1 = mathjs.parse(node.args[1].toString()); // cloneDeep() doesn't work
                        return arg1;
                    } else if (node.args[1].isConstantNode && node.args[1].value === "0") {
                        var arg0 = mathjs.parse(node.args[0].toString()); // cloneDeep() doesn't work
                        return arg0;
                    }
                } else if (node.fn === "subtract") {
                    if (node.args[0].isConstantNode && node.args[0].value === "0") {
                        var arg1 = mathjs.parse(node.args[1].toString()); // cloneDeep() doesn't work
                        return new mathjs.expression.node.OperatorNode(node.op, "unaryMinus", [arg1]);
                    }
                } else if (node.fn === "unaryMinus") {
                    if (node.args[0].isOperatorNode && node.fn === "unaryMinus") {
                        return node.args[0].args[0];
                    }
                    if (node.args[0].isParenthesisNode) {
                        var content = node.args[0].content;
                        if (content.isOperatorNode) {
                            if (content.fn === "unaryMinus") {
                                return content.args[0];
                            }
                            return new mathjs.expression.node.OperatorNode(node.op, "unaryMinus", [content]);
                        }
                    }
                }
            } else if (node.isParenthesisNode) {
                if (parent == null) {
                    return node.content;
                } else if (node.content.isOperatorNode && node.content.fn === "unaryMinus") {
                    if (parent.isOperatorNode && precedence[parent.fn] <= precedence[node.content.fn]) {
                        //return node.content;
                    }
                }
            }
            return node;
        }
        var iterations = options.iterations || 1;
        while (iterations-- > 0) {
            //console.log("=======iterations", iterations+1);
            root = root.transform(simplify);
            root = mathjs.parse(root.toString()); // clean up pointers
        }
        return root;
    }

    module.exports = exports.Learn = Learn;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Learn", function() {
    var Learn = exports.Learn; // require("./Learn");
    it("randomGaussian(n, sigma, mu) returns n random numbers with Gaussian distribution", function() {
        var list = Learn.randomGaussian(1000);
        mathjs.mean(list).should.approximately(0, 0.10);
        mathjs.std(list).should.approximately(1, 0.1);
        var list = Learn.randomGaussian(1000, 2, 3);
        mathjs.mean(list).should.approximately(3, 0.15);
        mathjs.std(list).should.approximately(2, 0.15);
    })
    it("softmax(v) returns softmax of vector", function() {
        var learn = new Learn();
        var v1 = [-1, -0.5, -0.1, 0, 0.1, 0.5, 1];
        var v10 = mathjs.multiply(10, v1);
        var smv1 = learn.softmax(v1);
        var smv10 = learn.softmax(v10);
        var e = 0.01;
        smv10[0].should.approximately(0, e);
        smv10[1].should.approximately(0, e);
        smv10[6].should.approximately(1, e);
        var e = 0.05;
        smv1[0].should.approximately(0.0, e);
        smv1[1].should.approximately(0.1, e);
        smv1[6].should.approximately(0.3, e);
    })
    it("ESTTESTsimplifyTree(root) simplifies mathjs parse tree", function() {
        var assertSimple = function(expr, expected, iterations = 1) {
            Learn.simplifyTree(mathjs.parse(expr), {
                    iterations: iterations
                })
                .toString().should.equal(expected)
        };
        assertSimple("0-x", "-x");
        assertSimple("0-2*x*y", "-(2 * x * y)");
        assertSimple("exp(-(2*x*y))", "exp(-(2 * x * y))");
        assertSimple("--x", "x");
        assertSimple("(-sin(x))", "-sin(x)");
        assertSimple("-(-sin(x))", "sin(x)");
        assertSimple("(0-exp(-(2*x*y)))", "0 - exp(-(2 * x * y))", 1);
        assertSimple("0 - exp(-(2 * x * y))", "-exp(-(2 * x * y))", 1);
        assertSimple("(0-exp(-(2*x*y)))", "-exp(-(2 * x * y))", 2);
    })
    it("TESTTESTLayer(nIn, nOut, id, options) creates neural network layer", function() {
        var nIn = 3;
        var nOut = 2;
        // create layer with default identity activation typically used for regression output
        var defaultActivation = new Learn.Layer(nIn, nOut, 0);
        var identity = new Learn.Layer(nIn, nOut, 0, {
            activation: "identity"
        });
        should.deepEqual(defaultActivation, identity);
        var vsOut = identity.expressions(["x0", "x1", "x2"]);
        should.deepEqual(vsOut, [
            "w0b0+w0r0c0*x0+w0r0c1*x1+w0r0c2*x2",
            "w0b1+w0r1c0*x0+w0r1c1*x1+w0r1c2*x2",
        ]);

        // create layer with logistic sigmoid activation typically used for hidden layer(s)
        var nIn = 2;
        var nOut = 3;
        var hidden = new Learn.Layer(nIn, nOut, 1, {
            activation: "logistic"
        });
        var vsHidden = hidden.expressions(["x0", "x1"]);
        should.deepEqual(vsHidden, [
            "1/(1+exp(-(w1b0+w1r0c0*x0+w1r0c1*x1)))",
            "1/(1+exp(-(w1b1+w1r1c0*x0+w1r1c1*x1)))",
            "1/(1+exp(-(w1b2+w1r2c0*x0+w1r2c1*x1)))",
        ]);

        // create layer with softmax activation typically used for categorization output
        var nIn = 2;
        var nOut = 2;
        var softmax = new Learn.Layer(nIn, nOut, 1, {
            activation: "softmax"
        });
        var vsSoftmax = softmax.expressions(()=>["x0", "x1"]); // functional input resolution
        should.deepEqual(vsSoftmax, [
            "exp(w1b0+w1r0c0*x0+w1r0c1*x1)/(exp(w1b0+w1r0c0*x0+w1r0c1*x1)+exp(w1b1+w1r1c0*x0+w1r1c1*x1))",
            "exp(w1b1+w1r1c0*x0+w1r1c1*x1)/(exp(w1b0+w1r0c0*x0+w1r0c1*x1)+exp(w1b1+w1r1c0*x0+w1r1c1*x1))",
        ]);

        // layer output expressions can be chained
        var vsOut = identity.expressions(vsHidden);
        should.deepEqual(vsOut, [
            "w0b0+w0r0c0/(1+exp(-(w1b0+w1r0c0*x0+w1r0c1*x1)))+w0r0c1/(1+exp(-(w1b1+w1r1c0*x0+w1r1c1*x1)))+w0r0c2/(1+exp(-(w1b2+w1r2c0*x0+w1r2c1*x1)))",
            "w0b1+w0r1c0/(1+exp(-(w1b0+w1r0c0*x0+w1r0c1*x1)))+w0r1c1/(1+exp(-(w1b1+w1r1c0*x0+w1r1c1*x1)))+w0r1c2/(1+exp(-(w1b2+w1r2c0*x0+w1r2c1*x1)))",
        ]);
    })
    it("TESTTESTLayer.initialize(options) initializes layer weights", function() {
        // create layer with logistic sigmoid activation typically used for hidden layer(s)
        var nIn = 2;
        var nOut = 3;
        var hidden = new Learn.Layer(nIn, nOut, 5, {
            activation: "logistic"
        });

        // default initialization is with random gaussian distribution 
        // having xavier variance and 0 mean
        var weights = hidden.initialize();
        should.equal(weights, hidden.weights);
        var wkeys = Object.keys(weights).sort();
        should.deepEqual(wkeys, [
            "w5b0",
            "w5b1",
            "w5b2",
            "w5r0c0",
            "w5r0c1",
            "w5r1c0",
            "w5r1c1",
            "w5r2c0",
            "w5r2c1",
        ]);
        var variance = 2 / (nIn+nOut);
        var err = 4 * variance;
        var w = [];
        for (var iw = 0; iw < wkeys.length; iw++) {
            w.push(weights[wkeys[iw]]);
        }
        for (var iw = 0; iw < wkeys.length-1; iw++) {
            w[iw].should.not.equal(w[iw+1]);
        }
        mathjs.var(w).should.below(variance);
        mathjs.var(w).should.above(0);

        // weights can be copied
        var hidden2 = new Learn.Layer(nIn, nOut, 5, {
            activation: "logistic"
        });
        var weights2 = hidden2.initialize({weights:weights});
        should.deepEqual(hidden2, hidden);

    })
    it("TESTTESTLayer.compile(inputs, options) compiles the activation functions", function() {
        var layer = new Learn.Layer(2, 2, 1);
        var scope = {
            x0: 5,
            x1: 7,
            w1b0: 0.1,
            w1b1: 0.2,
            w1b2: 0.3,
            w1r0c0: 1,
            w1r0c1: 2,
            w1r1c0: 3,
            w1r1c1: 4,
        };
        layer.initialize({weights: scope});
        var activations = layer.compile(["x0","x1"]);
        var y0 = activations[0].eval(scope).should.equal(19+0.1);
        var y1 = activations[1].eval(scope).should.equal(43+0.2);
    })
    it("TESTTESTLayer.activate(scope) computes feed-forward activation", function() {
        var layer = new Learn.Layer(2, 2, 1);
        var scope = {
            x0: 5,
            x1: 7,
            w1b0: 0.1,
            w1b1: 0.2,
            w1b2: 0.3,
            w1r0c0: 1,
            w1r0c1: 2,
            w1r1c0: 3,
            w1r1c1: 4,
        };
        var mockOptions = {weights: scope};
        layer.initialize(mockOptions);
        layer.compile(["x0","x1"]);

        var outputs = layer.activate(scope);
        should.deepEqual(outputs, [19.1, 43.2]);
    })
    it("TESTTESTSequential() creates a model aggregated as a sequence of layers", function() {
        var model = new Learn.Sequential();
        var hidden = new Learn.Layer(2, 2, 0, {
            activation: "logistic"
        });
        var output = new Learn.Layer(2, 2, 1, {
            activation: "identity"
        });
        model.add(hidden);
        model.add(output);

        // expressions are aggregated
        var exprs = model.expressions(["x0","x1"]);
        should.deepEqual(exprs, [
            "w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
            "w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
        ]);

        // cost is aggregated
        var cost = model.cost(["x0","x1"]);
        should.deepEqual(cost, 
            "((w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-y0)^2" +
            "+(w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-y1)^2)/2"
        );

        //console.log((mathjs.derivative(mathjs.parse(cost),"w0r1c0")).toString());
    })
})

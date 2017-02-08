var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");
var mathjs = require("mathjs");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Learn(network) {
        var that = this;
        return that;
    }

    Learn.shuffle = function(a) {
        for (var i = a.length; i--;) {
            var j = mathjs.floor(mathjs.random() * (i + 1));
            var tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }
    Learn.weight = (layer, row, col) => {
        return col == null ?
            "w" + layer + "b" + row : // offset
            "w" + layer + "r" + row + "c" + col; // matrix weight
    }
    //////////////////// Optimizer
    Learn.Optimizer = function() {
        var that = this;
        that.findex = 0;
        that.emap = {};
        that.memo = {};
        return that;
    }
    Learn.Optimizer.prototype.optimize = function(expr) {
        var that = this;
        if (expr instanceof Array) {
            return expr.map((e) => that.optimize(e));
        }
        var root = mathjs.parse(expr);
        var eroot = root.toString();
        var fname = that.emap[eroot];
        if (!fname) {
            var ememo = eroot;
            root.traverse((node, path, parent) => {
                if (node.isParenthesisNode && parent) {
                    var e = node.toString();
                    !that.emap[e] && that.optimize(e);
                }
            });
            for (var i = 0; i < that.findex; i++) { // apply accumulated optimizations
                var fsub = "f" + i;
                var subExpr = that.memo[fsub];
                if (ememo.indexOf(subExpr) >= 0) {
                    ememo = ememo.split(subExpr).join("("+fsub+")"); // eliminate sub-expressions
                }
            }
            fname = "f" + that.findex++;
            that.memo[fname] = ememo;
            that.emap[eroot] = fname;
        }

        return fname;
    }
    Learn.Optimizer.prototype.compile = function() {
        var that = this;
        that.funs = {};
        for (var i = 0; i < that.findex; i++) {
            var fname = "f" + i;
            that.funs[fname] = mathjs.compile(that.memo[fname]);
        }
        return that.funs;
    }
    Learn.Optimizer.prototype.eval = function(scope) {
        var that = this;
        var result = [];
        for (var i = 0; i < that.findex; i++) {
            var fname = "f" + i;
            scope[fname] = that.funs[fname].eval(scope);
        }
        return scope;
    }

    ///////////// Network
    Learn.Network = function() {
        var that = this;
        that.layers = [];
        return that;
    }
    Learn.Network.prototype.initialize = function(weights = {}, options = {}) {
        var that = this;
        var layers = that.layers;
        for (var iLayer = 0; iLayer < layers.length; iLayer++) {
            layers[iLayer].initialize(weights, options);
        }
        return that.weights = weights;
    }
    Learn.Network.prototype.costExpr = function(exprIn, options = {}) {
        var that = this;
        var costExpr = "";
        var exprs = that.expressions(exprIn);
        var metric = options.metric || "quadratic";
        if (metric === "quadratic") {
            for (var iOut = 0; iOut < exprs.length; iOut++) {
                costExpr.length && (costExpr += "+");
                costExpr += "(" + exprs[iOut] + "-yt" + iOut + ")^2"
            }
            costExpr = "(" + costExpr + ")/2"; // 2 disappears with derivative
        } else {
            throw new Error("Unsupported cost metric:" + metric);
        }
        return costExpr;
    }
    Learn.Network.prototype.costGradientExpr = function(exprIn, options = {}) {
        var that = this;
        if (that.weights == null) {
            throw new Error("initialize() must be called before costGradientExpr()");
        }
        var costExpr = that.costFunExpr = that.costExpr(exprIn);
        var weights = that.weights;
        var keys = Object.keys(weights).sort();
        var gradExpr = {};
        for (var iw = 0; iw < keys.length; iw++) {
            var weight = keys[iw];
            gradExpr[weight] = mathjs.derivative(costExpr, weight).toString();
        }
        that.keys = keys;
        return that.gradExpr = gradExpr;
    }
    Learn.Network.prototype.compile = function(exprIn, options = {}) {
        var that = this;
        that.optActivate = new Learn.Optimizer();
        that.optPropagate = new Learn.Optimizer();
        that.memo = {
            outputs: null,
            cost: null,
            gradient:{},
        };
        var expr = that.expressions(exprIn);
        that.memo.outputs = that.optActivate.optimize(expr);
        that.optActivate.compile();
        that.gradExpr = that.gradExpr || that.costGradientExpr(exprIn, options);
        that.gradFun = {};
        for (var iKey = 0; iKey < that.keys.length; iKey++) {
            var key = that.keys[iKey];
            var partial = that.gradExpr[key];
            that.gradFun[key] = mathjs.compile(partial);
            that.memo.gradient[key] = that.optPropagate.optimize(partial);
        }
        that.costFun = mathjs.compile(that.costFunExpr);
        that.memo.cost = that.optPropagate.optimize(that.costFunExpr);
        that.optPropagate.compile();
        return that.activations = expr.map((expr) => mathjs.compile(expr));
    }
    Learn.Network.prototype.activate = function(inputs) {
        var that = this;
        if (that.activations == null) {
            throw new Error("initialize() and compile() are prerequisites for activate()");
        }
        inputs.map((x, i) => that.weights["x" + i] = x);
        that.optActivate.eval(that.weights);
        return that.memo.outputs.map((f,i) => that.weights["y"+i] = that.weights[f]);
    }
    Learn.Network.prototype.costGradient = function(target) {
        var that = this;
        if (that.weights.x0 == null) {
            throw new Error("activate() must be called before costGradient()");
        }
        target.map((y, i) => that.weights["yt" + i] = y);
        var grad = {};
        for (var iKey = 0; iKey < that.keys.length; iKey++) {
            var key = that.keys[iKey];
            grad[key] = that.gradFun[key].eval(that.weights);
        }
        return grad;
    }
    Learn.Network.prototype.cost = function(target) {
        var that = this;
        if (that.costFun == null) {
            throw new Error("activate() must be called before cost()");
        }
        target.map((y, i) => that.weights["yt" + i] = y);
        //that.memo.cost = that.opt.optimize(that.costFunExpr);
        return that.costFun.eval(that.weights);
    }
    Learn.Network.prototype.propagate = function(learningRate, target) {
        var that = this;
        var gradC = that.costGradient(target);
        that.keys.map((key) => that.weights[key] -= learningRate * gradC[key])
        return that;
    }

    ///////////// Sequential
    Learn.Sequential = function(layers = [], options = {}) {
        var that = this;
        that.super = Object.getPrototypeOf(Object.getPrototypeOf(that)); // TODO: use ECMAScript 2015 super 
        that.super.constructor.call(that, options);
        layers.map((layer) => that.add(layer));

        return that;
    }
    Learn.Sequential.prototype = Object.create(Learn.Network.prototype);
    Learn.Sequential.prototype.add = function(layer, options = {}) {
        var that = this;
        var idBase = options.idBase || 0;
        var lastLayer = that.layers.length ? that.layers[that.layers.length - 1] : null;
        if (lastLayer) {
            if (lastLayer.nOut != layer.nIn) {
                throw new Error("layer inputs:" + layer.nIn +
                    " does not match previous layer outputs:" + lastLayer.nOut);
            }
        }
        layer.id = idBase + that.layers.length;
        !that.layers[0] && (that.exprIn = Array(layer.nIn).fill().map((e, i) => "x" + i));
        that.layers.push(layer);
        return layer;
    }
    Learn.Sequential.prototype.expressions = function(exprIn) {
        var that = this;
        var layers = that.layers;
        var inOut = exprIn || that.exprIn;
        for (var iLayer = 0; iLayer < layers.length; iLayer++) {
            inOut = layers[iLayer].expressions(inOut);
        }
        return inOut;
    }

    //////////// Layer
    Learn.Layer = function(nIn = 2, nOut = 2, options = {}) {
        var that = this;
        that.id = options.id || 0;
        that.nIn = nIn;
        that.nOut = nOut;
        that.activation = options.activation || "identity";
        that.weights = {};
        return that;
    }
    Learn.Layer.prototype.initialize = function(weights = {}, options = {}) {
        var that = this;
        var xavier = 2 / (that.nIn + that.nOut);
        var wInit = Learn.randomGaussian((that.nIn + 1) * that.nOut, xavier);
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
    Learn.Layer.prototype.expressions = function(exprIn) {
        var that = this;
        var outputs = [];
        if (typeof exprIn === "function") {
            exprIn = exprIn();
        }
        if (!exprIn instanceof Array) {
            throw new Error("Expected input expression vector");
        }
        if (exprIn.length !== that.nIn) { // 
            throw new Error("Layer[" + that.id + "] inputs expected:" + that.nIn + " actual:" + exprIn.length);
        }
        for (var r = 0; r < that.nOut; r++) {
            var dot = Learn.weight(that.id, r);
            for (var c = 0; c < that.nIn; c++) {
                dot.length && (dot += "+");
                if (exprIn[c].indexOf("1/(1+exp(-(") === 0) { // logistic optimization
                    dot += Learn.weight(that.id, r, c) + exprIn[c].substring(1);
                } else {
                    dot += Learn.weight(that.id, r, c) + "*" + exprIn[c];
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
    Learn.Layer.prototype.compile = function(exprIn, options = {}) {
        var that = this;
        var funs = [];
        var exprs = that.expressions(exprIn);
        return that.activations = exprs.map((expr) => mathjs.compile(expr));
    }
    Learn.Layer.prototype.activate = function(scope) {
        var that = this;
        if (that.activations == null) {
            throw new Error("initialize() and compile() are prerequisites for activate()");
        }
        return that.activations.map((fun) => fun.eval(scope));
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
    var logistic_opts = {
        activation: "logistic"
    };
    var identity_opts = {
        activation: "identity",
        id: 1,
    };

    function assertRandom(weights, variance) {
        var wkeys = Object.keys(weights);
        var w = [];
        for (var iw = 0; iw < wkeys.length; iw++) {
            w.push(weights[wkeys[iw]]);
        }
        w = w.sort();
        for (var iw = 0; iw < wkeys.length - 1; iw++) {
            w[iw].should.not.equal(w[iw + 1]);
            w[iw].should.not.equal(0);
            (typeof w[iw]).should.equal("number");
        }
        mathjs.var(w).should.below(variance);
        mathjs.var(w).should.above(0);
    }
    it("TESTTESTrandomGaussian(n, sigma, mu) returns n random numbers with Gaussian distribution", function() {
        var list = Learn.randomGaussian(1000);
        mathjs.mean(list).should.approximately(0, 0.10);
        mathjs.std(list).should.approximately(1, 0.1);
        var list = Learn.randomGaussian(1000, 2, 3);
        mathjs.mean(list).should.approximately(3, 0.21);
        mathjs.std(list).should.approximately(2, 0.15);
    })
    it("TESTTESTsoftmax(v) returns softmax of vector", function() {
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
        var defaultActivation = new Learn.Layer(nIn, nOut);
        defaultActivation.activation.should.equal("identity");
        var vsOut = defaultActivation.expressions(["x0", "x1", "x2"]);
        should.deepEqual(vsOut, [
            "w0b0+w0r0c0*x0+w0r0c1*x1+w0r0c2*x2",
            "w0b1+w0r1c0*x0+w0r1c1*x1+w0r1c2*x2",
        ]);

        // create layer with logistic sigmoid activation typically used for hidden layer(s)
        var nIn = 2;
        var nOut = 3;
        var hidden = new Learn.Layer(nIn, nOut, logistic_opts);
        var vsHidden = hidden.expressions(["x0", "x1"]);
        should.deepEqual(vsHidden, [
            "1/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))",
            "1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
            "1/(1+exp(-(w0b2+w0r2c0*x0+w0r2c1*x1)))",
        ]);

        // create layer with softmax activation typically used for categorization output
        var nIn = 2;
        var nOut = 2;
        var softmax = new Learn.Layer(nIn, nOut, {
            activation: "softmax",
            id: 1,
        });
        var vsSoftmax = softmax.expressions(["x0", "x1"]); // functional input resolution
        should.deepEqual(vsSoftmax, [
            "exp(w1b0+w1r0c0*x0+w1r0c1*x1)/(exp(w1b0+w1r0c0*x0+w1r0c1*x1)+exp(w1b1+w1r1c0*x0+w1r1c1*x1))",
            "exp(w1b1+w1r1c0*x0+w1r1c1*x1)/(exp(w1b0+w1r0c0*x0+w1r0c1*x1)+exp(w1b1+w1r1c0*x0+w1r1c1*x1))",
        ]);

        // layer output expressions can be chained
        var identity = new Learn.Layer(3, 2, identity_opts);
        var vsOut = identity.expressions(vsHidden);
        should.deepEqual(vsOut, [
            "w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))+w1r0c2/(1+exp(-(w0b2+w0r2c0*x0+w0r2c1*x1)))",
            "w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))+w1r1c2/(1+exp(-(w0b2+w0r2c0*x0+w0r2c1*x1)))",
        ]);
    })
    it("TESTTESTLayer.initialize(weights, options) initializes layer weights", function() {
        // create layer with logistic sigmoid activation typically used for hidden layer(s)
        var nIn = 2;
        var nOut = 3;
        var hidden = new Learn.Layer(nIn, nOut, logistic_opts);

        // default initialization is with random gaussian distribution 
        // having xavier variance and 0 mean
        var weightsIn = {};
        var weights = hidden.initialize({});
        should.equal(weights, hidden.weights);
        var wkeys = Object.keys(weights).sort();
        should.deepEqual(wkeys, [
            "w0b0",
            "w0b1",
            "w0b2",
            "w0r0c0",
            "w0r0c1",
            "w0r1c0",
            "w0r1c1",
            "w0r2c0",
            "w0r2c1",
        ]);
        assertRandom(weights, 1.5);

        // weights can be copied
        var hidden2 = new Learn.Layer(nIn, nOut, logistic_opts);
        var weights2 = hidden2.initialize(weights);
        should.deepEqual(hidden2, hidden);

    })
    it("TESTTESTLayer.compile(exprIn, options) compiles the activation functions", function() {
        var layer = new Learn.Layer(2, 2, identity_opts);
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
        layer.initialize(scope);
        var activations = layer.compile(["x0", "x1"]);
        var y0 = activations[0].eval(scope).should.equal(19 + 0.1);
        var y1 = activations[1].eval(scope).should.equal(43 + 0.2);
    })
    it("TESTTESTNetwork.compile(exprIn, options) compiles the activation functions", function() {
        var network = new Learn.Sequential([new Learn.Layer(2, 2)]);
        var scope = {
            x0: 5,
            x1: 7,
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        network.initialize(scope);
        var activations = network.compile();
        var y0 = activations[0].eval(scope).should.equal(19 + 0.1);
        var y1 = activations[1].eval(scope).should.equal(43 + 0.2);
    })
    it("TESTTESTLayer.activate(scope) computes feed-forward activation", function() {
        var layer = new Learn.Layer(2, 2);
        var scope = {
            x0: 5,
            x1: 7,
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        layer.initialize(scope);
        layer.compile(["x0", "x1"]);

        var outputs = layer.activate(scope);
        should.deepEqual(outputs, [19.1, 43.2]);
    })
    it("TESTTESTNetwork.activate(inputs) computes feed-forward activation", function() {
        var network = new Learn.Sequential([new Learn.Layer(2, 2)]);
        var scope = {
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        network.initialize(scope);
        network.compile();

        // activation returns output vector and updates scope
        var outputs = network.activate([5, 7]);
        should.deepEqual(outputs, [19.1, 43.2]);
        scope.should.properties({
            x0: 5,
            x1: 7,
            y0: 19.1,
            y1: 43.2,
        });
        //console.log("activate weights:", network.weights, "memo.outputs", network.memo.outputs);
    })
    it("TESTTESTSequential() creates a network aggregated as a sequence of layers", function() {
        var network = new Learn.Sequential([
            new Learn.Layer(2, 2, logistic_opts),
            new Learn.Layer(2, 2, identity_opts),
        ]);

        // expressions are aggregated
        var exprs = network.expressions();
        should.deepEqual(exprs, [
            "w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
            "w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
        ]);

        network.initialize();
        network.compile();

        var opt = new Learn.Optimizer();
        opt.optimize(exprs[0]).should.equal("f4");
    })
    it("TESTTESTNetwork.costExpr(exprIn) returns formula for network cost", function() {
        var network = new Learn.Sequential([
            new Learn.Layer(2, 2, logistic_opts),
            new Learn.Layer(2, 2, identity_opts),
        ]);

        var costExpr = network.costExpr(["x0", "x1"]);
        should.deepEqual(costExpr,
            "((w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-yt0)^2" +
            "+(w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-yt1)^2)/2"
        );

        //console.log((mathjs.derivative(mathjs.parse(costExpr),"w0b0")).toString());
    })
    it("TESTTESTNetwork.initialize(weights,options) initializes weights", function() {
        var network = new Learn.Sequential([new Learn.Layer(2, 2, logistic_opts)]);

        // each added layer has allocated a new id
        var identity = new Learn.Layer(2, 2);
        identity.id.should.equal(0); // default id
        network.add(identity); // update id
        identity.id.should.equal(1); // new layer id

        // initialize all weights
        var weights = network.initialize();
        assertRandom(weights, 1.5);
        var keys = Object.keys(weights);
        keys.length.should.equal(12); // 2 layers * (2 inputs + 2 outputs + 2 offsets)

        // initialize overwrites all existing weights
        var weights2 = network.initialize();
        keys.map((key) => weights2[key].should.not.equal(weights[key]));

        // initialize only overwrites MISSING weights 
        var w0r0c0 = weights2.w0r0c0;
        delete weights2.w0r0c0;
        var weights3 = network.initialize(weights2);
        keys.map((key) => {
            key === "w0r0c0" && weights3[key].should.not.equal(w0r0c0);
            key !== "w0r0c0" && weights3[key].should.equal(weights2[key]);
        });
    })
    it("TESTTESTNetwork.costGradientExpr(exprIn) returns cost gradient expression vector", function() {
        var network = new Learn.Sequential([new Learn.Layer(2, 2, identity_opts)]);
        var weights = network.initialize();
        var gradC = network.costGradientExpr();
        //console.log(network.costExpr());
        should.deepEqual(gradC, {
            w0b0: '(2 * (w0b0 - yt0 + w0r0c0 * x0 + w0r0c1 * x1) + 0) / 2',
            w0b1: '(2 * (w0b1 - yt1 + w0r1c0 * x0 + w0r1c1 * x1) + 0) / 2',
            w0r0c0: '(2 * (x0 + 0) * (w0b0 - yt0 + w0r0c0 * x0 + w0r0c1 * x1) + 0) / 2',
            w0r0c1: '(2 * (x1 + 0) * (w0b0 - yt0 + w0r0c0 * x0 + w0r0c1 * x1) + 0) / 2',
            w0r1c0: '(2 * (x0 + 0) * (w0b1 - yt1 + w0r1c0 * x0 + w0r1c1 * x1) + 0) / 2',
            w0r1c1: '(2 * (x1 + 0) * (w0b1 - yt1 + w0r1c0 * x0 + w0r1c1 * x1) + 0) / 2',
        });
    })
    it("TESTTESTNetwork.costGradient(target) returns current cost gradient vector", function() {
        var network = new Learn.Sequential([new Learn.Layer(2, 2, identity_opts)]);
        var scope = {
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        var weights = network.initialize(scope);
        network.compile();
        network.activate([5, 7]);

        // when outputs===target, gradient is zero
        var gradC = network.costGradient([19.1, 43.2]);
        should.deepEqual(gradC, {
            w0b0: 0,
            w0b1: 0,
            w0b2: 0,
            w0r0c0: 0,
            w0r0c1: 0,
            w0r1c0: 0,
            w0r1c1: 0,
        });

        // gradient near target value
        var gradC = network.costGradient([19, 43.2]);
        should.deepEqual(gradC, {
            w0b0: 0.10000000000000142,
            w0b1: 0,
            w0b2: 0,
            w0r0c0: 0.5000000000000071,
            w0r0c1: 0.70000000000001,
            w0r1c0: 0,
            w0r1c1: 0,
        });
    })
    it("TESTTESTNetwork.cost(target) returns cost with respect to target values", function() {
        var network = new Learn.Sequential([new Learn.Layer(2, 2, identity_opts)]);
        var scope = {
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        var weights = network.initialize(scope);
        network.compile();
        network.activate([5, 7]);

        network.cost([19.1, 43.2]).should.equal(0); // cost at target
        mathjs.round(network.cost([19, 43.2]), 3).should.equal(0.005); // near target
        mathjs.round(network.cost([18, 43.2]), 3).should.equal(0.605); // far from target
    })
    it("TESTTESTshuffle(a) permutes array", function() {
        var a = [1, 2, 3, 4, 5, 6, 7, 8];
        var b = [1, 2, 3, 4, 5, 6, 7, 8];
        Learn.shuffle(b);
        should(
            a[0] !== b[0] ||
            a[1] !== b[1] ||
            a[2] !== b[2] ||
            a[3] !== b[3] ||
            a[4] !== b[4] ||
            a[5] !== b[5] ||
            a[6] !== b[6]
        ).equal(true);
        should.deepEqual(a, b.sort());
    })
    it("TESTTESTNetwork.propagate(learningRate,target) back-propagates gradient descent weight changes", function() {
        //this.timeout( 60 * 1000 );
        var network = new Learn.Sequential([
            new Learn.Layer(2, 2, identity_opts),
        ]);
        network.initialize();
        network.compile();
        var f0 = (x) => 3 * x + 8;
        var f1 = (x) => 0;

        // training set should cover domain and include boundaries
        var train = [];
        [5, 3.5, 2, .5, -.5, -2, -3.5, -5].map((x) =>
            train.push({
                input: [x, x],
                target: [f0(x), f1(x)]
            }));

        // train
        var nEpochs = 100;
        var lr = 0.01;
        for (var epoch = 0; epoch < nEpochs; epoch++) {
            //Learn.shuffle(train);
            lr = mathjs.max(0.00001, lr - lr / nEpochs);
            train.map((t) => {
                var outputs = network.activate(t.input);
                network.propagate(lr, t.target);
                //          return network.cost(t.target);
            });
        }

        // test set should be different than training set
        [5, -5, 3, -3, 0].map((x) => {
            var outputs = network.activate([x, x]);
            outputs[0].should.approximately(f0(x), 0.06);
            outputs[1].should.approximately(f1(x), 0.2);
        });
    })
    it("TESTTESTOptimizer.optimize(expr) returns memoized expression name", function() {
        var opt = new Learn.Optimizer();

        opt.optimize("2*(a+b)+1/(a+b)").should.equal("f1");
        should.deepEqual(opt.memo, {
            f0: "(a + b)",
            f1: "2 * (f0) + 1 / (f0)",
        });

        // re-optimization of expressions matching existing optimizations has no effect 
        opt.optimize("2*(a + b)+1/(a+b)").should.equal("f1");

        // optimizations accumulate
        opt.optimize("((a+b)*(b+c)+1/(a + exp(b+c)))").should.equal("f4");
        should.deepEqual(opt.memo, {
            f0: "(a + b)",
            f1: "2 * (f0) + 1 / (f0)",
            f2: "(b + c)",
            f3: "(a + exp(f2))",
            f4: "((f0) * (f2) + 1 / (f3))",
        });

        // vector optimizations are supported
        should.deepEqual(
            opt.optimize(["(a+b)", "(b+c)", "3*(a+b)"]), ["f0", "f2", "f5"]
        );
        opt.memo.f5.should.equal("3 * (f0)");

        // compile() enables eval()
        var funs = opt.compile();
        funs.f0.eval({a:3,b:5}).should.equal(8);
        funs.f1.eval({a:3,b:5,f0:8}).should.equal(16+1/8);

        var scope = {a:3, b:5, c:7};
        should.deepEqual(opt.eval(scope), {
            a: 3,
            b: 5,
            c: 7,
            f0: 8,
            f1: 16.125,
            f2: 12,
            f3: 162757.79141900386,
            f4: 96.0000061440991,
            f5: 24,
        });
    });
})

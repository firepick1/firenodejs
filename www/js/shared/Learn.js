var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");
var mathjs = require("mathjs");

(function(exports) {
    ////////////////// constructor
    function Learn(network) {
        var that = this;
        return that;
    }

    ///////////////// class ////////////////////
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
                if (subExpr[0] === '(' && ememo.indexOf(subExpr) >= 0) {
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
        var body = "";
        for (var i = 0; i < that.findex; i++) {
            var fname = "f" + i;
            var root = mathjs.parse(that.memo[fname]);
            root = root.transform((node,path,parent) => {
                if (node.isSymbolNode) {
                    node.name = "$." + node.name;
                } else if (node.isFunctionNode) {
                    node.fn.name = "math." + node.fn.name;
                } else if (node.isOperatorNode && node.op === "^") { // Javscript doesn't have "^"
                    return new mathjs.expression.node.FunctionNode("math.pow", node.args);
                }
                return node;
            });
            body += "\n  $." + fname + " = " + root.toString() + ";";
        }
        body += "\n  return $.f" + (that.findex-1) + ";\n";
        // use Function to create a function with "math" in its lexical environment
        return (new Function("math","return function($) {" + body + "}"))(mathjs);
    }

    ///////////// Network
    Learn.Network = function(nIn) {
        var that = this;
        that.nIn = nIn;
        that.exprIn = Array(nIn).fill().map((e, i) => "x" + i);
        that.layers = [];
        that.inputs = Array(nIn).fill().map((x,i) => "x" + i);
        that.fNormIn = Array(nIn).fill().map(() => function(x) {return x;});
        return that;
    }
    Learn.Network.prototype.add = function(layer, options = {}) {
        var that = this;
        var idBase = options.idBase || 0;
        layer.id = idBase + that.layers.length;
        that.layers.push(layer);
        return layer;
    }
    Learn.Network.prototype.toJSON = function(type) {
        var that = this;
        var obj = {
            type: that.type || "Network",
            nIn: that.nIn,
        }
        obj.layers = that.layers.map((l) => l.toJSON());
        obj.fNormIn = that.fNormIn.map((f) => f.toString());
        that.weights && (obj.weights = that.weights);
        return JSON.stringify(obj);
    }
    Learn.Network.fromJSON = function(json) {
        var obj = JSON.parse(json);
        var network = null;
        if (obj.type === "Sequential") {
            var layers = obj.layers.map((l) => Learn.Layer.fromJSON(l));
            network = new Learn.Sequential(obj.nIn, layers, obj);
        }
        if (network) {
            network.fNormIn = obj.fNormIn.map((f) => (new Function("return "+f))());
            if (obj.weights) {
                network.weights = obj.weights;
                network.compile();
            }
        }
        return network;
    }
    Learn.Network.prototype.initialize = function(weights = {}, options = {}) {
        var that = this;
        var layers = that.layers;
        var nIn = that.nIn;
        for (var iLayer = 0; iLayer < layers.length; iLayer++) {
            layers[iLayer].initialize(nIn, weights, options);
            nIn = layers[iLayer].nOut;
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
    Learn.Network.prototype.compile = function(exprsIn, options = {}) {
        var that = this;
        that.opt = new Learn.Optimizer();
        var nIn = that.nIn;
        var exprs = that.expressions(exprsIn) ;
        that.fmemo_outputs = that.opt.optimize(exprs);
        that.memoizeActivate = that.opt.compile();
        that.scope = Object.create(that.weights);

        that.gradExpr = that.gradExpr || that.costGradientExpr(exprsIn, options);
        that.gradFun = {};
        that.fmemo_gradient = {};
        for (var iKey = 0; iKey < that.keys.length; iKey++) {
            var key = that.keys[iKey];
            var partial = that.gradExpr[key];
            that.fmemo_gradient[key] = that.opt.optimize(partial);
        }

        that.fmemo_cost = that.opt.optimize(that.costFunExpr);
        that.memoizePropagate = that.opt.compile();

        return that;
    }
    Learn.Network.prototype.activate = function(input, target) { // see compile()
        var that = this;
        if (!that.memoizeActivate) {
            throw new Error("compile() before activate()");
        }
        input.map((x, i) => that.scope["x"+i] = that.fNormIn[i](x));
        that.target = target;
        if (target) {
            target.map((y, i) => that.scope["yt" + i] = y);
            that.memoizePropagate(that.scope);
        } else {
            that.memoizeActivate(that.scope);
        }
        return that.fmemo_outputs.map((f,i) => that.scope["y"+i] = that.scope[f]);
    }
    Learn.Network.prototype.costGradient = function() { // see compile()
        var that = this;
        if (that.scope.yt0 == null) {
            throw new Error("activate(input, target) must be called before costGradient()");
        }
        var grad = {};
        that.keys.map((key) => grad[key] = that.scope[that.fmemo_gradient[key]]);
        return grad;
    }
    Learn.Network.prototype.cost = function() { // see compile()
        var that = this;
        if (that.scope.yt0 == null) {
            throw new Error("activate(input, target) must be called before costGradient()");
        }
        return that.scope[that.fmemo_cost];
    }
    Learn.Network.prototype.propagate = function(learningRate) { // see compile
        var that = this;
        if (!that.memoizeActivate) {
            throw new Error("compile() must be called before propagate()");
        }
        var gradC = that.costGradient();
        that.keys.map((key) => that.weights[key] -= learningRate * gradC[key])
        return that;
    }
    Learn.Network.prototype.exampleStats = function(examples, key="input") {
        var that = this;
        var result = {};
        result.mean = [];
        result.std = [];
        for (var i = that.nIn; i-- > 0; ) {
            result.mean[i] = 0;
            for (var iEx = 0; iEx < examples.length; iEx++) {
                var x = examples[iEx][key][i];
                result.mean[i] += x;
            }
            result.mean[i] /= examples.length;
        }
        for (var i = that.nIn; i-- > 0; ) {
            result.std[i] = 0;
            for (var iEx = 0; iEx < examples.length; iEx++) {
                var dx = examples[iEx][key][i] - result.mean[i];
                result.std[i] += dx * dx;
            }
            result.std[i] = mathjs.sqrt(result.std[i]/examples.length);
        }
        return result;
    }
    Learn.Network.prototype.train = function(examples, options={}) {
        var that = this;

        if (!that.scope) {
            throw new Error("compile() network before train()");
        }

        var result = { // normalize inputs
            input: that.exampleStats(examples, "input"),
            target: that.exampleStats(examples, "target"),
        };

        var normInStd = options.normInStd || 0.3;
        var normInMean = options.normInMean || 0;
        that.fNormIn = Array(that.nIn).fill().map((f,i) => {
            var scale = result.input.std[i] ? normInStd / result.input.std[i] : 1;
            var xmean = result.input.mean[i];
            return new Function("x",
                normInMean ?
                    "return (x - " + xmean + ")*" + scale + "+" + normInMean :
                    "return (x - " + xmean + ")*" + scale
            );
        });

        var learningRate = options.learningRate || 0.1;
        var lrDecay = options.learningRateDecay || 0.99985;
        var lrMin = options.learningRateMin || 0.01;
        if (typeof learningRate === "number") {
            var lrNum = learningRate;
            learningRate = (lr=lrNum) => lrDecay * lr + (1-lrDecay) * lrMin;
        }
        result.learningRate = learningRate();
        var nEpochs = options.maxEpochs || 10000;
        var minCost = options.minCost || 0.0003;
        var shuffle = options.shuffle == null ? true : options.shuffle;
        var prevCost = null;
        var done = false;
        for (var iEpoch = 0; !done && iEpoch < nEpochs; iEpoch++) {
            done = true;
            shuffle && Learn.shuffle(examples);
            for(var iEx=1; iEx < examples.length; iEx++) {
                var example = examples[iEx];
                that.activate(example.input, example.target);
                var cost = that.cost();
                (cost > minCost) && (done = false);
                that.propagate(result.learningRate);
            }
            result.epochs = iEpoch;
            result.learningRate = learningRate(result.learningRate);
        }

        return result;
    }

    ///////////// Sequential
    Learn.Sequential = function(nIn, layers = [], options = {}) {
        var that = this;
        that.type = "Sequential";
        that.super = Object.getPrototypeOf(Object.getPrototypeOf(that)); // TODO: use ECMAScript 2015 super 
        that.super.constructor.call(that, nIn, options);
        layers.map((layer) => that.add(layer));

        return that;
    }
    Learn.Sequential.prototype = Object.create(Learn.Network.prototype);
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
    Learn.Layer = function(nOut = 2, options = {}) {
        var that = this;
        that.id = options.id || 0;
        that.nOut = nOut;
        that.activation = options.activation || "identity";
        return that;
    }
    Learn.Layer.prototype.toJSON = function() {
        var that = this;
        return JSON.stringify({
            type: "Layer",
            id: that.id,
            nOut: that.nOut,
            activation: that.activation,
        });
    }
    Learn.Layer.fromJSON = function(json) { // layer factory
        var obj = JSON.parse(json);
        if (obj.type === "Layer") {
            return new Learn.Layer(obj.nOut, obj);
        }
        if (obj.type === "MapLayer") {
            return Learn.MapLayer.fromJSON(json);
        }
        return null;
    }
    Learn.Layer.prototype.initialize = function(nIn, weights = {}, options = {}) {
        var that = this;
        var xavier = 2 / (nIn + that.nOut);
        var wInit = Learn.randomGaussian(nIn * that.nOut, xavier); // weight initializations
        var bInit = Learn.randomGaussian(that.nOut, 1); // offset initializations
        var iInit = 0;
        for (var r = 0; r < that.nOut; r++) {
            var bkey = Learn.weight(that.id, r);
            weights[bkey] == null && (weights[bkey] = bInit[r]);
            for (var c = 0; c < nIn; c++) {
                var wkey = Learn.weight(that.id, r, c);
                weights[wkey] == null && (weights[wkey] = wInit[iInit++]);
            }
        }

        return weights;
    };
    Learn.Layer.prototype.expressions = function(exprIn) {
        var that = this;
        var outputs = [];
        if (!exprIn instanceof Array) {
            throw new Error("Expected input expression vector");
        }
        var nIn = exprIn.length;
        for (var r = 0; r < that.nOut; r++) {
            var dot = Learn.weight(that.id, r);
            for (var c = 0; c < nIn; c++) {
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

    //////////// MapLayer
    Learn.MapLayer = function(fmap, options = {}) {
        var that = this;
        that.id = options.id || 0;
        that.nOut = fmap.length;
        that.fmap = fmap;
        return that;
    }
    Learn.MapLayer.prototype.toJSON = function() {
        var that = this;
        return JSON.stringify({
            type: "MapLayer",
            id: that.id,
            fmap: that.fmap.map((f) => f.toString()),
        });
    }
    Learn.MapLayer.fromJSON = function(json) {
        var obj = JSON.parse(json);
        if (obj.type !== "MapLayer") {
            return null;
        }
        var fmap = obj.fmap.map((f) => (new Function("return " + f))());
        //var fun = JSON.parse(json).map((f) => (new Function("return " + f))());
        return new Learn.MapLayer(fmap, {
            id: obj.id,
        });
    }
    Learn.MapLayer.prototype.initialize = function(nIn, weights = {}, options = {}) {
        var that = this;
        return weights;
    };
    Learn.MapLayer.prototype.expressions = function(exprIn) {
        var that = this;
        if (!exprIn instanceof Array) {
            throw new Error("Expected input expression vector");
        }
        return that.fmap.map((f) => f(exprIn));
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
    it("randomGaussian(n, sigma, mu) returns n random numbers with Gaussian distribution", function() {
        var list = Learn.randomGaussian(1000);
        mathjs.mean(list).should.approximately(0, 0.10);
        mathjs.std(list).should.approximately(1, 0.1);
        var list = Learn.randomGaussian(1000, 2, 3);
        mathjs.mean(list).should.approximately(3, 0.21);
        mathjs.std(list).should.approximately(2, 0.15);
    })
    it("Layer(nOut, id, options) creates neural network layer", function() {
        var nOut = 2;
        // create layer with default identity activation typically used for regression output
        var defaultActivation = new Learn.Layer(nOut);
        var vsOut = defaultActivation.expressions(["x0", "x1", "x2"]);
        should.deepEqual(vsOut, [
            "w0b0+w0r0c0*x0+w0r0c1*x1+w0r0c2*x2",
            "w0b1+w0r1c0*x0+w0r1c1*x1+w0r1c2*x2",
        ]);

        // create layer with logistic sigmoid activation typically used for hidden layer(s)
        var nOut = 3;
        var hidden = new Learn.Layer(nOut, logistic_opts);
        var vsHidden = hidden.expressions(["x0", "x1"]);
        should.deepEqual(vsHidden, [
            "1/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))",
            "1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
            "1/(1+exp(-(w0b2+w0r2c0*x0+w0r2c1*x1)))",
        ]);

        // create layer with softmax activation typically used for categorization output
        var nOut = 2;
        var softmax = new Learn.Layer(nOut, {
            activation: "softmax",
            id: 1,
        });
        var vsSoftmax = softmax.expressions(["x0", "x1"]); // functional input resolution
        should.deepEqual(vsSoftmax, [
            "exp(w1b0+w1r0c0*x0+w1r0c1*x1)/(exp(w1b0+w1r0c0*x0+w1r0c1*x1)+exp(w1b1+w1r1c0*x0+w1r1c1*x1))",
            "exp(w1b1+w1r1c0*x0+w1r1c1*x1)/(exp(w1b0+w1r0c0*x0+w1r0c1*x1)+exp(w1b1+w1r1c0*x0+w1r1c1*x1))",
        ]);

        // layer output expressions can be chained
        var identity = new Learn.Layer(2, identity_opts);
        var vsOut = identity.expressions(vsHidden);
        should.deepEqual(vsOut, [
            "w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))+w1r0c2/(1+exp(-(w0b2+w0r2c0*x0+w0r2c1*x1)))",
            "w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))+w1r1c2/(1+exp(-(w0b2+w0r2c0*x0+w0r2c1*x1)))",
        ]);
    })
    it("Layer.initialize(nIn, weights, options) initializes layer weights", function() {
        // create layer with logistic sigmoid activation typically used for hidden layer(s)
        var nIn = 2;
        var nOut = 3;
        var hidden = new Learn.Layer(nOut, logistic_opts);

        // default initialization is with random gaussian distribution 
        // having xavier variance and 0 mean
        var weightsIn = {};
        var weights = hidden.initialize(nIn, {});
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
        var hidden2 = new Learn.Layer(nOut, logistic_opts);
        var weights2 = hidden2.initialize(nIn, weights);
        should.deepEqual(hidden2, hidden);
    })
    it("Sequential(nIn, layers) creates a network aggregated as a sequence of layers", function() {
        var network = new Learn.Sequential(2, [
            new Learn.Layer(2, logistic_opts),
            new Learn.Layer(2, identity_opts),
        ]);

        // expressions are aggregated
        var exprs = network.expressions();
        should.deepEqual(exprs, [
            "w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
            "w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
        ]);
    })
    it("Network.compile(exprIn, options) compiles the feed-forward activate() function ", function() {
        var network = new Learn.Sequential(2, [new Learn.Layer(2)]);
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
        network.compile();

        var outputs = network.activate([5,7])
        should.deepEqual(outputs, [19+0.1, 43+0.2]);
    })
    it("Network.costExpr(exprIn) returns formula for network cost", function() {
        var network = new Learn.Sequential(2, [
            new Learn.Layer(2, logistic_opts),
            new Learn.Layer(2, identity_opts),
        ]);

        var costExpr = network.costExpr(["x0", "x1"]);
        should.deepEqual(costExpr,
            "((w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-yt0)^2" +
            "+(w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-yt1)^2)/2"
        );
    })
    it("Network.initialize(weights,options) initializes weights", function() {
        var network = new Learn.Sequential(2, [new Learn.Layer(2, logistic_opts)]);

        // each added layer has allocated a new id
        var identity = new Learn.Layer(2);
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
    it("Network.costGradientExpr(exprIn) returns cost gradient expression vector", function() {
        var network = new Learn.Sequential(2, [new Learn.Layer(2, identity_opts)]);
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
    it("Network.activate(ipnuts, targets) computes activation outputs", function() {
        var network = new Learn.Sequential(2, [new Learn.Layer(2)]);
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
        network.compile();

        var outputs = network.activate([5,7])
        should.deepEqual(outputs, [19.1, 43.2]);

        var outputs2 = network.activate([5,7], [19.1+.01, 43.2+.02]);
        should.deepEqual(outputs2, outputs);
        //console.log(network.weights);
        //console.log(network.fmemo_gradient);
    })
    it("Network.cost() returns activation cost", function() {
        var network = new Learn.Sequential(2, [new Learn.Layer(2, identity_opts)]);
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
        
        // targeted activation is required for cost()
        var inputs = [5, 7];
        var targets = [19.1, 43.2];
        network.activate(inputs, targets); 
        network.cost().should.equal(0); // cost at target

        network.activate(inputs, [19, 43.2]); 
        mathjs.round(network.cost(), 3).should.equal(0.005); // near target

        network.activate(inputs, [18, 43.2]); 
        mathjs.round(network.cost(), 3).should.equal(0.605); // far from target
    })
    it("Network.costGradient() returns activation cost gradient vector", function() {
        var network = new Learn.Sequential(2, [new Learn.Layer(2, identity_opts)]);
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
        
        // targeted activation is required for costGradient()
        var inputs = [5, 7];
        var targets = [19.1, 43.2];
        network.activate(inputs, targets); 

        // when outputs===target, gradient is zero
        var gradC = network.costGradient();
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
        network.activate(inputs, [targets[0]-0.1, targets[1]]);
        var gradC = network.costGradient();
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
    it("shuffle(a) permutes array", function() {
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
    it("Optimizer.optimize(expr) returns memoized expression name", function() {
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
    });
    it("Optimizer.compile(fname) compiles Javascript memoization function", function() {
        var opt = new Learn.Optimizer();
        var scope = {a:3, b: 5};
        opt.optimize("2*(a+b)+1/(a+b)").should.equal("f1");
        var f1 = opt.compile(); // memoize all currently optimized functions
        should.deepEqual(scope, {
            a: 3,
            b: 5,
        });
        f1(scope).should.equal(16.125);
        should.deepEqual(scope, {
            a: 3,
            b: 5,
            f0: 8,
            f1: 16.125,
            // f2,f3 not present
        });

        opt.optimize("floor(exp(a))").should.equal("f2"); // mathjs functions
        opt.optimize("(a+b)^a").should.equal("f3"); // non-Javascript operator

        var f3 = opt.compile(); // memoize all currently optimized functions 
        f3(scope).should.equal(512);
        should.deepEqual(scope, {
            a: 3,
            b: 5,
            f0: 8,
            f1: 16.125,
            f2: 20,
            f3: 512,
        });
    });
    it("Network.propagate(learningRate) back-propagates gradient descent weight changes", function() {
        var network = new Learn.Sequential(2, [
            new Learn.Layer(2, identity_opts),
        ]);
        network.initialize();
        network.compile();
        var f0 = (x) => 3 * x + 8;
        var f1 = (x) => 0;
        var input = [5, 5];
        var target = [f0(input[0]), f1(input[0])];

        // activate() must be called before training
        network.activate(input, target);
        var cost = network.cost();

        // train network 
        var learningRate = 0.01; 
        for (var iEpoch = 0; iEpoch < 10; iEpoch++) {
            var prevCost = cost;

            // train network via back-propagation of gradient descent deltas
            network.propagate(learningRate);
            network.activate(input, target);

            cost = network.cost();
            cost.should.below(prevCost); // we are getting better!
        }
    })
    it("Network.train(examples, options) trains neural net", function() {
        this.timeout(60*1000);
        var nHidden = 2;
        var network = new Learn.Sequential(2, [
            //new Learn.Layer(nHidden, logistic_opts),
            new Learn.Layer(2, identity_opts),
        ]);
        network.initialize();
        network.compile();
        var f0 = (x) => (3 * x + 8);
        var f1 = (x) => 0;
        var examples = [-5, 5, 4, -4, 3, -3, 2, -2, 1, -1, 0].map((x) => { 
            return { input:[x,0], target:[f0(x), f1(x)] }
        });

        var result = network.train(examples, {
            normInStd: 0.3, // standard deviation of normalized input
            normInMean: 0, // mean of normalized input
            maxEpochs: 10000,  // maximum number of training epochs
            minCost: 0.00003, // stop training if cost for all examples drops below minCost
            learningRate: 0.1, // initial learning rate or function(lr)
            learningRateDecay: 0.99985, // exponential learning rate decay
            learningRateMin: 0.001, // minimum learning rate
            shuffle: true, // shuffle examples for each epoch
        });
        var tests = [-5, -3.1, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.1, 5].map((x) => { 
            return { input:[x,0], target:[f0(x), f1(x)] }
        });

        for (var iTest = 0; iTest < tests.length; iTest++) {
            var test = tests[iTest];
            var outputs = network.activate(test.input, test.target);
            var cost = network.cost();
        }
    })
    it("MapLayer(fmap) creates an unweighted mapping layer", function() {
        var map = new Learn.MapLayer([
            (eIn) => eIn[0],
            (eIn) => "((" + eIn[0] + ")^2)",
            (eIn) => eIn[1],
            (eIn) => "((" + eIn[1] + ")^2)",
        ]);
        should.deepEqual(map.expressions(["x0", "x1", "x2"]), [
            "x0",
            "((x0)^2)",
            "x1",
            "((x1)^2)",
        ]);
        map.nOut.should.equal(4);
    });
    it("TESTTESTLayer can be serialized", function() {
        var layer = new Learn.Layer(3, {
            id: 5,
            activation: "logistic",
       });

        var json = layer.toJSON(); // serialize layer
        var layer2 = Learn.Layer.fromJSON(json); // deserialize layer

        layer2.id.should.equal(5);
        var eIn = ["x0","x1"];
        should.deepEqual(layer2.expressions(eIn), layer.expressions(eIn));
    })
    it("TESTTESTMapLayer can be serialized", function() {
        var layer = new Learn.MapLayer([
            (eIn) => eIn[0],
            (eIn) => "(" + eIn[0] + "^2)", 
        ], {id:3});

        var json = layer.toJSON(); // serialize layer
        var layer2 = Learn.MapLayer.fromJSON(json); // deserialize layer

        layer2.id.should.equal(3);
        var eIn = ["x0","x1"];
        should.deepEqual(layer2.expressions(eIn), layer.expressions(eIn));
    })
    it("TESTTESTNetwork can be serialized", function() {
        var network = new Learn.Sequential(2, [
            new Learn.Layer(2, identity_opts),
        ]);
        network.initialize();
        network.compile();
        var examples = [
            {input: [1,2], target:[10, 200]},
            {input: [4,3], target:[40, 300]},
            {input: [-3,-4], target:[-30, -400]},
        ];
        network.train(examples);
        var json = network.toJSON();

        // de-serialized network should be trained
        var network2 = Learn.Network.fromJSON(json);
        network2.toJSON().should.equal(json);
        should.deepEqual(network.activate([2,3]), network2.activate([2,3]));
    })
    it("Network.train(examples, options) trains polynomial neural net", function() {
        this.timeout(60*1000);
        var nInputs = 3;
        var nOutputs = 3;
        var buildNetwork = function() {
            var layers = [
                new Learn.MapLayer([
                    (eIn) => eIn[0], // x0
                    (eIn) => eIn[1], // x1
                    (eIn) => eIn[2], // x2
                    (eIn) => "(" + eIn[0] + "^2)", // quadratic x0 input 
                    (eIn) => "(" + eIn[1] + "^2)", // quadratic x1 input
                    (eIn) => "(" + eIn[2] + "^2)", // quadratic x2 input
                ]),
                new Learn.Layer(nOutputs, identity_opts),
            ];
            return new Learn.Sequential(nInputs, layers);
        };
        var examples = [
            { input:[0,0,100] },
            { input:[0,0,5] },
            { input:[200,0,100] },
            { input:[0,200,100] },
            { input:[100,0,50] },
            { input:[0,100,50] },
            { input:[200,0,5] },
            { input:[0,200,5] },
            { input:[100,0,5] },
            { input:[0,100,5] },
        ];
        var tests = [
            { input:[200,200,30] },
            { input:[200,0,30] },
            { input:[100,0,0] },
            { input:[1,1,1] },
            { input:[200,200,0] },
        ];
        var makeExample = function(ex,f) {
            ex.target = f(ex.input);
        };
        var options = { 
            minCost: .001,
            maxEpochs: 20000,  // maximum number of training epochs
            learningRate: 0.2,
            learningRateDecay: 0.99985, // exponential learning rate decay
            lrMin: .01,
        };
        var network0 = buildNetwork();
        network0.initialize();
        network0.compile();
        var verbose = false;
        var preTrain = true; // pre-training saves about 700ms
        if (preTrain) {
            var msStart = new Date();
            var fideal = (input) => input;
            var examples2 = JSON.parse(JSON.stringify(examples));
            var tests2 = JSON.parse(JSON.stringify(tests));
            examples2.map((ex) => makeExample(ex, fideal));
            tests2.map((ex) => makeExample(ex, fideal));
            var result = network0.train(examples2, options);
            var test = tests2[0];
            var outputs = network0.activate(test.input, test.target);
            verbose && console.log("pre-train epochs:"+result.epochs, "outputs:"+outputs, "elapsed:"+(new Date() - msStart));
        }
        var preTrainJson = network0.toJSON();

        // build a new network using preTrainJson
        var msStart = new Date();
        var network = Learn.Network.fromJSON(preTrainJson);
        var theta = 1 * mathjs.PI / 180;
        var fskew = (input) => [input[0]+input[1]*mathjs.sin(theta), input[1] * mathjs.cos(theta), input[2]];
        examples.map((ex) => makeExample(ex, fskew));
        tests.map((ex) => makeExample(ex, fskew));
        var result = network.train(examples, options);
        verbose && console.log("learningRate:"+result.learningRate, "epochs:"+result.epochs, "minCost:"+options.minCost);

        for (var iTest = 0; iTest < tests.length; iTest++) {
            var test = tests[iTest];
            outputs = network.activate(test.input, test.target);
            var error = mathjs.sqrt(2*network.cost()/nOutputs);
            verbose && console.log("fskew epochs:"+result.epochs, 
                "error:"+error,
                "output:"+JSON.stringify(outputs),
                "target:"+JSON.stringify(test.target),
                "input:"+test.input 
            );
            error.should.below(0.1);
        }
        //verbose && console.log("activate:", network.memoizeActivate.toString());
        verbose && console.log("elapsed:", new Date() - msStart);
    })
})

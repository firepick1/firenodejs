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
    Learn.Network.prototype.compile = function(exprsIn, options = {}) {
        var that = this;
        that.opt = new Learn.Optimizer();
        that.inputs = Array(that.layers[0].nIn).fill().map((x,i) => "x" + i);
        var exprs = that.expressions(exprsIn);
        that.fmemo_outputs = that.opt.optimize(exprs);
        that.memoizeActivate = that.opt.compile();
        that.activate = function(inputs, target) {
            inputs.map((x, i) => that.weights["x" + i] = x);
            that.target = target;
            if (target) {
                target.map((y, i) => that.weights["yt" + i] = y);
                that.memoizePropagate(that.weights);
            } else {
                that.memoizeActivate(that.weights);
            }
            return that.fmemo_outputs.map((f,i) => that.weights["y"+i] = that.weights[f]);
        }

        that.gradExpr = that.gradExpr || that.costGradientExpr(exprsIn, options);
        that.gradFun = {};
        that.fmemo_gradient = {};
        for (var iKey = 0; iKey < that.keys.length; iKey++) {
            var key = that.keys[iKey];
            var partial = that.gradExpr[key];
            //TODOthat.gradFun[key] = mathjs.compile(partial);
            that.fmemo_gradient[key] = that.opt.optimize(partial);
        }
        that.costGradient = function() {
            var grad = {};
            that.keys.map((key) => grad[key] = that.weights[that.fmemo_gradient[key]]);
            return grad;
        }

        that.fmemo_cost = that.opt.optimize(that.costFunExpr);
        that.memoizePropagate = that.opt.compile();
        that.cost = function(target) {
            return that.weights[that.fmemo_cost];
        }
        that.propagate = function(learningRate) {
            var gradC = that.costGradient();
            that.keys.map((key) => that.weights[key] -= learningRate * gradC[key])
            return that;
        }

        return that;
    }
    Learn.Network.prototype.activate = function(inputs, targets) { // see compile()
        throw new Error("initialize() and compile() before activate()");
    }
    Learn.Network.prototype.costGradient = function() { // see compile()
        throw new Error("activate(inputs, targets) must be called before costGradient()");
    }
    Learn.Network.prototype.cost = function() { // see compile()
        throw new Error("activate(inputs, targets) must be called before cost()");
    }
    Learn.Network.prototype.propagate = function(learningRate) { // see compile
        throw new Error("compile(inputs, targets) must be called before propagate()");
    }
    Learn.Network.prototype.train = function(examples, options={}) {
        var that = this;

        that.initialize(options);
        that.compile();

        var result = { };
        var learningRate = options.learningRate || 0.1;
        var lrDecay = options.learningRateDecay || 0.98;
        var lrMin = options.learningRateMin || 0.001;
        if (typeof learningRate === "number") {
            var lrNum = learningRate;
            learningRate = (lr=lrNum) => lrDecay * lr + (1-lrDecay) * lrMin;
        }
        result.learningRate = learningRate();
        var nEpochs = options.maxEpochs || 1000;
        var minCost = options.minCost || 0.001;
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
        var wInit = Learn.randomGaussian(that.nIn * that.nOut, xavier); // weight initializations
        var bInit = Learn.randomGaussian(that.nOut, 1); // offset initializations
        var iInit = 0;
        for (var r = 0; r < that.nOut; r++) {
            var bkey = Learn.weight(that.id, r);
            weights[bkey] == null && (weights[bkey] = bInit[r]);
            for (var c = 0; c < that.nIn; c++) {
                var wkey = Learn.weight(that.id, r, c);
                weights[wkey] == null && (weights[wkey] = wInit[iInit++]);
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
    it("TESTTESTrandomGaussian(n, sigma, mu) returns n random numbers with Gaussian distribution", function() {
        var list = Learn.randomGaussian(1000);
        mathjs.mean(list).should.approximately(0, 0.10);
        mathjs.std(list).should.approximately(1, 0.1);
        var list = Learn.randomGaussian(1000, 2, 3);
        mathjs.mean(list).should.approximately(3, 0.21);
        mathjs.std(list).should.approximately(2, 0.15);
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
    })
    it("TESTTESTNetwork.compile(exprIn, options) compiles the feed-forward activate() function ", function() {
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
        network.compile();

        var outputs = network.activate([5,7])
        should.deepEqual(outputs, [19+0.1, 43+0.2]);
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
    it("TESTTESTNetwork.activate(ipnuts, targets) computes activation outputs", function() {
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
        network.compile();

        var outputs = network.activate([5,7])
        should.deepEqual(outputs, [19.1, 43.2]);

        var outputs2 = network.activate([5,7], [19.1+.01, 43.2+.02]);
        should.deepEqual(outputs2, outputs);
        //console.log(network.weights);
        //console.log(network.fmemo_gradient);
    })
    it("TESTTESTNetwork.cost() returns activation cost", function() {
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
    it("TESTTESTNetwork.costGradient() returns activation cost gradient vector", function() {
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
    });
    it("TESTTESTOptimizer.compile(fname) compiles Javascript memoization function", function() {
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
    it("TESTTESTNetwork.propagate(learningRate) back-propagates gradient descent weight changes", function() {
        var network = new Learn.Sequential([
            new Learn.Layer(2, 2, identity_opts),
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
    it("TESTTESTNetwork.train(examples, options) trains neural net", function() {
        this.timeout(60*1000);
        var nHidden = 2; // 5 for logistic_opts
        var network = new Learn.Sequential([
        //    new Learn.Layer(2, nHidden, logistic_opts),
            new Learn.Layer(nHidden, 2, identity_opts),
        ]);
        network.initialize();
        network.compile();
        var f0 = (x) => 3 * x + 8;
        var f1 = (x) => 0;
        var examples = [-5, 5, 4, -4, 2, -2, 0, 1, -1, 3, -3].map((x) => { 
            return { input:[x,x], target:[f0(x), f1(x)] }
        });

        var result = network.train(examples, {
            maxEpochs: 10000,  // maximum number of training epochs
            minCost: 0.001, // stop training if cost for all examples drops below minCost
            learningRate: 0.1, // initial learning rate or function(lr)
            learningRateDecay: 0.98, // exponential learning rate decay
            learningRateMin: 0.01, // minimum learning rate
            shuffle: true, // shuffle examples for each epoch
        });
        var tests = [-5, 5, 3.1, -3.1, 2.5, -2.5, -1.5, 1.5, 0.5, -0.5].map((x) => { 
            return { input:[x,x], target:[f0(x), f1(x)] }
        });

        console.log(result);
        for (var iTest = 0; iTest < tests.length; iTest++) {
            var test = tests[iTest];
            var outputs = network.activate(test.input, test.target);
            var cost = network.cost();
            console.log(cost);
        }
    })
})

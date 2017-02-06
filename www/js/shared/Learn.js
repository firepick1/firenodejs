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
        that.layers = [];
        return that;
    }
    Learn.Model.prototype.costExpr = function(exprIn, options={}) {
        var that = this;
        var costExpr = "";
        var exprs = that.expressions(exprIn);
        var metric = options.metric || "quadratic"; 
        if (metric === "quadratic") {
            for (var iOut = 0; iOut < exprs.length; iOut++) {
                costExpr.length && (costExpr += "+");
                costExpr += "(" + exprs[iOut] + "-y" + iOut + ")^2"
            }
            costExpr = "(" + costExpr + ")/2"; // 2 disappears with derivative
        } else {
            throw new Error("Unsupported cost metric:" + metric);
        }
        return costExpr; 
    }
    Learn.Model.prototype.initialize = function(weights={},options={}) {
        var that = this;
        var layers = that.layers;
        for (var iLayer = 0; iLayer < layers.length; iLayer++) {
            layers[iLayer].initialize(weights,options);
        }
        return that.weights = weights;
    }
    Learn.Model.prototype.costGradientExpr = function(exprIn, options={}) {
        var that = this;
        var costExpr = that.costExpr(exprIn);
        if (that.weights == null) {
            throw new Error("initialize() must be called before costGradientExpr()");
        }
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
    Learn.Model.prototype.compile = function(exprIn, options={}) {
        var that = this;
        var expr = that.expressions(exprIn);
        that.gradExpr = that.gradExpr || that.costGradientExpr(exprIn, options);
        that.gradFun = {};
        for (var iKey = 0; iKey < that.keys.length; iKey++) {
            var key = that.keys[iKey];
            that.gradFun[key] = mathjs.compile(that.gradExpr[key]);
        }
        return that.activations = expr.map((expr) => mathjs.compile(expr));
    }
    Learn.Model.prototype.activate = function(inputs) {
        var that = this;
        if (that.activations == null) {
            throw new Error("initialize() and compile() are prerequisites for activate()");
        }
        inputs.map((x,i) => that.weights["x"+i] = x);
        return that.activations.map( (fun) => fun.eval(that.weights) );
    }
    Learn.Model.prototype.costGradient = function(inputs,outputs) {
        var that = this;
        //var outputs = that.activate(inputs);
        inputs.map( (x,i) => that.weights["x"+i] = x);
        outputs.map( (y,i) => that.weights["y"+i] = y);
        var grad = {};
        for (var iKey = 0; iKey < that.keys.length; iKey++) {
            var key = that.keys[iKey];
            grad[key] = that.gradFun[key].eval(that.weights);
        }
        return grad;
    }

    ///////////// Sequential
    Learn.Sequential = function(options={}) {
        var that = this;
        that.super = Object.getPrototypeOf(Object.getPrototypeOf(that)); // TODO: use ECMAScript 2015 super 
        that.super.constructor.call(that, options);

        return that;
    }
    Learn.Sequential.prototype = Object.create(Learn.Model.prototype);
    Learn.Sequential.prototype.add = function(layer, options = {}) {
        var that = this;
        var idBase = options.idBase || 0;
        var lastLayer = that.layers.length ? that.layers[that.layers.length-1] : null;
        if (lastLayer) {
            if (lastLayer.nOut != layer.nIn) {
                throw new Error("layer inputs:" + layer.nIn
                    + " does not match previous layer outputs:" + lastLayer.nOut);
            }
        }
        layer.id = idBase + that.layers.length;
        !that.layers[0] && (that.exprIn = Array(layer.nIn).fill().map((e,i) => "x"+i));
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
    Learn.Layer = function(nIn=2, nOut=2, options={}) {
        var that = this;
        that.id = options.id || 0;
        that.nIn = nIn;
        that.nOut = nOut;
        that.activation = options.activation || "identity";
        that.weights = {};
        return that;
    }
    Learn.Layer.prototype.initialize = function(weights={},options={}) {
        var that = this;
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
    Learn.Layer.prototype.compile = function(exprIn, options={}) {
        var that = this;
        var funs = [];
        var exprs = that.expressions(exprIn);
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
        for (var iw = 0; iw < wkeys.length-1; iw++) {
            w[iw].should.not.equal(w[iw+1]);
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
        mathjs.mean(list).should.approximately(3, 0.15);
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
        var activations = layer.compile(["x0","x1"]);
        var y0 = activations[0].eval(scope).should.equal(19+0.1);
        var y1 = activations[1].eval(scope).should.equal(43+0.2);
    })
    it("TESTTESTModel.compile(exprIn, options) compiles the activation functions", function() {
        var model = new Learn.Sequential()
        model.add(new Learn.Layer(2, 2));
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
        model.initialize(scope);
        var activations = model.compile();
        var y0 = activations[0].eval(scope).should.equal(19+0.1);
        var y1 = activations[1].eval(scope).should.equal(43+0.2);
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
        layer.compile(["x0","x1"]);

        var outputs = layer.activate(scope);
        should.deepEqual(outputs, [19.1, 43.2]);
    })
    it("TESTTESTModel.activate(inputs) computes feed-forward activation", function() {
        var model = new Learn.Sequential();
        model.add(new Learn.Layer(2,2));
        var scope = {
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        model.initialize(scope);
        model.compile(["x0","x1"]);

        var outputs = model.activate([5,7]);
        should.deepEqual(outputs, [19.1, 43.2]);
    })
    it("TESTTESTSequential() creates a model aggregated as a sequence of layers", function() {
        var model = new Learn.Sequential();
        model.add(new Learn.Layer(2, 2, logistic_opts));
        model.add(new Learn.Layer(2, 2, identity_opts));

        // expressions are aggregated
        var exprs = model.expressions();
        should.deepEqual(exprs, [
            "w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
            "w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))",
        ]);
    })
    it("TESTTESTModel.costExpr(exprIn) returns formula for model cost", function() {
        var model = new Learn.Sequential();
        model.add(new Learn.Layer(2, 2, logistic_opts));
        model.add(new Learn.Layer(2, 2, identity_opts));

        var costExpr = model.costExpr(["x0","x1"]);
        should.deepEqual(costExpr, 
            "((w1b0+w1r0c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r0c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-y0)^2" +
            "+(w1b1+w1r1c0/(1+exp(-(w0b0+w0r0c0*x0+w0r0c1*x1)))+w1r1c1/(1+exp(-(w0b1+w0r1c0*x0+w0r1c1*x1)))-y1)^2)/2"
        );

        //console.log((mathjs.derivative(mathjs.parse(costExpr),"w0b0")).toString());
    })
    it("TESTTESTModel.initialize(weights,options) initializes weights", function() {
        var model = new Learn.Sequential();
        model.add(new Learn.Layer(2, 2, logistic_opts));

        // each added layer has allocated a new id
        var identity = new Learn.Layer(2,2);
        identity.id.should.equal(0); // default id
        model.add(identity); // update id
        identity.id.should.equal(1); // new layer id

        // initialize all weights
        var weights = model.initialize();
        assertRandom(weights, 1.5);
        var keys = Object.keys(weights);
        keys.length.should.equal(12); // 2 layers * (2 inputs + 2 outputs + 2 offsets)
        
        // initialize overwrites all existing weights
        var weights2 = model.initialize();
        keys.map((key) => weights2[key].should.not.equal(weights[key]));
        
        // initialize only overwrites MISSING weights 
        var w0r0c0 = weights2.w0r0c0;
        delete weights2.w0r0c0;
        var weights3 = model.initialize(weights2);
        keys.map((key) => {
            key === "w0r0c0" && weights3[key].should.not.equal(w0r0c0);
            key !== "w0r0c0" && weights3[key].should.equal(weights2[key]);
        });
    })
    it("TESTTESTModel.costGradientExpr(exprIn) returns cost gradient expression vector", function() {
        var model = new Learn.Sequential();
        model.add(new Learn.Layer(2, 2, identity_opts));
        var weights = model.initialize();
        var gradC = model.costGradientExpr();
        //console.log(model.costExpr());
        should.deepEqual(gradC, { 
            w0b0: '(2 * (w0b0 - y0 + w0r0c0 * x0 + w0r0c1 * x1) + 0) / 2',
            w0b1: '(2 * (w0b1 - y1 + w0r1c0 * x0 + w0r1c1 * x1) + 0) / 2',
            w0r0c0: '(2 * (x0 + 0) * (w0b0 - y0 + w0r0c0 * x0 + w0r0c1 * x1) + 0) / 2',
            w0r0c1: '(2 * (x1 + 0) * (w0b0 - y0 + w0r0c0 * x0 + w0r0c1 * x1) + 0) / 2',
            w0r1c0: '(2 * (x0 + 0) * (w0b1 - y1 + w0r1c0 * x0 + w0r1c1 * x1) + 0) / 2',
            w0r1c1: '(2 * (x1 + 0) * (w0b1 - y1 + w0r1c0 * x0 + w0r1c1 * x1) + 0) / 2',
        });
    })
    it("TESTTESTModel.costGradient(inputs,expected) returns cost gradient vector", function() {
        var model = new Learn.Sequential();
        model.add(new Learn.Layer(2, 2, identity_opts));
        var scope = {
            w0b0: 0.1,
            w0b1: 0.2,
            w0b2: 0.3,
            w0r0c0: 1,
            w0r0c1: 2,
            w0r1c0: 3,
            w0r1c1: 4,
        };
        var weights = model.initialize(scope);
        model.compile();

        // gradient at expected value is zero
        var gradC = model.costGradient([5, 7], [19.1, 43.2]);
        should.deepEqual(gradC, {
            w0b0: 0,
            w0b1: 0,
            w0b2: 0,
            w0r0c0: 0,
            w0r0c1: 0,
            w0r1c0: 0,
            w0r1c1: 0,
        });

        // gradient near expected value
        var gradC = model.costGradient([5, 7], [19, 43.2]);
        should.deepEqual(gradC, {
            w0b0: 0.10000000000000142,
            w0b1: 0,
            w0b2: 0,
            w0r0c0: 0.5000000000000071,
            w0r0c1: 0.70000000000001,
            w0r1c0: 0,
            w0r1c1: 0,
        });

        var lr = -0.014; 
        scope.w0b0 += lr*gradC.w0b0;
        scope.w0r0c0 += lr*gradC.w0r0c0;
        scope.w0r0c1 += lr*gradC.w0r0c1;
        var gradC = model.costGradient([5, 7], [19, 43.2]);
        scope.w0b0 += lr*gradC.w0b0;
        scope.w0r0c0 += lr*gradC.w0r0c0;
        scope.w0r0c1 += lr*gradC.w0r0c1;
        var gradC = model.costGradient([5, 7], [19, 43.2]);
        scope.w0b0 += lr*gradC.w0b0;
        scope.w0r0c0 += lr*gradC.w0r0c0;
        scope.w0r0c1 += lr*gradC.w0r0c1;
        var gradC = model.costGradient([5, 7], [19, 43.2]);
        scope.w0b0 += lr*gradC.w0b0;
        scope.w0r0c0 += lr*gradC.w0r0c0;
        scope.w0r0c1 += lr*gradC.w0r0c1;
        var gradC = model.costGradient([5, 7], [19, 43.2]);
        console.log(weights);
    })
})
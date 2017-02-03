
var should = require("should");
var Logger = require("./Logger");
var JsonUtil = require("./JsonUtil");
var mathjs = require("mathjs");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function Learn(layers=[[2,2]]) {
        var that = this;

        that.net = [];
        for (var iLayer = 0; iLayer < layers.length; iLayer++) {
            var layer = layers[iLayer];
            var nIn = layer.in;
            var nOut = layer.out;
            var xavier = 2 / (nIn + nOut);
            var mLayer = [];
            mLayer.activation = layer.activation || Learn.logistic;
            for (var i=nIn; i-- > 0;) {
                mLayer.push(that.randomGaussian(nOut, xavier));
            }
            that.net.push(mLayer);
        }

        return that;
    }
    Learn.weight = (layer, row, col) => {
        return "w" + layer + "r" + row + "c" + col;
    }
    Learn.prototype.createLayer = function(nIn=2, nOut=2, id=0, options={}) {
        var that = this;
        var weights = {};
        var xavier = 2 / (nIn + nOut);
        var wInit = that.randomGaussian(nIn * nOut, xavier);
        for (var r = 0; r < nOut; r++) {
            for (var c = 0; c < nIn; c++) {
                weights[Learn.weight(id,r,c)] = wInit[r * nIn + c];
            }
        }
        
        var layer = {
            id: id,
            nIn: nIn,
            nOut: nOut,
            activation: options.activation || "identity",
            weights: weights,
            exprOut: (vsIn) => { // return vector of strings for output functions
                var vsOut = [];
                for (var r = 0; r < nOut; r++) {
                    var dot = "";
                    for (var c = 0; c < nIn; c++) {
                        dot.length && (dot += "+");
                        if (vsIn[c].indexOf("1/(1+exp(-(") === 0) { // logistic optimization
                            dot += Learn.weight(id, r, c) + vsIn[c].substring(1);
                        } else {
                            dot += Learn.weight(id, r, c) + "*" + vsIn[c];
                        }
                    }
                    if (layer.activation === "logistic") {
                        var activation = "1/(1+exp(-(" + dot + ")))";
                        vsOut.push(activation);
                    } else if (layer.activation === "identity") {
                        vsOut.push(dot);
                    } else { // default
                        vsOut.push(dot);
                    }
                }
                return vsOut;
            },
        }
        return layer;
    }
    Learn.prototype.nndot = function(a, b) {
        return a.map(ai => mathjs.dot(ai, b));
    }
    Learn.prototype.nnadd = function(a, b) {
        return a.map(ai => mathjs.add(ai, b));
    }
    Learn.prototype.feedForward = function(inputs, nLayers) {
        var that = this;
        var outputs = inputs;
        nLayers = nLayers || that.net.length;
        for (var iLayer = 0; iLayer < nLayers; iLayer++) {
            var mLayer = that.net[iLayer];
            outputs = mathjs.multiply(inputs, mLayer);
            outputs = outputs.map( oi => mLayer.activation(oi) );
            inputs = outputs;
        }
        return outputs;
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
    Learn.prototype.cost = function(actual, expected) {
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

    ///////////////// class ////////////////////
    Learn.logistic = function(x) {
        return 1/(1+mathjs.exp(-x))
    }
    Learn.unity = function(x) {
        return x;
    }
    Learn.simplifyTree = function(root, options={}) {
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
                } else if (node.content.isOperatorNode && node.content.fn === "unaryMinus" ) {
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
    it("cost(actual, expected) computes minimization function", function() {
        var learn = new Learn();
        var expected = [1,2,3];
        learn.cost(expected, expected).should.equal(0); // identity
        learn.cost([2, 2, 3], expected).should.equal(0.5); // single value
        learn.cost([2, 0, 6], expected).should.equal(7); // delta [1, -2, 3]
        learn.cost(expected, [2, 0, 6]).should.equal(7); // commutative
    })
    it("derivative", function() {
        var fun = "a*x^2+b";
        var node = mathjs.parse(fun);
        var dfun = mathjs.derivative(fun,'x');
        dfun.toString().should.equal("2 * a * x + 0");
        dfun.eval({x:3, a:1.5}).should.equal(9);
    })
    it("randomGaussian(n, sigma, mu) returns n random numbers with Gaussian distribution", function() {
        var learn = new Learn();
        var list = learn.randomGaussian(1000);
        mathjs.mean(list).should.approximately(0, 0.10);
        mathjs.std(list).should.approximately(1, 0.1);
        var list = learn.randomGaussian(1000, 2, 3);
        mathjs.mean(list).should.approximately(3, 0.15);
        mathjs.std(list).should.approximately(2, 0.15);
    })
    it("logistic(x) returns standard (slow) logistic activation function", function() {
        Learn.logistic(0).should.equal(0.5);
        Learn.logistic(-10).should.approximately(0,0.0001);
        Learn.logistic(10).should.approximately(1,0.0001);
    })
    it("feedForward(input,n) returns neural network layer output", function() {
        var learn = new Learn([
            {in:3, out:4, activation: Learn.logistic},
            {in:4, out:3, }, // default activiation is logistic
            {in:3, out:2, activation: Learn.unity},
        ]);
        console.log("\n");
        console.log("activation1:", JsonUtil.summarize(learn.feedForward([2,3,1],1))); // first layer activation
        console.log("activation2:", JsonUtil.summarize(learn.feedForward([2,3,1],2))); // second layer activation
        var actual = learn.feedForward([2,3,1]); // output layer activation
        var expected = [5,6];
        console.log("actual:", JsonUtil.summarize(actual));
        var gradient = mathjs.subtract(expected, actual);
        console.log("gradient:", gradient);
    })
    it("softmax(v) returns softmax of vector", function() {
        var learn = new Learn();
        var v1 = [-1, -0.5, -0.1, 0, 0.1, 0.5,  1];
        var v10 = mathjs.multiply(10, v1);
        var smv1 = learn.softmax(v1);
        var smv10 = learn.softmax(v10);
        var e = 0.01;
        smv10[0].should.approximately(0,e);
        smv10[1].should.approximately(0,e);
        smv10[6].should.approximately(1,e);
        var e = 0.05;
        smv1[0].should.approximately(0.0,e);
        smv1[1].should.approximately(0.1,e);
        smv1[6].should.approximately(0.3,e);
    })
    it("TESTTESTcreateLayer(nIn, nOut, id, options) creates layer", function() {
        var learn = new Learn();
        var layer = learn.createLayer(2,2,1);
        var vsOut = layer.exprOut(["x0", "x1"]);
        should.deepEqual(vsOut, [ 
            "w1r0c0*x0+w1r0c1*x1",
            "w1r1c0*x0+w1r1c1*x1",
        ]);
        var hidden = learn.createLayer(2,2,1,{activation:"logistic"});
        var vsHidden = hidden.exprOut(["x0", "x1"]);
        should.deepEqual(vsHidden, [ 
            "1/(1+exp(-(w1r0c0*x0+w1r0c1*x1)))",
            "1/(1+exp(-(w1r1c0*x0+w1r1c1*x1)))",
        ]);
        var output = learn.createLayer(2,2,2,{activation:"identity"});
        var vsOut = layer.exprOut(vsHidden);
        should.deepEqual(vsOut, [ 
            "w1r0c0/(1+exp(-(w1r0c0*x0+w1r0c1*x1)))+w1r0c1/(1+exp(-(w1r1c0*x0+w1r1c1*x1)))",
            "w1r1c0/(1+exp(-(w1r0c0*x0+w1r0c1*x1)))+w1r1c1/(1+exp(-(w1r1c0*x0+w1r1c1*x1)))",
            
        ]);
        
    })
    it("nndot(a,b) returns neural net dot product", function() {
        var a = [
            [1,2],
            [3,4],
            [5,6],
        ];
        var learn = new Learn();
        should.deepEqual(learn.nndot(a,[1,10]), [21,43,65]);
    })
    it("nnadd(a,b) returns neural net sum", function() {
        var a = [
            [1,2],
            [3,4],
            [5,6],
        ];
        var learn = new Learn();
        should.deepEqual(learn.nnadd(a,[1,10]), [[2,12],[4,14],[6,16]]);
    })
    it("ESTTESTsimplifyTree(root) simplifies mathjs parse tree", function() {
        var assertSimple = function(expr, expected, iterations=1) {
            Learn.simplifyTree(mathjs.parse(expr),{iterations:iterations})
                .toString().should.equal(expected)
        };
        assertSimple("0-x","-x");
        assertSimple("0-2*x*y","-(2 * x * y)");
        assertSimple("exp(-(2*x*y))","exp(-(2 * x * y))");
        assertSimple("--x","x");
        assertSimple("(-sin(x))","-sin(x)");
        assertSimple("-(-sin(x))","sin(x)");
        assertSimple("(0-exp(-(2*x*y)))", "0 - exp(-(2 * x * y))", 1);
        assertSimple("0 - exp(-(2 * x * y))", "-exp(-(2 * x * y))", 1);
        assertSimple("(0-exp(-(2*x*y)))", "-exp(-(2 * x * y))", 2);
    })
    it("TESTTESTasdf", function() {
        var weight = (l,r,c) => "w"+l+"r"+r+"c"+c;
        var wcost = xneg => "1/(1+exp(" + xneg+"))";
        var layers = 1;
        var mrows = 2;
        var mcols = 2;
        console.log();
        var fcost = () => {
            var sumsq = "";
            for (var c=0; c<mcols; c++) {
                var negdot = "";
                for (var r=0; r<mrows; r++) {
                    negdot += "-" + weight(0,r,c) + "*x" + r;
                }
                sumsq.length && (sumsq += " + ");
                //console.log(wcost(negdot));
                sumsq += "(" + wcost(negdot) + "-y"+r +")^2";
            }
            return "(" + sumsq + ")/2";
        }
        var C = fcost();
        console.log("C:", C);
        var treeC = mathjs.parse(C);
        var gradC = [
            mathjs.derivative(treeC, String(weight(0,0,0))),
            mathjs.derivative(treeC, String(weight(0,1,1))),
        ]
        var a = 3;
        var b = 8;
        var x = [ 10, 1];
        var y = [ a*x[0] + b, 1];
        var scope = function() { return {
            x0: x[0],
            x1: x[1],
        }};
        console.log("dC/dw0r0c0:", Learn.simplifyTree(gradC[0], {iterations:1}).toString());
        console.log("dC/dw0r1c1:",gradC[1].toString());
    })
})

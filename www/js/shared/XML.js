
var should = require("should");
var Logger = require("./Logger");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function XML(rootTag, options) {
        const that = this;
        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }
        
        that.xml = {
            tag: rootTag || "root",
            elements: [],
        };

        return that;
    }
    XML.prototype.root = function() {
        const that = this;
        return that.xml;
    }
    XML.prototype.addElement = function(tag, json, parent) {
        const that = this;
        var element = JSON.parse(JSON.stringify(json));
        element.tag = tag;
        parent = parent || that.xml;
        parent.elements = parent.elements || [];
        parent.elements.push(element);
        return element;
    }
    XML.prototype.serialize = function() {
        const that = this;
        var result = "";
        var processElement = function(node) {
            var elements = null;
            result += "<" + node.tag;
            var keys = Object.keys(node);
            for (var i=0; i< keys.length; i++) {
                var key = keys[i];
                var value = node[key];
                if (key === "tag") {
                    // do nothing
                } else if (key === "elements") {
                    elements = value;
                } else if (typeof value === "string") {
                    result += ' ' + key + '="' + value.replace(/"/g, '\\"') + '"';
                } else if (typeof value === "number") {
                    result += ' ' + key + '="' + value + '"';
                } else if (typeof value === "boolean") {
                    result += ' ' + key + '="' + value + '"';
                } else if (node == null) {
                    result += ' ' + key + '="null"';
                } else {
                    result += ' ' + key + '="' + JSON.stringify(value).replace(/"/g, '\\"') + '"';
                }
            }
            result += elements ? ">\n" : ">";
            if (elements) {
                for (var i=0; i < elements.length; i++) {
                    processElement(elements[i]);
                }
            }
            result += "</" + node.tag;
            result += elements ? ">" : ">\n";
        }
        processElement(that.xml);

        return result;
    }

    module.exports = exports.XML = XML;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("XML", function() {
    var XML = exports.XML;
    var options = {
        verbose: true
    };
    it ("serialize() generates XML string", function() {
        var svg = new XML("svg");
        svg.serialize().should.equal('<svg>\n</svg>');
        var root = svg.root();
        root.width = 181;
        root.height = 182;
        svg.serialize().should.equal('<svg width="181" height="182">\n</svg>');
        var line1 = { 
            tag: "line",
            x1: -100,
            y1: -200,
            x2: 100,
            y2: 200,
        }
        root.elements.push(line1);
        svg.serialize().should.equal('<svg width="181" height="182">\n' +
            '<line x1="-100" y1="-200" x2="100" y2="200"></line>\n' +
            '</svg>');
        var line2 = { 
            tag: "line",
            x1: -10,
            y1: -20,
            x2: 10,
            y2: 20,
            comment: 'it\'s "good"',
        }
        root.elements.push(line2);
        svg.serialize().should.equal('<svg width="181" height="182">\n' +
            '<line x1="-100" y1="-200" x2="100" y2="200"></line>\n' +
            '<line x1="-10" y1="-20" x2="10" y2="20" comment="it\'s \\"good\\""></line>\n' +
            '</svg>');
    });
    it ("addElement(tag, json, parent) adds new element to parent)", function() {
        var svg = new XML("svg");
        var root = svg.root();
        root.width = 181;
        root.height = 182;
        var line1 = svg.addElement("line", {
            x1: -100,
            y1: -200,
            x2: 100,
            y2: 200,
        }, root);
        var line2 = svg.addElement("line", {
            x1: -10,
            y1: -20,
            x2: 10,
            y2: 20,
        });
        svg.serialize().should.equal('<svg width="181" height="182">\n' +
            '<line x1="-100" y1="-200" x2="100" y2="200"></line>\n' +
            '<line x1="-10" y1="-20" x2="10" y2="20"></line>\n' +
            '</svg>');
    });
})

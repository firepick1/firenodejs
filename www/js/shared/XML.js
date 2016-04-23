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

        that.xml = new XMLElement(rootTag || "root");

        return that;
    }
    XML.prototype.root = function() {
        const that = this;
        return that.xml;
    }
    XML.prototype.addElement = function(tag, json, parent) {
        const that = this;
        parent = parent || that.root();
        return parent.addElement(tag, json);
    }
    XML.prototype.serialize = function() {
        const that = this;
        return that.xml.serialize();
    }

    function XMLElement(tag, json) {
        var that = this;
        that.tag = tag || "element";
        that.elements = [];
        if (json) {
            var keys = Object.keys(json);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                that[key] = JSON.parse(JSON.stringify(json[key]));
            }
        }
        return that;
    }
    XMLElement.prototype.addElement = function(tag, json) {
        const that = this;
        var element = new XMLElement(tag, json);
        that.elements.push(element);
        return element;
    }
    XMLElement.prototype.addText = function(text) {
        const that = this;
        text = text.replace(/</g, "&lt;");
        text = text.replace(/>/g, "&gt;");
        text = text.replace(/&/g, "&amp;");
        that.elements.push(text);
        return that;
    }
    XMLElement.prototype.serialize = function() {
        var that = this;
        var elements = null;
        var result = "<" + that.tag;
        var keys = Object.keys(that);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = that[key];
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
            } else if (that == null) {
                result += ' ' + key + '="null"';
            } else {
                result += ' ' + key + '="' + JSON.stringify(value).replace(/"/g, '\\"') + '"';
            }
        }
        var hasElements = elements && elements.length && (typeof elements[0] === "object");
        result += hasElements ? ">\n" : ">";
        if (elements) {
            for (var i = 0; i < elements.length; i++) {
                var kid = elements[i];
                if (typeof kid == "string") {
                    result += kid;
                } else {
                    result += kid.serialize();
                    result += "\n";
                }
            }
        }
        result += "</" + that.tag + ">";
        return result;
    }
    XML.XMLElement = XMLElement;

    module.exports = exports.XML = XML;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("XML", function() {
    var XML = exports.XML;
    var options = {
        verbose: true
    };
    it("serialize() generates XML string", function() {
        var svg = new XML("svg");
        svg.serialize().should.equal('<svg></svg>');
        var root = svg.root();
        root.width = 181;
        root.height = 182;
        svg.serialize().should.equal('<svg width="181" height="182"></svg>');
        root.addElement("line", {
            x1: -100,
            y1: -200,
            x2: 100,
            y2: 200,
        });
        svg.serialize().should.equal('<svg width="181" height="182">\n' +
            '<line x1="-100" y1="-200" x2="100" y2="200"></line>\n' +
            '</svg>');
        root.addElement("line", {
            x1: -10,
            y1: -20,
            x2: 10,
            y2: 20,
            comment: 'it\'s "good"',
        });
        svg.serialize().should.equal('<svg width="181" height="182">\n' +
            '<line x1="-100" y1="-200" x2="100" y2="200"></line>\n' +
            '<line x1="-10" y1="-20" x2="10" y2="20" comment="it\'s \\"good\\""></line>\n' +
            '</svg>');
    });
    it("addElement(tag, json, parent) adds new element to parent)", function() {
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
    it("XML.XMLElement(tag, json) should create an XML element", function() {
        var elt = new XML.XMLElement("abc", {
            a: 1,
            b: 2,
            c: 3,
        });
        elt.should.properties({
            a: 1,
            b: 2,
            c: 3,
        });
    });
    it("addText(text) adds text to an XML element", function() {
        var elt = new XML.XMLElement("abc", {
            color: "red",
        }).addText("hello");
        elt.serialize().should.equal('<abc color="red">hello</abc>');
    });
})

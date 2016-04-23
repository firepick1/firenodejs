var should = require("should");
var XML = require("./XML");
var JsonUtil = require("./JsonUtil");

(function(exports) {
    ////////////////// constructor
    function SvgGrid(options) {
        const that = this;

        // svg options
        options = options || {};
        that.width = options.width || 194;
        that.height = options.height || 228;
        that.units = options.units || "mm";
        that.textHeight = options.textHeight || 3;
        that.fontFamily = options.fontFamily || "Verdana";
        that.stroke = options.stroke || "black";
        that.strokeWidth = options.strokeWidth || "0.25mm";
        that.strokeLinecap = options.strokeLinecap || "round";
        that.scale = options.scale || {
            x: 1,
            y: 1
        };
        that.xml = new XML("svg");
        var svg = that.xml.root();
        svg.width = that.width + that.units;
        svg.height = that.height + that.units;
        svg.viewbox = -that.width / 2 + " " + -that.height / 2 + " " + that.width + " " + that.height;
        that.gRoot = svg.addElement("g", {
            "stroke-linecap": that.strokeLinecap,
            "stroke-width": that.strokeWidth,
            "font-family": that.fontFamily,
            "transform": "scale(" + that.scale.x + "," + that.scale.y + ")",
        });

        return that;
    }

    SvgGrid.prototype.addCartesianGrid = function(cellWidth, cellHeight, options) {
        const that = this;
        options = options || {};
        var gGrid = that.gRoot.addElement("g", {
            stroke: options.stroke || that.stroke,
            "stroke-width": options.strokeWidth || that.strokeWidth,
        });

        var nRows = Math.ceil(that.height / cellHeight + 0.5);
        for (var r = -nRows; r <= nRows; r++) {
            var y = r * cellHeight;
            gGrid.addElement("line", {
                x1: -that.width,
                y1: y,
                x2: that.width,
                y2: y,
            });
        }

        var nCols = Math.ceil(that.width / cellWidth + 0.5);
        for (var c = -nCols; c <= nCols; c++) {
            var x = c * cellWidth;
            gGrid.addElement("line", {
                x1: x,
                y1: -that.height,
                x2: x,
                y2: that.height,
            });
        }

        return gGrid;
    }

    SvgGrid.prototype.addCrashDummySymbol = function(x, y, options) {
        const that = this;
        options = options || {};
        var fill = options.fill || ["black", "none", "black", "none"];
        var height = options.height || 10;
        var h2 = height/2;

        var gCDS = that.gRoot.addElement("g", {
            transform: "translate(" + x + "," + (-y) + ")",
            stroke: options.stroke || that.stroke,
            "stroke-width": options.strokeWidth || "0.1",
            "font-family": that.fontFamily,
        });
        gCDS.addElement("path", {
            d: "M0,0 v" + (-h2) + " a" + h2 + "," + h2 + " 0 0,0 " + (-h2) + "," + h2 + " z",
            fill: fill[0],
        });
        gCDS.addElement("path", {
            d: "M0,0 h" + h2 + " a" + h2 + "," + h2 + " 0 0,0 " + (-h2) + "," + (-h2) + " z",
            fill: fill[1],
        });
        gCDS.addElement("path", {
            d: "M0,0 v" + h2 + " a" + h2 + "," + h2 + " 0 0,0 " + h2 + "," + (-h2) + " z",
            fill: fill[2],
        });
        gCDS.addElement("path", {
            d: "M0,0 h" + (-h2) + " a" + h2 + "," + h2 + " 0 0,0 " + h2 + "," + h2 + " z",
            fill: fill[3],
        });
        if (options.labelTop) {
            var labelH = that.textHeight;
            gCDS.addElement("text", {
                "text-anchor": "middle",
                x: 0,
                y: JsonUtil.round(-h2 - labelH/3,100),
                height: labelH+that.units,
            }).addText(options.labelTop);
        }
        if (options.labelBottom) {
            var labelH = that.textHeight;
            gCDS.addElement("text", {
                "text-anchor": "middle",
                x: 0,
                y: JsonUtil.round(h2 + 2*labelH/3,100),
                height: labelH+that.units,
            }).addText(options.labelBottom);
        }
        return gCDS;
    }

    SvgGrid.prototype.serialize = function() {
        const that = this;
        return that.xml.serialize();
    }

    module.exports = exports.SvgGrid = SvgGrid;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("SvgGrid", function() {
    var SvgGrid = exports.SvgGrid;
    var options = {
        verbose: true
    };
    it("SvgGrid() creates an SVG grid builder", function() {
        var gridDefault = new SvgGrid();
        gridDefault.should.properties({
            width: 194,
            height: 228,
            fontFamily: "Verdana",
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "black",
            strokeWidth: "0.25mm",
            strokeLinecap: "round",
        });
        var grid = new SvgGrid({
            width: 193,
            height: 223,
            fontFamily: "Arial",
            scale: {
                x: 1.02,
                y: 1.01,
            },
            stroke: "red",
            strokeWidth: "0.2mm",
            strokeLinecap: "butt",
        });
        grid.should.properties({
            width: 193,
            height: 223,
            fontFamily: "Arial",
            scale: {
                x: 1.02,
                y: 1.01,
            },
            stroke: "red",
            strokeWidth: "0.2mm",
            strokeLinecap: "butt",
        });
    });
    it("serialize() returns XML string for SVG document", function() {
        var grid = new SvgGrid();
        grid.xml.serialize().should.equal('<svg width="194mm" height="228mm" viewbox="-97 -114 194 228">\n' +
            '<g stroke-linecap="round" stroke-width="0.25mm" font-family="Verdana" transform="scale(1,1)"></g>\n' +
            "</svg>");
    });
    it("addCartesianGrid(cellWidth, cellHeight) adds a cartesian grid to SVG document", function() {
        var grid = new SvgGrid({
            width: 6,
            height: 6,
        });
        grid.addCartesianGrid(2, 3);
        grid.xml.serialize().should.equal('<svg width="6mm" height="6mm" viewbox="-3 -3 6 6">\n' +
            '<g stroke-linecap="round" stroke-width="0.25mm" font-family="Verdana" transform="scale(1,1)">\n' +
            '<g stroke="black" stroke-width="0.25mm">\n' +
            '<line x1="-6" y1="-9" x2="6" y2="-9"></line>\n' +
            '<line x1="-6" y1="-6" x2="6" y2="-6"></line>\n' +
            '<line x1="-6" y1="-3" x2="6" y2="-3"></line>\n' +
            '<line x1="-6" y1="0" x2="6" y2="0"></line>\n' +
            '<line x1="-6" y1="3" x2="6" y2="3"></line>\n' +
            '<line x1="-6" y1="6" x2="6" y2="6"></line>\n' +
            '<line x1="-6" y1="9" x2="6" y2="9"></line>\n' +
            '<line x1="-8" y1="-6" x2="-8" y2="6"></line>\n' +
            '<line x1="-6" y1="-6" x2="-6" y2="6"></line>\n' +
            '<line x1="-4" y1="-6" x2="-4" y2="6"></line>\n' +
            '<line x1="-2" y1="-6" x2="-2" y2="6"></line>\n' +
            '<line x1="0" y1="-6" x2="0" y2="6"></line>\n' +
            '<line x1="2" y1="-6" x2="2" y2="6"></line>\n' +
            '<line x1="4" y1="-6" x2="4" y2="6"></line>\n' +
            '<line x1="6" y1="-6" x2="6" y2="6"></line>\n' +
            '<line x1="8" y1="-6" x2="8" y2="6"></line>\n' +
            '</g>\n' +
            '</g>\n' +
            "</svg>");
    });
    it("addCrashDummySymbol(x,y) adds a CDS to SVG document", function() {
        var svg = new SvgGrid();
        svg.addCrashDummySymbol(10, 20, {
            labelTop: "bien",
            labelBottom: "hello",
        });
        svg.xml.serialize().should.equal('<svg width="194mm" height="228mm" viewbox="-97 -114 194 228">\n' +
            '<g stroke-linecap="round" stroke-width="0.25mm" font-family="Verdana" transform="scale(1,1)">\n' +
            '<g transform="translate(10,-20)" stroke="black" stroke-width="0.1" font-family="Verdana">\n' +
            '<path d="M0,0 v-5 a5,5 0 0,0 -5,5 z" fill="black"></path>\n' +
            '<path d="M0,0 h5 a5,5 0 0,0 -5,-5 z" fill="none"></path>\n' +
            '<path d="M0,0 v5 a5,5 0 0,0 5,-5 z" fill="black"></path>\n' +
            '<path d="M0,0 h-5 a5,5 0 0,0 5,5 z" fill="none"></path>\n' +
            '<text text-anchor="middle" x="0" y="-6" height="3mm">bien</text>\n' +
            '<text text-anchor="middle" x="0" y="7" height="3mm">hello</text>\n' +
            "</g>\n" +
            "</g>\n" +
            "</svg>");
    })
})

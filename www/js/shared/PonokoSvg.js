var should = require("should");
var XML = require("./XML");
var JsonUtil = require("./JsonUtil");

(function(exports) {
    ////////////////// constructor
    function PonokoSvg(options) {
        const that = this;

        // svg options
        options = options || {};
        that.precision = options.precision || 4;
        that.precisionFactor = Math.pow(10, Number(that.precision));
        that.template = options.template || "P1";
        if (that.template === "P1") {
            that.width = that.mm_to_pts(181);
            that.height = that.mm_to_pts(181);
        } else if (that.template === "P2") {
            that.width = that.mm_to_pts(384);
            that.height = that.mm_to_pts(384);
        } else if (that.template === "P3") {
            that.width = that.mm_to_pts(790);
            that.height = that.mm_to_pts(384);
        } else if (that.template === "24x12") {
            that.width = that.mm_to_pts(596);
            that.height = that.mm_to_pts(291);
        }
        options.width && (that.width = that.mm_to_pts(options.width && options.width || 100));
        options.height && (that.height = that.mm_to_pts(options.height && options.height || 100));
        that.textHeight = options.textHeight || 10;
        that.fontFamily = options.fontFamily || "Verdana";
        that.stroke = options.stroke || PonokoSvg.STROKE_ENGRAVE;
        that.strokeWidth = that.mm_to_pts(0.01);
        that.fill = options.fill || "none";
        that.scale = options.scale || {
            x: 1,
            y: 1
        };
        that.xml = new XML("svg");
        that.units = "pt";
        var svg = that.xml.root();
        svg.width = that.width + that.units;
        svg.height = that.height + that.units;
        svg.viewbox = "0 0 " + that.width + " " + that.height;
        that.gRoot = svg.addElement("g", {
            "transform": "scale(" + that.scale.x + "," + that.scale.y + ")",
        });
        return that;
    }
    
    PonokoSvg.prototype.addFrame  = function(options) {
        const that = this;
        options = options || {};
        options.stroke = options.stroke || PonokoSvg.STROKE_CUT;
        var wFrame = that.round(that.width - that.strokeWidth);
        var hFrame = that.round(that.height - that.strokeWidth);
        var rect = that.gRoot.addElement("rect", {
            x: that.round(that.strokeWidth/2),
            y: that.round(that.strokeWidth/2),
            style: that.svgStyle(options),
            width: wFrame,
            height: hFrame,
        });
        options.rx && (rect.rx = that.mm_to_pts(options.rx || 3));
        options.ry && (rect.ry = that.mm_to_pts(options.ry || 3));

        return that;
    }

    PonokoSvg.prototype.svgStyle = function(options) {
        const that = this;
        options = options || {};
        style = "";
        style += "fill:" + (options.fill || that.fill) + ";";
        style += "stroke:" + (options.stroke || that.stroke) + ";";
        style += "stroke-width:" + (options.strokeWidth || that.strokeWidth) + ";";
        style += "stroke-opacity:1;";
        return style;
    }

    PonokoSvg.prototype.addCartesianGrid = function(cellWidth, cellHeight, options) {
        const that = this;
        options = options || {};
        cellWidth = that.mm_to_pts(cellWidth);
        cellHeight = that.mm_to_pts(cellHeight);
        options.stroke = options.stroke || that.stroke;
        var gGrid = that.gRoot.addElement("g", {
            style: that.svgStyle(options),
        });

        var nRows = Math.ceil(that.height / cellHeight + 0.5);
        for (var r = -nRows; r <= nRows; r++) {
            var y = that.round(r * cellHeight);
            gGrid.addElement("line", {
                x1: -that.width,
                y1: y,
                x2: that.width,
                y2: y,
            });
        }

        var nCols = Math.ceil(that.width / cellWidth + 0.5);
        for (var c = -nCols; c <= nCols; c++) {
            var x = that.round(c * cellWidth);
            gGrid.addElement("line", {
                x1: x,
                y1: -that.height,
                x2: x,
                y2: that.height,
            });
        }


        return gGrid;
    }

    PonokoSvg.prototype.addCrashDummySymbol = function(x, y, options) {
        const that = this;
        options = options || {};
        options.fill = options.fill || ["#000000", "none", "#000000", "none"];
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

    PonokoSvg.prototype.serialize = function() {
        const that = this;
        return that.xml.serialize();
    }

    PonokoSvg.prototype.round = function(value) {
        const that = this;
        var result = JsonUtil.round(value, that.precisionFactor);
        return result;
    }

    PonokoSvg.prototype.pts_to_mm = function(pts) {
        const that = this;
        return that.round(pts * 25.4 / 72);
    }

    PonokoSvg.prototype.mm_to_pts = function(mm) {
        const that = this;
        return that.round(mm * 72 / 25.4);
    }

    // Class variables
    PonokoSvg.STROKE_CUT = "#0000ff";
    PonokoSvg.STROKE_ENGRAVE = "#ff0000";
    PonokoSvg.FILL_AREA = "#000000";

    module.exports = exports.PonokoSvg = PonokoSvg;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("PonokoSvg", function() {
    var PonokoSvg = exports.PonokoSvg;
    var options = {
        verbose: true
    };
    it("TESTTESTPonokoSvg(template) creates an Ponoko SVG document", function() {
        var p1 = new PonokoSvg();
        p1.should.properties({
            width: 513.0709,
            height: 513.0709,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0283,
        });
        var p2 = new PonokoSvg({
            template: "P2",
        });
        p2.should.properties({
            width: 1088.5039,
            height: 1088.5039,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0283,
        });
        var p3 = new PonokoSvg({
            template: "P3",
        });
        p3.should.properties({
            width: 2239.3701,
            height: 1088.5039,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0283,
        });
        var p24x12 = new PonokoSvg({
            template: "24x12",
        });
        p24x12.should.properties({
            width: 1689.4488,
            height: 824.8819,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0283,
        });
    });
    it("TESTTESTserialize() returns XML string for SVG document", function() {
        var svg = new PonokoSvg();
        svg.xml.serialize().should.equal('<svg width="513.0709pt" height="513.0709pt" viewbox="0 0 513.0709 513.0709">\n' +
            '<g transform="scale(1,1)"></g>\n' +
            "</svg>");
    });
    it("TESTTESTaddFrame(cornerRadius) adds frame to SVG document", function() {
        var svg = new PonokoSvg();
        svg.addFrame({
            rx:3,
            ry:3,
        });
        svg.serialize().should.equal('<svg width="513.0709pt" height="513.0709pt" viewbox="0 0 513.0709 513.0709">\n' +
            '<g transform="scale(1,1)">\n' +
            '<rect x="0.0142" y="0.0142"' + 
            ' style="fill:none;stroke:#0000ff;stroke-width:0.0283;stroke-opacity:1;" width="513.0426" height="513.0426"' +
            ' rx="8.5039" ry="8.5039"></rect>\n' +
            "</g>\n" +
            "</svg>");
    });
    it("TESTTESTaddCartesianGrid(cellWidth, cellHeight) adds a cartesian grid to SVG document", function() {
        var svg = new PonokoSvg({
            width: 6,
            height: 6,
        });
        svg.addCartesianGrid(2, 3);
        svg.serialize().should.equal('<svg width="17.0079pt" height="17.0079pt" viewbox="0 0 17.0079 17.0079">\n' +
            '<g transform="scale(1,1)">\n' +
            '<g style="fill:none;stroke:#ff0000;stroke-width:0.0283;stroke-opacity:1;">\n' +
            '<line x1="-17.0079" y1="-25.5117" x2="17.0079" y2="-25.5117"></line>\n' +
            '<line x1="-17.0079" y1="-17.0078" x2="17.0079" y2="-17.0078"></line>\n' +
            '<line x1="-17.0079" y1="-8.5039" x2="17.0079" y2="-8.5039"></line>\n' +
            '<line x1="-17.0079" y1="0" x2="17.0079" y2="0"></line>\n' +
            '<line x1="-17.0079" y1="8.5039" x2="17.0079" y2="8.5039"></line>\n' +
            '<line x1="-17.0079" y1="17.0078" x2="17.0079" y2="17.0078"></line>\n' +
            '<line x1="-17.0079" y1="25.5117" x2="17.0079" y2="25.5117"></line>\n' +
            '<line x1="-22.6772" y1="-17.0079" x2="-22.6772" y2="17.0079"></line>\n' +
            '<line x1="-17.0079" y1="-17.0079" x2="-17.0079" y2="17.0079"></line>\n' +
            '<line x1="-11.3386" y1="-17.0079" x2="-11.3386" y2="17.0079"></line>\n' +
            '<line x1="-5.6693" y1="-17.0079" x2="-5.6693" y2="17.0079"></line>\n' +
            '<line x1="0" y1="-17.0079" x2="0" y2="17.0079"></line>\n' +
            '<line x1="5.6693" y1="-17.0079" x2="5.6693" y2="17.0079"></line>\n' +
            '<line x1="11.3386" y1="-17.0079" x2="11.3386" y2="17.0079"></line>\n' +
            '<line x1="17.0079" y1="-17.0079" x2="17.0079" y2="17.0079"></line>\n' +
            '<line x1="22.6772" y1="-17.0079" x2="22.6772" y2="17.0079"></line>\n' +
            '</g>\n' +
            '</g>\n' +
            "</svg>");
    });
    it("addCrashDummySymbol(x,y) adds a CDS to SVG document", function() {
        var svg = new PonokoSvg();
        svg.addCrashDummySymbol(10, 20, {
            labelTop: "bien",
            labelBottom: "hello",
        });
        svg.xml.serialize().should.equal('<svg width="194mm" height="228mm" viewbox="-97 -114 194 228">\n' +
            '<g stroke-linecap="round" stroke-width="0.25" font-family="Verdana" transform="scale(1,1)">\n' +
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

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
        that.userUnits = options.userUnits || "mm";
        that.svgUnits = options.svgUnits || "px";
        var userUnitScale = 1;
        if (that.userUnits === "mm") {
            userUnitScale = 25.4;
        }
        var svgUnitScale = 1;
        if (that.svgUnits === "px") {
            svgUnitScale = 90;
        } else if (that.svgUnits === "pt") {
            svgUnitScale = 72;
        }
        that.unitScale = svgUnitScale/userUnitScale;
        that.template = options.template || "P1";
        if (that.template === "P1") {
            that.width = that.toSvgUnits(181);
            that.height = that.toSvgUnits(181);
        } else if (that.template === "P2") {
            that.width = that.toSvgUnits(384);
            that.height = that.toSvgUnits(384);
        } else if (that.template === "P3") {
            that.width = that.toSvgUnits(790);
            that.height = that.toSvgUnits(384);
        } else if (that.template === "24x12") {
            that.width = that.toSvgUnits(596);
            that.height = that.toSvgUnits(291);
        }
        options.width && (that.width = that.toSvgUnits(options.width && options.width || 100));
        options.height && (that.height = that.toSvgUnits(options.height && options.height || 100));
        that.textHeight = that.toSvgUnits(options.textHeight || 3);
        that.fontFamily = options.fontFamily || "Verdana";
        that.stroke = options.stroke || PonokoSvg.STROKE_ENGRAVE;
        that.strokeWidth = that.toSvgUnits(0.01);
        that.fill = options.fill || "none";
        that.scale = options.scale || {
            x: 1,
            y: 1
        };
        that.xml = new XML("svg");
        var svg = that.xml.root();
        svg.width = that.width + that.svgUnits;
        svg.height = that.height + that.svgUnits;
        svg.viewbox = "0 0 " + that.width + " " + that.height;

        that.defs = that.defs || svg.addElement("defs");
        that.gBase = svg.addElement("g", {
            transform: "scale(" + that.scale.x + "," + that.scale.y + ")" +
            " translate(" + that.round(that.width/2) + "," + that.round(that.height/2) +  ")",
            style: that.svgStyle(options),
        });
        var clipPath = that.defs.addElement("clipPath", {
            id: "clipPanel",
        });
        var clipMargin = that.strokeWidth;
        clipPath.addElement("rect", {
            x: that.round(-that.width/2+clipMargin),
            y: that.round(-that.height/2+clipMargin),
            width: that.round(that.width - 2*clipMargin),
            height: that.round(that.height - 2*clipMargin),
        });
        that.gRoot = that.gBase.addElement("g", {
            "clip-path":"url(#clipPanel)",
        });
            
        return that;
    }
    
    PonokoSvg.prototype.addFrame  = function(options) {
        const that = this;
        options = options || {};
        options.stroke = options.stroke || PonokoSvg.STROKE_CUT;
        var rect = that.xml.root().addElement("rect", {
            x: 0,
            y: 0,
            style: that.svgStyle(options),
            width: that.width,
            height: that.height,
        });
        options.rx && (rect.rx = that.toSvgUnits(options.rx || 3));
        options.ry && (rect.ry = that.toSvgUnits(options.ry || 3));

        return rect;
    }

    PonokoSvg.prototype.svgStyle = function(options) {
        const that = this;
        options = options || {};
        style = "";
        style += "fill:" + (options.fill || that.fill) + ";";
        style += "stroke:" + (options.stroke || that.stroke) + ";";
        style += "stroke-width:" + (options.strokeWidth || that.strokeWidth) + ";";
        style += "stroke-opacity:1;";
        options.fontFamily && (style += "font-family:" + options.fontFamily + ";");
        options.fontSize && (style += "font-size:" + options.fontSize + ";");
        return style;
    }

    PonokoSvg.prototype.addCartesianGrid = function(cellWidth, cellHeight, options) {
        const that = this;
        options = options || {};
        cellWidth = that.toSvgUnits(cellWidth);
        cellHeight = that.toSvgUnits(cellHeight);
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
        var lineOpts = JSON.parse(JSON.stringify(options || {}));
        var textOpts = JSON.parse(JSON.stringify(options || {}));
        var fill = options.fill || ["#000000", "none", "#000000", "none"];
        var height = that.toSvgUnits(options.height || 10);
        var h2 = that.round(height/2);
        x = that.toSvgUnits(x);
        y = that.toSvgUnits(y);
        textOpts.fontFamily = textOpts.fontFamily || "Verdana";
        textOpts.fontSize = that.toSvgUnits(textOpts.fontSize || 1.8);

        var gCDS = that.gRoot.addElement("g", {
            transform: "translate(" + x + "," + (-y) + ")",
        });
        lineOpts.fill = fill[0];
        gCDS.addElement("path", {
            d: "M0,0 v" + (-h2) + " a" + h2 + "," + h2 + " 0 0,0 " + (-h2) + "," + h2 + " z",
            style: that.svgStyle(lineOpts),
        });
        lineOpts.fill = fill[1];
        gCDS.addElement("path", {
            d: "M0,0 h" + h2 + " a" + h2 + "," + h2 + " 0 0,0 " + (-h2) + "," + (-h2) + " z",
            style: that.svgStyle(lineOpts),
        });
        lineOpts.fill = fill[2];
        gCDS.addElement("path", {
            d: "M0,0 v" + h2 + " a" + h2 + "," + h2 + " 0 0,0 " + h2 + "," + (-h2) + " z",
            style: that.svgStyle(lineOpts),
        });
        lineOpts.fill = fill[3];
        gCDS.addElement("path", {
            d: "M0,0 h" + (-h2) + " a" + h2 + "," + h2 + " 0 0,0 " + h2 + "," + h2 + " z",
            style: that.svgStyle(lineOpts),
        });
        var labelH = 1.2*textOpts.fontSize; // leading
        if (options.labelTop) {
            gCDS.addElement("text", {
                x: 0,
                y: that.round(-h2 - labelH/3),
                style: that.svgStyle(textOpts),
                "text-anchor": "middle",
            }).addText(options.labelTop);
        }
        if (options.labelBottom) {
            gCDS.addElement("text", {
                x: 0,
                y: that.round(h2 + 2*labelH/3),
                style: that.svgStyle(textOpts),
                "text-anchor": "middle",
            }).addText(options.labelBottom);
        }
        return gCDS;
    }

    PonokoSvg.prototype.addLine = function(x1, y1, x2, y2, options) {
        const that = this;
        var line = that.gRoot.addElement("line", {
            x1: that.toSvgUnits(x1),
            y1: that.toSvgUnits(y1),
            x2: that.toSvgUnits(x2),
            y2: that.toSvgUnits(y2),
            style: that.svgStyle(options),
        });
        return line;
    }

    PonokoSvg.prototype.addCircle = function(x, y, r, options) {
        const that = this;
        var circle = that.gRoot.addElement("circle", {
            cx: that.toSvgUnits(x),
            cy: that.toSvgUnits(y),
            r: that.toSvgUnits(r),
            style: that.svgStyle(options),
        });
        return circle;
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

    PonokoSvg.prototype.toSvgUnits = function(userUnits) {
        const that = this;
        return that.round(userUnits * that.unitScale);
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
    it("PonokoSvg(template) creates an Ponoko SVG document", function() {
        var p1 = new PonokoSvg();
        p1.should.properties({
            width: 641.3386,
            height: 641.3386,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0354,
        });
        var p2 = new PonokoSvg({
            template: "P2",
        });
        p2.should.properties({
            width: 1360.6299,
            height: 1360.6299,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0354,
        });
        var p3 = new PonokoSvg({
            template: "P3",
        });
        p3.should.properties({
            width: 2799.2126,
            height: 1360.6299,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0354,
        });
        var p24x12 = new PonokoSvg({
            template: "24x12",
        });
        p24x12.should.properties({
            width: 2111.811,
            height: 1031.1024,
            scale: {
                x: 1,
                y: 1,
            },
            stroke: "#ff0000",
            strokeWidth: 0.0354,
        });
    });
    it("serialize() returns XML string for SVG document", function() {
        var svg = new PonokoSvg();
        svg.xml.serialize().should.equal('<svg width="641.3386px" height="641.3386px" viewbox="0 0 641.3386 641.3386">\n' +
            '<defs>\n'+
            '<clipPath id="clipPanel">\n'+
            '<rect x="-320.6339" y="-320.6339" width="641.2678" height="641.2678"></rect>\n' +
            '</clipPath>\n'+
            '</defs>\n'+
            '<g transform="scale(1,1) translate(320.6693,320.6693)"' +
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<g clip-path="url(#clipPanel)"></g>\n' +
            '</g>\n' +
            "</svg>");
    });
    it("addFrame(cornerRadius) adds frame to SVG document", function() {
        var svg = new PonokoSvg();
        svg.addFrame({
            rx:3,
            ry:3,
        });
        svg.serialize().should.equal('<svg width="641.3386px" height="641.3386px" viewbox="0 0 641.3386 641.3386">\n' +
            '<defs>\n'+
            '<clipPath id="clipPanel">\n'+
            '<rect x="-320.6339" y="-320.6339" width="641.2678" height="641.2678"></rect>\n' +
            '</clipPath>\n'+
            '</defs>\n'+
            '<g transform="scale(1,1) translate(320.6693,320.6693)"' +
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<g clip-path="url(#clipPanel)"></g>\n' +
            '</g>\n' +
            '<rect x="0" y="0"' + 
            ' style="fill:none;stroke:#0000ff;stroke-width:0.0354;stroke-opacity:1;" width="641.3386" height="641.3386"' +
            ' rx="10.6299" ry="10.6299"></rect>\n' +
            "</svg>");
    });
    it("addCartesianGrid(cellWidth, cellHeight) adds a cartesian grid to SVG document", function() {
        var svg = new PonokoSvg({
            width: 6,
            height: 6,
        });
        svg.addCartesianGrid(2, 3);
        svg.serialize().should.equal('<svg width="21.2598px" height="21.2598px" viewbox="0 0 21.2598 21.2598">\n' +
            '<defs>\n'+
            '<clipPath id="clipPanel">\n'+
            '<rect x="-10.5945" y="-10.5945" width="21.189" height="21.189"></rect>\n' +
            '</clipPath>\n'+
            '</defs>\n'+
            '<g transform="scale(1,1) translate(10.6299,10.6299)"' +
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<g clip-path="url(#clipPanel)">\n' +
            '<g style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<line x1="-21.2598" y1="-31.8897" x2="21.2598" y2="-31.8897"></line>\n' +
            '<line x1="-21.2598" y1="-21.2598" x2="21.2598" y2="-21.2598"></line>\n' +
            '<line x1="-21.2598" y1="-10.6299" x2="21.2598" y2="-10.6299"></line>\n' +
            '<line x1="-21.2598" y1="0" x2="21.2598" y2="0"></line>\n' +
            '<line x1="-21.2598" y1="10.6299" x2="21.2598" y2="10.6299"></line>\n' +
            '<line x1="-21.2598" y1="21.2598" x2="21.2598" y2="21.2598"></line>\n' +
            '<line x1="-21.2598" y1="31.8897" x2="21.2598" y2="31.8897"></line>\n' +
            '<line x1="-28.3464" y1="-21.2598" x2="-28.3464" y2="21.2598"></line>\n' +
            '<line x1="-21.2598" y1="-21.2598" x2="-21.2598" y2="21.2598"></line>\n' +
            '<line x1="-14.1732" y1="-21.2598" x2="-14.1732" y2="21.2598"></line>\n' +
            '<line x1="-7.0866" y1="-21.2598" x2="-7.0866" y2="21.2598"></line>\n' +
            '<line x1="0" y1="-21.2598" x2="0" y2="21.2598"></line>\n' +
            '<line x1="7.0866" y1="-21.2598" x2="7.0866" y2="21.2598"></line>\n' +
            '<line x1="14.1732" y1="-21.2598" x2="14.1732" y2="21.2598"></line>\n' +
            '<line x1="21.2598" y1="-21.2598" x2="21.2598" y2="21.2598"></line>\n' +
            '<line x1="28.3464" y1="-21.2598" x2="28.3464" y2="21.2598"></line>\n' +
            '</g>\n' +
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
        svg.xml.serialize().should.equal('<svg width="641.3386px" height="641.3386px" viewbox="0 0 641.3386 641.3386">\n' +
            '<defs>\n'+
            '<clipPath id="clipPanel">\n'+
            '<rect x="-320.6339" y="-320.6339" width="641.2678" height="641.2678"></rect>\n' +
            '</clipPath>\n'+
            '</defs>\n'+
            '<g transform="scale(1,1) translate(320.6693,320.6693)"' +
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<g clip-path="url(#clipPanel)">\n' +
            '<g transform="translate(35.4331,-70.8661)">\n' +
            '<path d="M0,0 v-17.7166 a17.7166,17.7166 0 0,0 -17.7166,17.7166 z"'+
            ' style="fill:#000000;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;"></path>\n' +
            '<path d="M0,0 h17.7166 a17.7166,17.7166 0 0,0 -17.7166,-17.7166 z"'+
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;"></path>\n' +
            '<path d="M0,0 v17.7166 a17.7166,17.7166 0 0,0 17.7166,-17.7166 z"'+
            ' style="fill:#000000;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;"></path>\n' +
            '<path d="M0,0 h-17.7166 a17.7166,17.7166 0 0,0 17.7166,17.7166 z"'+
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;"></path>\n' +
            '<text x="0" y="-21.2599" style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;font-family:Verdana;font-size:5pt;" text-anchor="middle">bien</text>\n' +
            '<text x="0" y="24.8032" style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;font-family:Verdana;font-size:5pt;" text-anchor="middle">hello</text>\n' +
            "</g>\n" +
            "</g>\n" +
            "</g>\n" +
            "</svg>");
    })
    it("addLine(x,y) adds a line to SVG document", function() {
        var svg = new PonokoSvg();
        svg.addLine(10, 20, 5, -6, {
            stroke: PonokoSvg.STROKE_CUT,
        });
        svg.xml.serialize().should.equal('<svg width="641.3386px" height="641.3386px" viewbox="0 0 641.3386 641.3386">\n' +
            '<defs>\n'+
            '<clipPath id="clipPanel">\n'+
            '<rect x="-320.6339" y="-320.6339" width="641.2678" height="641.2678"></rect>\n' +
            '</clipPath>\n'+
            '</defs>\n'+
            '<g transform="scale(1,1) translate(320.6693,320.6693)"' +
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<g clip-path="url(#clipPanel)">\n' +
            '<line x1="35.4331" y1="70.8661" x2="17.7165" y2="-21.2598"' +
            ' style="fill:none;stroke:#0000ff;stroke-width:0.0354;stroke-opacity:1;">' +
            "</line>\n" +
            "</g>\n" +
            "</g>\n" +
            "</svg>");
    })
    it("addCircle(x,y) adds a circle to SVG document", function() {
        var svg = new PonokoSvg();
        svg.addCircle(10, 20, 5, {
            stroke: PonokoSvg.STROKE_CUT,
        });
        svg.xml.serialize().should.equal('<svg width="641.3386px" height="641.3386px" viewbox="0 0 641.3386 641.3386">\n' +
            '<defs>\n'+
            '<clipPath id="clipPanel">\n'+
            '<rect x="-320.6339" y="-320.6339" width="641.2678" height="641.2678"></rect>\n' +
            '</clipPath>\n'+
            '</defs>\n'+
            '<g transform="scale(1,1) translate(320.6693,320.6693)"' +
            ' style="fill:none;stroke:#ff0000;stroke-width:0.0354;stroke-opacity:1;">\n' +
            '<g clip-path="url(#clipPanel)">\n' +
            '<circle cx="35.4331" cy="70.8661" r="17.7165"' +
            ' style="fill:none;stroke:#0000ff;stroke-width:0.0354;stroke-opacity:1;">' +
            "</circle>\n" +
            "</g>\n" +
            "</g>\n" +
            "</svg>");
    })
})

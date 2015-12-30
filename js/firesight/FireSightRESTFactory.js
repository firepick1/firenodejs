var should = require("should");
var FireSightREST = require("./FireSightREST");
var CalcOffset = require("./CalcOffset");
var CalcGrid = require("./CalcGrid");
var CalcFgRect = require("./CalcFgRect");

(function(exports) {
    ////////////////// constructor
    function FireSightRESTFactory() {
        var that = this;
        return that;
    }
    FireSightRESTFactory.create = function(images, options) {
        var that = this;
        var firesight = new FireSightREST(images, options);
        firesight.open();
        firesight.registerCalc("CalcGrid", new CalcGrid(firesight, options));
        firesight.registerCalc("CalcOffset", new CalcOffset(firesight, options));
        firesight.registerCalc("CalcFgRect", new CalcFgRect(firesight, options));
        return firesight;
    }

    module.exports = exports.FireSightRESTFactory = FireSightRESTFactory;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("FireSightRESTFactory", function() {
    var FireSightRESTFactory = require("./FireSightRESTFactory.js");
    var MockImages = new require("../mock/MockImages");
    var mock_images = new MockImages();
    it("FireSightRESTFactory.create() should create a FireSightREST service", function() {
        var options = {};
        var firesight = FireSightRESTFactory.create(mock_images, options);
        firesight.isAvailable().should.equal(false);
        setTimeout(function() {
            firesight.isAvailable().should.equal(true);
        }, 100);
        firesight.calcs.should.exist;
        firesight.calcs.should.have.property("CalcGrid");
        firesight.calcs.should.have.property("CalcOffset");
        firesight.calcs.should.have.property("CalcFgRect");;
    })
})

var path = require("path");
var should = require("should");
var MockCamera = require("./MockCamera");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function MockImages(options) {
        var that = this;
        options = options || {};

        that.model = {};
        that.verbose = options.verbose;
        that.mock_location = "x0_y0_z0";
        that.camera = new MockCamera();
        that.firestep = {model:{rest:{msSettle:600}}};

        return that;
    }
    MockImages.prototype.location = function() {
        var that = this;
        return that.mock_location;
    }
    MockImages.prototype.isAvailable = function() {
        return true;
    }
    MockImages.prototype.savedImagePath = function(camName) {
        var that = this;
        return that.storeDir() + "/" + camName;
    }
    MockImages.prototype.storeDir = function(dir, camera) {
        var that = this;
        return '/var/img';
    }

    module.exports = exports.MockImages = MockImages;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockImages", function() {
    var MockImages = require("../mock/MockImages");
    it("new MockImages() should create a mock images", function() {
        var images = new MockImages();
        images.isAvailable().should.equal(true);
        images.storeDir().should.equal("/var/img");
        images.savedImagePath("test-camera").should.equal("/var/img/test-camera");
    });
})

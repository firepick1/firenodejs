var path = require("path");
var should = require("should");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function MockCamera(options) {
        var that = this;
        options = options || {};

        that.model = {};
        that.verbose = options.verbose;
        that.name = options.cameraName || "mock_camera";
        that.msSettle = 1;
        that.mockImagePath = options.mockImagePath || "../../www/img/no-image.jpg";

        return that;
    }
    MockCamera.prototype.isAvailable = function() {
        return true;
    }
    MockCamera.prototype.capture = function(name, onSuccess, onFail) {
        var that = this;
        onSuccess(that.mockImagePath);
    }

    module.exports = exports.MockCamera = MockCamera;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("MockCamera", function() {
    var MockCamera = require("../mock/MockCamera");
    it("new MockCamera() should create a mock images", function() {
        var camera = new MockCamera();
        camera.name.should.equal("mock_camera");
        camera.isAvailable().should.equal(true);
    });
})

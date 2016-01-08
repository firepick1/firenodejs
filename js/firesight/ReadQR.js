var child_process = require('child_process');
var path = require("path");
var should = require("should");

(function(exports) {
    ////////////////// constructor
    function ReadQR(firesight, options) {
        var that = this;
        options = options || {};

        should(firesight).exist;
        that.verbose = options.verbose;
        that.firesight = firesight;
        that.pipeline = "json/read-qr.json";

        return that;
    }
    ReadQR.prototype.calculate = function(camName, onSuccess, onFail) {
        var that = this;
        var firesight = that.firesight;
        camName = typeof camName == "undefined" ? firesight.camera.name : camName;
        var loc = firesight.images.location();
        var args = "";
        var onReadQR = function(stdout, stderr, fail) {
            var outJson;
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                } catch (e) {
                    fail("FireSightREST.ReadQR(" + loc + ") could not parse JSON:" + stdout);
                }
            }
            if (outJson && outJson.qr.qrdata.length) {
                var result = outJson.qr;
                console.log("INFO\t: FireSightREST.ReadQR(" + loc + ") " + JSON.stringify(result));
                onSuccess(result);
            } else {
                fail("FireSightREST.ReadQR(" + loc + ") no match");
            }
        };
        return firesight.calcImage(camName, "json/read-qr.json", args, onReadQR, onFail);
    }

    module.exports = exports.ReadQR = ReadQR;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("ReadQR", function() {
    var MockImages = require("../mock/MockImages");
    var mockImages = new MockImages();
    var mockCamera = mockImages.camera;
    var FireSightREST = require("../firesight/FireSightREST");
    var firesight = new FireSightREST(mockImages, {
        verbose: true,
        appDir: "../../",
    });
    var ReadQR = require("./ReadQR");
    it("ReadQR() should calculate minimum bounding rectangle of foreground at current location", function() {
        var rqr = new ReadQR(firesight, {
            verbose: true
        });
        var mockImagePath = "../../www/img/qr-waldo-50.png";
        var cmd = firesight.buildCommand(mockCamera.name, rqr.pipeline, "", mockImagePath);
        cmd.should.equal("firesight -i " + mockImagePath +
            " -p ../../json/read-qr.json" +
            " -o /var/img/mock_camera_x0_y0_z0.jpg" +
            " " +
            " | tee /var/img/mock_camera_x0_y0_z0.json"
        );
        var callbacks = 0;
        var execResult = child_process.exec(cmd, function(error, stdout, stderr) {
            should(error instanceof Error).equal(false);
            stderr.should.equal("");
            should.deepEqual(JSON.parse(stdout), {
                qr: {
                    qrdata: [{
                        text: 'Waldo was here',
                        x: 25,
                        y: 25
                    }]
                }
            });
            callbacks++;
        });
    });
})

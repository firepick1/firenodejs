var child_process = require('child_process');
var path = require("path");
var should = require("should");

(function(exports) {
    ////////////////// constructor
    function ReadQR(firesight, options) {
        var that = this;
        options = options || {};

        should && should.exist(firesight);
        that.verbose = options.verbose;
        that.firesight = firesight;
        that.pipeline = "json/read-qr.json";

        return that;
    }
    ReadQR.prototype.calculate = function(camName, onSuccess, onFail, options) {
        var that = this;
        options = options || {};
        var firesight = that.firesight;
        camName = typeof camName == "undefined" ? firesight.camera.name : camName;
        var loc = firesight.images.location();
        var args = "";
        var result = {
            summary: "No match",
            qrdata: [],
        };
        var onReadQR = function(stdout, stderr, fail) {
            var outJson;
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                } catch (e) {
                    result.summary = "No match (JSON parse error)";
                    console.log("WARN\t: FireSightREST.ReadQR(" + loc + ") could not parse Json;" + stdout);
                    console.log("WARN\t: FireSightREST.ReadQR(" + loc + ") " + JSON.stringify(result));
                    onSuccess(result);
                    return that;
                }
            }
            if (outJson && outJson.qr.qrdata.length) {
                result = outJson.qr;
                result.summary = "Matched " + result.qrdata.length;
                result.class = "";
                console.log("INFO\t: FireSightREST.ReadQR(" + loc + ") " + JSON.stringify(result));
            }
            onSuccess(result);
            return that;
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

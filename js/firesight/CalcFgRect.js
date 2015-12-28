var child_process = require('child_process');
var path = require("path");
var should = require("should");

(function(exports) {
    ////////////////// constructor
    function CalcFgRect(firesight, options) {
        var that = this;
        options = options || {};
        should(firesight).exist;

        that.verbose = options.verbose;
        that.firesight = firesight;
        that.pipeline = "json/calc-fg-rect.json";

        return that;
    }
    CalcFgRect.prototype.calculate = function(camName, onSuccess, onFail) {
        var that = this;
        var firesight = that.firesight;
        camName = typeof camName == "undefined" ?  firesight.camera.name : camName;
        var loc = firesight.images.location();
        var savedImage = firesight.images.savedImagePath(camName);
        if (!savedImage) {
            onFail(new Error("FireSightREST.CalcFgRect() no saved image"));
            return that;
        }
        var args = "-DbgImg=" + savedImage;
        var onCalcFgRect = function(stdout, stderr, fail) {
            var outJson;
            if (stdout && stdout.length > 0) {
                try {
                    outJson = JSON.parse(stdout);
                    console.log(stdout);
                    onSuccess(outJson);
                } catch (e) {
                    fail("FireSightREST.CalcFgRect(" + loc + ") could not parse JSON:" + stdout);
                }
            }
        };
        return firesight.calcImage(camName, that.pipeline, args, onCalcFgRect, onFail);
    }

    module.exports = exports.CalcFgRect = CalcFgRect;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("CalcFgRect", function() {
    var MockImages = require("../mock/MockImages");
    var mockImages = new MockImages();
    var mockCamera = mockImages.camera;
    var FireSightREST = require("../firesight/FireSightREST");
    var firesight = new FireSightREST(mockImages, {
        verbose:true,
        appDir:"../../",
    });
    var CalcFgRect = require("./CalcFgRect");
    it("CalcFgRect() should calculate minimum bounding rectangle of foreground at current location", function() {
        var fgRect = new CalcFgRect(firesight, {verbose:true});
        var savedImage = "../../www/img/pcb.jpg";
        var args = "-DbgImg=" + savedImage;
        var mockImagePath = "../../www/img/pcb-firesight.jpg";
        var cmd = firesight.buildCommand(mockCamera.name, fgRect.pipeline, args, mockImagePath);
        cmd.should.equal("firesight -i " + mockImagePath +
            " -p ../../json/calc-fg-rect.json" +
            " -o /var/img/mock_camera_x0_y0_z0.jpg" +
            " -DbgImg=" + savedImage +
            " | tee /var/img/mock_camera_x0_y0_z0.json"
        );
        var callbacks = 0;
        var execResult = child_process.exec(cmd, function(error, stdout, stderr) {
            should(error instanceof Error).equal(false);
            stderr.should.equal("");
            should.deepEqual(JSON.parse(stdout), {
                s1:{},
                s2:{},
                singleBlob:{
                    rects: [{
                        x:323.471,
                        y:65.7342,
                        width:30.5843,
                        height:145.516,
                        angle:-87.7543,
                    }],
                    points:1775
                },
                s4:{}
            });
            callbacks++;
        });
    });
})

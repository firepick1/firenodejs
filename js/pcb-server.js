var child_process = require('child_process');
var fs = require("fs");
var path = require("path");
var jspcb = require("jspcb");
var PcbTransform = jspcb.PcbTransform;

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function PcbServer(options) {
        var that = this;
        options = options || {};
        that.model = {
            name: "PcbServer",
            available: true,
            uploadCount: 0,
            version: new PcbTransform().version(),
            gerberLayers: {},
            bounds: {
                l: null,
                t: null,
                r: null,
                b: null,
            },
            eagle: {},
            colors: {
                board: "#004",
                pads: "#f00",
            },
            fileFormat: "SparkFun",
        };
        console.log("PCB\t: jspcb v"+that.model.version);
        that.path = options.path || "/var/firenodejs/pcb/";
        fs.mkdir(that.path, null, function(err) {
            if (!err) {
                console.log("PCB\t: created", that.path);
            }
        });

        return that;
    }

    PcbServer.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }
    PcbServer.prototype.onPostFile = function(req, res) {
        var that = this;
        var response = {
            body: Object.keys(req),
            files: req.files,
            status: "OK",
        }
        for (var iFile = 0; iFile < req.files.length; iFile++) {
            var file = req.files[iFile];
            var fileType = req.body.fileType[iFile];
            var pcbFile = that.path + file.originalname;
            if (fs.existsSync(pcbFile)) {
                fs.unlinkSync(pcbFile);
            }
            fs.linkSync(file.path, pcbFile);

            if (fileType === "BRD") {
                that.model.eagle.path = pcbFile;
                console.log("PCB\t: uploaded", file.originalname, "as Eagle BRD", pcbFile);
            } else if (fileType === "GKO" || fileType==="GTP") {
                that.model.gerberLayers[fileType] = pcbFile;
                console.log("PCB\t: uploaded", file.originalname, "as Gerber", fileType, pcbFile);
            } else {
                res.status(500);
                response.status = "Invalid fileType:" + fileType;
                return response;
            }
        }

        var now = new Date();
        that.model.uploadDate = now.toLocaleDateString() + "@" + now.toLocaleTimeString();
        that.model.status = "uploaded files:" + req.files.length;
        that.model.svg = that.model.svg || {};
        that.model.svg.path = path.join(that.path, "pcb.svg");
        fs.existsSync(that.model.svg.path) && fs.unlink(that.model.svg.path);
        that.model.png = that.model.png || {};
        that.model.png.path = path.join(that.path, "pcb.png");
        fs.existsSync(that.model.png.path) && fs.unlink(that.model.png.path);
        var xfmFile = path.join(that.path, "transform.json");
        fs.writeFileSync(xfmFile, JSON.stringify(that.model, null, "    "));
        if (that.model.gerberLayers.GKO || that.model.eagle.path) {
            console.log("PCB\t: spawning transformation...");
            var cp = child_process.spawn("node", ['js/pcb-transform.js', xfmFile]);
            cp.on('close', (code) => {
                console.log("PCB\t: transformation complete code:", code);
                that.model.uploadCount = (that.model.uploadCount || 0) + 1;
            });
        }

        return that.model;
    }

    module.exports = exports.PcbServer = PcbServer;
})(typeof exports === "object" ? exports : (exports = {}));

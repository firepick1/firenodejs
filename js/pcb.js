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

        that.model = {};
        that.model.name = "PcbServer";
        that.model.available = true;
        that.model.version = new PcbTransform().version();
        that.model.gerberLayers = {};
        that.model.eagle = {};
        that.model.colors = {
            board: "#004",
            smdpads: "#f00",
        };
        that.model.fileFormat = "SparkFun";
        console.log("PCB\t: jspcb v"+that.model.version);
        that.path = options.path || "/var/firenodejs/pcb/";
        that.xfm = {
            gerberFiles:{},
        };
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
    PcbServer.prototype.onPostFile = function(req, res, fileType, fileName) {
        var that = this;
        var baseName = path.basename(fileName);
        var response = {
            type: fileType,
            name: baseName,
            body: Object.keys(req),
            files: req.files,
            status: "OK",
        }
        if (req.files.length === 1) {
            var file = req.files[0];
            //var pcbFile = that.path + "upload." + fileType;
            var pcbFile = that.path + baseName;
            if (fs.existsSync(pcbFile)) {
                fs.unlinkSync(pcbFile);
            }
            fs.linkSync(file.path, pcbFile);
            if (fileType === "GKO" || fileType==="GTP") {
                that.model.gerberLayers[fileType] = pcbFile;
                console.log("PCB\t: uploaded", fileName, "as Gerber ", fileType, pcbFile);
            } else if (fileType === "BRD") {
                that.model.eagle.path = pcbFile;
                console.log("PCB\t: uploaded", fileName, "as Eagle BRD", pcbFile);
            } else {
                res.setStatus(500);
                response.status = "Invalid fileType:" + fileType;
                return response;
            }
        } else {
            response.status = "Expected single file upload fileType:" + fileType + " fileName:"+ baseName;
            res && res.setStatus(500);
            return response;
        }
        return that.model;
    }

    module.exports = exports.PcbServer = PcbServer;
})(typeof exports === "object" ? exports : (exports = {}));

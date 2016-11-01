var child_process = require('child_process');
var fs = require("fs");
var JsPcb = require("jspcb");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function PcbServer(options) {
        var that = this;
        options = options || {};

        that.model = {};
        that.model.name = "PcbServer";
        that.model.available = true;
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
    PcbServer.prototype.postFile = function(req, res, fileType, fileName) {
        var that = this;
        var response = {
            type: fileType,
            name: fileName,
            body: Object.keys(req),
            files: req.files,
            status: "OK",
        }
        if (req.files.length === 1) {
            var file = req.files[0];
            var pcbFile = that.path + "upload." + fileType;
            if (fs.existsSync(pcbFile)) {
                fs.unlinkSync(pcbFile);
            }
            fs.linkSync(file.path, pcbFile);
        } else {
            response.status = "Expected single file upload fileType:" + fileType + " fileName:"+ fileName;
            res && res.setStatus(500);
        }
        return response;
    }

    module.exports = exports.PcbServer = PcbServer;
})(typeof exports === "object" ? exports : (exports = {}));

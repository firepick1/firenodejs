console.log("INFO\t: loading FireSight");
var child_process = require('child_process');
var path = require("path");

module.exports.FireSight = (function() {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FireSight(options) {
        var that = this;
        options = options || {};
        options.model = options.model || {};

        that.model = options.model;
        that.model.isAvailable = null;
        var cmd = "firesight -version";
        var result = child_process.exec(cmd, function(error, stdout, stderr) {
            if (error) {
                console.log("WARN\t: firesight unavailable", error);
                that.model.isAvailable = false;
            } else {
                that.model.version = JSON.parse(stdout).version;
                that.model.isAvailable = true;
                console.log("INFO\t: firesight", that.model);
            }
        });

        return that;
    }

    FireSight.prototype.getModel = function() {
        var that = this;
        return that.model;
    }

    return FireSight;
})();

var child_process = require('child_process');
var fs = require("fs");
var path = require("path");

(function(exports) {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FirePaste(options) {
        var that = this;
        options = options || {};
        that.model = { // default values provided by client
            name: "FirePaste",
            available: true,
            kinematics: {
                xAxis: { /* initialized in client */ },
                yAxis: { /* initialized in client */ },
                zAxis: { /* initialized in client */ },
            },
        };

        return that;
    }

    FirePaste.prototype.isAvailable = function() {
        var that = this;
        return that.model.available === true;
    }

    module.exports = exports.FirePaste = FirePaste;
})(typeof exports === "object" ? exports : (exports = {}));

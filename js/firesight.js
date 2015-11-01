console.log("INFO\t: loading FireSight");
var child_process = require('child_process');
var path = require("path");

module.exports.FireSight = (function() {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function FireSight(options) {
        var that = this;
        options = options || {};
        options.model = options.model || {isAvailable: false};

        that.model = options.model;
        return that;
    }

    FireSight.prototype.getModel = function() {
        var that = this;
        return that.model;
    }

    return FireSight;
})();

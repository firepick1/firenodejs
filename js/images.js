console.log("INFO\t: loading images service");
var child_process = require('child_process');
var path = require("path");

module.exports.Images = (function() {
    ///////////////////////// private instance variables

    ////////////////// constructor
    function Images(firestep, camera, options) {
        var that = this;
        options = options || {};
        options.model = options.model || {isAvailable: false};

        that.model = options.model;
        that.isAvailable = false;
        if ((that.firestep = firestep) == null) throw new Error("firestep is required");
        if ((that.camera = camera) == null) throw new Error("camera is required");;
        that.isAvailable = true;

        return that;
    }

    Images.prototype.location = function() {
        var that = this;
        console.log("HI");
        return "X1Y2Z3";
    }

    return Images;
})();

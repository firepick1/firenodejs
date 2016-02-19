const EventEmitter = require('events');
const util = require('util');

var Logger = require("../www/js/shared/Logger");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function UpdateService(options) {
        var that = this;
        EventEmitter.call(that);
        util.inherits(that.constructor, EventEmitter);

        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        that.on("beforeUpdate", function() {
            that.verbose &&
                verboseLogger.debug("DEBUG\t: UpdateService-beforeUpdate");
        });
        that.on("afterUpdate", function() {
            that.verbose &&
                verboseLogger.debug("DEBUG\t: UpdateService-afterUpdate");
        });

        return that;
    }
    UpdateService.prototype.onBeforeUpdate = function(callback) {
        var that = this;
        that.on("beforeUpdate", callback);
    }
    UpdateService.prototype.onAfterUpdate = function(callback) {
        var that = this;
        that.on("afterUpdate", callback);
    }
    UpdateService.prototype.emitAfterUpdate = function() {
        var that = this;
        that.emit("afterUpdate");
    }
    UpdateService.prototype.emitBeforeUpdate = function() {
        var that = this;
        that.emit("beforeUpdate");
    }

    module.exports = exports.UpdateService = UpdateService;
})(typeof exports === "object" ? exports : (exports = {}));

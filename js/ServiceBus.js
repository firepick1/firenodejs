const EventEmitter = require('events');
const util = require('util');

var Logger = require("../www/js/shared/Logger");
var JsonUtil = require("../www/js/shared/JsonUtil");

(function(exports) {
    var verboseLogger = new Logger({
        logLevel: "debug"
    });

    ////////////////// constructor
    function ServiceBus(options) {
        var that = this;
        EventEmitter.call(that);
        util.inherits(that.constructor, EventEmitter);

        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }
    ServiceBus.prototype.onSaveModels = function(callback) {
        var that = this;
        that.on("saveModels", callback);
    }
    ServiceBus.prototype.onBeforeUpdate = function(callback) {
        var that = this;
        that.on("beforeUpdate", callback);
    }
    ServiceBus.prototype.onAfterUpdate = function(callback) {
        var that = this;
        that.on("afterUpdate", callback);
    }
    ServiceBus.prototype.onBeforeRestore = function(callback) {
        var that = this;
        that.on("beforeRestore", callback);
    }
    ServiceBus.prototype.onBeforeRebase = function(callback) {
        var that = this;
        that.on("beforeRebase", callback);
    }

    ServiceBus.prototype.emitSaveModels = function() {
        var that = this;
        that.verbose && verboseLogger.debug("ServiceBus: emitSaveModels");
        that.emit("saveModels");
    }
    ServiceBus.prototype.emitAfterUpdate = function() {
        var that = this;
        that.verbose && verboseLogger.debug("ServiceBus: emitAfterUpdate");
        that.emit("afterUpdate");
    }
    ServiceBus.prototype.emitBeforeUpdate = function() {
        var that = this;
        that.verbose && verboseLogger.debug("ServiceBus: emitBeforeUpdate");
        that.emit("beforeUpdate");
    }
    ServiceBus.prototype.emitBeforeRestore = function(savedModels) {
        var that = this;
        that.verbose && verboseLogger.debug("ServiceBus: emitBeforeRestore", JsonUtil.summarize(savedModels,1));
        that.emit("beforeRestore", savedModels);
    }
    ServiceBus.prototype.emitBeforeRebase = function() {
        var that = this;
        that.verbose && verboseLogger.debug("ServiceBus: emitBeforeRebase");
        that.emit("beforeRebase");
    }

    module.exports = exports.ServiceBus = ServiceBus;
})(typeof exports === "object" ? exports : (exports = {}));

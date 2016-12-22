
var JsonUtil = require("../www/js/shared/JsonUtil");
var Logger = require("../www/js/shared/Logger");
var Synchronizer = require("../www/js/shared/Synchronizer");

(function(exports) {
    ////////////////// constructor
    function RestSync(options) {
        var that = this;

        options = options || {};

        that.verbose = options.verbose;
        that.synchronizer = options.synchronizer;

        return that;
    }

    RestSync.prototype.setSynchronizer = function(synchronizer) {
        var that = this;
        that.synchronizer = synchronizer;
    }
    RestSync.prototype.syncResponse = function(request, resultPromise) {
        // Return chained promise that constructs http response wrapper for
        // server data/error as well as client synchronization delta.
        // This REST protocol synchronizes client/server models efficiently
        // by decorating REST requests with synchronization information.
        var that = this;
        return new Promise((resolve, reject) => {
            resultPromise.then( data => {
                resolve({
                    data: data,
                    sync: request.sync && that.synchronizer.sync(request.sync),
                });
            }, err => {
                reject({
                    error: err,
                    sync: request.sync && that.synchronizer.sync(request.sync),
                });
            });
        });
    }

    module.exports = exports.RestSync = RestSync;
})(typeof exports === "object" ? exports : (exports = {}));

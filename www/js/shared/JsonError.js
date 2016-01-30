
var should = require("should");

(function(exports) {

    ////////////////// constructor
    function JsonError(message,options) {
        var that = Error.call(this, typeof message === "string" ? message : null);

        if (message instanceof Error) {
            that.error = message.message;
        } else if (typeof message === "string") {
            that.error = message;
        } else if (message == null) {
            that.error = "null";
        } else if (typeof message === "object") {
            var keys = Object.keys(message);
            that.error = "null";
            for (var i=0; i<keys.length; i++) {
                that[keys[i]] = message[keys[i]];
            }
        }
        options = options || {};
        if (options.verbose) {
            that.verbose = options.verbose;
        }

        return that;
    }

    JsonError.prototype = Object.create(Error.prototype); // inherits
    JsonError.prototype.constructor = JsonError;

    module.exports = exports.JsonError = JsonError;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("JsonError", function() {
    var JsonError = require("./JsonError");
    it("JsonError(message) creates a serializable error", function() {
        var e = new Error("error-message");
        e.message.should.equal("error-message");
        var je = new JsonError("error-message");
        should.deepEqual(JSON.parse(JSON.stringify(je)), {
            error:"error-message",
        });
        je.message.should.equal("error-message");
        je.should.instanceOf(Error);
    })
    it("JsonError(object) creates a serializable error", function() {
        var je = new JsonError({
            statusCode:500,
            error:"error-message",
        });
        should.deepEqual(JSON.parse(JSON.stringify(je)), {
            statusCode:500,
            error:"error-message",
        });
        je.should.instanceOf(Error);
    })
    it("JsonError(Error) creates a serializable error", function() {
        var e = new Error("error-message");
        var je = new JsonError(e);
        should.deepEqual(JSON.parse(JSON.stringify(je)), {
            error:"error-message",
        });
        je.should.instanceOf(Error);
    })
})

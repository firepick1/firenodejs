var exports = typeof exports === "object" ? exports : {};
var module = typeof module === "object" ? module : {};
require = typeof require === "function" ? require : function(path) {
    var tokens = path.split("/");
    var name = tokens[tokens.length - 1];
    if (exports.hasOwnProperty(name)) {
        return exports[name];
    }
    return null;
};

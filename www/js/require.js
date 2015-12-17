firepick = typeof firepick === "object" ? firepick : {};
require = typeof require === "function" ? require : function(path) {
    var tokens = path.split("/");
    var name = tokens[tokens.length - 1];
    if (typeof firepick[name] === "function") {
        return firepick[name];
    }
    if (module && module.exports && typeof module.exports[name] === "function") {
        return module.exports[name];
    }
    return null;
};

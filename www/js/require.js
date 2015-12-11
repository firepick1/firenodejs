firepick = typeof firepick === "object" ? firepick : {};
require = typeof require === "function" ? require : function(path) {
    var tokens = path.split("/");
    var name = tokens[tokens.length - 1];
    if (typeof firepick[name] === "function") {
        return firepick[name];
    }
    return null;
};

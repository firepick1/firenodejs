(function(exports) {
    function applyJson(dst, update) {
        if (dst == null || update == null) {
            return null;
        }
        var keys = Object.keys(update);
        for (var i = keys.length; i-- > 0;) {
            var key = keys[i];
            var value = update[key];
            if (value == null) {
                // nothing to do
            } else if (typeof value === 'string') {
                dst[key] = value;
            } else if (typeof value === 'number') {
                dst[key] = value;
            } else if (typeof value === 'boolean') {
                dst[key] = value;
            } else {
                if (dst.key == null) {
                    dst[key] = {};
                }
                applyJson(dst[key], value);
            }
        }
        return dst;
    }
    function summarize(data, lvl) {
        var s = "";
        lvl = lvl == null ? 100 : lvl;
        if (lvl < 0) {
            return "_";
        }

        if (data == null) {
            s += "null";
        } else if (typeof data === "boolean") {
            s += data;
        } else if (typeof data === "string") {
            s += data;
        } else if (typeof data === "number") {
            s += data;
        } else if (typeof data === "object") {
            var keys = Object.keys(data);
            if (data instanceof Array) {
                s += "[";
                for (var i=0; i<keys.length; i++) {
                    if (i) {
                        s += ","
                    }
                    s += summarize(data[i], lvl-1);
                }
                s += "]";
            } else {
                s += "{";
                for (var i=0; i<keys.length; i++) {
                    if (i) {
                        s += ","
                    }
                    s += keys[i];
                    s += ":";
                    s += summarize(data[keys[i]], lvl-1);
                }
                s += "}";
            }
        } else {
            s += "?";
        }

        return s;
    }

    var JsonUtil = {
        applyJson: applyJson,
        summarize: summarize,
    }
    module.exports = exports.JsonUtil = JsonUtil;
})(typeof exports === "object" ? exports : (exports = {}));

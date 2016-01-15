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

    var JsonUtil = {
        applyJson: applyJson,
    }
    module.exports = exports.JsonUtil = JsonUtil;
})(typeof exports === "object" ? exports : (exports = {}));

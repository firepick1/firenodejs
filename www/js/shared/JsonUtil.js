var should = require("should");

(function(exports) {
    // return true if null, {}, [], or ""
    function isEmpty(obj) {
        if (obj == null) {
            return true;
        }
        if (typeof obj === "string") {
            return obj.length === 0;
        } else if (typeof obj !== "object") {
            return false;
        } else {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    return false;
                }
            }
        }
        return true;
    }

    function summarize(data, lvl) {
        var s = "";
        lvl = lvl == null ? 100 : lvl;

        if (data == null) {
            s += "null";
        } else if (typeof data === "boolean") {
            s += data;
        } else if (typeof data === "string") {
            s += "'" + data + "'";
        } else if (typeof data === "number") {
            s += data;
        } else if (typeof data === "object") {
            if (lvl < 0) {
                return "_";
            }
            var keys = Object.keys(data);
            if (data instanceof Array) {
                s += "[";
                for (var i = 0; i < keys.length; i++) {
                    if (i) {
                        s += ","
                    }
                    s += summarize(data[i], lvl - 1);
                }
                s += "]";
            } else {
                s += "{";
                for (var i = 0; i < keys.length; i++) {
                    if (i) {
                        s += ","
                    }
                    s += keys[i];
                    s += ":";
                    s += summarize(data[keys[i]], lvl - 1);
                }
                s += "}";
            }
        } else {
            s += "?";
        }

        return s;
    }

    function applyJson(dst, delta) {
        if (dst == null || delta == null) {
            return null;
        }
        dst.should.not.instanceof(Array);
        dst.should.instanceof(Object);
        var keys = Object.keys(delta);
        for (var i = keys.length; i-- > 0;) {
            var key = keys[i];
            var value = delta[key];
            if (dst[key] == null) {
                dst[key] = value;
            } else if (value == null) {
                dst[key] = value;
            } else if (dst[key] instanceof Array) {
                dst[key] = value;
            } else if (value instanceof Array) {
                dst[key] = value;
            } else if (typeof dst[key] == 'object' && typeof value === 'object') {
                applyJson(dst[key], value);
            } else {
                dst[key] = value;
            }
        }
        return dst;
    }

    var JsonUtil = {
        applyJson: applyJson,
        summarize: summarize,
        isEmpty: isEmpty,
    }
    module.exports = exports.JsonUtil = JsonUtil;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("JsonUtil", function() {
    var JsonUtil = exports.JsonUtil;
    it("isEmpty(v) should return true for null, {}, [], or ''", function() {
        var x;
        JsonUtil.isEmpty(null).should.true;
        JsonUtil.isEmpty(x).should.true;
        JsonUtil.isEmpty({}).should.true;
        JsonUtil.isEmpty([]).should.true;
        JsonUtil.isEmpty("").should.true;
        JsonUtil.isEmpty(0).should.false;
        JsonUtil.isEmpty(" ").should.false;
        JsonUtil.isEmpty(function() {}).should.false;
        JsonUtil.isEmpty(false).should.false;
    });
    it("applyJson(dst, delta) should update dst with delta", function() {
        should.deepEqual(JsonUtil.applyJson({}, {
            a: "av"
        }), {
            a: "av"
        });
        should.deepEqual(JsonUtil.applyJson({
            a: "a1",
            c: "c1",
            d: "d1",
        }, {
            a: "a2",
            b: "b1",
            d: null,
        }), {
            a: "a2",
            b: "b1",
            c: "c1",
            d: null,
        });
        should.deepEqual(JsonUtil.applyJson({
            x:"x1",
            y:{
                a: "a1",
                c: "c1",
            },
        }, {
            y: {
                a: "a2",
                b: "b1",
            },
            z:{
                d: "d1",
                e: "e1",
            },
        }), {
            x:"x1",
            y:{
                a: "a2",
                b: "b1",
                c: "c1",
            },
            z:{
                d: "d1",
                e: "e1",
            },
        });
        should.deepEqual(JsonUtil.applyJson({
            a: {x:"x2"}
        }, {
            a: [1,2]
        }), {
            a: [1,2]
        });
        should.deepEqual(JsonUtil.applyJson({
            a:[1,2]
        }, {
            a: {b:"b2"}
        }), {
            a: {b:"b2"}
        });
        should.deepEqual(JsonUtil.applyJson({
            a:1
        }, {
            a: {b:"b2"}
        }), {
            a: {b:"b2"}
        });
        should.deepEqual(JsonUtil.applyJson({}, {
            a: ["a2"]
        }), {
            a: ["a2"]
        });
        should.deepEqual(JsonUtil.applyJson({
            a: {
                b: [],
                c: "red"
            }
        }, {
            a: {
                b: [{
                    x:"x1"
                }],
                d:"d1",
            }
        }), {
            a: {
                b: [{
                        x: "x1"
                    }], 
                c: "red",
                d: "d1",
            }
        });
        should.deepEqual(JsonUtil.applyJson({
            a: [1, 2]
        }, {
            a: [2, 3]
        }), {
            a: [2, 3]
        });
    });
})

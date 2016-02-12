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
            var deltaVal = delta[key];
            var dstVal = dst[key];
            if (dstVal == null) {
                dst[key] = deltaVal;
            } else if (deltaVal == null) {
                dst[key] = deltaVal;
            } else if (dstVal instanceof Array) {
                if (dstVal.length === deltaVal.length) {
                    for (var j=0; j< dstVal.length; j++) {
                        if (deltaVal[j] != null) {
                            dstVal[j] = deltaVal[j];
                        }
                    }
                } else {
                    dst[key] = deltaVal;
                }
            } else if (deltaVal instanceof Array) {
                dst[key] = deltaVal;
            } else if (typeof dstVal == 'object' && typeof deltaVal === 'object') {
                applyJson(dst[key], deltaVal);
            } else {
                dst[key] = deltaVal;
            }
        }
        return dst;
    }

    function diffUpsertCore(obj1, obj2) {
        if (obj1 === obj2) {
            return {same:true};
        }
        if (typeof obj1 === 'undefined' || typeof obj2 === 'undefined') {
            return {same:false, diff:obj1};
        }
        if (obj1.constructor !== obj2.constructor) {
            return {same:false, diff:obj1};
        }
        if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
            return {same:false, diff:obj1}; // atomic nodes differ
        }
        var delta = { same: true };
        if (obj1.constructor === Array) {
            delta.diff = [];
            if (obj1.length == obj2.length) {
                for (var i=0; i< obj1.length; i++) {
                    var kidDelta = diffUpsertCore(obj1[i], obj2[i]);
                    if (kidDelta.same) {
                        delta.diff[i] = null;
                    } else {
                        delta.diff[i] = kidDelta.diff;
                        delta.same = false;
                    }
                }
            } else {
                delta.diff = obj1;
                delta.same = false;
            }
        } else { // object
            var keys = Object.keys(obj1);
            for (var i=0; i<keys.length; i++) {
                var key = keys[i];
                var kidDelta = diffUpsertCore(obj1[key], obj2[key]);
                if (!kidDelta.same) {
                    delta.diff = delta.diff || {};
                    delta.diff[key] = kidDelta.diff;
                    delta.same = false;
                }
            }
        }
        return delta;
    }
    function diffUpsert(obj1, obj2) {
        return diffUpsertCore(obj1, obj2).diff;
    };

    var JsonUtil = {
        applyJson: applyJson,
        summarize: summarize,
        isEmpty: isEmpty,
        diffUpsert: diffUpsert,
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
            x: "x1",
            y: {
                a: "a1",
                c: "c1",
            },
        }, {
            y: {
                a: "a2",
                b: "b1",
            },
            z: {
                d: "d1",
                e: "e1",
            },
        }), {
            x: "x1",
            y: {
                a: "a2",
                b: "b1",
                c: "c1",
            },
            z: {
                d: "d1",
                e: "e1",
            },
        });
        should.deepEqual(JsonUtil.applyJson({
            a: {
                x: "x2"
            }
        }, {
            a: [1, 2]
        }), {
            a: [1, 2]
        });
        should.deepEqual(JsonUtil.applyJson({
            a: [1, 2]
        }, {
            a: {
                b: "b2"
            }
        }), {
            a: {
                b: "b2"
            }
        });
        should.deepEqual(JsonUtil.applyJson({
            a: 1
        }, {
            a: {
                b: "b2"
            }
        }), {
            a: {
                b: "b2"
            }
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
                    x: "x1"
                }],
                d: "d1",
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
    it("diffUpsert(obj,objBase) should return diff of updated or inserted fields", function() {
        var jsonold = {
            "w": [{
                va:1,
                wa:11,
            }, {
                vc:3,
                wc:31,
            }],
            "x": {
                "A": "1",
                "B": 2,
                "D": "Something",
                "E": [10, 20, 30]
            },
            "y": ["a", "b", "c"],
            "z": { "p":911 },
        };

        var jsonnew = {
            "w": [{
                va:1,
                wa:11,
            }, {
                va:2,
                wb:21,
            }, {
                vc:30,
                wc:31,
            }],
            "x": {
                "A": "1",
                "B": 2.1,
                "C": "3",
                "D": "Different",
                "E": [10, 21, 30]
            },
            "y": ["a", "b", "d"],
            "z": { "p":911 },
        };

        var deltaExpected = {
            "w": [ {
                va:1,
                wa:11,
            }, {
                va:2,
                wb:21,
            }, {
                vc:30,
                wc:31,
            }],
            "x": {
                "B": 2.1,
                "C": "3",
                "D": "Different",
                "E": [null, 21, null]
            },
            "y": [null, null, "d"],
        };

        var delta = JsonUtil.diffUpsert(jsonnew, jsonold);
        should.deepEqual(delta, deltaExpected);

        JsonUtil.applyJson(jsonold, delta);
        should.deepEqual(jsonold, jsonnew);

        var selfDiff = JsonUtil.diffUpsert(jsonold, jsonold);
        should(selfDiff == null).True;
    });
})

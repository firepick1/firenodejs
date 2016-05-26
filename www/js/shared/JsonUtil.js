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

    function round(v, scale) {
        return Math.round(v * scale) / scale;
    }

    function summarize(data, lvl, options) {
        lvl = lvl == null ? 100 : lvl;
        options = options || {};
        var comma = options.comma || ", ";
        var scale = options.scale || 10;

        var traverse = function(data, lvl) {
            var s = "";

            if (data == null) {
                s += "null";
            } else if (typeof data === "boolean") {
                s += data;
            } else if (typeof data === "string") {
                s += "'" + data + "'";
            } else if (typeof data === "number") {
                s += round(data, scale);
            } else if (typeof data === "object") {
                if (lvl < 0) {
                    return "_";
                }
                var keys = Object.keys(data);
                if (data instanceof Array) {
                    s += "[";
                    for (var i = 0; i < keys.length; i++) {
                        if (i) {
                            s += comma;
                        }
                        s += traverse(data[i], lvl - 1);
                    }
                    s += "]";
                } else {
                    s += "{";
                    for (var i = 0; i < keys.length; i++) {
                        if (i) {
                            s += comma;
                        }
                        s += keys[i];
                        s += ":";
                        s += traverse(data[keys[i]], lvl - 1);
                    }
                    s += "}";
                }
            } else {
                s += "?";
            }

            return s;
        }

        return traverse(data, lvl);
    }

    function applyJson(dst, delta) {
        if (dst == null || delta == null) {
            return null;
        }
        should && dst.should.not.instanceof(Array);
        should && dst.should.instanceof(Object);
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
                    for (var j = 0; j < dstVal.length; j++) {
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

    function diffUpsertCore(obj1, obj2, filter$) {
        if (obj1 === obj2) {
            return {
                same: true
            };
        }
        if (obj1 == null) {
            return {
                same: false,
                diff: obj1
            };
        }
        if (obj2 == null) {
            return {
                same: false,
                diff: obj1
            };
        }
        if (typeof obj1 === 'undefined' || typeof obj2 === 'undefined') {
            return {
                same: false,
                diff: obj1
            };
        }
        if (obj1.constructor !== obj2.constructor) {
            return {
                same: false,
                diff: obj1
            };
        }
        if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
            return {
                same: false,
                diff: obj1
            }; // atomic nodes differ
        }
        var delta = {
            same: true
        };
        if (obj1.constructor === Array) {
            delta.diff = [];
            if (obj1.length == obj2.length) {
                for (var i = 0; i < obj1.length; i++) {
                    var kidDelta = diffUpsertCore(obj1[i], obj2[i], filter$);
                    if (kidDelta.same) {
                        //delta.diff[i] = null;
                    } else {
                        //delta.diff[i] = kidDelta.diff;
                        delta.same = false;
                        delta.diff = obj1;
                        break;
                    }
                }
            } else {
                delta.diff = obj1;
                delta.same = false;
            }
        } else { // object
            var keys = Object.keys(obj1);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if (filter$ && key.startsWith("$")) {
                    continue;
                }
                var kidDelta = diffUpsertCore(obj1[key], obj2[key], filter$);
                if (!kidDelta.same) {
                    delta.diff = delta.diff || {};
                    delta.diff[key] = kidDelta.diff;
                    delta.same = false;
                }
            }
        }
        return delta;
    }

    function diffUpsert(obj1, obj2, options) {
        options = options || {};
        var result = diffUpsertCore(obj1, obj2, options.filter$).diff || null;
        return result;
    };

    var JsonUtil = {
        applyJson: applyJson,
        summarize: summarize,
        isEmpty: isEmpty,
        diffUpsert: diffUpsert,
        round: round,
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
                va: 1,
                wa: 11,
            }, {
                vc: 3,
                wc: 31,
            }],
            "x": {
                "A": "1",
                "B": 2,
                "D": "Something",
                "E": [10, 20, 30]
            },
            "y": ["a", "b", "c"],
            "z": {
                "p": 911
            },
        };

        var jsonnew = {
            "w": [{
                va: 1,
                wa: 11,
            }, {
                va: 2,
                wb: 21,
            }, {
                vc: 30,
                wc: 31,
            }],
            "x": {
                "A": "1",
                "B": 2.1,
                "C": "3",
                "D": "Different",
                "E": [10, 21, 30]
            },
            "y": ["a", "b", "d"],
            "z": {
                "p": 911
            },
        };

        var deltaExpected = {
            "w": [{
                va: 1,
                wa: 11,
            }, {
                va: 2,
                wb: 21,
            }, {
                vc: 30,
                wc: 31,
            }],
            "x": {
                "B": 2.1,
                "C": "3",
                "D": "Different",
                //"E": [null, 21, null]
                "E": [10, 21, 30]
            },
            //"y": [null, null, "d"],
            "y": ["a", "b", "d"],
        };

        var delta;
        delta = JsonUtil.diffUpsert(jsonnew, jsonold);
        should.deepEqual(delta, deltaExpected);

        JsonUtil.applyJson(jsonold, delta);
        should.deepEqual(jsonold, jsonnew);

        var selfDiff = JsonUtil.diffUpsert(jsonold, jsonold);
        should(selfDiff == null).True;

        delta = JsonUtil.diffUpsert(jsonnew, null);
        should.deepEqual(delta, jsonnew);

        delta = JsonUtil.diffUpsert(null, jsonold);
        should.deepEqual(delta, null);
    });
    it("diffUpsert(obj,objBase, {filter$:true}) should return diff of updated or inserted fields", function() {
        var jsonOld = {
            version: {
                major: 1,
            }
        };
        var jsonNew = {
            $$hashKey: "angular:##",
            version: {
                major: 1,
            }
        };
        var options = {
            filter$: true,
        };
        var delta = JsonUtil.diffUpsert(jsonNew, jsonOld, options);
        should.deepEqual(delta, null);
        jsonNew.version.minor = 2;
        var delta = JsonUtil.diffUpsert(jsonNew, jsonOld, options);
        should.deepEqual(delta, {
            version: {
                minor: 2,
            }
        });
    });
    it("round(value, scale) rounds values", function() {
        var d = 61.34583333333333;
        JsonUtil.round(d, 10).toString().should.equal("61.3");
        JsonUtil.round(d, 100).toString().should.equal("61.35");
        JsonUtil.round(d, 1000).toString().should.equal("61.346");
        var d = 69.48756944444445;
        JsonUtil.round(d, 10).toString().should.equal("69.5");
        JsonUtil.round(d, 100).toString().should.equal("69.49");
        JsonUtil.round(d, 1000).toString().should.equal("69.488");
    });
    it("falsy and truthy", function() {
        var obj = {
            y: 0
        };
        var u;

        // Things that work well
        should(obj.x == null).True; // it's nully
        should(u == null).True;
        should(obj.x === null).False; // it's undefined
        should(obj.y < 10).True; // (but see below)
        should("a" === 10).False; // (but see below)
        should("a" == 10).False; // (but see below)

        // DANGER: comparing numbers with non-numbers is asymmetric and highly inconsistent
        should(obj.x < 10).False; // DANGER
        should(u < 10).False; // DANGER
        should("a" < 10).False;
        should("a" > 10).False; // asymmetric
        should(null < 10).True;
    });
    it("summarize(json, lvl, options) summarizes JSON to given depth", function() {
        var json = {
            a: {
                b: {
                    b1: 1.23456789,
                },
                c: 2,
            }
        };
        var options = {
            scale: 1000,
            comma: ",",
        };
        should.deepEqual(JsonUtil.summarize(json), "{a:{b:{b1:1.2}, c:2}}");
        should.deepEqual(JsonUtil.summarize(json, null, options), "{a:{b:{b1:1.235},c:2}}");
        should.deepEqual(JsonUtil.summarize(json, 0), "{a:_}");
        should.deepEqual(JsonUtil.summarize(json, 1), "{a:{b:_, c:2}}");
        should.deepEqual(JsonUtil.summarize(json, 1, options), "{a:{b:_,c:2}}");
    });
    it("empty objects", function() {
        var a = {};
        should(a == {}).equal(false);
        should(a === {}).equal(false);
        Object.keys(a).length.should.equal(0);
        Object.keys("").length.should.equal(0);
        Object.keys(123).length.should.equal(0);
        Object.keys(true).length.should.equal(0);
        Object.keys([]).length.should.equal(0);
        should.throws(function() {
            Object.keys(null).length;
        });
    });
})

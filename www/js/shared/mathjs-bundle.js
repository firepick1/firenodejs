(function e(t, n, r) {
    function s(o, u) {
        if (!n[o]) {
            if (!t[o]) {
                var a = typeof require == "function" && require;
                if (!u && a) return a(o, !0);
                if (i) return i(o, !0);
                var f = new Error("Cannot find module '" + o + "'");
                throw f.code = "MODULE_NOT_FOUND", f
            }
            var l = n[o] = {
                exports: {}
            };
            t[o][0].call(l.exports, function(e) {
                var n = t[o][1][e];
                return s(n ? n : e)
            }, l, l.exports, e, t, n, r)
        }
        return n[o].exports
    }
    var i = typeof require == "function" && require;
    for (var o = 0; o < r.length; o++) s(r[o]);
    return s
})({
    1: [function(require, module, exports) {
        var core = require('mathjs/core');
        var mathjs = core.create();
        mathjs.import(require('mathjs/lib/type/matrix/Matrix'));
        mathjs.import(require('mathjs/lib/type/matrix/DenseMatrix'));
        mathjs.import(require('mathjs/lib/function/arithmetic/add'));
        mathjs.import(require('mathjs/lib/function/arithmetic/subtract'));
        mathjs.import(require('mathjs/lib/function/arithmetic/multiply'));
        mathjs.import(require('mathjs/lib/function/matrix/inv'));
        mathjs.import(require('mathjs/lib/function/matrix/transpose'));
        mathjs.import(require('mathjs/lib/function/matrix/det'));

    }, {
        "mathjs/core": 2,
        "mathjs/lib/function/arithmetic/add": 10,
        "mathjs/lib/function/arithmetic/multiply": 13,
        "mathjs/lib/function/arithmetic/subtract": 15,
        "mathjs/lib/function/matrix/det": 17,
        "mathjs/lib/function/matrix/inv": 19,
        "mathjs/lib/function/matrix/transpose": 20,
        "mathjs/lib/type/matrix/DenseMatrix": 22,
        "mathjs/lib/type/matrix/Matrix": 23
    }],
    2: [function(require, module, exports) {
        module.exports = require('./lib/core/core');
    }, {
        "./lib/core/core": 3
    }],
    3: [function(require, module, exports) {
        var isFactory = require('./../utils/object').isFactory;
        var deepExtend = require('./../utils/object').deepExtend;
        var typedFactory = require('./typed');
        var emitter = require('./../utils/emitter');

        var importFactory = require('./function/import');
        var configFactory = require('./function/config');

        /**
         * Math.js core. Creates a new, empty math.js instance
         * @param {Object} [options] Available options:
         *                            {number} epsilon
         *                              Minimum relative difference between two
         *                              compared values, used by all comparison functions.
         *                            {string} matrix
         *                              A string 'Matrix' (default) or 'Array'.
         *                            {string} number
         *                              A string 'number' (default), 'BigNumber', or 'Fraction'
         *                            {number} precision
         *                              The number of significant digits for BigNumbers.
         *                              Not applicable for Numbers.
         *                            {boolean} predictable
         *                              Predictable output type of functions. When true,
         *                              output type depends only on the input types. When
         *                              false (default), output type can vary depending
         *                              on input values. For example `math.sqrt(-2)`
         *                              returns `NaN` when predictable is false, and
         *                              returns `complex('2i')` when true.
         * @returns {Object} Returns a bare-bone math.js instance containing
         *                   functions:
         *                   - `import` to add new functions
         *                   - `config` to change configuration
         *                   - `on`, `off`, `once`, `emit` for events
         */
        exports.create = function create(options) {
            // simple test for ES5 support
            if (typeof Object.create !== 'function') {
                throw new Error('ES5 not supported by this JavaScript engine. ' +
                    'Please load the es5-shim and es5-sham library for compatibility.');
            }

            // cached factories and instances
            var factories = [];
            var instances = [];

            // create a namespace for the mathjs instance, and attach emitter functions
            var math = emitter.mixin({});
            math.type = {};
            math.expression = {
                transform: Object.create(math)
            };

            // create a new typed instance
            math.typed = typedFactory.create(math.type);

            // create configuration options. These are private
            var _config = {
                // minimum relative difference between two compared values,
                // used by all comparison functions
                epsilon: 1e-12,

                // type of default matrix output. Choose 'matrix' (default) or 'array'
                matrix: 'Matrix',

                // type of default number output. Choose 'number' (default) 'BigNumber', or 'Fraction
                number: 'number',

                // number of significant digits in BigNumbers
                precision: 64,

                // predictable output type of functions. When true, output type depends only
                // on the input types. When false (default), output type can vary depending
                // on input values. For example `math.sqrt(-2)` returns `NaN` when
                // predictable is false, and returns `complex('2i')` when true.
                predictable: false
            };

            /**
             * Load a function or data type from a factory.
             * If the function or data type already exists, the existing instance is
             * returned.
             * @param {{type: string, name: string, factory: Function}} factory
             * @returns {*}
             */
            function load(factory) {
                if (!isFactory(factory)) {
                    throw new Error('Factory object with properties `type`, `name`, and `factory` expected');
                }

                var index = factories.indexOf(factory);
                var instance;
                if (index === -1) {
                    // doesn't yet exist
                    if (factory.math === true) {
                        // pass with math namespace
                        instance = factory.factory(math.type, _config, load, math.typed, math);
                    } else {
                        instance = factory.factory(math.type, _config, load, math.typed);
                    }

                    // append to the cache
                    factories.push(factory);
                    instances.push(instance);
                } else {
                    // already existing function, return the cached instance
                    instance = instances[index];
                }

                return instance;
            }

            // load the import and config functions
            math['import'] = load(importFactory);
            math['config'] = load(configFactory);

            // apply options
            if (options) {
                math.config(options);
            }

            return math;
        };

    }, {
        "./../utils/emitter": 39,
        "./../utils/object": 44,
        "./function/config": 4,
        "./function/import": 5,
        "./typed": 6
    }],
    4: [function(require, module, exports) {
        'use strict';

        var object = require('../../utils/object');

        function factory(type, config, load, typed, math) {
            var MATRIX = ['Matrix', 'Array']; // valid values for option matrix
            var NUMBER = ['number', 'BigNumber', 'Fraction']; // valid values for option number

            /**
             * Set configuration options for math.js, and get current options.
             * Will emit a 'config' event, with arguments (curr, prev).
             *
             * Syntax:
             *
             *     math.config(config: Object): Object
             *
             * Examples:
             *
             *     math.config().number;                // outputs 'number'
             *     math.eval('0.4');                    // outputs number 0.4
             *     math.config({number: 'Fraction'});
             *     math.eval('0.4');                    // outputs Fraction 2/5
             *
             * @param {Object} [options] Available options:
             *                            {number} epsilon
             *                              Minimum relative difference between two
             *                              compared values, used by all comparison functions.
             *                            {string} matrix
             *                              A string 'Matrix' (default) or 'Array'.
             *                            {string} number
             *                              A string 'number' (default), 'BigNumber', or 'Fraction'
             *                            {number} precision
             *                              The number of significant digits for BigNumbers.
             *                              Not applicable for Numbers.
             *                            {string} parenthesis
             *                              How to display parentheses in LaTeX and string
             *                              output.
             * @return {Object} Returns the current configuration
             */
            function _config(options) {
                if (options) {
                    var prev = object.clone(config);

                    // validate some of the options
                    validateOption(options, 'matrix', MATRIX);
                    validateOption(options, 'number', NUMBER);

                    // merge options
                    object.deepExtend(config, options);

                    var curr = object.clone(config);

                    // emit 'config' event
                    math.emit('config', curr, prev);

                    return curr;
                } else {
                    return object.clone(config);
                }
            }

            // attach the valid options to the function so they can be extended
            _config.MATRIX = MATRIX;
            _config.NUMBER = NUMBER;

            return _config;
        }

        /**
         * Test whether an Array contains a specific item.
         * @param {Array.<string>} array
         * @param {string} item
         * @return {boolean}
         */
        function contains(array, item) {
            return array.indexOf(item) !== -1;
        }

        /**
         * Find a string in an array. Case insensitive search
         * @param {Array.<string>} array
         * @param {string} item
         * @return {number} Returns the index when found. Returns -1 when not found
         */
        function findIndex(array, item) {
            return array
                .map(function(i) {
                    return i.toLowerCase();
                })
                .indexOf(item.toLowerCase());
        }

        /**
         * Validate an option
         * @param {Object} options         Object with options
         * @param {string} name            Name of the option to validate
         * @param {Array.<string>} values  Array with valid values for this option
         */
        function validateOption(options, name, values) {
            if (options[name] !== undefined && !contains(values, options[name])) {
                var index = findIndex(values, options[name]);
                if (index !== -1) {
                    // right value, wrong casing
                    // TODO: lower case values are deprecated since v3, remove this warning some day.
                    console.warn('Warning: Wrong casing for configuration option "' + name + '", should be "' + values[index] + '" instead of "' + options[name] + '".');

                    options[name] = values[index]; // change the option to the right casing
                } else {
                    // unknown value
                    console.warn('Warning: Unknown value "' + options[name] + '" for configuration option "' + name + '". Available options: ' + values.map(JSON.stringify).join(', ') + '.');
                }
            }
        }

        exports.name = 'config';
        exports.math = true; // request the math namespace as fifth argument
        exports.factory = factory;

    }, {
        "../../utils/object": 44
    }],
    5: [function(require, module, exports) {
        'use strict';

        var lazy = require('../../utils/object').lazy;
        var isFactory = require('../../utils/object').isFactory;
        var traverse = require('../../utils/object').traverse;
        var extend = require('../../utils/object').extend;
        var ArgumentsError = require('../../error/ArgumentsError');

        function factory(type, config, load, typed, math) {
            /**
             * Import functions from an object or a module
             *
             * Syntax:
             *
             *    math.import(object)
             *    math.import(object, options)
             *
             * Where:
             *
             * - `object: Object`
             *   An object with functions to be imported.
             * - `options: Object` An object with import options. Available options:
             *   - `override: boolean`
             *     If true, existing functions will be overwritten. False by default.
             *   - `silent: boolean`
             *     If true, the function will not throw errors on duplicates or invalid
             *     types. False by default.
             *   - `wrap: boolean`
             *     If true, the functions will be wrapped in a wrapper function
             *     which converts data types like Matrix to primitive data types like Array.
             *     The wrapper is needed when extending math.js with libraries which do not
             *     support these data type. False by default.
             *
             * Examples:
             *
             *    // define new functions and variables
             *    math.import({
             *      myvalue: 42,
             *      hello: function (name) {
             *        return 'hello, ' + name + '!';
             *      }
             *    });
             *
             *    // use the imported function and variable
             *    math.myvalue * 2;               // 84
             *    math.hello('user');             // 'hello, user!'
             *
             *    // import the npm module 'numbers'
             *    // (must be installed first with `npm install numbers`)
             *    math.import(require('numbers'), {wrap: true});
             *
             *    math.fibonacci(7); // returns 13
             *
             * @param {Object | Array} object   Object with functions to be imported.
             * @param {Object} [options]        Import options.
             */
            function math_import(object, options) {
                var num = arguments.length;
                if (num != 1 && num != 2) {
                    throw new ArgumentsError('import', num, 1, 2);
                }

                if (!options) {
                    options = {};
                }

                if (isFactory(object)) {
                    _importFactory(object, options);
                }
                // TODO: allow a typed-function with name too
                else if (Array.isArray(object)) {
                    object.forEach(function(entry) {
                        math_import(entry, options);
                    });
                } else if (typeof object === 'object') {
                    // a map with functions
                    for (var name in object) {
                        if (object.hasOwnProperty(name)) {
                            var value = object[name];
                            if (isSupportedType(value)) {
                                _import(name, value, options);
                            } else if (isFactory(object)) {
                                _importFactory(object, options);
                            } else {
                                math_import(value, options);
                            }
                        }
                    }
                } else {
                    if (!options.silent) {
                        throw new TypeError('Factory, Object, or Array expected');
                    }
                }
            }

            /**
             * Add a property to the math namespace and create a chain proxy for it.
             * @param {string} name
             * @param {*} value
             * @param {Object} options  See import for a description of the options
             * @private
             */
            function _import(name, value, options) {
                if (options.wrap && typeof value === 'function') {
                    // create a wrapper around the function
                    value = _wrap(value);
                }

                if (isTypedFunction(math[name]) && isTypedFunction(value)) {
                    if (options.override) {
                        // give the typed function the right name
                        value = typed(name, value.signatures);
                    } else {
                        // merge the existing and typed function
                        value = typed(math[name], value);
                    }

                    math[name] = value;
                    _importTransform(name, value);
                    math.emit('import', name, function resolver() {
                        return value;
                    });
                    return;
                }

                if (math[name] === undefined || options.override) {
                    math[name] = value;
                    _importTransform(name, value);
                    math.emit('import', name, function resolver() {
                        return value;
                    });
                    return;
                }

                if (!options.silent) {
                    throw new Error('Cannot import "' + name + '": already exists');
                }
            }

            function _importTransform(name, value) {
                if (value && typeof value.transform === 'function') {
                    math.expression.transform[name] = value.transform;
                }
            }

            /**
             * Create a wrapper a round an function which converts the arguments
             * to their primitive values (like convert a Matrix to Array)
             * @param {Function} fn
             * @return {Function} Returns the wrapped function
             * @private
             */
            function _wrap(fn) {
                var wrapper = function wrapper() {
                    var args = [];
                    for (var i = 0, len = arguments.length; i < len; i++) {
                        var arg = arguments[i];
                        args[i] = arg && arg.valueOf();
                    }
                    return fn.apply(math, args);
                };

                if (fn.transform) {
                    wrapper.transform = fn.transform;
                }

                return wrapper;
            }

            /**
             * Import an instance of a factory into math.js
             * @param {{factory: Function, name: string, path: string, math: boolean}} factory
             * @param {Object} options  See import for a description of the options
             * @private
             */
            function _importFactory(factory, options) {
                if (typeof factory.name === 'string') {
                    var name = factory.name;
                    var namespace = factory.path ? traverse(math, factory.path) : math;
                    var existing = namespace.hasOwnProperty(name) ? namespace[name] : undefined;

                    var resolver = function() {
                        var instance = load(factory);

                        if (isTypedFunction(existing) && isTypedFunction(instance)) {
                            if (options.override) {
                                // replace the existing typed function (nothing to do)
                            } else {
                                // merge the existing and new typed function
                                instance = typed(existing, instance);
                            }

                            return instance;
                        }

                        if (existing === undefined || options.override) {
                            return instance;
                        }

                        if (!options.silent) {
                            throw new Error('Cannot import "' + name + '": already exists');
                        }
                    };

                    if (factory.lazy !== false) {
                        lazy(namespace, name, resolver);
                    } else {
                        namespace[name] = resolver();
                    }

                    math.emit('import', name, resolver, factory.path);
                } else {
                    // unnamed factory.
                    // no lazy loading
                    load(factory);
                }
            }

            /**
             * Check whether given object is a type which can be imported
             * @param {Function | number | string | boolean | null | Unit | Complex} object
             * @return {boolean}
             * @private
             */
            function isSupportedType(object) {
                return typeof object == 'function' ||
                    typeof object === 'number' ||
                    typeof object === 'string' ||
                    typeof object === 'boolean' ||
                    object === null ||
                    (object && object.isUnit === true) ||
                    (object && object.isComplex === true) ||
                    (object && object.isBigNumber === true) ||
                    (object && object.isFraction === true) ||
                    (object && object.isMatrix === true) ||
                    (object && Array.isArray(object) === true)
            }

            /**
             * Test whether a given thing is a typed-function
             * @param {*} fn
             * @return {boolean} Returns true when `fn` is a typed-function
             */
            function isTypedFunction(fn) {
                return typeof fn === 'function' && typeof fn.signatures === 'object';
            }

            return math_import;
        }

        exports.math = true; // request access to the math namespace as 5th argument of the factory function
        exports.name = 'import';
        exports.factory = factory;
        exports.lazy = true;

    }, {
        "../../error/ArgumentsError": 7,
        "../../utils/object": 44
    }],
    6: [function(require, module, exports) {
        var typedFunction = require('typed-function');
        var digits = require('./../utils/number').digits;

        // returns a new instance of typed-function
        var createTyped = function() {
            // initially, return the original instance of typed-function
            // consecutively, return a new instance from typed.create.
            createTyped = typedFunction.create;
            return typedFunction;
        };

        /**
         * Factory function for creating a new typed instance
         * @param {Object} type   Object with data types like Complex and BigNumber
         * @returns {Function}
         */
        exports.create = function create(type) {
            // TODO: typed-function must be able to silently ignore signatures with unknown data types

            // get a new instance of typed-function
            var typed = createTyped();

            // define all types. The order of the types determines in which order function
            // arguments are type-checked (so for performance it's important to put the
            // most used types first).
            typed.types = [{
                    name: 'number',
                    test: function(x) {
                        return typeof x === 'number';
                    }
                },
                {
                    name: 'Complex',
                    test: function(x) {
                        return x && x.isComplex;
                    }
                },
                {
                    name: 'BigNumber',
                    test: function(x) {
                        return x && x.isBigNumber;
                    }
                },
                {
                    name: 'Fraction',
                    test: function(x) {
                        return x && x.isFraction;
                    }
                },
                {
                    name: 'Unit',
                    test: function(x) {
                        return x && x.isUnit;
                    }
                },
                {
                    name: 'string',
                    test: function(x) {
                        return typeof x === 'string';
                    }
                },
                {
                    name: 'Array',
                    test: Array.isArray
                },
                {
                    name: 'Matrix',
                    test: function(x) {
                        return x && x.isMatrix;
                    }
                },
                {
                    name: 'DenseMatrix',
                    test: function(x) {
                        return x && x.isDenseMatrix;
                    }
                },
                {
                    name: 'SparseMatrix',
                    test: function(x) {
                        return x && x.isSparseMatrix;
                    }
                },
                {
                    name: 'ImmutableDenseMatrix',
                    test: function(x) {
                        return x && x.isImmutableDenseMatrix;
                    }
                },
                {
                    name: 'Range',
                    test: function(x) {
                        return x && x.isRange;
                    }
                },
                {
                    name: 'Index',
                    test: function(x) {
                        return x && x.isIndex;
                    }
                },
                {
                    name: 'boolean',
                    test: function(x) {
                        return typeof x === 'boolean';
                    }
                },
                {
                    name: 'ResultSet',
                    test: function(x) {
                        return x && x.isResultSet;
                    }
                },
                {
                    name: 'Help',
                    test: function(x) {
                        return x && x.isHelp;
                    }
                },
                {
                    name: 'function',
                    test: function(x) {
                        return typeof x === 'function';
                    }
                },
                {
                    name: 'Date',
                    test: function(x) {
                        return x instanceof Date;
                    }
                },
                {
                    name: 'RegExp',
                    test: function(x) {
                        return x instanceof RegExp;
                    }
                },
                {
                    name: 'Object',
                    test: function(x) {
                        return typeof x === 'object';
                    }
                },
                {
                    name: 'null',
                    test: function(x) {
                        return x === null;
                    }
                },
                {
                    name: 'undefined',
                    test: function(x) {
                        return x === undefined;
                    }
                }
            ];

            // TODO: add conversion from BigNumber to number?
            typed.conversions = [{
                from: 'number',
                to: 'BigNumber',
                convert: function(x) {
                    // note: conversion from number to BigNumber can fail if x has >15 digits
                    if (digits(x) > 15) {
                        throw new TypeError('Cannot implicitly convert a number with >15 significant digits to BigNumber ' +
                            '(value: ' + x + '). ' +
                            'Use function bignumber(x) to convert to BigNumber.');
                    }
                    return new type.BigNumber(x);
                }
            }, {
                from: 'number',
                to: 'Complex',
                convert: function(x) {
                    return new type.Complex(x, 0);
                }
            }, {
                from: 'number',
                to: 'string',
                convert: function(x) {
                    return x + '';
                }
            }, {
                from: 'BigNumber',
                to: 'Complex',
                convert: function(x) {
                    return new type.Complex(x.toNumber(), 0);
                }
            }, {
                from: 'Fraction',
                to: 'Complex',
                convert: function(x) {
                    return new type.Complex(x.valueOf(), 0);
                }
            }, {
                from: 'number',
                to: 'Fraction',
                convert: function(x) {
                    if (digits(x) > 15) {
                        throw new TypeError('Cannot implicitly convert a number with >15 significant digits to Fraction ' +
                            '(value: ' + x + '). ' +
                            'Use function fraction(x) to convert to Fraction.');
                    }
                    return new type.Fraction(x);
                }
            }, {
                // FIXME: add conversion from Fraction to number, for example for `sqrt(fraction(1,3))`
                //  from: 'Fraction',
                //  to: 'number',
                //  convert: function (x) {
                //    return x.valueOf();
                //  }
                //}, {
                from: 'string',
                to: 'number',
                convert: function(x) {
                    var n = Number(x);
                    if (isNaN(n)) {
                        throw new Error('Cannot convert "' + x + '" to a number');
                    }
                    return n;
                }
            }, {
                from: 'boolean',
                to: 'number',
                convert: function(x) {
                    return +x;
                }
            }, {
                from: 'boolean',
                to: 'BigNumber',
                convert: function(x) {
                    return new type.BigNumber(+x);
                }
            }, {
                from: 'boolean',
                to: 'Fraction',
                convert: function(x) {
                    return new type.Fraction(+x);
                }
            }, {
                from: 'boolean',
                to: 'string',
                convert: function(x) {
                    return +x;
                }
            }, {
                from: 'null',
                to: 'number',
                convert: function() {
                    return 0;
                }
            }, {
                from: 'null',
                to: 'string',
                convert: function() {
                    return 'null';
                }
            }, {
                from: 'null',
                to: 'BigNumber',
                convert: function() {
                    return new type.BigNumber(0);
                }
            }, {
                from: 'null',
                to: 'Fraction',
                convert: function() {
                    return new type.Fraction(0);
                }
            }, {
                from: 'Array',
                to: 'Matrix',
                convert: function(array) {
                    // TODO: how to decide on the right type of matrix to create?
                    return new type.DenseMatrix(array);
                }
            }, {
                from: 'Matrix',
                to: 'Array',
                convert: function(matrix) {
                    return matrix.valueOf();
                }
            }];

            return typed;
        };

    }, {
        "./../utils/number": 43,
        "typed-function": 48
    }],
    7: [function(require, module, exports) {
        'use strict';

        /**
         * Create a syntax error with the message:
         *     'Wrong number of arguments in function <fn> (<count> provided, <min>-<max> expected)'
         * @param {string} fn     Function name
         * @param {number} count  Actual argument count
         * @param {number} min    Minimum required argument count
         * @param {number} [max]  Maximum required argument count
         * @extends Error
         */
        function ArgumentsError(fn, count, min, max) {
            if (!(this instanceof ArgumentsError)) {
                throw new SyntaxError('Constructor must be called with the new operator');
            }

            this.fn = fn;
            this.count = count;
            this.min = min;
            this.max = max;

            this.message = 'Wrong number of arguments in function ' + fn +
                ' (' + count + ' provided, ' +
                min + ((max != undefined) ? ('-' + max) : '') + ' expected)';

            this.stack = (new Error()).stack;
        }

        ArgumentsError.prototype = new Error();
        ArgumentsError.prototype.constructor = Error;
        ArgumentsError.prototype.name = 'ArgumentsError';
        ArgumentsError.prototype.isArgumentsError = true;

        module.exports = ArgumentsError;

    }, {}],
    8: [function(require, module, exports) {
        'use strict';

        /**
         * Create a range error with the message:
         *     'Dimension mismatch (<actual size> != <expected size>)'
         * @param {number | number[]} actual        The actual size
         * @param {number | number[]} expected      The expected size
         * @param {string} [relation='!=']          Optional relation between actual
         *                                          and expected size: '!=', '<', etc.
         * @extends RangeError
         */
        function DimensionError(actual, expected, relation) {
            if (!(this instanceof DimensionError)) {
                throw new SyntaxError('Constructor must be called with the new operator');
            }

            this.actual = actual;
            this.expected = expected;
            this.relation = relation;

            this.message = 'Dimension mismatch (' +
                (Array.isArray(actual) ? ('[' + actual.join(', ') + ']') : actual) +
                ' ' + (this.relation || '!=') + ' ' +
                (Array.isArray(expected) ? ('[' + expected.join(', ') + ']') : expected) +
                ')';

            this.stack = (new Error()).stack;
        }

        DimensionError.prototype = new RangeError();
        DimensionError.prototype.constructor = RangeError;
        DimensionError.prototype.name = 'DimensionError';
        DimensionError.prototype.isDimensionError = true;

        module.exports = DimensionError;

    }, {}],
    9: [function(require, module, exports) {
        'use strict';

        /**
         * Create a range error with the message:
         *     'Index out of range (index < min)'
         *     'Index out of range (index < max)'
         *
         * @param {number} index     The actual index
         * @param {number} [min=0]   Minimum index (included)
         * @param {number} [max]     Maximum index (excluded)
         * @extends RangeError
         */
        function IndexError(index, min, max) {
            if (!(this instanceof IndexError)) {
                throw new SyntaxError('Constructor must be called with the new operator');
            }

            this.index = index;
            if (arguments.length < 3) {
                this.min = 0;
                this.max = min;
            } else {
                this.min = min;
                this.max = max;
            }

            if (this.min !== undefined && this.index < this.min) {
                this.message = 'Index out of range (' + this.index + ' < ' + this.min + ')';
            } else if (this.max !== undefined && this.index >= this.max) {
                this.message = 'Index out of range (' + this.index + ' > ' + (this.max - 1) + ')';
            } else {
                this.message = 'Index out of range (' + this.index + ')';
            }

            this.stack = (new Error()).stack;
        }

        IndexError.prototype = new RangeError();
        IndexError.prototype.constructor = RangeError;
        IndexError.prototype.name = 'IndexError';
        IndexError.prototype.isIndexError = true;

        module.exports = IndexError;

    }, {}],
    10: [function(require, module, exports) {
        'use strict';

        var extend = require('../../utils/object').extend;

        function factory(type, config, load, typed) {

            var matrix = load(require('../../type/matrix/function/matrix'));
            var addScalar = load(require('./addScalar'));
            var latex = require('../../utils/latex.js');

            var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
            var algorithm04 = load(require('../../type/matrix/utils/algorithm04'));
            var algorithm10 = load(require('../../type/matrix/utils/algorithm10'));
            var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
            var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

            /**
             * Add two values, `x + y`.
             * For matrices, the function is evaluated element wise.
             *
             * Syntax:
             *
             *    math.add(x, y)
             *
             * Examples:
             *
             *    math.add(2, 3);               // returns number 5
             *
             *    var a = math.complex(2, 3);
             *    var b = math.complex(-4, 1);
             *    math.add(a, b);               // returns Complex -2 + 4i
             *
             *    math.add([1, 2, 3], 4);       // returns Array [5, 6, 7]
             *
             *    var c = math.unit('5 cm');
             *    var d = math.unit('2.1 mm');
             *    math.add(c, d);               // returns Unit 52.1 mm
             *
             *    math.add("2.3", "4");         // returns number 6.3
             *
             * See also:
             *
             *    subtract
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x First value to add
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} y Second value to add
             * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} Sum of `x` and `y`
             */
            var add = typed('add', extend({
                // we extend the signatures of addScalar with signatures dealing with matrices

                'Matrix, Matrix': function(x, y) {
                    // result
                    var c;

                    // process matrix storage
                    switch (x.storage()) {
                        case 'sparse':
                            switch (y.storage()) {
                                case 'sparse':
                                    // sparse + sparse
                                    c = algorithm04(x, y, addScalar);
                                    break;
                                default:
                                    // sparse + dense
                                    c = algorithm01(y, x, addScalar, true);
                                    break;
                            }
                            break;
                        default:
                            switch (y.storage()) {
                                case 'sparse':
                                    // dense + sparse
                                    c = algorithm01(x, y, addScalar, false);
                                    break;
                                default:
                                    // dense + dense
                                    c = algorithm13(x, y, addScalar);
                                    break;
                            }
                            break;
                    }
                    return c;
                },

                'Array, Array': function(x, y) {
                    // use matrix implementation
                    return add(matrix(x), matrix(y)).valueOf();
                },

                'Array, Matrix': function(x, y) {
                    // use matrix implementation
                    return add(matrix(x), y);
                },

                'Matrix, Array': function(x, y) {
                    // use matrix implementation
                    return add(x, matrix(y));
                },

                'Matrix, any': function(x, y) {
                    // result
                    var c;
                    // check storage format
                    switch (x.storage()) {
                        case 'sparse':
                            c = algorithm10(x, y, addScalar, false);
                            break;
                        default:
                            c = algorithm14(x, y, addScalar, false);
                            break;
                    }
                    return c;
                },

                'any, Matrix': function(x, y) {
                    // result
                    var c;
                    // check storage format
                    switch (y.storage()) {
                        case 'sparse':
                            c = algorithm10(y, x, addScalar, true);
                            break;
                        default:
                            c = algorithm14(y, x, addScalar, true);
                            break;
                    }
                    return c;
                },

                'Array, any': function(x, y) {
                    // use matrix implementation
                    return algorithm14(matrix(x), y, addScalar, false).valueOf();
                },

                'any, Array': function(x, y) {
                    // use matrix implementation
                    return algorithm14(matrix(y), x, addScalar, true).valueOf();
                }
            }, addScalar.signatures));

            add.toTex = {
                2: '\\left(${args[0]}' + latex.operators['add'] + '${args[1]}\\right)'
            };

            return add;
        }

        exports.name = 'add';
        exports.factory = factory;

    }, {
        "../../type/matrix/function/matrix": 24,
        "../../type/matrix/utils/algorithm01": 25,
        "../../type/matrix/utils/algorithm04": 27,
        "../../type/matrix/utils/algorithm10": 29,
        "../../type/matrix/utils/algorithm13": 31,
        "../../type/matrix/utils/algorithm14": 32,
        "../../utils/latex.js": 42,
        "../../utils/object": 44,
        "./addScalar": 11
    }],
    11: [function(require, module, exports) {
        'use strict';

        function factory(type, config, load, typed) {

            /**
             * Add two scalar values, `x + y`.
             * This function is meant for internal use: it is used by the public function
             * `add`
             *
             * This function does not support collections (Array or Matrix), and does
             * not validate the number of of inputs.
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit} x   First value to add
             * @param  {number | BigNumber | Fraction | Complex} y          Second value to add
             * @return {number | BigNumber | Fraction | Complex | Unit}                      Sum of `x` and `y`
             * @private
             */
            var add = typed('add', {

                'number, number': function(x, y) {
                    return x + y;
                },

                'Complex, Complex': function(x, y) {
                    return x.add(y);
                },

                'BigNumber, BigNumber': function(x, y) {
                    return x.plus(y);
                },

                'Fraction, Fraction': function(x, y) {
                    return x.add(y);
                },

                'Unit, Unit': function(x, y) {
                    if (x.value == null) throw new Error('Parameter x contains a unit with undefined value');
                    if (y.value == null) throw new Error('Parameter y contains a unit with undefined value');
                    if (!x.equalBase(y)) throw new Error('Units do not match');

                    var res = x.clone();
                    res.value = add(res.value, y.value);
                    res.fixPrefix = false;
                    return res;
                }
            });

            return add;
        }

        exports.factory = factory;

    }, {}],
    12: [function(require, module, exports) {
        'use strict';

        function factory(type, config, load, typed) {
            var multiplyScalar = load(require('./multiplyScalar'));

            /**
             * Divide two scalar values, `x / y`.
             * This function is meant for internal use: it is used by the public functions
             * `divide` and `inv`.
             *
             * This function does not support collections (Array or Matrix), and does
             * not validate the number of of inputs.
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit} x   Numerator
             * @param  {number | BigNumber | Fraction | Complex} y          Denominator
             * @return {number | BigNumber | Fraction | Complex | Unit}                      Quotient, `x / y`
             * @private
             */
            var divideScalar = typed('divide', {
                'number, number': function(x, y) {
                    return x / y;
                },

                'Complex, Complex': function(x, y) {
                    return x.div(y);
                },

                'BigNumber, BigNumber': function(x, y) {
                    return x.div(y);
                },

                'Fraction, Fraction': function(x, y) {
                    return x.div(y);
                },

                'Unit, number | Fraction | BigNumber': function(x, y) {
                    var res = x.clone();
                    // TODO: move the divide function to Unit.js, it uses internals of Unit
                    res.value = divideScalar(((res.value === null) ? res._normalize(1) : res.value), y);
                    return res;
                },

                'number | Fraction | BigNumber, Unit': function(x, y) {
                    var res = y.pow(-1);
                    // TODO: move the divide function to Unit.js, it uses internals of Unit
                    res.value = multiplyScalar(((res.value === null) ? res._normalize(1) : res.value), x);
                    return res;
                },

                'Unit, Unit': function(x, y) {
                    return x.divide(y);
                }

            });

            return divideScalar;
        }

        exports.factory = factory;

    }, {
        "./multiplyScalar": 14
    }],
    13: [function(require, module, exports) {
        'use strict';

        var extend = require('../../utils/object').extend;
        var array = require('../../utils/array');

        function factory(type, config, load, typed) {
            var latex = require('../../utils/latex');

            var matrix = load(require('../../type/matrix/function/matrix'));
            var addScalar = load(require('./addScalar'));
            var multiplyScalar = load(require('./multiplyScalar'));
            var equalScalar = load(require('../relational/equalScalar'));

            var algorithm11 = load(require('../../type/matrix/utils/algorithm11'));
            var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

            var DenseMatrix = type.DenseMatrix;
            var SparseMatrix = type.SparseMatrix;

            /**
             * Multiply two values, `x * y`.
             * For matrices, the matrix product is calculated.
             *
             * Syntax:
             *
             *    math.multiply(x, y)
             *
             * Examples:
             *
             *    math.multiply(4, 5.2);        // returns number 20.8
             *
             *    var a = math.complex(2, 3);
             *    var b = math.complex(4, 1);
             *    math.multiply(a, b);          // returns Complex 5 + 14i
             *
             *    var c = [[1, 2], [4, 3]];
             *    var d = [[1, 2, 3], [3, -4, 7]];
             *    math.multiply(c, d);          // returns Array [[7, -6, 17], [13, -4, 33]]
             *
             *    var e = math.unit('2.1 km');
             *    math.multiply(3, e);          // returns Unit 6.3 km
             *
             * See also:
             *
             *    divide
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x First value to multiply
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} y Second value to multiply
             * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} Multiplication of `x` and `y`
             */
            var multiply = typed('multiply', extend({
                // we extend the signatures of multiplyScalar with signatures dealing with matrices

                'Array, Array': function(x, y) {
                    // check dimensions
                    _validateMatrixDimensions(array.size(x), array.size(y));

                    // use dense matrix implementation
                    var m = multiply(matrix(x), matrix(y));
                    // return array or scalar
                    return (m && m.isMatrix === true) ? m.valueOf() : m;
                },

                'Matrix, Matrix': function(x, y) {
                    // dimensions
                    var xsize = x.size();
                    var ysize = y.size();

                    // check dimensions
                    _validateMatrixDimensions(xsize, ysize);

                    // process dimensions
                    if (xsize.length === 1) {
                        // process y dimensions
                        if (ysize.length === 1) {
                            // Vector * Vector
                            return _multiplyVectorVector(x, y, xsize[0]);
                        }
                        // Vector * Matrix
                        return _multiplyVectorMatrix(x, y);
                    }
                    // process y dimensions
                    if (ysize.length === 1) {
                        // Matrix * Vector
                        return _multiplyMatrixVector(x, y);
                    }
                    // Matrix * Matrix
                    return _multiplyMatrixMatrix(x, y);
                },

                'Matrix, Array': function(x, y) {
                    // use Matrix * Matrix implementation
                    return multiply(x, matrix(y));
                },

                'Array, Matrix': function(x, y) {
                    // use Matrix * Matrix implementation
                    return multiply(matrix(x, y.storage()), y);
                },

                'Matrix, any': function(x, y) {
                    // result
                    var c;

                    // process storage format
                    switch (x.storage()) {
                        case 'sparse':
                            c = algorithm11(x, y, multiplyScalar, false);
                            break;
                        case 'dense':
                            c = algorithm14(x, y, multiplyScalar, false);
                            break;
                    }
                    return c;
                },

                'any, Matrix': function(x, y) {
                    // result
                    var c;
                    // check storage format
                    switch (y.storage()) {
                        case 'sparse':
                            c = algorithm11(y, x, multiplyScalar, true);
                            break;
                        case 'dense':
                            c = algorithm14(y, x, multiplyScalar, true);
                            break;
                    }
                    return c;
                },

                'Array, any': function(x, y) {
                    // use matrix implementation
                    return algorithm14(matrix(x), y, multiplyScalar, false).valueOf();
                },

                'any, Array': function(x, y) {
                    // use matrix implementation
                    return algorithm14(matrix(y), x, multiplyScalar, true).valueOf();
                }
            }, multiplyScalar.signatures));

            var _validateMatrixDimensions = function(size1, size2) {
                // check left operand dimensions
                switch (size1.length) {
                    case 1:
                        // check size2
                        switch (size2.length) {
                            case 1:
                                // Vector x Vector
                                if (size1[0] !== size2[0]) {
                                    // throw error
                                    throw new RangeError('Dimension mismatch in multiplication. Vectors must have the same length');
                                }
                                break;
                            case 2:
                                // Vector x Matrix
                                if (size1[0] !== size2[0]) {
                                    // throw error
                                    throw new RangeError('Dimension mismatch in multiplication. Vector length (' + size1[0] + ') must match Matrix rows (' + size2[0] + ')');
                                }
                                break;
                            default:
                                throw new Error('Can only multiply a 1 or 2 dimensional matrix (Matrix B has ' + size2.length + ' dimensions)');
                        }
                        break;
                    case 2:
                        // check size2
                        switch (size2.length) {
                            case 1:
                                // Matrix x Vector
                                if (size1[1] !== size2[0]) {
                                    // throw error
                                    throw new RangeError('Dimension mismatch in multiplication. Matrix columns (' + size1[1] + ') must match Vector length (' + size2[0] + ')');
                                }
                                break;
                            case 2:
                                // Matrix x Matrix
                                if (size1[1] !== size2[0]) {
                                    // throw error
                                    throw new RangeError('Dimension mismatch in multiplication. Matrix A columns (' + size1[1] + ') must match Matrix B rows (' + size2[0] + ')');
                                }
                                break;
                            default:
                                throw new Error('Can only multiply a 1 or 2 dimensional matrix (Matrix B has ' + size2.length + ' dimensions)');
                        }
                        break;
                    default:
                        throw new Error('Can only multiply a 1 or 2 dimensional matrix (Matrix A has ' + size1.length + ' dimensions)');
                }
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            Dense Vector   (N)
             * @param {Matrix} b            Dense Vector   (N)
             *
             * @return {number}             Scalar value
             */
            var _multiplyVectorVector = function(a, b, n) {
                // check empty vector
                if (n === 0)
                    throw new Error('Cannot multiply two empty vectors');

                // a dense
                var adata = a._data;
                var adt = a._datatype;
                // b dense
                var bdata = b._data;
                var bdt = b._datatype;

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                }

                // result (do not initialize it with zero)
                var c = mf(adata[0], bdata[0]);
                // loop data
                for (var i = 1; i < n; i++) {
                    // multiply and accumulate
                    c = af(c, mf(adata[i], bdata[i]));
                }
                return c;
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            Dense Vector   (M)
             * @param {Matrix} b            Matrix         (MxN)
             *
             * @return {Matrix}             Dense Vector   (N)
             */
            var _multiplyVectorMatrix = function(a, b) {
                // process storage
                switch (b.storage()) {
                    case 'dense':
                        return _multiplyVectorDenseMatrix(a, b);
                }
                throw new Error('Not implemented');
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            Dense Vector   (M)
             * @param {Matrix} b            Dense Matrix   (MxN)
             *
             * @return {Matrix}             Dense Vector   (N)
             */
            var _multiplyVectorDenseMatrix = function(a, b) {
                // a dense
                var adata = a._data;
                var asize = a._size;
                var adt = a._datatype;
                // b dense
                var bdata = b._data;
                var bsize = b._size;
                var bdt = b._datatype;
                // rows & columns
                var alength = asize[0];
                var bcolumns = bsize[1];

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                }

                // result
                var c = [];

                // loop matrix columns
                for (var j = 0; j < bcolumns; j++) {
                    // sum (do not initialize it with zero)
                    var sum = mf(adata[0], bdata[0][j]);
                    // loop vector
                    for (var i = 1; i < alength; i++) {
                        // multiply & accumulate
                        sum = af(sum, mf(adata[i], bdata[i][j]));
                    }
                    c[j] = sum;
                }

                // return matrix
                return new DenseMatrix({
                    data: c,
                    size: [bcolumns],
                    datatype: dt
                });
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            Matrix         (MxN)
             * @param {Matrix} b            Dense Vector   (N)
             *
             * @return {Matrix}             Dense Vector   (M)
             */
            var _multiplyMatrixVector = function(a, b) {
                // process storage
                switch (a.storage()) {
                    case 'dense':
                        return _multiplyDenseMatrixVector(a, b);
                    case 'sparse':
                        return _multiplySparseMatrixVector(a, b);
                }
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            Matrix         (MxN)
             * @param {Matrix} b            Matrix         (NxC)
             *
             * @return {Matrix}             Matrix         (MxC)
             */
            var _multiplyMatrixMatrix = function(a, b) {
                // process storage
                switch (a.storage()) {
                    case 'dense':
                        // process storage
                        switch (b.storage()) {
                            case 'dense':
                                return _multiplyDenseMatrixDenseMatrix(a, b);
                            case 'sparse':
                                return _multiplyDenseMatrixSparseMatrix(a, b);
                        }
                        break;
                    case 'sparse':
                        // process storage
                        switch (b.storage()) {
                            case 'dense':
                                return _multiplySparseMatrixDenseMatrix(a, b);
                            case 'sparse':
                                return _multiplySparseMatrixSparseMatrix(a, b);
                        }
                        break;
                }
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            DenseMatrix  (MxN)
             * @param {Matrix} b            Dense Vector (N)
             *
             * @return {Matrix}             Dense Vector (M) 
             */
            var _multiplyDenseMatrixVector = function(a, b) {
                // a dense
                var adata = a._data;
                var asize = a._size;
                var adt = a._datatype;
                // b dense
                var bdata = b._data;
                var bdt = b._datatype;
                // rows & columns
                var arows = asize[0];
                var acolumns = asize[1];

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                }

                // result
                var c = [];

                // loop matrix a rows
                for (var i = 0; i < arows; i++) {
                    // current row
                    var row = adata[i];
                    // sum (do not initialize it with zero)
                    var sum = mf(row[0], bdata[0]);
                    // loop matrix a columns
                    for (var j = 1; j < acolumns; j++) {
                        // multiply & accumulate
                        sum = af(sum, mf(row[j], bdata[j]));
                    }
                    c[i] = sum;
                }

                // return matrix
                return new DenseMatrix({
                    data: c,
                    size: [arows],
                    datatype: dt
                });
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            DenseMatrix    (MxN)
             * @param {Matrix} b            DenseMatrix    (NxC)
             *
             * @return {Matrix}             DenseMatrix    (MxC)
             */
            var _multiplyDenseMatrixDenseMatrix = function(a, b) {
                // a dense
                var adata = a._data;
                var asize = a._size;
                var adt = a._datatype;
                // b dense
                var bdata = b._data;
                var bsize = b._size;
                var bdt = b._datatype;
                // rows & columns
                var arows = asize[0];
                var acolumns = asize[1];
                var bcolumns = bsize[1];

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                }

                // result
                var c = [];

                // loop matrix a rows
                for (var i = 0; i < arows; i++) {
                    // current row
                    var row = adata[i];
                    // initialize row array
                    c[i] = [];
                    // loop matrix b columns
                    for (var j = 0; j < bcolumns; j++) {
                        // sum (avoid initializing sum to zero)
                        var sum = mf(row[0], bdata[0][j]);
                        // loop matrix a columns
                        for (var x = 1; x < acolumns; x++) {
                            // multiply & accumulate
                            sum = af(sum, mf(row[x], bdata[x][j]));
                        }
                        c[i][j] = sum;
                    }
                }

                // return matrix
                return new DenseMatrix({
                    data: c,
                    size: [arows, bcolumns],
                    datatype: dt
                });
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            DenseMatrix    (MxN)
             * @param {Matrix} b            SparseMatrix   (NxC)
             *
             * @return {Matrix}             SparseMatrix   (MxC)
             */
            var _multiplyDenseMatrixSparseMatrix = function(a, b) {
                // a dense
                var adata = a._data;
                var asize = a._size;
                var adt = a._datatype;
                // b sparse
                var bvalues = b._values;
                var bindex = b._index;
                var bptr = b._ptr;
                var bsize = b._size;
                var bdt = b._datatype;
                // validate b matrix
                if (!bvalues)
                    throw new Error('Cannot multiply Dense Matrix times Pattern only Matrix');
                // rows & columns
                var arows = asize[0];
                var bcolumns = bsize[1];

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;
                // equalScalar signature to use
                var eq = equalScalar;
                // zero value
                var zero = 0;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                    eq = typed.find(equalScalar, [dt, dt]);
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                }

                // result
                var cvalues = [];
                var cindex = [];
                var cptr = [];
                // c matrix
                var c = new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [arows, bcolumns],
                    datatype: dt
                });

                // loop b columns
                for (var jb = 0; jb < bcolumns; jb++) {
                    // update ptr
                    cptr[jb] = cindex.length;
                    // indeces in column jb
                    var kb0 = bptr[jb];
                    var kb1 = bptr[jb + 1];
                    // do not process column jb if no data exists
                    if (kb1 > kb0) {
                        // last row mark processed
                        var last = 0;
                        // loop a rows
                        for (var i = 0; i < arows; i++) {
                            // column mark
                            var mark = i + 1;
                            // C[i, jb]
                            var cij;
                            // values in b column j
                            for (var kb = kb0; kb < kb1; kb++) {
                                // row
                                var ib = bindex[kb];
                                // check value has been initialized
                                if (last !== mark) {
                                    // first value in column jb
                                    cij = mf(adata[i][ib], bvalues[kb]);
                                    // update mark
                                    last = mark;
                                } else {
                                    // accumulate value
                                    cij = af(cij, mf(adata[i][ib], bvalues[kb]));
                                }
                            }
                            // check column has been processed and value != 0
                            if (last === mark && !eq(cij, zero)) {
                                // push row & value
                                cindex.push(i);
                                cvalues.push(cij);
                            }
                        }
                    }
                }
                // update ptr
                cptr[bcolumns] = cindex.length;

                // return sparse matrix
                return c;
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            SparseMatrix    (MxN)
             * @param {Matrix} b            Dense Vector (N)
             *
             * @return {Matrix}             SparseMatrix    (M, 1) 
             */
            var _multiplySparseMatrixVector = function(a, b) {
                // a sparse
                var avalues = a._values;
                var aindex = a._index;
                var aptr = a._ptr;
                var adt = a._datatype;
                // validate a matrix
                if (!avalues)
                    throw new Error('Cannot multiply Pattern only Matrix times Dense Matrix');
                // b dense
                var bdata = b._data;
                var bdt = b._datatype;
                // rows & columns
                var arows = a._size[0];
                var brows = b._size[0];
                // result
                var cvalues = [];
                var cindex = [];
                var cptr = [];

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;
                // equalScalar signature to use
                var eq = equalScalar;
                // zero value
                var zero = 0;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                    eq = typed.find(equalScalar, [dt, dt]);
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                }

                // workspace
                var x = [];
                // vector with marks indicating a value x[i] exists in a given column
                var w = [];

                // update ptr
                cptr[0] = 0;
                // rows in b
                for (var ib = 0; ib < brows; ib++) {
                    // b[ib]
                    var vbi = bdata[ib];
                    // check b[ib] != 0, avoid loops
                    if (!eq(vbi, zero)) {
                        // A values & index in ib column
                        for (var ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                            // a row
                            var ia = aindex[ka];
                            // check value exists in current j
                            if (!w[ia]) {
                                // ia is new entry in j
                                w[ia] = true;
                                // add i to pattern of C
                                cindex.push(ia);
                                // x(ia) = A
                                x[ia] = mf(vbi, avalues[ka]);
                            } else {
                                // i exists in C already
                                x[ia] = af(x[ia], mf(vbi, avalues[ka]));
                            }
                        }
                    }
                }
                // copy values from x to column jb of c
                for (var p1 = cindex.length, p = 0; p < p1; p++) {
                    // row
                    var ic = cindex[p];
                    // copy value
                    cvalues[p] = x[ic];
                }
                // update ptr
                cptr[1] = cindex.length;

                // return sparse matrix
                return new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [arows, 1],
                    datatype: dt
                });
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            SparseMatrix      (MxN)
             * @param {Matrix} b            DenseMatrix       (NxC)
             *
             * @return {Matrix}             SparseMatrix      (MxC)
             */
            var _multiplySparseMatrixDenseMatrix = function(a, b) {
                // a sparse
                var avalues = a._values;
                var aindex = a._index;
                var aptr = a._ptr;
                var adt = a._datatype;
                // validate a matrix
                if (!avalues)
                    throw new Error('Cannot multiply Pattern only Matrix times Dense Matrix');
                // b dense
                var bdata = b._data;
                var bdt = b._datatype;
                // rows & columns
                var arows = a._size[0];
                var brows = b._size[0];
                var bcolumns = b._size[1];

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;
                // equalScalar signature to use
                var eq = equalScalar;
                // zero value
                var zero = 0;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                    eq = typed.find(equalScalar, [dt, dt]);
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                }

                // result
                var cvalues = [];
                var cindex = [];
                var cptr = [];
                // c matrix
                var c = new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [arows, bcolumns],
                    datatype: dt
                });

                // workspace
                var x = [];
                // vector with marks indicating a value x[i] exists in a given column
                var w = [];

                // loop b columns
                for (var jb = 0; jb < bcolumns; jb++) {
                    // update ptr
                    cptr[jb] = cindex.length;
                    // mark in workspace for current column
                    var mark = jb + 1;
                    // rows in jb
                    for (var ib = 0; ib < brows; ib++) {
                        // b[ib, jb]
                        var vbij = bdata[ib][jb];
                        // check b[ib, jb] != 0, avoid loops
                        if (!eq(vbij, zero)) {
                            // A values & index in ib column
                            for (var ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                                // a row
                                var ia = aindex[ka];
                                // check value exists in current j
                                if (w[ia] !== mark) {
                                    // ia is new entry in j
                                    w[ia] = mark;
                                    // add i to pattern of C
                                    cindex.push(ia);
                                    // x(ia) = A
                                    x[ia] = mf(vbij, avalues[ka]);
                                } else {
                                    // i exists in C already
                                    x[ia] = af(x[ia], mf(vbij, avalues[ka]));
                                }
                            }
                        }
                    }
                    // copy values from x to column jb of c
                    for (var p0 = cptr[jb], p1 = cindex.length, p = p0; p < p1; p++) {
                        // row
                        var ic = cindex[p];
                        // copy value
                        cvalues[p] = x[ic];
                    }
                }
                // update ptr
                cptr[bcolumns] = cindex.length;

                // return sparse matrix
                return c;
            };

            /**
             * C = A * B
             *
             * @param {Matrix} a            SparseMatrix      (MxN)
             * @param {Matrix} b            SparseMatrix      (NxC)
             *
             * @return {Matrix}             SparseMatrix      (MxC)
             */
            var _multiplySparseMatrixSparseMatrix = function(a, b) {
                // a sparse
                var avalues = a._values;
                var aindex = a._index;
                var aptr = a._ptr;
                var adt = a._datatype;
                // b sparse
                var bvalues = b._values;
                var bindex = b._index;
                var bptr = b._ptr;
                var bdt = b._datatype;

                // rows & columns
                var arows = a._size[0];
                var bcolumns = b._size[1];
                // flag indicating both matrices (a & b) contain data
                var values = avalues && bvalues;

                // datatype
                var dt;
                // addScalar signature to use
                var af = addScalar;
                // multiplyScalar signature to use
                var mf = multiplyScalar;

                // process data types
                if (adt && bdt && adt === bdt && typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signatures that matches (dt, dt)
                    af = typed.find(addScalar, [dt, dt]);
                    mf = typed.find(multiplyScalar, [dt, dt]);
                }

                // result
                var cvalues = values ? [] : undefined;
                var cindex = [];
                var cptr = [];
                // c matrix
                var c = new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [arows, bcolumns],
                    datatype: dt
                });

                // workspace
                var x = values ? [] : undefined;
                // vector with marks indicating a value x[i] exists in a given column
                var w = [];
                // variables
                var ka, ka0, ka1, kb, kb0, kb1, ia, ib;
                // loop b columns
                for (var jb = 0; jb < bcolumns; jb++) {
                    // update ptr
                    cptr[jb] = cindex.length;
                    // mark in workspace for current column
                    var mark = jb + 1;
                    // B values & index in j
                    for (kb0 = bptr[jb], kb1 = bptr[jb + 1], kb = kb0; kb < kb1; kb++) {
                        // b row
                        ib = bindex[kb];
                        // check we need to process values
                        if (values) {
                            // loop values in a[:,ib]
                            for (ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                                // row
                                ia = aindex[ka];
                                // check value exists in current j
                                if (w[ia] !== mark) {
                                    // ia is new entry in j
                                    w[ia] = mark;
                                    // add i to pattern of C
                                    cindex.push(ia);
                                    // x(ia) = A
                                    x[ia] = mf(bvalues[kb], avalues[ka]);
                                } else {
                                    // i exists in C already
                                    x[ia] = af(x[ia], mf(bvalues[kb], avalues[ka]));
                                }
                            }
                        } else {
                            // loop values in a[:,ib]
                            for (ka0 = aptr[ib], ka1 = aptr[ib + 1], ka = ka0; ka < ka1; ka++) {
                                // row
                                ia = aindex[ka];
                                // check value exists in current j
                                if (w[ia] !== mark) {
                                    // ia is new entry in j
                                    w[ia] = mark;
                                    // add i to pattern of C
                                    cindex.push(ia);
                                }
                            }
                        }
                    }
                    // check we need to process matrix values (pattern matrix)
                    if (values) {
                        // copy values from x to column jb of c
                        for (var p0 = cptr[jb], p1 = cindex.length, p = p0; p < p1; p++) {
                            // row
                            var ic = cindex[p];
                            // copy value
                            cvalues[p] = x[ic];
                        }
                    }
                }
                // update ptr
                cptr[bcolumns] = cindex.length;

                // return sparse matrix
                return c;
            };

            multiply.toTex = {
                2: '\\left(${args[0]}' + latex.operators['multiply'] + '${args[1]}\\right)'
            };

            return multiply;
        }

        exports.name = 'multiply';
        exports.factory = factory;

    }, {
        "../../type/matrix/function/matrix": 24,
        "../../type/matrix/utils/algorithm11": 30,
        "../../type/matrix/utils/algorithm14": 32,
        "../../utils/array": 34,
        "../../utils/latex": 42,
        "../../utils/object": 44,
        "../relational/equalScalar": 21,
        "./addScalar": 11,
        "./multiplyScalar": 14
    }],
    14: [function(require, module, exports) {
        'use strict';

        function factory(type, config, load, typed) {

            /**
             * Multiply two scalar values, `x * y`.
             * This function is meant for internal use: it is used by the public function
             * `multiply`
             *
             * This function does not support collections (Array or Matrix), and does
             * not validate the number of of inputs.
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit} x   First value to multiply
             * @param  {number | BigNumber | Fraction | Complex} y          Second value to multiply
             * @return {number | BigNumber | Fraction | Complex | Unit}                      Multiplication of `x` and `y`
             * @private
             */
            var multiplyScalar = typed('multiplyScalar', {

                'number, number': function(x, y) {
                    return x * y;
                },

                'Complex, Complex': function(x, y) {
                    return x.mul(y);
                },

                'BigNumber, BigNumber': function(x, y) {
                    return x.times(y);
                },

                'Fraction, Fraction': function(x, y) {
                    return x.mul(y);
                },

                'number | Fraction | BigNumber | Complex, Unit': function(x, y) {
                    var res = y.clone();
                    res.value = (res.value === null) ? res._normalize(x) : multiplyScalar(res.value, x);
                    return res;
                },

                'Unit, number | Fraction | BigNumber | Complex': function(x, y) {
                    var res = x.clone();
                    res.value = (res.value === null) ? res._normalize(y) : multiplyScalar(res.value, y);
                    return res;
                },

                'Unit, Unit': function(x, y) {
                    return x.multiply(y);
                }

            });

            return multiplyScalar;
        }

        exports.factory = factory;

    }, {}],
    15: [function(require, module, exports) {
        'use strict';

        var DimensionError = require('../../error/DimensionError');

        function factory(type, config, load, typed) {
            var latex = require('../../utils/latex');

            var matrix = load(require('../../type/matrix/function/matrix'));
            var addScalar = load(require('./addScalar'));
            var unaryMinus = load(require('./unaryMinus'));

            var algorithm01 = load(require('../../type/matrix/utils/algorithm01'));
            var algorithm03 = load(require('../../type/matrix/utils/algorithm03'));
            var algorithm05 = load(require('../../type/matrix/utils/algorithm05'));
            var algorithm10 = load(require('../../type/matrix/utils/algorithm10'));
            var algorithm13 = load(require('../../type/matrix/utils/algorithm13'));
            var algorithm14 = load(require('../../type/matrix/utils/algorithm14'));

            // TODO: split function subtract in two: subtract and subtractScalar

            /**
             * Subtract two values, `x - y`.
             * For matrices, the function is evaluated element wise.
             *
             * Syntax:
             *
             *    math.subtract(x, y)
             *
             * Examples:
             *
             *    math.subtract(5.3, 2);        // returns number 3.3
             *
             *    var a = math.complex(2, 3);
             *    var b = math.complex(4, 1);
             *    math.subtract(a, b);          // returns Complex -2 + 2i
             *
             *    math.subtract([5, 7, 4], 4);  // returns Array [1, 3, 0]
             *
             *    var c = math.unit('2.1 km');
             *    var d = math.unit('500m');
             *    math.subtract(c, d);          // returns Unit 1.6 km
             *
             * See also:
             *
             *    add
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x
             *            Initial value
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} y
             *            Value to subtract from `x`
             * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix}
             *            Subtraction of `x` and `y`
             */
            var subtract = typed('subtract', {

                'number, number': function(x, y) {
                    return x - y;
                },

                'Complex, Complex': function(x, y) {
                    return x.sub(y);
                },

                'BigNumber, BigNumber': function(x, y) {
                    return x.minus(y);
                },

                'Fraction, Fraction': function(x, y) {
                    return x.sub(y);
                },

                'Unit, Unit': function(x, y) {
                    if (x.value == null) {
                        throw new Error('Parameter x contains a unit with undefined value');
                    }

                    if (y.value == null) {
                        throw new Error('Parameter y contains a unit with undefined value');
                    }

                    if (!x.equalBase(y)) {
                        throw new Error('Units do not match');
                    }

                    var res = x.clone();
                    res.value = subtract(res.value, y.value);
                    res.fixPrefix = false;

                    return res;
                },

                'Matrix, Matrix': function(x, y) {
                    // matrix sizes
                    var xsize = x.size();
                    var ysize = y.size();

                    // check dimensions
                    if (xsize.length !== ysize.length)
                        throw new DimensionError(xsize.length, ysize.length);

                    // result
                    var c;

                    // process matrix storage
                    switch (x.storage()) {
                        case 'sparse':
                            switch (y.storage()) {
                                case 'sparse':
                                    // sparse - sparse
                                    c = algorithm05(x, y, subtract);
                                    break;
                                default:
                                    // sparse - dense
                                    c = algorithm03(y, x, subtract, true);
                                    break;
                            }
                            break;
                        default:
                            switch (y.storage()) {
                                case 'sparse':
                                    // dense - sparse
                                    c = algorithm01(x, y, subtract, false);
                                    break;
                                default:
                                    // dense - dense
                                    c = algorithm13(x, y, subtract);
                                    break;
                            }
                            break;
                    }
                    return c;
                },

                'Array, Array': function(x, y) {
                    // use matrix implementation
                    return subtract(matrix(x), matrix(y)).valueOf();
                },

                'Array, Matrix': function(x, y) {
                    // use matrix implementation
                    return subtract(matrix(x), y);
                },

                'Matrix, Array': function(x, y) {
                    // use matrix implementation
                    return subtract(x, matrix(y));
                },

                'Matrix, any': function(x, y) {
                    // result
                    var c;
                    // check storage format
                    switch (x.storage()) {
                        case 'sparse':
                            // algorithm 7 is faster than 9 since it calls f() for nonzero items only!
                            c = algorithm10(x, unaryMinus(y), addScalar);
                            break;
                        default:
                            c = algorithm14(x, y, subtract);
                            break;
                    }
                    return c;
                },

                'any, Matrix': function(x, y) {
                    // result
                    var c;
                    // check storage format
                    switch (y.storage()) {
                        case 'sparse':
                            c = algorithm10(y, x, subtract, true);
                            break;
                        default:
                            c = algorithm14(y, x, subtract, true);
                            break;
                    }
                    return c;
                },

                'Array, any': function(x, y) {
                    // use matrix implementation
                    return algorithm14(matrix(x), y, subtract, false).valueOf();
                },

                'any, Array': function(x, y) {
                    // use matrix implementation
                    return algorithm14(matrix(y), x, subtract, true).valueOf();
                }
            });

            subtract.toTex = {
                2: '\\left(${args[0]}' + latex.operators['subtract'] + '${args[1]}\\right)'
            };

            return subtract;
        }

        exports.name = 'subtract';
        exports.factory = factory;

    }, {
        "../../error/DimensionError": 8,
        "../../type/matrix/function/matrix": 24,
        "../../type/matrix/utils/algorithm01": 25,
        "../../type/matrix/utils/algorithm03": 26,
        "../../type/matrix/utils/algorithm05": 28,
        "../../type/matrix/utils/algorithm10": 29,
        "../../type/matrix/utils/algorithm13": 31,
        "../../type/matrix/utils/algorithm14": 32,
        "../../utils/latex": 42,
        "./addScalar": 11,
        "./unaryMinus": 16
    }],
    16: [function(require, module, exports) {
        'use strict';

        var deepMap = require('../../utils/collection/deepMap');

        function factory(type, config, load, typed) {
            var latex = require('../../utils/latex');

            /**
             * Inverse the sign of a value, apply a unary minus operation.
             *
             * For matrices, the function is evaluated element wise. Boolean values and
             * strings will be converted to a number. For complex numbers, both real and
             * complex value are inverted.
             *
             * Syntax:
             *
             *    math.unaryMinus(x)
             *
             * Examples:
             *
             *    math.unaryMinus(3.5);      // returns -3.5
             *    math.unaryMinus(-4.2);     // returns 4.2
             *
             * See also:
             *
             *    add, subtract, unaryPlus
             *
             * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x Number to be inverted.
             * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} Returns the value with inverted sign.
             */
            var unaryMinus = typed('unaryMinus', {
                'number': function(x) {
                    return -x;
                },

                'Complex': function(x) {
                    return x.neg();
                },

                'BigNumber': function(x) {
                    return x.neg();
                },

                'Fraction': function(x) {
                    return x.neg();
                },

                'Unit': function(x) {
                    var res = x.clone();
                    res.value = unaryMinus(x.value);
                    return res;
                },

                'Array | Matrix': function(x) {
                    // deep map collection, skip zeros since unaryMinus(0) = 0
                    return deepMap(x, unaryMinus, true);
                }

                // TODO: add support for string
            });

            unaryMinus.toTex = {
                1: latex.operators['unaryMinus'] + '\\left(${args[0]}\\right)'
            };

            return unaryMinus;
        }

        exports.name = 'unaryMinus';
        exports.factory = factory;

    }, {
        "../../utils/collection/deepMap": 38,
        "../../utils/latex": 42
    }],
    17: [function(require, module, exports) {
        'use strict';

        var util = require('../../utils/index');
        var object = util.object;
        var string = util.string;

        function factory(type, config, load, typed) {
            var matrix = load(require('../../type/matrix/function/matrix'));
            var add = load(require('../arithmetic/add'));
            var subtract = load(require('../arithmetic/subtract'));
            var multiply = load(require('../arithmetic/multiply'));
            var unaryMinus = load(require('../arithmetic/unaryMinus'));

            /**
             * Calculate the determinant of a matrix.
             *
             * Syntax:
             *
             *    math.det(x)
             *
             * Examples:
             *
             *    math.det([[1, 2], [3, 4]]); // returns -2
             *
             *    var A = [
             *      [-2, 2, 3],
             *      [-1, 1, 3],
             *      [2, 0, -1]
             *    ]
             *    math.det(A); // returns 6
             *
             * See also:
             *
             *    inv
             *
             * @param {Array | Matrix} x  A matrix
             * @return {number} The determinant of `x`
             */
            var det = typed('det', {
                'any': function(x) {
                    return object.clone(x);
                },

                'Array | Matrix': function det(x) {
                    var size;
                    if (x && x.isMatrix === true) {
                        size = x.size();
                    } else if (Array.isArray(x)) {
                        x = matrix(x);
                        size = x.size();
                    } else {
                        // a scalar
                        size = [];
                    }

                    switch (size.length) {
                        case 0:
                            // scalar
                            return object.clone(x);

                        case 1:
                            // vector
                            if (size[0] == 1) {
                                return object.clone(x.valueOf()[0]);
                            } else {
                                throw new RangeError('Matrix must be square ' +
                                    '(size: ' + string.format(size) + ')');
                            }

                        case 2:
                            // two dimensional array
                            var rows = size[0];
                            var cols = size[1];
                            if (rows == cols) {
                                return _det(x.clone().valueOf(), rows, cols);
                            } else {
                                throw new RangeError('Matrix must be square ' +
                                    '(size: ' + string.format(size) + ')');
                            }

                        default:
                            // multi dimensional array
                            throw new RangeError('Matrix must be two dimensional ' +
                                '(size: ' + string.format(size) + ')');
                    }
                }
            });

            det.toTex = {
                1: '\\det\\left(${args[0]}\\right)'
            };

            return det;

            /**
             * Calculate the determinant of a matrix
             * @param {Array[]} matrix  A square, two dimensional matrix
             * @param {number} rows     Number of rows of the matrix (zero-based)
             * @param {number} cols     Number of columns of the matrix (zero-based)
             * @returns {number} det
             * @private
             */
            function _det(matrix, rows, cols) {
                if (rows == 1) {
                    // this is a 1 x 1 matrix
                    return object.clone(matrix[0][0]);
                } else if (rows == 2) {
                    // this is a 2 x 2 matrix
                    // the determinant of [a11,a12;a21,a22] is det = a11*a22-a21*a12
                    return subtract(
                        multiply(matrix[0][0], matrix[1][1]),
                        multiply(matrix[1][0], matrix[0][1])
                    );
                } else {
                    // this is an n x n matrix
                    var compute_mu = function(matrix) {
                        var i, j;

                        // Compute the matrix with zero lower triangle, same upper triangle,
                        // and diagonals given by the negated sum of the below diagonal
                        // elements.
                        var mu = new Array(matrix.length);
                        var sum = 0;
                        for (i = 1; i < matrix.length; i++) {
                            sum = add(sum, matrix[i][i]);
                        }

                        for (i = 0; i < matrix.length; i++) {
                            mu[i] = new Array(matrix.length);
                            mu[i][i] = unaryMinus(sum);

                            for (j = 0; j < i; j++) {
                                mu[i][j] = 0; // TODO: make bignumber 0 in case of bignumber computation
                            }

                            for (j = i + 1; j < matrix.length; j++) {
                                mu[i][j] = matrix[i][j];
                            }

                            if (i + 1 < matrix.length) {
                                sum = subtract(sum, matrix[i + 1][i + 1]);
                            }
                        }

                        return mu;
                    };

                    var fa = matrix;
                    for (var i = 0; i < rows - 1; i++) {
                        fa = multiply(compute_mu(fa), matrix);
                    }

                    if (rows % 2 == 0) {
                        return unaryMinus(fa[0][0]);
                    } else {
                        return fa[0][0];
                    }
                }
            }
        }

        exports.name = 'det';
        exports.factory = factory;


    }, {
        "../../type/matrix/function/matrix": 24,
        "../../utils/index": 41,
        "../arithmetic/add": 10,
        "../arithmetic/multiply": 13,
        "../arithmetic/subtract": 15,
        "../arithmetic/unaryMinus": 16
    }],
    18: [function(require, module, exports) {
        'use strict';

        var array = require('../../utils/array');
        var isInteger = require('../../utils/number').isInteger;

        function factory(type, config, load, typed) {

            var matrix = load(require('../../type/matrix/function/matrix'));

            /**
             * Create a 2-dimensional identity matrix with size m x n or n x n.
             * The matrix has ones on the diagonal and zeros elsewhere.
             *
             * Syntax:
             *
             *    math.eye(n)
             *    math.eye(n, format)
             *    math.eye(m, n)
             *    math.eye(m, n, format)
             *    math.eye([m, n])
             *    math.eye([m, n], format)
             *
             * Examples:
             *
             *    math.eye(3);                    // returns [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
             *    math.eye(3, 2);                 // returns [[1, 0], [0, 1], [0, 0]]
             *
             *    var A = [[1, 2, 3], [4, 5, 6]];
             *    math.eye(math.size(A));         // returns [[1, 0, 0], [0, 1, 0]]
             *
             * See also:
             *
             *    diag, ones, zeros, size, range
             *
             * @param {...number | Matrix | Array} size   The size for the matrix
             * @param {string} [format]                   The Matrix storage format
             *
             * @return {Matrix | Array | number} A matrix with ones on the diagonal.
             */
            var eye = typed('eye', {
                '': function() {
                    return (config.matrix === 'Matrix') ? matrix([]) : [];
                },

                'string': function(format) {
                    return matrix(format);
                },

                'number | BigNumber': function(rows) {
                    return _eye(rows, rows, config.matrix === 'Matrix' ? 'default' : undefined);
                },

                'number | BigNumber, string': function(rows, format) {
                    return _eye(rows, rows, format);
                },

                'number | BigNumber, number | BigNumber': function(rows, cols) {
                    return _eye(rows, cols, config.matrix === 'Matrix' ? 'default' : undefined);
                },

                'number | BigNumber, number | BigNumber, string': function(rows, cols, format) {
                    return _eye(rows, cols, format);
                },

                'Array': function(size) {
                    return _eyeVector(size);
                },

                'Array, string': function(size, format) {
                    return _eyeVector(size, format);
                },

                'Matrix': function(size) {
                    return _eyeVector(size.valueOf(), size.storage());
                },

                'Matrix, string': function(size, format) {
                    return _eyeVector(size.valueOf(), format);
                }
            });

            eye.toTex = undefined; // use default template

            return eye;

            function _eyeVector(size, format) {
                switch (size.length) {
                    case 0:
                        return format ? matrix(format) : [];
                    case 1:
                        return _eye(size[0], size[0], format);
                    case 2:
                        return _eye(size[0], size[1], format);
                    default:
                        throw new Error('Vector containing two values expected');
                }
            }

            /**
             * Create an identity matrix
             * @param {number | BigNumber} rows
             * @param {number | BigNumber} cols
             * @param {string} [format]
             * @returns {Matrix}
             * @private
             */
            function _eye(rows, cols, format) {
                // BigNumber constructor with the right precision
                var Big = (rows && rows.isBigNumber === true) ?
                    type.BigNumber :
                    (cols && cols.isBigNumber === true) ?
                    type.BigNumber :
                    null;

                if (rows && rows.isBigNumber === true) rows = rows.toNumber();
                if (cols && cols.isBigNumber === true) cols = cols.toNumber();

                if (!isInteger(rows) || rows < 1) {
                    throw new Error('Parameters in function eye must be positive integers');
                }
                if (!isInteger(cols) || cols < 1) {
                    throw new Error('Parameters in function eye must be positive integers');
                }

                var one = Big ? new type.BigNumber(1) : 1;
                var defaultValue = Big ? new Big(0) : 0;
                var size = [rows, cols];

                // check we need to return a matrix
                if (format) {
                    // get matrix storage constructor
                    var F = type.Matrix.storage(format);
                    // create diagonal matrix (use optimized implementation for storage format)
                    return F.diagonal(size, one, 0, defaultValue);
                }

                // create and resize array
                var res = array.resize([], size, defaultValue);
                // fill in ones on the diagonal
                var minimum = rows < cols ? rows : cols;
                // fill diagonal
                for (var d = 0; d < minimum; d++) {
                    res[d][d] = one;
                }
                return res;
            }
        }

        exports.name = 'eye';
        exports.factory = factory;

    }, {
        "../../type/matrix/function/matrix": 24,
        "../../utils/array": 34,
        "../../utils/number": 43
    }],
    19: [function(require, module, exports) {
        'use strict';

        var util = require('../../utils/index');

        function factory(type, config, load, typed) {
            var matrix = load(require('../../type/matrix/function/matrix'));
            var divideScalar = load(require('../arithmetic/divideScalar'));
            var addScalar = load(require('../arithmetic/addScalar'));
            var multiply = load(require('../arithmetic/multiply'));
            var unaryMinus = load(require('../arithmetic/unaryMinus'));
            var det = load(require('../matrix/det'));
            var eye = load(require('./eye'));

            /**
             * Calculate the inverse of a square matrix.
             *
             * Syntax:
             *
             *     math.inv(x)
             *
             * Examples:
             *
             *     math.inv([[1, 2], [3, 4]]);  // returns [[-2, 1], [1.5, -0.5]]
             *     math.inv(4);                 // returns 0.25
             *     1 / 4;                       // returns 0.25
             *
             * See also:
             *
             *     det, transpose
             *
             * @param {number | Complex | Array | Matrix} x     Matrix to be inversed
             * @return {number | Complex | Array | Matrix} The inverse of `x`.
             */
            var inv = typed('inv', {
                'Array | Matrix': function(x) {
                    var size = (x.isMatrix === true) ? x.size() : util.array.size(x);
                    switch (size.length) {
                        case 1:
                            // vector
                            if (size[0] == 1) {
                                if (x.isMatrix === true) {
                                    return matrix([
                                        divideScalar(1, x.valueOf()[0])
                                    ]);
                                } else {
                                    return [
                                        divideScalar(1, x[0])
                                    ];
                                }
                            } else {
                                throw new RangeError('Matrix must be square ' +
                                    '(size: ' + util.string.format(size) + ')');
                            }

                        case 2:
                            // two dimensional array
                            var rows = size[0];
                            var cols = size[1];
                            if (rows == cols) {
                                if (x.isMatrix === true) {
                                    return matrix(
                                        _inv(x.valueOf(), rows, cols),
                                        x.storage()
                                    );
                                } else {
                                    // return an Array
                                    return _inv(x, rows, cols);
                                }
                            } else {
                                throw new RangeError('Matrix must be square ' +
                                    '(size: ' + util.string.format(size) + ')');
                            }

                        default:
                            // multi dimensional array
                            throw new RangeError('Matrix must be two dimensional ' +
                                '(size: ' + util.string.format(size) + ')');
                    }
                },

                'any': function(x) {
                    // scalar
                    return divideScalar(1, x); // FIXME: create a BigNumber one when configured for bignumbers
                }
            });

            /**
             * Calculate the inverse of a square matrix
             * @param {Array[]} mat     A square matrix
             * @param {number} rows     Number of rows
             * @param {number} cols     Number of columns, must equal rows
             * @return {Array[]} inv    Inverse matrix
             * @private
             */
            function _inv(mat, rows, cols) {
                var r, s, f, value, temp;

                if (rows == 1) {
                    // this is a 1 x 1 matrix
                    value = mat[0][0];
                    if (value == 0) {
                        throw Error('Cannot calculate inverse, determinant is zero');
                    }
                    return [
                        [
                            divideScalar(1, value)
                        ]
                    ];
                } else if (rows == 2) {
                    // this is a 2 x 2 matrix
                    var d = det(mat);
                    if (d == 0) {
                        throw Error('Cannot calculate inverse, determinant is zero');
                    }
                    return [
                        [
                            divideScalar(mat[1][1], d),
                            divideScalar(unaryMinus(mat[0][1]), d)
                        ],
                        [
                            divideScalar(unaryMinus(mat[1][0]), d),
                            divideScalar(mat[0][0], d)
                        ]
                    ];
                } else {
                    // this is a matrix of 3 x 3 or larger
                    // calculate inverse using gauss-jordan elimination
                    //      http://en.wikipedia.org/wiki/Gaussian_elimination
                    //      http://mathworld.wolfram.com/MatrixInverse.html
                    //      http://math.uww.edu/~mcfarlat/inverse.htm

                    // make a copy of the matrix (only the arrays, not of the elements)
                    var A = mat.concat();
                    for (r = 0; r < rows; r++) {
                        A[r] = A[r].concat();
                    }

                    // create an identity matrix which in the end will contain the
                    // matrix inverse
                    var B = eye(rows).valueOf();

                    // loop over all columns, and perform row reductions
                    for (var c = 0; c < cols; c++) {
                        // element Acc should be non zero. if not, swap content
                        // with one of the lower rows
                        r = c;
                        while (r < rows && A[r][c] == 0) {
                            r++;
                        }
                        if (r == rows || A[r][c] == 0) {
                            // TODO: in case of zero det, just return a matrix wih Infinity values? (like octave)
                            throw Error('Cannot calculate inverse, determinant is zero');
                        }
                        if (r != c) {
                            temp = A[c];
                            A[c] = A[r];
                            A[r] = temp;
                            temp = B[c];
                            B[c] = B[r];
                            B[r] = temp;
                        }

                        // eliminate non-zero values on the other rows at column c
                        var Ac = A[c],
                            Bc = B[c];
                        for (r = 0; r < rows; r++) {
                            var Ar = A[r],
                                Br = B[r];
                            if (r != c) {
                                // eliminate value at column c and row r
                                if (Ar[c] != 0) {
                                    f = divideScalar(unaryMinus(Ar[c]), Ac[c]);

                                    // add (f * row c) to row r to eliminate the value
                                    // at column c
                                    for (s = c; s < cols; s++) {
                                        Ar[s] = addScalar(Ar[s], multiply(f, Ac[s]));
                                    }
                                    for (s = 0; s < cols; s++) {
                                        Br[s] = addScalar(Br[s], multiply(f, Bc[s]));
                                    }
                                }
                            } else {
                                // normalize value at Acc to 1,
                                // divide each value on row r with the value at Acc
                                f = Ac[c];
                                for (s = c; s < cols; s++) {
                                    Ar[s] = divideScalar(Ar[s], f);
                                }
                                for (s = 0; s < cols; s++) {
                                    Br[s] = divideScalar(Br[s], f);
                                }
                            }
                        }
                    }
                    return B;
                }
            }

            inv.toTex = {
                1: '\\left(${args[0]}\\right)^{-1}'
            };

            return inv;
        }

        exports.name = 'inv';
        exports.factory = factory;

    }, {
        "../../type/matrix/function/matrix": 24,
        "../../utils/index": 41,
        "../arithmetic/addScalar": 11,
        "../arithmetic/divideScalar": 12,
        "../arithmetic/multiply": 13,
        "../arithmetic/unaryMinus": 16,
        "../matrix/det": 17,
        "./eye": 18
    }],
    20: [function(require, module, exports) {
        'use strict';

        var clone = require('../../utils/object').clone;
        var format = require('../../utils/string').format;

        function factory(type, config, load, typed) {
            var latex = require('../../utils/latex');

            var matrix = load(require('../../type/matrix/function/matrix'));

            var DenseMatrix = type.DenseMatrix,
                SparseMatrix = type.SparseMatrix;

            /**
             * Transpose a matrix. All values of the matrix are reflected over its
             * main diagonal. Only applicable to two dimensional matrices containing
             * a vector (i.e. having size `[1,n]` or `[n,1]`). One dimensional
             * vectors and scalars return the input unchanged.
             *
             * Syntax:
             *
             *     math.transpose(x)
             *
             * Examples:
             *
             *     var A = [[1, 2, 3], [4, 5, 6]];
             *     math.transpose(A);               // returns [[1, 4], [2, 5], [3, 6]]
             *
             * See also:
             *
             *     diag, inv, subset, squeeze
             *
             * @param {Array | Matrix} x  Matrix to be transposed
             * @return {Array | Matrix}   The transposed matrix
             */
            var transpose = typed('transpose', {

                'Array': function(x) {
                    // use dense matrix implementation
                    return transpose(matrix(x)).valueOf();
                },

                'Matrix': function(x) {
                    // matrix size
                    var size = x.size();

                    // result
                    var c;

                    // process dimensions
                    switch (size.length) {
                        case 1:
                            // vector
                            c = x.clone();
                            break;

                        case 2:
                            // rows and columns
                            var rows = size[0];
                            var columns = size[1];

                            // check columns
                            if (columns === 0) {
                                // throw exception
                                throw new RangeError('Cannot transpose a 2D matrix with no columns (size: ' + format(size) + ')');
                            }

                            // process storage format
                            switch (x.storage()) {
                                case 'dense':
                                    c = _denseTranspose(x, rows, columns);
                                    break;
                                case 'sparse':
                                    c = _sparseTranspose(x, rows, columns);
                                    break;
                            }
                            break;

                        default:
                            // multi dimensional
                            throw new RangeError('Matrix must be a vector or two dimensional (size: ' + format(this._size) + ')');
                    }
                    return c;
                },

                // scalars
                'any': function(x) {
                    return clone(x);
                }
            });

            var _denseTranspose = function(m, rows, columns) {
                // matrix array
                var data = m._data;
                // transposed matrix data
                var transposed = [];
                var transposedRow;
                // loop columns
                for (var j = 0; j < columns; j++) {
                    // initialize row
                    transposedRow = transposed[j] = [];
                    // loop rows
                    for (var i = 0; i < rows; i++) {
                        // set data
                        transposedRow[i] = clone(data[i][j]);
                    }
                }
                // return matrix
                return new DenseMatrix({
                    data: transposed,
                    size: [columns, rows],
                    datatype: m._datatype
                });
            };

            var _sparseTranspose = function(m, rows, columns) {
                // matrix arrays
                var values = m._values;
                var index = m._index;
                var ptr = m._ptr;
                // result matrices
                var cvalues = values ? [] : undefined;
                var cindex = [];
                var cptr = [];
                // row counts
                var w = [];
                for (var x = 0; x < rows; x++)
                    w[x] = 0;
                // vars
                var p, l, j;
                // loop values in matrix
                for (p = 0, l = index.length; p < l; p++) {
                    // number of values in row
                    w[index[p]]++;
                }
                // cumulative sum
                var sum = 0;
                // initialize cptr with the cummulative sum of row counts
                for (var i = 0; i < rows; i++) {
                    // update cptr
                    cptr.push(sum);
                    // update sum
                    sum += w[i];
                    // update w
                    w[i] = cptr[i];
                }
                // update cptr
                cptr.push(sum);
                // loop columns
                for (j = 0; j < columns; j++) {
                    // values & index in column
                    for (var k0 = ptr[j], k1 = ptr[j + 1], k = k0; k < k1; k++) {
                        // C values & index
                        var q = w[index[k]]++;
                        // C[j, i] = A[i, j]
                        cindex[q] = j;
                        // check we need to process values (pattern matrix)
                        if (values)
                            cvalues[q] = clone(values[k]);
                    }
                }
                // return matrix
                return new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [columns, rows],
                    datatype: m._datatype
                });
            };

            transpose.toTex = {
                1: '\\left(${args[0]}\\right)' + latex.operators['transpose']
            };

            return transpose;
        }

        exports.name = 'transpose';
        exports.factory = factory;

    }, {
        "../../type/matrix/function/matrix": 24,
        "../../utils/latex": 42,
        "../../utils/object": 44,
        "../../utils/string": 45
    }],
    21: [function(require, module, exports) {
        'use strict';

        var nearlyEqual = require('../../utils/number').nearlyEqual;
        var bigNearlyEqual = require('../../utils/bignumber/nearlyEqual');

        function factory(type, config, load, typed) {

            /**
             * Test whether two values are equal.
             *
             * @param  {number | BigNumber | Fraction | boolean | Complex | Unit} x   First value to compare
             * @param  {number | BigNumber | Fraction | boolean | Complex} y          Second value to compare
             * @return {boolean}                                                  Returns true when the compared values are equal, else returns false
             * @private
             */
            var equalScalar = typed('equalScalar', {

                'boolean, boolean': function(x, y) {
                    return x === y;
                },

                'number, number': function(x, y) {
                    return x === y || nearlyEqual(x, y, config.epsilon);
                },

                'BigNumber, BigNumber': function(x, y) {
                    return x.eq(y) || bigNearlyEqual(x, y, config.epsilon);
                },

                'Fraction, Fraction': function(x, y) {
                    return x.equals(y);
                },

                'Complex, Complex': function(x, y) {
                    return x.equals(y);
                },

                'Unit, Unit': function(x, y) {
                    if (!x.equalBase(y)) {
                        throw new Error('Cannot compare units with different base');
                    }
                    return equalScalar(x.value, y.value);
                },

                'string, string': function(x, y) {
                    return x === y;
                }
            });

            return equalScalar;
        }

        exports.factory = factory;

    }, {
        "../../utils/bignumber/nearlyEqual": 36,
        "../../utils/number": 43
    }],
    22: [function(require, module, exports) {
        'use strict';

        var util = require('../../utils/index');
        var DimensionError = require('../../error/DimensionError');

        var string = util.string;
        var array = util.array;
        var object = util.object;
        var number = util.number;

        var isArray = Array.isArray;
        var isNumber = number.isNumber;
        var isInteger = number.isInteger;
        var isString = string.isString;

        var validateIndex = array.validateIndex;

        function factory(type, config, load, typed) {
            var Matrix = load(require('./Matrix')); // force loading Matrix (do not use via type.Matrix)

            /**
             * Dense Matrix implementation. A regular, dense matrix, supporting multi-dimensional matrices. This is the default matrix type.
             * @class DenseMatrix
             */
            function DenseMatrix(data, datatype) {
                if (!(this instanceof DenseMatrix))
                    throw new SyntaxError('Constructor must be called with the new operator');
                if (datatype && !isString(datatype))
                    throw new Error('Invalid datatype: ' + datatype);

                if (data && data.isMatrix === true) {
                    // check data is a DenseMatrix
                    if (data.type === 'DenseMatrix') {
                        // clone data & size
                        this._data = object.clone(data._data);
                        this._size = object.clone(data._size);
                        this._datatype = datatype || data._datatype;
                    } else {
                        // build data from existing matrix
                        this._data = data.toArray();
                        this._size = data.size();
                        this._datatype = datatype || data._datatype;
                    }
                } else if (data && isArray(data.data) && isArray(data.size)) {
                    // initialize fields from JSON representation
                    this._data = data.data;
                    this._size = data.size;
                    this._datatype = datatype || data.datatype;
                } else if (isArray(data)) {
                    // replace nested Matrices with Arrays
                    this._data = preprocess(data);
                    // get the dimensions of the array
                    this._size = array.size(this._data);
                    // verify the dimensions of the array, TODO: compute size while processing array
                    array.validate(this._data, this._size);
                    // data type unknown
                    this._datatype = datatype;
                } else if (data) {
                    // unsupported type
                    throw new TypeError('Unsupported type of data (' + util.types.type(data) + ')');
                } else {
                    // nothing provided
                    this._data = [];
                    this._size = [0];
                    this._datatype = datatype;
                }
            }

            DenseMatrix.prototype = new Matrix();

            /**
             * Attach type information
             */
            DenseMatrix.prototype.type = 'DenseMatrix';
            DenseMatrix.prototype.isDenseMatrix = true;

            /**
             * Get the storage format used by the matrix.
             *
             * Usage:
             *     var format = matrix.storage()                   // retrieve storage format
             *
             * @memberof DenseMatrix
             * @return {string}           The storage format.
             */
            DenseMatrix.prototype.storage = function() {
                return 'dense';
            };

            /**
             * Get the datatype of the data stored in the matrix.
             *
             * Usage:
             *     var format = matrix.datatype()                   // retrieve matrix datatype
             *
             * @memberof DenseMatrix
             * @return {string}           The datatype.
             */
            DenseMatrix.prototype.datatype = function() {
                return this._datatype;
            };

            /**
             * Create a new DenseMatrix
             * @memberof DenseMatrix
             * @param {Array} data
             * @param {string} [datatype]
             */
            DenseMatrix.prototype.create = function(data, datatype) {
                return new DenseMatrix(data, datatype);
            };

            /**
             * Get a subset of the matrix, or replace a subset of the matrix.
             *
             * Usage:
             *     var subset = matrix.subset(index)               // retrieve subset
             *     var value = matrix.subset(index, replacement)   // replace subset
             *
             * @memberof DenseMatrix
             * @param {Index} index
             * @param {Array | DenseMatrix | *} [replacement]
             * @param {*} [defaultValue=0]      Default value, filled in on new entries when
             *                                  the matrix is resized. If not provided,
             *                                  new matrix elements will be filled with zeros.
             */
            DenseMatrix.prototype.subset = function(index, replacement, defaultValue) {
                switch (arguments.length) {
                    case 1:
                        return _get(this, index);

                        // intentional fall through
                    case 2:
                    case 3:
                        return _set(this, index, replacement, defaultValue);

                    default:
                        throw new SyntaxError('Wrong number of arguments');
                }
            };

            /**
             * Get a single element from the matrix.
             * @memberof DenseMatrix
             * @param {number[]} index   Zero-based index
             * @return {*} value
             */
            DenseMatrix.prototype.get = function(index) {
                if (!isArray(index))
                    throw new TypeError('Array expected');
                if (index.length != this._size.length)
                    throw new DimensionError(index.length, this._size.length);

                // check index
                for (var x = 0; x < index.length; x++)
                    validateIndex(index[x], this._size[x]);

                var data = this._data;
                for (var i = 0, ii = index.length; i < ii; i++) {
                    var index_i = index[i];
                    validateIndex(index_i, data.length);
                    data = data[index_i];
                }

                return data;
            };

            /**
             * Replace a single element in the matrix.
             * @memberof DenseMatrix
             * @param {number[]} index   Zero-based index
             * @param {*} value
             * @param {*} [defaultValue]        Default value, filled in on new entries when
             *                                  the matrix is resized. If not provided,
             *                                  new matrix elements will be left undefined.
             * @return {DenseMatrix} self
             */
            DenseMatrix.prototype.set = function(index, value, defaultValue) {
                if (!isArray(index))
                    throw new TypeError('Array expected');
                if (index.length < this._size.length)
                    throw new DimensionError(index.length, this._size.length, '<');

                var i, ii, index_i;

                // enlarge matrix when needed
                var size = index.map(function(i) {
                    return i + 1;
                });
                _fit(this, size, defaultValue);

                // traverse over the dimensions
                var data = this._data;
                for (i = 0, ii = index.length - 1; i < ii; i++) {
                    index_i = index[i];
                    validateIndex(index_i, data.length);
                    data = data[index_i];
                }

                // set new value
                index_i = index[index.length - 1];
                validateIndex(index_i, data.length);
                data[index_i] = value;

                return this;
            };

            /**
             * Get a submatrix of this matrix
             * @memberof DenseMatrix
             * @param {DenseMatrix} matrix
             * @param {Index} index   Zero-based index
             * @private
             */
            function _get(matrix, index) {
                if (!index || index.isIndex !== true) {
                    throw new TypeError('Invalid index');
                }

                var isScalar = index.isScalar();
                if (isScalar) {
                    // return a scalar
                    return matrix.get(index.min());
                } else {
                    // validate dimensions
                    var size = index.size();
                    if (size.length != matrix._size.length) {
                        throw new DimensionError(size.length, matrix._size.length);
                    }

                    // validate if any of the ranges in the index is out of range
                    var min = index.min();
                    var max = index.max();
                    for (var i = 0, ii = matrix._size.length; i < ii; i++) {
                        validateIndex(min[i], matrix._size[i]);
                        validateIndex(max[i], matrix._size[i]);
                    }

                    // retrieve submatrix
                    // TODO: more efficient when creating an empty matrix and setting _data and _size manually
                    return new DenseMatrix(_getSubmatrix(matrix._data, index, size.length, 0), matrix._datatype);
                }
            }

            /**
             * Recursively get a submatrix of a multi dimensional matrix.
             * Index is not checked for correct number or length of dimensions.
             * @memberof DenseMatrix
             * @param {Array} data
             * @param {Index} index
             * @param {number} dims   Total number of dimensions
             * @param {number} dim    Current dimension
             * @return {Array} submatrix
             * @private
             */
            function _getSubmatrix(data, index, dims, dim) {
                var last = (dim == dims - 1);
                var range = index.dimension(dim);

                if (last) {
                    return range.map(function(i) {
                        return data[i];
                    }).valueOf();
                } else {
                    return range.map(function(i) {
                        var child = data[i];
                        return _getSubmatrix(child, index, dims, dim + 1);
                    }).valueOf();
                }
            }

            /**
             * Replace a submatrix in this matrix
             * Indexes are zero-based.
             * @memberof DenseMatrix
             * @param {DenseMatrix} matrix
             * @param {Index} index
             * @param {DenseMatrix | Array | *} submatrix
             * @param {*} defaultValue          Default value, filled in on new entries when
             *                                  the matrix is resized.
             * @return {DenseMatrix} matrix
             * @private
             */
            function _set(matrix, index, submatrix, defaultValue) {
                if (!index || index.isIndex !== true) {
                    throw new TypeError('Invalid index');
                }

                // get index size and check whether the index contains a single value
                var iSize = index.size(),
                    isScalar = index.isScalar();

                // calculate the size of the submatrix, and convert it into an Array if needed
                var sSize;
                if (submatrix && submatrix.isMatrix === true) {
                    sSize = submatrix.size();
                    submatrix = submatrix.valueOf();
                } else {
                    sSize = array.size(submatrix);
                }

                if (isScalar) {
                    // set a scalar

                    // check whether submatrix is a scalar
                    if (sSize.length !== 0) {
                        throw new TypeError('Scalar expected');
                    }

                    matrix.set(index.min(), submatrix, defaultValue);
                } else {
                    // set a submatrix

                    // validate dimensions
                    if (iSize.length < matrix._size.length) {
                        throw new DimensionError(iSize.length, matrix._size.length, '<');
                    }

                    if (sSize.length < iSize.length) {
                        // calculate number of missing outer dimensions
                        var i = 0;
                        var outer = 0;
                        while (iSize[i] === 1 && sSize[i] === 1) {
                            i++;
                        }
                        while (iSize[i] === 1) {
                            outer++;
                            i++;
                        }

                        // unsqueeze both outer and inner dimensions
                        submatrix = array.unsqueeze(submatrix, iSize.length, outer, sSize);
                    }

                    // check whether the size of the submatrix matches the index size
                    if (!object.deepEqual(iSize, sSize)) {
                        throw new DimensionError(iSize, sSize, '>');
                    }

                    // enlarge matrix when needed
                    var size = index.max().map(function(i) {
                        return i + 1;
                    });
                    _fit(matrix, size, defaultValue);

                    // insert the sub matrix
                    var dims = iSize.length,
                        dim = 0;
                    _setSubmatrix(matrix._data, index, submatrix, dims, dim);
                }

                return matrix;
            }

            /**
             * Replace a submatrix of a multi dimensional matrix.
             * @memberof DenseMatrix
             * @param {Array} data
             * @param {Index} index
             * @param {Array} submatrix
             * @param {number} dims   Total number of dimensions
             * @param {number} dim
             * @private
             */
            function _setSubmatrix(data, index, submatrix, dims, dim) {
                var last = (dim == dims - 1),
                    range = index.dimension(dim);

                if (last) {
                    range.forEach(function(dataIndex, subIndex) {
                        validateIndex(dataIndex);
                        data[dataIndex] = submatrix[subIndex[0]];
                    });
                } else {
                    range.forEach(function(dataIndex, subIndex) {
                        validateIndex(dataIndex);
                        _setSubmatrix(data[dataIndex], index, submatrix[subIndex[0]], dims, dim + 1);
                    });
                }
            }

            /**
             * Resize the matrix to the given size. Returns a copy of the matrix when
             * `copy=true`, otherwise return the matrix itself (resize in place).
             *
             * @memberof DenseMatrix
             * @param {number[]} size           The new size the matrix should have.
             * @param {*} [defaultValue=0]      Default value, filled in on new entries.
             *                                  If not provided, the matrix elements will
             *                                  be filled with zeros.
             * @param {boolean} [copy]          Return a resized copy of the matrix
             *
             * @return {Matrix}                 The resized matrix
             */
            DenseMatrix.prototype.resize = function(size, defaultValue, copy) {
                // validate arguments
                if (!isArray(size))
                    throw new TypeError('Array expected');

                // matrix to resize
                var m = copy ? this.clone() : this;
                // resize matrix
                return _resize(m, size, defaultValue);
            };

            var _resize = function(matrix, size, defaultValue) {
                // check size
                if (size.length === 0) {
                    // first value in matrix
                    var v = matrix._data;
                    // go deep
                    while (isArray(v)) {
                        v = v[0];
                    }
                    return v;
                }
                // resize matrix
                matrix._size = size.slice(0); // copy the array
                matrix._data = array.resize(matrix._data, matrix._size, defaultValue);
                // return matrix
                return matrix;
            };

            /**
             * Enlarge the matrix when it is smaller than given size.
             * If the matrix is larger or equal sized, nothing is done.
             * @memberof DenseMatrix
             * @param {DenseMatrix} matrix           The matrix to be resized
             * @param {number[]} size
             * @param {*} defaultValue          Default value, filled in on new entries.
             * @private
             */
            function _fit(matrix, size, defaultValue) {
                var newSize = matrix._size.slice(0), // copy the array
                    changed = false;

                // add dimensions when needed
                while (newSize.length < size.length) {
                    newSize.push(0);
                    changed = true;
                }

                // enlarge size when needed
                for (var i = 0, ii = size.length; i < ii; i++) {
                    if (size[i] > newSize[i]) {
                        newSize[i] = size[i];
                        changed = true;
                    }
                }

                if (changed) {
                    // resize only when size is changed
                    _resize(matrix, newSize, defaultValue);
                }
            }

            /**
             * Create a clone of the matrix
             * @memberof DenseMatrix
             * @return {DenseMatrix} clone
             */
            DenseMatrix.prototype.clone = function() {
                var m = new DenseMatrix({
                    data: object.clone(this._data),
                    size: object.clone(this._size),
                    datatype: this._datatype
                });
                return m;
            };

            /**
             * Retrieve the size of the matrix.
             * @memberof DenseMatrix
             * @returns {number[]} size
             */
            DenseMatrix.prototype.size = function() {
                return this._size.slice(0); // return a clone of _size
            };

            /**
             * Create a new matrix with the results of the callback function executed on
             * each entry of the matrix.
             * @memberof DenseMatrix
             * @param {Function} callback   The callback function is invoked with three
             *                              parameters: the value of the element, the index
             *                              of the element, and the Matrix being traversed.
             *
             * @return {DenseMatrix} matrix
             */
            DenseMatrix.prototype.map = function(callback) {
                // matrix instance
                var me = this;
                var recurse = function(value, index) {
                    if (isArray(value)) {
                        return value.map(function(child, i) {
                            return recurse(child, index.concat(i));
                        });
                    } else {
                        return callback(value, index, me);
                    }
                };
                // return dense format
                return new DenseMatrix({
                    data: recurse(this._data, []),
                    size: object.clone(this._size),
                    datatype: this._datatype
                });
            };

            /**
             * Execute a callback function on each entry of the matrix.
             * @memberof DenseMatrix
             * @param {Function} callback   The callback function is invoked with three
             *                              parameters: the value of the element, the index
             *                              of the element, and the Matrix being traversed.
             */
            DenseMatrix.prototype.forEach = function(callback) {
                // matrix instance
                var me = this;
                var recurse = function(value, index) {
                    if (isArray(value)) {
                        value.forEach(function(child, i) {
                            recurse(child, index.concat(i));
                        });
                    } else {
                        callback(value, index, me);
                    }
                };
                recurse(this._data, []);
            };

            /**
             * Create an Array with a copy of the data of the DenseMatrix
             * @memberof DenseMatrix
             * @returns {Array} array
             */
            DenseMatrix.prototype.toArray = function() {
                return object.clone(this._data);
            };

            /**
             * Get the primitive value of the DenseMatrix: a multidimensional array
             * @memberof DenseMatrix
             * @returns {Array} array
             */
            DenseMatrix.prototype.valueOf = function() {
                return this._data;
            };

            /**
             * Get a string representation of the matrix, with optional formatting options.
             * @memberof DenseMatrix
             * @param {Object | number | Function} [options]  Formatting options. See
             *                                                lib/utils/number:format for a
             *                                                description of the available
             *                                                options.
             * @returns {string} str
             */
            DenseMatrix.prototype.format = function(options) {
                return string.format(this._data, options);
            };

            /**
             * Get a string representation of the matrix
             * @memberof DenseMatrix
             * @returns {string} str
             */
            DenseMatrix.prototype.toString = function() {
                return string.format(this._data);
            };

            /**
             * Get a JSON representation of the matrix
             * @memberof DenseMatrix
             * @returns {Object}
             */
            DenseMatrix.prototype.toJSON = function() {
                return {
                    mathjs: 'DenseMatrix',
                    data: this._data,
                    size: this._size,
                    datatype: this._datatype
                };
            };

            /**
             * Get the kth Matrix diagonal.
             *
             * @memberof DenseMatrix
             * @param {number | BigNumber} [k=0]     The kth diagonal where the vector will retrieved.
             *
             * @returns {Array}                      The array vector with the diagonal values.
             */
            DenseMatrix.prototype.diagonal = function(k) {
                // validate k if any
                if (k) {
                    // convert BigNumber to a number
                    if (k.isBigNumber === true)
                        k = k.toNumber();
                    // is must be an integer
                    if (!isNumber(k) || !isInteger(k)) {
                        throw new TypeError('The parameter k must be an integer number');
                    }
                } else {
                    // default value
                    k = 0;
                }

                var kSuper = k > 0 ? k : 0;
                var kSub = k < 0 ? -k : 0;

                // rows & columns
                var rows = this._size[0];
                var columns = this._size[1];

                // number diagonal values
                var n = Math.min(rows - kSub, columns - kSuper);

                // x is a matrix get diagonal from matrix
                var data = [];

                // loop rows
                for (var i = 0; i < n; i++) {
                    data[i] = this._data[i + kSub][i + kSuper];
                }

                // create DenseMatrix
                return new DenseMatrix({
                    data: data,
                    size: [n],
                    datatype: this._datatype
                });
            };

            /**
             * Create a diagonal matrix.
             *
             * @memberof DenseMatrix
             * @param {Array} size                   The matrix size.
             * @param {number | Array} value          The values for the diagonal.
             * @param {number | BigNumber} [k=0]     The kth diagonal where the vector will be filled in.
             * @param {number} [defaultValue]        The default value for non-diagonal
             *
             * @returns {DenseMatrix}
             */
            DenseMatrix.diagonal = function(size, value, k, defaultValue, datatype) {
                if (!isArray(size))
                    throw new TypeError('Array expected, size parameter');
                if (size.length !== 2)
                    throw new Error('Only two dimensions matrix are supported');

                // map size & validate
                size = size.map(function(s) {
                    // check it is a big number
                    if (s && s.isBigNumber === true) {
                        // convert it
                        s = s.toNumber();
                    }
                    // validate arguments
                    if (!isNumber(s) || !isInteger(s) || s < 1) {
                        throw new Error('Size values must be positive integers');
                    }
                    return s;
                });

                // validate k if any
                if (k) {
                    // convert BigNumber to a number
                    if (k && k.isBigNumber === true)
                        k = k.toNumber();
                    // is must be an integer
                    if (!isNumber(k) || !isInteger(k)) {
                        throw new TypeError('The parameter k must be an integer number');
                    }
                } else {
                    // default value
                    k = 0;
                }

                if (defaultValue && isString(datatype)) {
                    // convert defaultValue to the same datatype
                    defaultValue = typed.convert(defaultValue, datatype);
                }

                var kSuper = k > 0 ? k : 0;
                var kSub = k < 0 ? -k : 0;

                // rows and columns
                var rows = size[0];
                var columns = size[1];

                // number of non-zero items
                var n = Math.min(rows - kSub, columns - kSuper);

                // value extraction function
                var _value;

                // check value
                if (isArray(value)) {
                    // validate array
                    if (value.length !== n) {
                        // number of values in array must be n
                        throw new Error('Invalid value array length');
                    }
                    // define function
                    _value = function(i) {
                        // return value @ i
                        return value[i];
                    };
                } else if (value && value.isMatrix === true) {
                    // matrix size
                    var ms = value.size();
                    // validate matrix
                    if (ms.length !== 1 || ms[0] !== n) {
                        // number of values in array must be n
                        throw new Error('Invalid matrix length');
                    }
                    // define function
                    _value = function(i) {
                        // return value @ i
                        return value.get([i]);
                    };
                } else {
                    // define function
                    _value = function() {
                        // return value
                        return value;
                    };
                }

                // discover default value if needed
                if (!defaultValue) {
                    // check first value in array
                    defaultValue = (_value(0) && _value(0).isBigNumber === true) ? new type.BigNumber(0) : 0;
                }

                // empty array
                var data = [];

                // check we need to resize array
                if (size.length > 0) {
                    // resize array
                    data = array.resize(data, size, defaultValue);
                    // fill diagonal
                    for (var d = 0; d < n; d++) {
                        data[d + kSub][d + kSuper] = _value(d);
                    }
                }

                // create DenseMatrix
                return new DenseMatrix({
                    data: data,
                    size: [rows, columns]
                });
            };

            /**
             * Generate a matrix from a JSON object
             * @memberof DenseMatrix
             * @param {Object} json  An object structured like
             *                       `{"mathjs": "DenseMatrix", data: [], size: []}`,
             *                       where mathjs is optional
             * @returns {DenseMatrix}
             */
            DenseMatrix.fromJSON = function(json) {
                return new DenseMatrix(json);
            };

            /**
             * Swap rows i and j in Matrix.
             *
             * @memberof DenseMatrix
             * @param {number} i       Matrix row index 1
             * @param {number} j       Matrix row index 2
             *
             * @return {Matrix}        The matrix reference
             */
            DenseMatrix.prototype.swapRows = function(i, j) {
                // check index
                if (!isNumber(i) || !isInteger(i) || !isNumber(j) || !isInteger(j)) {
                    throw new Error('Row index must be positive integers');
                }
                // check dimensions
                if (this._size.length !== 2) {
                    throw new Error('Only two dimensional matrix is supported');
                }
                // validate index
                validateIndex(i, this._size[0]);
                validateIndex(j, this._size[0]);

                // swap rows
                DenseMatrix._swapRows(i, j, this._data);
                // return current instance
                return this;
            };

            /**
             * Swap rows i and j in Dense Matrix data structure.
             *
             * @param {number} i       Matrix row index 1
             * @param {number} j       Matrix row index 2
             */
            DenseMatrix._swapRows = function(i, j, data) {
                // swap values i <-> j
                var vi = data[i];
                data[i] = data[j];
                data[j] = vi;
            };

            /**
             * Preprocess data, which can be an Array or DenseMatrix with nested Arrays and
             * Matrices. Replaces all nested Matrices with Arrays
             * @memberof DenseMatrix
             * @param {Array} data
             * @return {Array} data
             */
            function preprocess(data) {
                for (var i = 0, ii = data.length; i < ii; i++) {
                    var elem = data[i];
                    if (isArray(elem)) {
                        data[i] = preprocess(elem);
                    } else if (elem && elem.isMatrix === true) {
                        data[i] = preprocess(elem.valueOf());
                    }
                }

                return data;
            }

            // register this type in the base class Matrix
            type.Matrix._storage.dense = DenseMatrix;
            type.Matrix._storage['default'] = DenseMatrix;

            // exports
            return DenseMatrix;
        }

        exports.name = 'DenseMatrix';
        exports.path = 'type';
        exports.factory = factory;
        exports.lazy = false; // no lazy loading, as we alter type.Matrix._storage
    }, {
        "../../error/DimensionError": 8,
        "../../utils/index": 41,
        "./Matrix": 23
    }],
    23: [function(require, module, exports) {
        'use strict';

        var util = require('../../utils/index');

        var string = util.string;

        var isString = string.isString;

        function factory(type, config, load, typed) {
            /**
             * @constructor Matrix
             *
             * A Matrix is a wrapper around an Array. A matrix can hold a multi dimensional
             * array. A matrix can be constructed as:
             *     var matrix = math.matrix(data)
             *
             * Matrix contains the functions to resize, get and set values, get the size,
             * clone the matrix and to convert the matrix to a vector, array, or scalar.
             * Furthermore, one can iterate over the matrix using map and forEach.
             * The internal Array of the Matrix can be accessed using the function valueOf.
             *
             * Example usage:
             *     var matrix = math.matrix([[1, 2], [3, 4]]);
             *     matix.size();              // [2, 2]
             *     matrix.resize([3, 2], 5);
             *     matrix.valueOf();          // [[1, 2], [3, 4], [5, 5]]
             *     matrix.subset([1,2])       // 3 (indexes are zero-based)
             *
             */
            function Matrix() {
                if (!(this instanceof Matrix)) {
                    throw new SyntaxError('Constructor must be called with the new operator');
                }
            }

            /**
             * Attach type information
             */
            Matrix.prototype.type = 'Matrix';
            Matrix.prototype.isMatrix = true;

            /**
             * Get the Matrix storage constructor for the given format.
             *
             * @param {string} format       The Matrix storage format.
             *
             * @return {Function}           The Matrix storage constructor.
             */
            Matrix.storage = function(format) {
                // check storage format is a string
                if (!isString(format)) {
                    throw new TypeError('format must be a string value');
                }

                // get storage format constructor
                var constructor = Matrix._storage[format];
                if (!constructor) {
                    throw new SyntaxError('Unsupported matrix storage format: ' + format);
                }

                // return storage constructor
                return constructor;
            };

            // a map with all constructors for all storage types
            Matrix._storage = {};

            /**
             * Get the storage format used by the matrix.
             *
             * Usage:
             *     var format = matrix.storage()                   // retrieve storage format
             *
             * @return {string}           The storage format.
             */
            Matrix.prototype.storage = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke storage on a Matrix interface');
            };

            /**
             * Get the datatype of the data stored in the matrix.
             *
             * Usage:
             *     var format = matrix.datatype()                   // retrieve matrix datatype
             *
             * @return {string}           The datatype.
             */
            Matrix.prototype.datatype = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke datatype on a Matrix interface');
            };

            /**
             * Create a new Matrix With the type of the current matrix instance
             * @param {Array | Object} data
             * @param {string} [datatype]
             */
            Matrix.prototype.create = function(data, datatype) {
                throw new Error('Cannot invoke create on a Matrix interface');
            };

            /**
             * Get a subset of the matrix, or replace a subset of the matrix.
             *
             * Usage:
             *     var subset = matrix.subset(index)               // retrieve subset
             *     var value = matrix.subset(index, replacement)   // replace subset
             *
             * @param {Index} index
             * @param {Array | Matrix | *} [replacement]
             * @param {*} [defaultValue=0]      Default value, filled in on new entries when
             *                                  the matrix is resized. If not provided,
             *                                  new matrix elements will be filled with zeros.
             */
            Matrix.prototype.subset = function(index, replacement, defaultValue) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke subset on a Matrix interface');
            };

            /**
             * Get a single element from the matrix.
             * @param {number[]} index   Zero-based index
             * @return {*} value
             */
            Matrix.prototype.get = function(index) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke get on a Matrix interface');
            };

            /**
             * Replace a single element in the matrix.
             * @param {number[]} index   Zero-based index
             * @param {*} value
             * @param {*} [defaultValue]        Default value, filled in on new entries when
             *                                  the matrix is resized. If not provided,
             *                                  new matrix elements will be left undefined.
             * @return {Matrix} self
             */
            Matrix.prototype.set = function(index, value, defaultValue) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke set on a Matrix interface');
            };

            /**
             * Resize the matrix to the given size. Returns a copy of the matrix when 
             * `copy=true`, otherwise return the matrix itself (resize in place).
             *
             * @param {number[]} size           The new size the matrix should have.
             * @param {*} [defaultValue=0]      Default value, filled in on new entries.
             *                                  If not provided, the matrix elements will
             *                                  be filled with zeros.
             * @param {boolean} [copy]          Return a resized copy of the matrix
             *
             * @return {Matrix}                 The resized matrix
             */
            Matrix.prototype.resize = function(size, defaultValue) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke resize on a Matrix interface');
            };

            /**
             * Create a clone of the matrix
             * @return {Matrix} clone
             */
            Matrix.prototype.clone = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke clone on a Matrix interface');
            };

            /**
             * Retrieve the size of the matrix.
             * @returns {number[]} size
             */
            Matrix.prototype.size = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke size on a Matrix interface');
            };

            /**
             * Create a new matrix with the results of the callback function executed on
             * each entry of the matrix.
             * @param {Function} callback   The callback function is invoked with three
             *                              parameters: the value of the element, the index
             *                              of the element, and the Matrix being traversed.
             * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
             *
             * @return {Matrix} matrix
             */
            Matrix.prototype.map = function(callback, skipZeros) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke map on a Matrix interface');
            };

            /**
             * Execute a callback function on each entry of the matrix.
             * @param {Function} callback   The callback function is invoked with three
             *                              parameters: the value of the element, the index
             *                              of the element, and the Matrix being traversed.
             */
            Matrix.prototype.forEach = function(callback) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke forEach on a Matrix interface');
            };

            /**
             * Create an Array with a copy of the data of the Matrix
             * @returns {Array} array
             */
            Matrix.prototype.toArray = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke toArray on a Matrix interface');
            };

            /**
             * Get the primitive value of the Matrix: a multidimensional array
             * @returns {Array} array
             */
            Matrix.prototype.valueOf = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke valueOf on a Matrix interface');
            };

            /**
             * Get a string representation of the matrix, with optional formatting options.
             * @param {Object | number | Function} [options]  Formatting options. See
             *                                                lib/utils/number:format for a
             *                                                description of the available
             *                                                options.
             * @returns {string} str
             */
            Matrix.prototype.format = function(options) {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke format on a Matrix interface');
            };

            /**
             * Get a string representation of the matrix
             * @returns {string} str
             */
            Matrix.prototype.toString = function() {
                // must be implemented by each of the Matrix implementations
                throw new Error('Cannot invoke toString on a Matrix interface');
            };

            // exports
            return Matrix;
        }

        exports.name = 'Matrix';
        exports.path = 'type';
        exports.factory = factory;

    }, {
        "../../utils/index": 41
    }],
    24: [function(require, module, exports) {
        'use strict';

        function factory(type, config, load, typed) {
            /**
             * Create a Matrix. The function creates a new `math.type.Matrix` object from
             * an `Array`. A Matrix has utility functions to manipulate the data in the
             * matrix, like getting the size and getting or setting values in the matrix.
             * Supported storage formats are 'dense' and 'sparse'.
             *
             * Syntax:
             *
             *    math.matrix()                         // creates an empty matrix using default storage format (dense).
             *    math.matrix(data)                     // creates a matrix with initial data using default storage format (dense).
             *    math.matrix('dense')                  // creates an empty matrix using the given storage format.
             *    math.matrix(data, 'dense')            // creates a matrix with initial data using the given storage format.
             *    math.matrix(data, 'sparse')           // creates a sparse matrix with initial data.
             *    math.matrix(data, 'sparse', 'number') // creates a sparse matrix with initial data, number data type.
             *
             * Examples:
             *
             *    var m = math.matrix([[1, 2], [3, 4]]);
             *    m.size();                        // Array [2, 2]
             *    m.resize([3, 2], 5);
             *    m.valueOf();                     // Array [[1, 2], [3, 4], [5, 5]]
             *    m.get([1, 0])                    // number 3
             *
             * See also:
             *
             *    bignumber, boolean, complex, index, number, string, unit, sparse
             *
             * @param {Array | Matrix} [data]    A multi dimensional array
             * @param {string} [format]          The Matrix storage format
             *
             * @return {Matrix} The created matrix
             */
            var matrix = typed('matrix', {
                '': function() {
                    return _create([]);
                },

                'string': function(format) {
                    return _create([], format);
                },

                'string, string': function(format, datatype) {
                    return _create([], format, datatype);
                },

                'Array': function(data) {
                    return _create(data);
                },

                'Matrix': function(data) {
                    return _create(data, data.storage());
                },

                'Array | Matrix, string': _create,

                'Array | Matrix, string, string': _create
            });

            matrix.toTex = {
                0: '\\begin{bmatrix}\\end{bmatrix}',
                1: '\\left(${args[0]}\\right)',
                2: '\\left(${args[0]}\\right)'
            };

            return matrix;

            /**
             * Create a new Matrix with given storage format
             * @param {Array} data
             * @param {string} [format]
             * @param {string} [datatype]
             * @returns {Matrix} Returns a new Matrix
             * @private
             */
            function _create(data, format, datatype) {
                // get storage format constructor
                var M = type.Matrix.storage(format || 'default');

                // create instance
                return new M(data, datatype);
            }
        }

        exports.name = 'matrix';
        exports.factory = factory;

    }, {}],
    25: [function(require, module, exports) {
        'use strict';

        var DimensionError = require('../../../error/DimensionError');

        function factory(type, config, load, typed) {

            var DenseMatrix = type.DenseMatrix;

            /**
             * Iterates over SparseMatrix nonzero items and invokes the callback function f(Dij, Sij). 
             * Callback function invoked NNZ times (number of nonzero items in SparseMatrix).
             *
             *
             *          ┌  f(Dij, Sij)  ; S(i,j) !== 0
             * C(i,j) = ┤
             *          └  Dij          ; otherwise
             *
             *
             * @param {Matrix}   denseMatrix       The DenseMatrix instance (D)
             * @param {Matrix}   sparseMatrix      The SparseMatrix instance (S)
             * @param {Function} callback          The f(Dij,Sij) operation to invoke, where Dij = DenseMatrix(i,j) and Sij = SparseMatrix(i,j)
             * @param {boolean}  inverse           A true value indicates callback should be invoked f(Sij,Dij)
             *
             * @return {Matrix}                    DenseMatrix (C)
             *
             * see https://github.com/josdejong/mathjs/pull/346#issuecomment-97477571
             */
            var algorithm01 = function(denseMatrix, sparseMatrix, callback, inverse) {
                // dense matrix arrays
                var adata = denseMatrix._data;
                var asize = denseMatrix._size;
                var adt = denseMatrix._datatype;
                // sparse matrix arrays
                var bvalues = sparseMatrix._values;
                var bindex = sparseMatrix._index;
                var bptr = sparseMatrix._ptr;
                var bsize = sparseMatrix._size;
                var bdt = sparseMatrix._datatype;

                // validate dimensions
                if (asize.length !== bsize.length)
                    throw new DimensionError(asize.length, bsize.length);

                // check rows & columns
                if (asize[0] !== bsize[0] || asize[1] !== bsize[1])
                    throw new RangeError('Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')');

                // sparse matrix cannot be a Pattern matrix
                if (!bvalues)
                    throw new Error('Cannot perform operation on Dense Matrix and Pattern Sparse Matrix');

                // rows & columns
                var rows = asize[0];
                var columns = asize[1];

                // process data types
                var dt = typeof adt === 'string' && adt === bdt ? adt : undefined;
                // callback function
                var cf = dt ? typed.find(callback, [dt, dt]) : callback;

                // vars
                var i, j;

                // result (DenseMatrix)
                var cdata = [];
                // initialize c
                for (i = 0; i < rows; i++)
                    cdata[i] = [];

                // workspace
                var x = [];
                // marks indicating we have a value in x for a given column
                var w = [];

                // loop columns in b
                for (j = 0; j < columns; j++) {
                    // column mark
                    var mark = j + 1;
                    // values in column j
                    for (var k0 = bptr[j], k1 = bptr[j + 1], k = k0; k < k1; k++) {
                        // row
                        i = bindex[k];
                        // update workspace
                        x[i] = inverse ? cf(bvalues[k], adata[i][j]) : cf(adata[i][j], bvalues[k]);
                        // mark i as updated
                        w[i] = mark;
                    }
                    // loop rows
                    for (i = 0; i < rows; i++) {
                        // check row is in workspace
                        if (w[i] === mark) {
                            // c[i][j] was already calculated
                            cdata[i][j] = x[i];
                        } else {
                            // item does not exist in S
                            cdata[i][j] = adata[i][j];
                        }
                    }
                }

                // return dense matrix
                return new DenseMatrix({
                    data: cdata,
                    size: [rows, columns],
                    datatype: dt
                });
            };

            return algorithm01;
        }

        exports.name = 'algorithm01';
        exports.factory = factory;

    }, {
        "../../../error/DimensionError": 8
    }],
    26: [function(require, module, exports) {
        'use strict';

        var DimensionError = require('../../../error/DimensionError');

        function factory(type, config, load, typed) {

            var DenseMatrix = type.DenseMatrix;

            /**
             * Iterates over SparseMatrix items and invokes the callback function f(Dij, Sij).
             * Callback function invoked M*N times.
             *
             *
             *          ┌  f(Dij, Sij)  ; S(i,j) !== 0
             * C(i,j) = ┤
             *          └  f(Dij, 0)    ; otherwise
             *
             *
             * @param {Matrix}   denseMatrix       The DenseMatrix instance (D)
             * @param {Matrix}   sparseMatrix      The SparseMatrix instance (C)
             * @param {Function} callback          The f(Dij,Sij) operation to invoke, where Dij = DenseMatrix(i,j) and Sij = SparseMatrix(i,j)
             * @param {boolean}  inverse           A true value indicates callback should be invoked f(Sij,Dij)
             *
             * @return {Matrix}                    DenseMatrix (C)
             *
             * see https://github.com/josdejong/mathjs/pull/346#issuecomment-97477571
             */
            var algorithm03 = function(denseMatrix, sparseMatrix, callback, inverse) {
                // dense matrix arrays
                var adata = denseMatrix._data;
                var asize = denseMatrix._size;
                var adt = denseMatrix._datatype;
                // sparse matrix arrays
                var bvalues = sparseMatrix._values;
                var bindex = sparseMatrix._index;
                var bptr = sparseMatrix._ptr;
                var bsize = sparseMatrix._size;
                var bdt = sparseMatrix._datatype;

                // validate dimensions
                if (asize.length !== bsize.length)
                    throw new DimensionError(asize.length, bsize.length);

                // check rows & columns
                if (asize[0] !== bsize[0] || asize[1] !== bsize[1])
                    throw new RangeError('Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')');

                // sparse matrix cannot be a Pattern matrix
                if (!bvalues)
                    throw new Error('Cannot perform operation on Dense Matrix and Pattern Sparse Matrix');

                // rows & columns
                var rows = asize[0];
                var columns = asize[1];

                // datatype
                var dt;
                // zero value
                var zero = 0;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string' && adt === bdt) {
                    // datatype
                    dt = adt;
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // result (DenseMatrix)
                var cdata = [];

                // initialize dense matrix
                for (var z = 0; z < rows; z++) {
                    // initialize row
                    cdata[z] = [];
                }

                // workspace
                var x = [];
                // marks indicating we have a value in x for a given column
                var w = [];

                // loop columns in b
                for (var j = 0; j < columns; j++) {
                    // column mark
                    var mark = j + 1;
                    // values in column j
                    for (var k0 = bptr[j], k1 = bptr[j + 1], k = k0; k < k1; k++) {
                        // row
                        var i = bindex[k];
                        // update workspace
                        x[i] = inverse ? cf(bvalues[k], adata[i][j]) : cf(adata[i][j], bvalues[k]);
                        w[i] = mark;
                    }
                    // process workspace
                    for (var y = 0; y < rows; y++) {
                        // check we have a calculated value for current row
                        if (w[y] === mark) {
                            // use calculated value
                            cdata[y][j] = x[y];
                        } else {
                            // calculate value
                            cdata[y][j] = inverse ? cf(zero, adata[y][j]) : cf(adata[y][j], zero);
                        }
                    }
                }

                // return dense matrix
                return new DenseMatrix({
                    data: cdata,
                    size: [rows, columns],
                    datatype: dt
                });
            };

            return algorithm03;
        }

        exports.name = 'algorithm03';
        exports.factory = factory;

    }, {
        "../../../error/DimensionError": 8
    }],
    27: [function(require, module, exports) {
        'use strict';

        var DimensionError = require('../../../error/DimensionError');

        function factory(type, config, load, typed) {

            var equalScalar = load(require('../../../function/relational/equalScalar'));

            var SparseMatrix = type.SparseMatrix;

            /**
             * Iterates over SparseMatrix A and SparseMatrix B nonzero items and invokes the callback function f(Aij, Bij). 
             * Callback function invoked MAX(NNZA, NNZB) times
             *
             *
             *          ┌  f(Aij, Bij)  ; A(i,j) !== 0 && B(i,j) !== 0
             * C(i,j) = ┤  A(i,j)       ; A(i,j) !== 0
             *          └  B(i,j)       ; B(i,j) !== 0
             *
             *
             * @param {Matrix}   a                 The SparseMatrix instance (A)
             * @param {Matrix}   b                 The SparseMatrix instance (B)
             * @param {Function} callback          The f(Aij,Bij) operation to invoke
             *
             * @return {Matrix}                    SparseMatrix (C)
             *
             * see https://github.com/josdejong/mathjs/pull/346#issuecomment-97620294
             */
            var algorithm04 = function(a, b, callback) {
                // sparse matrix arrays
                var avalues = a._values;
                var aindex = a._index;
                var aptr = a._ptr;
                var asize = a._size;
                var adt = a._datatype;
                // sparse matrix arrays
                var bvalues = b._values;
                var bindex = b._index;
                var bptr = b._ptr;
                var bsize = b._size;
                var bdt = b._datatype;

                // validate dimensions
                if (asize.length !== bsize.length)
                    throw new DimensionError(asize.length, bsize.length);

                // check rows & columns
                if (asize[0] !== bsize[0] || asize[1] !== bsize[1])
                    throw new RangeError('Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')');

                // rows & columns
                var rows = asize[0];
                var columns = asize[1];

                // datatype
                var dt;
                // equal signature to use
                var eq = equalScalar;
                // zero value
                var zero = 0;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string' && adt === bdt) {
                    // datatype
                    dt = adt;
                    // find signature that matches (dt, dt)
                    eq = typed.find(equalScalar, [dt, dt]);
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // result arrays
                var cvalues = avalues && bvalues ? [] : undefined;
                var cindex = [];
                var cptr = [];
                // matrix
                var c = new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [rows, columns],
                    datatype: dt
                });

                // workspace
                var xa = avalues && bvalues ? [] : undefined;
                var xb = avalues && bvalues ? [] : undefined;
                // marks indicating we have a value in x for a given column
                var wa = [];
                var wb = [];

                // vars 
                var i, j, k, k0, k1;

                // loop columns
                for (j = 0; j < columns; j++) {
                    // update cptr
                    cptr[j] = cindex.length;
                    // columns mark
                    var mark = j + 1;
                    // loop A(:,j)
                    for (k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
                        // row
                        i = aindex[k];
                        // update c
                        cindex.push(i);
                        // update workspace
                        wa[i] = mark;
                        // check we need to process values
                        if (xa)
                            xa[i] = avalues[k];
                    }
                    // loop B(:,j)
                    for (k0 = bptr[j], k1 = bptr[j + 1], k = k0; k < k1; k++) {
                        // row
                        i = bindex[k];
                        // check row exists in A
                        if (wa[i] === mark) {
                            // update record in xa @ i
                            if (xa) {
                                // invoke callback
                                var v = cf(xa[i], bvalues[k]);
                                // check for zero
                                if (!eq(v, zero)) {
                                    // update workspace
                                    xa[i] = v;
                                } else {
                                    // remove mark (index will be removed later)
                                    wa[i] = null;
                                }
                            }
                        } else {
                            // update c
                            cindex.push(i);
                            // update workspace
                            wb[i] = mark;
                            // check we need to process values
                            if (xb)
                                xb[i] = bvalues[k];
                        }
                    }
                    // check we need to process values (non pattern matrix)
                    if (xa && xb) {
                        // initialize first index in j
                        k = cptr[j];
                        // loop index in j
                        while (k < cindex.length) {
                            // row
                            i = cindex[k];
                            // check workspace has value @ i
                            if (wa[i] === mark) {
                                // push value (Aij != 0 || (Aij != 0 && Bij != 0))
                                cvalues[k] = xa[i];
                                // increment pointer
                                k++;
                            } else if (wb[i] === mark) {
                                // push value (bij != 0)
                                cvalues[k] = xb[i];
                                // increment pointer
                                k++;
                            } else {
                                // remove index @ k
                                cindex.splice(k, 1);
                            }
                        }
                    }
                }
                // update cptr
                cptr[columns] = cindex.length;

                // return sparse matrix
                return c;
            };

            return algorithm04;
        }

        exports.name = 'algorithm04';
        exports.factory = factory;

    }, {
        "../../../error/DimensionError": 8,
        "../../../function/relational/equalScalar": 21
    }],
    28: [function(require, module, exports) {
        'use strict';

        var DimensionError = require('../../../error/DimensionError');

        function factory(type, config, load, typed) {

            var equalScalar = load(require('../../../function/relational/equalScalar'));

            var SparseMatrix = type.SparseMatrix;

            /**
             * Iterates over SparseMatrix A and SparseMatrix B nonzero items and invokes the callback function f(Aij, Bij). 
             * Callback function invoked MAX(NNZA, NNZB) times
             *
             *
             *          ┌  f(Aij, Bij)  ; A(i,j) !== 0 || B(i,j) !== 0
             * C(i,j) = ┤  
             *          └  0            ; otherwise
             *
             *
             * @param {Matrix}   a                 The SparseMatrix instance (A)
             * @param {Matrix}   b                 The SparseMatrix instance (B)
             * @param {Function} callback          The f(Aij,Bij) operation to invoke
             *
             * @return {Matrix}                    SparseMatrix (C)
             *
             * see https://github.com/josdejong/mathjs/pull/346#issuecomment-97620294
             */
            var algorithm05 = function(a, b, callback) {
                // sparse matrix arrays
                var avalues = a._values;
                var aindex = a._index;
                var aptr = a._ptr;
                var asize = a._size;
                var adt = a._datatype;
                // sparse matrix arrays
                var bvalues = b._values;
                var bindex = b._index;
                var bptr = b._ptr;
                var bsize = b._size;
                var bdt = b._datatype;

                // validate dimensions
                if (asize.length !== bsize.length)
                    throw new DimensionError(asize.length, bsize.length);

                // check rows & columns
                if (asize[0] !== bsize[0] || asize[1] !== bsize[1])
                    throw new RangeError('Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')');

                // rows & columns
                var rows = asize[0];
                var columns = asize[1];

                // datatype
                var dt;
                // equal signature to use
                var eq = equalScalar;
                // zero value
                var zero = 0;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string' && adt === bdt) {
                    // datatype
                    dt = adt;
                    // find signature that matches (dt, dt)
                    eq = typed.find(equalScalar, [dt, dt]);
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // result arrays
                var cvalues = avalues && bvalues ? [] : undefined;
                var cindex = [];
                var cptr = [];
                // matrix
                var c = new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [rows, columns],
                    datatype: dt
                });

                // workspaces
                var xa = cvalues ? [] : undefined;
                var xb = cvalues ? [] : undefined;
                // marks indicating we have a value in x for a given column
                var wa = [];
                var wb = [];

                // vars
                var i, j, k, k1;

                // loop columns
                for (j = 0; j < columns; j++) {
                    // update cptr
                    cptr[j] = cindex.length;
                    // columns mark
                    var mark = j + 1;
                    // loop values A(:,j)
                    for (k = aptr[j], k1 = aptr[j + 1]; k < k1; k++) {
                        // row
                        i = aindex[k];
                        // push index
                        cindex.push(i);
                        // update workspace
                        wa[i] = mark;
                        // check we need to process values
                        if (xa)
                            xa[i] = avalues[k];
                    }
                    // loop values B(:,j)
                    for (k = bptr[j], k1 = bptr[j + 1]; k < k1; k++) {
                        // row
                        i = bindex[k];
                        // check row existed in A
                        if (wa[i] !== mark) {
                            // push index
                            cindex.push(i);
                        }
                        // update workspace
                        wb[i] = mark;
                        // check we need to process values
                        if (xb)
                            xb[i] = bvalues[k];
                    }
                    // check we need to process values (non pattern matrix)
                    if (cvalues) {
                        // initialize first index in j
                        k = cptr[j];
                        // loop index in j
                        while (k < cindex.length) {
                            // row
                            i = cindex[k];
                            // marks
                            var wai = wa[i];
                            var wbi = wb[i];
                            // check Aij or Bij are nonzero
                            if (wai === mark || wbi === mark) {
                                // matrix values @ i,j
                                var va = wai === mark ? xa[i] : zero;
                                var vb = wbi === mark ? xb[i] : zero;
                                // Cij
                                var vc = cf(va, vb);
                                // check for zero
                                if (!eq(vc, zero)) {
                                    // push value
                                    cvalues.push(vc);
                                    // increment pointer
                                    k++;
                                } else {
                                    // remove value @ i, do not increment pointer
                                    cindex.splice(k, 1);
                                }
                            }
                        }
                    }
                }
                // update cptr
                cptr[columns] = cindex.length;

                // return sparse matrix
                return c;
            };

            return algorithm05;
        }

        exports.name = 'algorithm05';
        exports.factory = factory;

    }, {
        "../../../error/DimensionError": 8,
        "../../../function/relational/equalScalar": 21
    }],
    29: [function(require, module, exports) {
        'use strict';

        function factory(type, config, load, typed) {

            var DenseMatrix = type.DenseMatrix;

            /**
             * Iterates over SparseMatrix S nonzero items and invokes the callback function f(Sij, b). 
             * Callback function invoked NZ times (number of nonzero items in S).
             *
             *
             *          ┌  f(Sij, b)  ; S(i,j) !== 0
             * C(i,j) = ┤  
             *          └  b          ; otherwise
             *
             *
             * @param {Matrix}   s                 The SparseMatrix instance (S)
             * @param {Scalar}   b                 The Scalar value
             * @param {Function} callback          The f(Aij,b) operation to invoke
             * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Sij)
             *
             * @return {Matrix}                    DenseMatrix (C)
             *
             * https://github.com/josdejong/mathjs/pull/346#issuecomment-97626813
             */
            var algorithm10 = function(s, b, callback, inverse) {
                // sparse matrix arrays
                var avalues = s._values;
                var aindex = s._index;
                var aptr = s._ptr;
                var asize = s._size;
                var adt = s._datatype;

                // sparse matrix cannot be a Pattern matrix
                if (!avalues)
                    throw new Error('Cannot perform operation on Pattern Sparse Matrix and Scalar value');

                // rows & columns
                var rows = asize[0];
                var columns = asize[1];

                // datatype
                var dt;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // convert b to the same datatype
                    b = typed.convert(b, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // result arrays
                var cdata = [];
                // matrix
                var c = new DenseMatrix({
                    data: cdata,
                    size: [rows, columns],
                    datatype: dt
                });

                // workspaces
                var x = [];
                // marks indicating we have a value in x for a given column
                var w = [];

                // loop columns
                for (var j = 0; j < columns; j++) {
                    // columns mark
                    var mark = j + 1;
                    // values in j
                    for (var k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
                        // row
                        var r = aindex[k];
                        // update workspace
                        x[r] = avalues[k];
                        w[r] = mark;
                    }
                    // loop rows
                    for (var i = 0; i < rows; i++) {
                        // initialize C on first column
                        if (j === 0) {
                            // create row array
                            cdata[i] = [];
                        }
                        // check sparse matrix has a value @ i,j
                        if (w[i] === mark) {
                            // invoke callback, update C
                            cdata[i][j] = inverse ? cf(b, x[i]) : cf(x[i], b);
                        } else {
                            // dense matrix value @ i, j
                            cdata[i][j] = b;
                        }
                    }
                }

                // return sparse matrix
                return c;
            };

            return algorithm10;
        }

        exports.name = 'algorithm10';
        exports.factory = factory;

    }, {}],
    30: [function(require, module, exports) {
        'use strict';

        function factory(type, config, load, typed) {

            var equalScalar = load(require('../../../function/relational/equalScalar'));

            var SparseMatrix = type.SparseMatrix;

            /**
             * Iterates over SparseMatrix S nonzero items and invokes the callback function f(Sij, b). 
             * Callback function invoked NZ times (number of nonzero items in S).
             *
             *
             *          ┌  f(Sij, b)  ; S(i,j) !== 0
             * C(i,j) = ┤  
             *          └  0          ; otherwise
             *
             *
             * @param {Matrix}   s                 The SparseMatrix instance (S)
             * @param {Scalar}   b                 The Scalar value
             * @param {Function} callback          The f(Aij,b) operation to invoke
             * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Sij)
             *
             * @return {Matrix}                    SparseMatrix (C)
             *
             * https://github.com/josdejong/mathjs/pull/346#issuecomment-97626813
             */
            var algorithm11 = function(s, b, callback, inverse) {
                // sparse matrix arrays
                var avalues = s._values;
                var aindex = s._index;
                var aptr = s._ptr;
                var asize = s._size;
                var adt = s._datatype;

                // sparse matrix cannot be a Pattern matrix
                if (!avalues)
                    throw new Error('Cannot perform operation on Pattern Sparse Matrix and Scalar value');

                // rows & columns
                var rows = asize[0];
                var columns = asize[1];

                // datatype
                var dt;
                // equal signature to use
                var eq = equalScalar;
                // zero value
                var zero = 0;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // find signature that matches (dt, dt)
                    eq = typed.find(equalScalar, [dt, dt]);
                    // convert 0 to the same datatype
                    zero = typed.convert(0, dt);
                    // convert b to the same datatype
                    b = typed.convert(b, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // result arrays
                var cvalues = [];
                var cindex = [];
                var cptr = [];
                // matrix
                var c = new SparseMatrix({
                    values: cvalues,
                    index: cindex,
                    ptr: cptr,
                    size: [rows, columns],
                    datatype: dt
                });

                // loop columns
                for (var j = 0; j < columns; j++) {
                    // initialize ptr
                    cptr[j] = cindex.length;
                    // values in j
                    for (var k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
                        // row
                        var i = aindex[k];
                        // invoke callback
                        var v = inverse ? cf(b, avalues[k]) : cf(avalues[k], b);
                        // check value is zero
                        if (!eq(v, zero)) {
                            // push index & value
                            cindex.push(i);
                            cvalues.push(v);
                        }
                    }
                }
                // update ptr
                cptr[columns] = cindex.length;

                // return sparse matrix
                return c;
            };

            return algorithm11;
        }

        exports.name = 'algorithm11';
        exports.factory = factory;

    }, {
        "../../../function/relational/equalScalar": 21
    }],
    31: [function(require, module, exports) {
        'use strict';

        var util = require('../../../utils/index');
        var DimensionError = require('../../../error/DimensionError');

        var string = util.string,
            isString = string.isString;

        function factory(type, config, load, typed) {

            var DenseMatrix = type.DenseMatrix;

            /**
             * Iterates over DenseMatrix items and invokes the callback function f(Aij..z, Bij..z). 
             * Callback function invoked MxN times.
             *
             * C(i,j,...z) = f(Aij..z, Bij..z)
             *
             * @param {Matrix}   a                 The DenseMatrix instance (A)
             * @param {Matrix}   b                 The DenseMatrix instance (B)
             * @param {Function} callback          The f(Aij..z,Bij..z) operation to invoke
             *
             * @return {Matrix}                    DenseMatrix (C)
             *
             * https://github.com/josdejong/mathjs/pull/346#issuecomment-97658658
             */
            var algorithm13 = function(a, b, callback) {
                // a arrays
                var adata = a._data;
                var asize = a._size;
                var adt = a._datatype;
                // b arrays
                var bdata = b._data;
                var bsize = b._size;
                var bdt = b._datatype;
                // c arrays
                var csize = [];

                // validate dimensions
                if (asize.length !== bsize.length)
                    throw new DimensionError(asize.length, bsize.length);

                // validate each one of the dimension sizes
                for (var s = 0; s < asize.length; s++) {
                    // must match
                    if (asize[s] !== bsize[s])
                        throw new RangeError('Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')');
                    // update dimension in c
                    csize[s] = asize[s];
                }

                // datatype
                var dt;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string' && adt === bdt) {
                    // datatype
                    dt = adt;
                    // convert b to the same datatype
                    b = typed.convert(b, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // populate cdata, iterate through dimensions
                var cdata = csize.length > 0 ? _iterate(cf, 0, csize, csize[0], adata, bdata) : [];

                // c matrix
                return new DenseMatrix({
                    data: cdata,
                    size: csize,
                    datatype: dt
                });
            };

            // recursive function
            var _iterate = function(f, level, s, n, av, bv) {
                // initialize array for this level
                var cv = [];
                // check we reach the last level
                if (level === s.length - 1) {
                    // loop arrays in last level
                    for (var i = 0; i < n; i++) {
                        // invoke callback and store value
                        cv[i] = f(av[i], bv[i]);
                    }
                } else {
                    // iterate current level
                    for (var j = 0; j < n; j++) {
                        // iterate next level
                        cv[j] = _iterate(f, level + 1, s, s[level + 1], av[j], bv[j]);
                    }
                }
                return cv;
            };

            return algorithm13;
        }

        exports.name = 'algorithm13';
        exports.factory = factory;

    }, {
        "../../../error/DimensionError": 8,
        "../../../utils/index": 41
    }],
    32: [function(require, module, exports) {
        'use strict';

        var clone = require('../../../utils/object').clone;

        function factory(type, config, load, typed) {

            var DenseMatrix = type.DenseMatrix;

            /**
             * Iterates over DenseMatrix items and invokes the callback function f(Aij..z, b). 
             * Callback function invoked MxN times.
             *
             * C(i,j,...z) = f(Aij..z, b)
             *
             * @param {Matrix}   a                 The DenseMatrix instance (A)
             * @param {Scalar}   b                 The Scalar value
             * @param {Function} callback          The f(Aij..z,b) operation to invoke
             * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Aij..z)
             *
             * @return {Matrix}                    DenseMatrix (C)
             *
             * https://github.com/josdejong/mathjs/pull/346#issuecomment-97659042
             */
            var algorithm14 = function(a, b, callback, inverse) {
                // a arrays
                var adata = a._data;
                var asize = a._size;
                var adt = a._datatype;

                // datatype
                var dt;
                // callback signature to use
                var cf = callback;

                // process data types
                if (typeof adt === 'string') {
                    // datatype
                    dt = adt;
                    // convert b to the same datatype
                    b = typed.convert(b, dt);
                    // callback
                    cf = typed.find(callback, [dt, dt]);
                }

                // populate cdata, iterate through dimensions
                var cdata = asize.length > 0 ? _iterate(cf, 0, asize, asize[0], adata, b, inverse) : [];

                // c matrix
                return new DenseMatrix({
                    data: cdata,
                    size: clone(asize),
                    datatype: dt
                });
            };

            // recursive function
            var _iterate = function(f, level, s, n, av, bv, inverse) {
                // initialize array for this level
                var cv = [];
                // check we reach the last level
                if (level === s.length - 1) {
                    // loop arrays in last level
                    for (var i = 0; i < n; i++) {
                        // invoke callback and store value
                        cv[i] = inverse ? f(bv, av[i]) : f(av[i], bv);
                    }
                } else {
                    // iterate current level
                    for (var j = 0; j < n; j++) {
                        // iterate next level
                        cv[j] = _iterate(f, level + 1, s, s[level + 1], av[j], bv, inverse);
                    }
                }
                return cv;
            };

            return algorithm14;
        }

        exports.name = 'algorithm14';
        exports.factory = factory;

    }, {
        "../../../utils/object": 44
    }],
    33: [function(require, module, exports) {
        'use strict';

        /**
         * Format a number using methods toPrecision, toFixed, toExponential.
         * @param {number | string} value
         * @constructor
         */
        function NumberFormatter(value) {
            // parse the input value
            var match = String(value).toLowerCase().match(/^0*?(-?)(\d+\.?\d*)(e([+-]?\d+))?$/);
            if (!match) {
                throw new SyntaxError('Invalid number');
            }

            var sign = match[1];
            var coefficients = match[2];
            var exponent = parseFloat(match[4] || '0');

            var dot = coefficients.indexOf('.');
            exponent += (dot !== -1) ? (dot - 1) : (coefficients.length - 1);

            this.sign = sign;
            this.coefficients = coefficients
                .replace('.', '') // remove the dot (must be removed before removing leading zeros)
                .replace(/^0*/, function(zeros) {
                    // remove leading zeros, add their count to the exponent
                    exponent -= zeros.length;
                    return '';
                })
                .replace(/0*$/, '') // remove trailing zeros
                .split('')
                .map(function(d) {
                    return parseInt(d);
                });

            if (this.coefficients.length === 0) {
                this.coefficients.push(0);
                exponent++;
            }

            this.exponent = exponent;
        }


        /**
         * Format a number with engineering notation.
         * @param {number} [precision=0]        Optional number of decimals after the
         *                                      decimal point. Zero by default.
         */
        NumberFormatter.prototype.toEngineering = function(precision) {
            var rounded = this.roundDigits(precision);

            var e = rounded.exponent;
            var c = rounded.coefficients;

            // find nearest lower multiple of 3 for exponent
            var newExp = e % 3 === 0 ? e : (e < 0 ? (e - 3) - (e % 3) : e - (e % 3));

            // concatenate coefficients with necessary zeros
            var significandsDiff = e >= 0 ? e : Math.abs(newExp);

            // add zeros if necessary (for ex: 1e+8)
            if (c.length - 1 < significandsDiff) c = c.concat(zeros(significandsDiff - (c.length - 1)));

            // find difference in exponents
            var expDiff = Math.abs(e - newExp);

            var decimalIdx = 1;
            var str = '';

            // push decimal index over by expDiff times
            while (--expDiff >= 0) decimalIdx++;

            // if all coefficient values are zero after the decimal point, don't add a decimal value. 
            // otherwise concat with the rest of the coefficients
            var decimals = c.slice(decimalIdx).join('');
            var decimalVal = decimals.match(/[1-9]/) ? ('.' + decimals) : '';

            str = c.slice(0, decimalIdx).join('') + decimalVal;

            str += 'e' + (e >= 0 ? '+' : '') + newExp.toString();
            return rounded.sign + str;
        }

        /**
         * Format a number with fixed notation.
         * @param {number} [precision=0]        Optional number of decimals after the
         *                                      decimal point. Zero by default.
         */
        NumberFormatter.prototype.toFixed = function(precision) {
            var rounded = this.roundDigits(this.exponent + 1 + (precision || 0));
            var c = rounded.coefficients;
            var p = rounded.exponent + 1; // exponent may have changed

            // append zeros if needed
            var pp = p + (precision || 0);
            if (c.length < pp) {
                c = c.concat(zeros(pp - c.length));
            }

            // prepend zeros if needed
            if (p < 0) {
                c = zeros(-p + 1).concat(c);
                p = 1;
            }

            // insert a dot if needed
            if (precision) {
                c.splice(p, 0, (p === 0) ? '0.' : '.');
            }

            return this.sign + c.join('');
        };

        /**
         * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
         * @param {number} [precision]  Number of digits in formatted output.
         *                              If not provided, the maximum available digits
         *                              is used.
         */
        NumberFormatter.prototype.toExponential = function(precision) {
            // round if needed, else create a clone
            var rounded = precision ? this.roundDigits(precision) : this.clone();
            var c = rounded.coefficients;
            var e = rounded.exponent;

            // append zeros if needed
            if (c.length < precision) {
                c = c.concat(zeros(precision - c.length));
            }

            // format as `C.CCCe+EEE` or `C.CCCe-EEE`
            var first = c.shift();
            return this.sign + first + (c.length > 0 ? ('.' + c.join('')) : '') +
                'e' + (e >= 0 ? '+' : '') + e;
        };

        /**
         * Format a number with a certain precision
         * @param {number} [precision=undefined] Optional number of digits.
         * @param {{lower: number | undefined, upper: number | undefined}} [options]
         *                                       By default:
         *                                         lower = 1e-3 (excl)
         *                                         upper = 1e+5 (incl)
         * @return {string}
         */
        NumberFormatter.prototype.toPrecision = function(precision, options) {
            // determine lower and upper bound for exponential notation.
            var lower = (options && options.lower !== undefined) ? options.lower : 1e-3;
            var upper = (options && options.upper !== undefined) ? options.upper : 1e+5;

            var abs = Math.abs(Math.pow(10, this.exponent));
            if (abs < lower || abs >= upper) {
                // exponential notation
                return this.toExponential(precision);
            } else {
                var rounded = precision ? this.roundDigits(precision) : this.clone();
                var c = rounded.coefficients;
                var e = rounded.exponent;

                // append trailing zeros
                if (c.length < precision) {
                    c = c.concat(zeros(precision - c.length));
                }

                // append trailing zeros
                // TODO: simplify the next statement
                c = c.concat(zeros(e - c.length + 1 +
                    (c.length < precision ? precision - c.length : 0)));

                // prepend zeros
                c = zeros(-e).concat(c);

                var dot = e > 0 ? e : 0;
                if (dot < c.length - 1) {
                    c.splice(dot + 1, 0, '.');
                }

                return this.sign + c.join('');
            }
        };

        /**
         * Crete a clone of the NumberFormatter
         * @return {NumberFormatter} Returns a clone of the NumberFormatter
         */
        NumberFormatter.prototype.clone = function() {
            var clone = new NumberFormatter('0');
            clone.sign = this.sign;
            clone.coefficients = this.coefficients.slice(0);
            clone.exponent = this.exponent;
            return clone;
        };

        /**
         * Round the number of digits of a number *
         * @param {number} precision  A positive integer
         * @return {NumberFormatter}  Returns a new NumberFormatter with the rounded
         *                            digits
         */
        NumberFormatter.prototype.roundDigits = function(precision) {
            var rounded = this.clone();
            var c = rounded.coefficients;

            // prepend zeros if needed
            while (precision <= 0) {
                c.unshift(0);
                rounded.exponent++;
                precision++;
            }

            if (c.length > precision) {
                var removed = c.splice(precision, c.length - precision);

                if (removed[0] >= 5) {
                    var i = precision - 1;
                    c[i]++;
                    while (c[i] === 10) {
                        c.pop();
                        if (i === 0) {
                            c.unshift(0);
                            rounded.exponent++;
                            i++;
                        }
                        i--;
                        c[i]++;
                    }
                }
            }

            return rounded;
        };

        /**
         * Create an array filled with zeros.
         * @param {number} length
         * @return {Array}
         */
        function zeros(length) {
            var arr = [];
            for (var i = 0; i < length; i++) {
                arr.push(0);
            }
            return arr;
        }

        module.exports = NumberFormatter;

    }, {}],
    34: [function(require, module, exports) {
        'use strict';

        var number = require('./number');
        var string = require('./string');
        var object = require('./object');
        var types = require('./types');

        var DimensionError = require('../error/DimensionError');
        var IndexError = require('../error/IndexError');

        /**
         * Calculate the size of a multi dimensional array.
         * This function checks the size of the first entry, it does not validate
         * whether all dimensions match. (use function `validate` for that)
         * @param {Array} x
         * @Return {Number[]} size
         */
        exports.size = function(x) {
            var s = [];

            while (Array.isArray(x)) {
                s.push(x.length);
                x = x[0];
            }

            return s;
        };

        /**
         * Recursively validate whether each element in a multi dimensional array
         * has a size corresponding to the provided size array.
         * @param {Array} array    Array to be validated
         * @param {number[]} size  Array with the size of each dimension
         * @param {number} dim   Current dimension
         * @throws DimensionError
         * @private
         */
        function _validate(array, size, dim) {
            var i;
            var len = array.length;

            if (len != size[dim]) {
                throw new DimensionError(len, size[dim]);
            }

            if (dim < size.length - 1) {
                // recursively validate each child array
                var dimNext = dim + 1;
                for (i = 0; i < len; i++) {
                    var child = array[i];
                    if (!Array.isArray(child)) {
                        throw new DimensionError(size.length - 1, size.length, '<');
                    }
                    _validate(array[i], size, dimNext);
                }
            } else {
                // last dimension. none of the childs may be an array
                for (i = 0; i < len; i++) {
                    if (Array.isArray(array[i])) {
                        throw new DimensionError(size.length + 1, size.length, '>');
                    }
                }
            }
        }

        /**
         * Validate whether each element in a multi dimensional array has
         * a size corresponding to the provided size array.
         * @param {Array} array    Array to be validated
         * @param {number[]} size  Array with the size of each dimension
         * @throws DimensionError
         */
        exports.validate = function(array, size) {
            var isScalar = (size.length == 0);
            if (isScalar) {
                // scalar
                if (Array.isArray(array)) {
                    throw new DimensionError(array.length, 0);
                }
            } else {
                // array
                _validate(array, size, 0);
            }
        };

        /**
         * Test whether index is an integer number with index >= 0 and index < length
         * when length is provided
         * @param {number} index    Zero-based index
         * @param {number} [length] Length of the array
         */
        exports.validateIndex = function(index, length) {
            if (!number.isNumber(index) || !number.isInteger(index)) {
                throw new TypeError('Index must be an integer (value: ' + index + ')');
            }
            if (index < 0 || (typeof length === 'number' && index >= length)) {
                throw new IndexError(index, length);
            }
        };

        // a constant used to specify an undefined defaultValue
        exports.UNINITIALIZED = {};

        /**
         * Resize a multi dimensional array. The resized array is returned.
         * @param {Array} array         Array to be resized
         * @param {Array.<number>} size Array with the size of each dimension
         * @param {*} [defaultValue=0]  Value to be filled in in new entries,
         *                              zero by default. To leave new entries undefined,
         *                              specify array.UNINITIALIZED as defaultValue
         * @return {Array} array         The resized array
         */
        exports.resize = function(array, size, defaultValue) {
            // TODO: add support for scalars, having size=[] ?

            // check the type of the arguments
            if (!Array.isArray(array) || !Array.isArray(size)) {
                throw new TypeError('Array expected');
            }
            if (size.length === 0) {
                throw new Error('Resizing to scalar is not supported');
            }

            // check whether size contains positive integers
            size.forEach(function(value) {
                if (!number.isNumber(value) || !number.isInteger(value) || value < 0) {
                    throw new TypeError('Invalid size, must contain positive integers ' +
                        '(size: ' + string.format(size) + ')');
                }
            });

            // recursively resize the array
            var _defaultValue = (defaultValue !== undefined) ? defaultValue : 0;
            _resize(array, size, 0, _defaultValue);

            return array;
        };

        /**
         * Recursively resize a multi dimensional array
         * @param {Array} array         Array to be resized
         * @param {number[]} size       Array with the size of each dimension
         * @param {number} dim          Current dimension
         * @param {*} [defaultValue]    Value to be filled in in new entries,
         *                              undefined by default.
         * @private
         */
        function _resize(array, size, dim, defaultValue) {
            var i;
            var elem;
            var oldLen = array.length;
            var newLen = size[dim];
            var minLen = Math.min(oldLen, newLen);

            // apply new length
            array.length = newLen;

            if (dim < size.length - 1) {
                // non-last dimension
                var dimNext = dim + 1;

                // resize existing child arrays
                for (i = 0; i < minLen; i++) {
                    // resize child array
                    elem = array[i];
                    if (!Array.isArray(elem)) {
                        elem = [elem]; // add a dimension
                        array[i] = elem;
                    }
                    _resize(elem, size, dimNext, defaultValue);
                }

                // create new child arrays
                for (i = minLen; i < newLen; i++) {
                    // get child array
                    elem = [];
                    array[i] = elem;

                    // resize new child array
                    _resize(elem, size, dimNext, defaultValue);
                }
            } else {
                // last dimension

                // remove dimensions of existing values
                for (i = 0; i < minLen; i++) {
                    while (Array.isArray(array[i])) {
                        array[i] = array[i][0];
                    }
                }

                if (defaultValue !== exports.UNINITIALIZED) {
                    // fill new elements with the default value
                    for (i = minLen; i < newLen; i++) {
                        array[i] = defaultValue;
                    }
                }
            }
        }

        /**
         * Squeeze a multi dimensional array
         * @param {Array} array
         * @param {Array} [size]
         * @returns {Array} returns the array itself
         */
        exports.squeeze = function(array, size) {
            var s = size || exports.size(array);

            // squeeze outer dimensions
            while (Array.isArray(array) && array.length === 1) {
                array = array[0];
                s.shift();
            }

            // find the first dimension to be squeezed
            var dims = s.length;
            while (s[dims - 1] === 1) {
                dims--;
            }

            // squeeze inner dimensions
            if (dims < s.length) {
                array = _squeeze(array, dims, 0);
                s.length = dims;
            }

            return array;
        };

        /**
         * Recursively squeeze a multi dimensional array
         * @param {Array} array
         * @param {number} dims Required number of dimensions
         * @param {number} dim  Current dimension
         * @returns {Array | *} Returns the squeezed array
         * @private
         */
        function _squeeze(array, dims, dim) {
            var i, ii;

            if (dim < dims) {
                var next = dim + 1;
                for (i = 0, ii = array.length; i < ii; i++) {
                    array[i] = _squeeze(array[i], dims, next);
                }
            } else {
                while (Array.isArray(array)) {
                    array = array[0];
                }
            }

            return array;
        }

        /**
         * Unsqueeze a multi dimensional array: add dimensions when missing
         * 
         * Paramter `size` will be mutated to match the new, unqueezed matrix size.
         * 
         * @param {Array} array
         * @param {number} dims     Desired number of dimensions of the array
         * @param {number} [outer]  Number of outer dimensions to be added
         * @param {Array} [size]    Current size of array.
         * @returns {Array} returns the array itself
         * @private
         */
        exports.unsqueeze = function(array, dims, outer, size) {
            var s = size || exports.size(array);

            // unsqueeze outer dimensions
            if (outer) {
                for (var i = 0; i < outer; i++) {
                    array = [array];
                    s.unshift(1);
                }
            }

            // unsqueeze inner dimensions
            array = _unsqueeze(array, dims, 0);
            while (s.length < dims) {
                s.push(1);
            }

            return array;
        };

        /**
         * Recursively unsqueeze a multi dimensional array
         * @param {Array} array
         * @param {number} dims Required number of dimensions
         * @param {number} dim  Current dimension
         * @returns {Array | *} Returns the squeezed array
         * @private
         */
        function _unsqueeze(array, dims, dim) {
            var i, ii;

            if (Array.isArray(array)) {
                var next = dim + 1;
                for (i = 0, ii = array.length; i < ii; i++) {
                    array[i] = _unsqueeze(array[i], dims, next);
                }
            } else {
                for (var d = dim; d < dims; d++) {
                    array = [array];
                }
            }

            return array;
        }
        /**
         * Flatten a multi dimensional array, put all elements in a one dimensional
         * array
         * @param {Array} array   A multi dimensional array
         * @return {Array}        The flattened array (1 dimensional)
         */
        exports.flatten = function(array) {
            if (!Array.isArray(array)) {
                //if not an array, return as is
                return array;
            }
            var flat = [];

            array.forEach(function callback(value) {
                if (Array.isArray(value)) {
                    value.forEach(callback); //traverse through sub-arrays recursively
                } else {
                    flat.push(value);
                }
            });

            return flat;
        };

        /**
         * Test whether an object is an array
         * @param {*} value
         * @return {boolean} isArray
         */
        exports.isArray = Array.isArray;

    }, {
        "../error/DimensionError": 8,
        "../error/IndexError": 9,
        "./number": 43,
        "./object": 44,
        "./string": 45,
        "./types": 46
    }],
    35: [function(require, module, exports) {
        /**
         * Convert a BigNumber to a formatted string representation.
         *
         * Syntax:
         *
         *    format(value)
         *    format(value, options)
         *    format(value, precision)
         *    format(value, fn)
         *
         * Where:
         *
         *    {number} value   The value to be formatted
         *    {Object} options An object with formatting options. Available options:
         *                     {string} notation
         *                         Number notation. Choose from:
         *                         'fixed'          Always use regular number notation.
         *                                          For example '123.40' and '14000000'
         *                         'exponential'    Always use exponential notation.
         *                                          For example '1.234e+2' and '1.4e+7'
         *                         'auto' (default) Regular number notation for numbers
         *                                          having an absolute value between
         *                                          `lower` and `upper` bounds, and uses
         *                                          exponential notation elsewhere.
         *                                          Lower bound is included, upper bound
         *                                          is excluded.
         *                                          For example '123.4' and '1.4e7'.
         *                     {number} precision   A number between 0 and 16 to round
         *                                          the digits of the number.
         *                                          In case of notations 'exponential' and
         *                                          'auto', `precision` defines the total
         *                                          number of significant digits returned
         *                                          and is undefined by default.
         *                                          In case of notation 'fixed',
         *                                          `precision` defines the number of
         *                                          significant digits after the decimal
         *                                          point, and is 0 by default.
         *                     {Object} exponential An object containing two parameters,
         *                                          {number} lower and {number} upper,
         *                                          used by notation 'auto' to determine
         *                                          when to return exponential notation.
         *                                          Default values are `lower=1e-3` and
         *                                          `upper=1e5`.
         *                                          Only applicable for notation `auto`.
         *    {Function} fn    A custom formatting function. Can be used to override the
         *                     built-in notations. Function `fn` is called with `value` as
         *                     parameter and must return a string. Is useful for example to
         *                     format all values inside a matrix in a particular way.
         *
         * Examples:
         *
         *    format(6.4);                                        // '6.4'
         *    format(1240000);                                    // '1.24e6'
         *    format(1/3);                                        // '0.3333333333333333'
         *    format(1/3, 3);                                     // '0.333'
         *    format(21385, 2);                                   // '21000'
         *    format(12.071, {notation: 'fixed'});                // '12'
         *    format(2.3,    {notation: 'fixed', precision: 2});  // '2.30'
         *    format(52.8,   {notation: 'exponential'});          // '5.28e+1'
         *
         * @param {BigNumber} value
         * @param {Object | Function | number} [options]
         * @return {string} str The formatted value
         */
        exports.format = function(value, options) {
            if (typeof options === 'function') {
                // handle format(value, fn)
                return options(value);
            }

            // handle special cases
            if (!value.isFinite()) {
                return value.isNaN() ? 'NaN' : (value.gt(0) ? 'Infinity' : '-Infinity');
            }

            // default values for options
            var notation = 'auto';
            var precision = undefined;

            if (options !== undefined) {
                // determine notation from options
                if (options.notation) {
                    notation = options.notation;
                }

                // determine precision from options
                if (typeof options === 'number') {
                    precision = options;
                } else if (options.precision) {
                    precision = options.precision;
                }
            }

            // handle the various notations
            switch (notation) {
                case 'fixed':
                    return exports.toFixed(value, precision);

                case 'exponential':
                    return exports.toExponential(value, precision);

                case 'auto':
                    // determine lower and upper bound for exponential notation.
                    // TODO: implement support for upper and lower to be BigNumbers themselves
                    var lower = 1e-3;
                    var upper = 1e5;
                    if (options && options.exponential) {
                        if (options.exponential.lower !== undefined) {
                            lower = options.exponential.lower;
                        }
                        if (options.exponential.upper !== undefined) {
                            upper = options.exponential.upper;
                        }
                    }

                    // adjust the configuration of the BigNumber constructor (yeah, this is quite tricky...)
                    var oldConfig = {
                        toExpNeg: value.constructor.toExpNeg,
                        toExpPos: value.constructor.toExpPos
                    };

                    value.constructor.config({
                        toExpNeg: Math.round(Math.log(lower) / Math.LN10),
                        toExpPos: Math.round(Math.log(upper) / Math.LN10)
                    });

                    // handle special case zero
                    if (value.isZero()) return '0';

                    // determine whether or not to output exponential notation
                    var str;
                    var abs = value.abs();
                    if (abs.gte(lower) && abs.lt(upper)) {
                        // normal number notation
                        str = value.toSignificantDigits(precision).toFixed();
                    } else {
                        // exponential notation
                        str = exports.toExponential(value, precision);
                    }

                    // remove trailing zeros after the decimal point
                    return str.replace(/((\.\d*?)(0+))($|e)/, function() {
                        var digits = arguments[2];
                        var e = arguments[4];
                        return (digits !== '.') ? digits + e : e;
                    });

                default:
                    throw new Error('Unknown notation "' + notation + '". ' +
                        'Choose "auto", "exponential", or "fixed".');
            }
        };

        /**
         * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
         * @param {BigNumber} value
         * @param {number} [precision]  Number of digits in formatted output.
         *                              If not provided, the maximum available digits
         *                              is used.
         * @returns {string} str
         */
        exports.toExponential = function(value, precision) {
            if (precision !== undefined) {
                return value.toExponential(precision - 1); // Note the offset of one
            } else {
                return value.toExponential();
            }
        };

        /**
         * Format a number with fixed notation.
         * @param {BigNumber} value
         * @param {number} [precision=0]        Optional number of decimals after the
         *                                      decimal point. Zero by default.
         */
        exports.toFixed = function(value, precision) {
            return value.toFixed(precision || 0);
            // Note: the (precision || 0) is needed as the toFixed of BigNumber has an
            // undefined default precision instead of 0.
        };

    }, {}],
    36: [function(require, module, exports) {
        'use strict';

        /**
         * Compares two BigNumbers.
         * @param {BigNumber} x       First value to compare
         * @param {BigNumber} y       Second value to compare
         * @param {number} [epsilon]  The maximum relative difference between x and y
         *                            If epsilon is undefined or null, the function will
         *                            test whether x and y are exactly equal.
         * @return {boolean} whether the two numbers are nearly equal
         */
        module.exports = function nearlyEqual(x, y, epsilon) {
            // if epsilon is null or undefined, test whether x and y are exactly equal
            if (epsilon == null) {
                return x.eq(y);
            }


            // use "==" operator, handles infinities
            if (x.eq(y)) {
                return true;
            }

            // NaN
            if (x.isNaN() || y.isNaN()) {
                return false;
            }

            // at this point x and y should be finite
            if (x.isFinite() && y.isFinite()) {
                // check numbers are very close, needed when comparing numbers near zero
                var diff = x.minus(y).abs();
                if (diff.isZero()) {
                    return true;
                } else {
                    // use relative error
                    var max = x.constructor.max(x.abs(), y.abs());
                    return diff.lte(max.times(epsilon));
                }
            }

            // Infinite and Number or negative Infinite and positive Infinite cases
            return false;
        };

    }, {}],
    37: [function(require, module, exports) {
        'use strict';

        /**
         * Test whether value is a boolean
         * @param {*} value
         * @return {boolean} isBoolean
         */
        exports.isBoolean = function(value) {
            return typeof value == 'boolean';
        };

    }, {}],
    38: [function(require, module, exports) {
        'use strict';

        /**
         * Execute the callback function element wise for each element in array and any
         * nested array
         * Returns an array with the results
         * @param {Array | Matrix} array
         * @param {Function} callback   The callback is called with two parameters:
         *                              value1 and value2, which contain the current
         *                              element of both arrays.
         * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
         *
         * @return {Array | Matrix} res
         */
        module.exports = function deepMap(array, callback, skipZeros) {
            if (array && (typeof array.map === 'function')) {
                // TODO: replace array.map with a for loop to improve performance
                return array.map(function(x) {
                    return deepMap(x, callback, skipZeros);
                });
            } else {
                return callback(array);
            }
        };

    }, {}],
    39: [function(require, module, exports) {
        var Emitter = require('tiny-emitter');

        /**
         * Extend given object with emitter functions `on`, `off`, `once`, `emit`
         * @param {Object} obj
         * @return {Object} obj
         */
        exports.mixin = function(obj) {
            // create event emitter
            var emitter = new Emitter();

            // bind methods to obj (we don't want to expose the emitter.e Array...)
            obj.on = emitter.on.bind(emitter);
            obj.off = emitter.off.bind(emitter);
            obj.once = emitter.once.bind(emitter);
            obj.emit = emitter.emit.bind(emitter);

            return obj;
        };

    }, {
        "tiny-emitter": 47
    }],
    40: [function(require, module, exports) {
        // function utils

        /*
         * Memoize a given function by caching the computed result.
         * The cache of a memoized function can be cleared by deleting the `cache`
         * property of the function.
         *
         * @param {function} fn                     The function to be memoized.
         *                                          Must be a pure function.
         * @param {function(args: Array)} [hasher]  A custom hash builder.
         *                                          Is JSON.stringify by default.
         * @return {function}                       Returns the memoized function
         */
        exports.memoize = function(fn, hasher) {
            return function memoize() {
                if (typeof memoize.cache !== 'object') {
                    memoize.cache = {};
                }

                var args = [];
                for (var i = 0; i < arguments.length; i++) {
                    args[i] = arguments[i];
                }

                var hash = hasher ? hasher(args) : JSON.stringify(args);
                if (!(hash in memoize.cache)) {
                    return memoize.cache[hash] = fn.apply(fn, args);
                }
                return memoize.cache[hash];
            };
        };

        /**
         * Find the maximum number of arguments expected by a typed function.
         * @param {function} fn   A typed function
         * @return {number} Returns the maximum number of expected arguments.
         *                  Returns -1 when no signatures where found on the function.
         */
        exports.maxArgumentCount = function(fn) {
            return Object.keys(fn.signatures || {})
                .reduce(function(args, signature) {
                    var count = (signature.match(/,/g) || []).length + 1;
                    return Math.max(args, count);
                }, -1);
        };

    }, {}],
    41: [function(require, module, exports) {
        'use strict';

        exports.array = require('./array');
        exports['boolean'] = require('./boolean');
        exports['function'] = require('./function');
        exports.number = require('./number');
        exports.object = require('./object');
        exports.string = require('./string');
        exports.types = require('./types');
        exports.emitter = require('./emitter');

    }, {
        "./array": 34,
        "./boolean": 37,
        "./emitter": 39,
        "./function": 40,
        "./number": 43,
        "./object": 44,
        "./string": 45,
        "./types": 46
    }],
    42: [function(require, module, exports) {
        'use strict';

        exports.symbols = {
            // GREEK LETTERS
            Alpha: 'A',
            alpha: '\\alpha',
            Beta: 'B',
            beta: '\\beta',
            Gamma: '\\Gamma',
            gamma: '\\gamma',
            Delta: '\\Delta',
            delta: '\\delta',
            Epsilon: 'E',
            epsilon: '\\epsilon',
            varepsilon: '\\varepsilon',
            Zeta: 'Z',
            zeta: '\\zeta',
            Eta: 'H',
            eta: '\\eta',
            Theta: '\\Theta',
            theta: '\\theta',
            vartheta: '\\vartheta',
            Iota: 'I',
            iota: '\\iota',
            Kappa: 'K',
            kappa: '\\kappa',
            varkappa: '\\varkappa',
            Lambda: '\\Lambda',
            lambda: '\\lambda',
            Mu: 'M',
            mu: '\\mu',
            Nu: 'N',
            nu: '\\nu',
            Xi: '\\Xi',
            xi: '\\xi',
            Omicron: 'O',
            omicron: 'o',
            Pi: '\\Pi',
            pi: '\\pi',
            varpi: '\\varpi',
            Rho: 'P',
            rho: '\\rho',
            varrho: '\\varrho',
            Sigma: '\\Sigma',
            sigma: '\\sigma',
            varsigma: '\\varsigma',
            Tau: 'T',
            tau: '\\tau',
            Upsilon: '\\Upsilon',
            upsilon: '\\upsilon',
            Phi: '\\Phi',
            phi: '\\phi',
            varphi: '\\varphi',
            Chi: 'X',
            chi: '\\chi',
            Psi: '\\Psi',
            psi: '\\psi',
            Omega: '\\Omega',
            omega: '\\omega',
            //logic
            'true': '\\mathrm{True}',
            'false': '\\mathrm{False}',
            //other
            i: 'i', //TODO use \i ??
            inf: '\\infty',
            Inf: '\\infty',
            infinity: '\\infty',
            Infinity: '\\infty',
            oo: '\\infty',
            lim: '\\lim',
            'undefined': '\\mathbf{?}'
        };

        exports.operators = {
            'transpose': '^\\top',
            'factorial': '!',
            'pow': '^',
            'dotPow': '.^\\wedge', //TODO find ideal solution
            'unaryPlus': '+',
            'unaryMinus': '-',
            'bitNot': '~', //TODO find ideal solution
            'not': '\\neg',
            'multiply': '\\cdot',
            'divide': '\\frac', //TODO how to handle that properly?
            'dotMultiply': '.\\cdot', //TODO find ideal solution
            'dotDivide': '.:', //TODO find ideal solution
            'mod': '\\mod',
            'add': '+',
            'subtract': '-',
            'to': '\\rightarrow',
            'leftShift': '<<',
            'rightArithShift': '>>',
            'rightLogShift': '>>>',
            'equal': '=',
            'unequal': '\\neq',
            'smaller': '<',
            'larger': '>',
            'smallerEq': '\\leq',
            'largerEq': '\\geq',
            'bitAnd': '\\&',
            'bitXor': '\\underline{|}',
            'bitOr': '|',
            'and': '\\wedge',
            'xor': '\\veebar',
            'or': '\\vee'
        };

        exports.defaultTemplate = '\\mathrm{${name}}\\left(${args}\\right)';

        var units = {
            deg: '^\\circ'
        };

        //@param {string} name
        //@param {boolean} isUnit
        exports.toSymbol = function(name, isUnit) {
            isUnit = typeof isUnit === 'undefined' ? false : isUnit;
            if (isUnit) {
                if (units.hasOwnProperty(name)) {
                    return units[name];
                }
                return '\\mathrm{' + name + '}';
            }

            if (exports.symbols.hasOwnProperty(name)) {
                return exports.symbols[name];
            } else if (name.indexOf('_') !== -1) {
                //symbol with index (eg. alpha_1)
                var index = name.indexOf('_');
                return exports.toSymbol(name.substring(0, index)) + '_{' +
                    exports.toSymbol(name.substring(index + 1)) + '}';
            }
            return name;
        };

    }, {}],
    43: [function(require, module, exports) {
        'use strict';

        var NumberFormatter = require('./NumberFormatter');

        /**
         * Test whether value is a number
         * @param {*} value
         * @return {boolean} isNumber
         */
        exports.isNumber = function(value) {
            return typeof value === 'number';
        };

        /**
         * Check if a number is integer
         * @param {number | boolean} value
         * @return {boolean} isInteger
         */
        exports.isInteger = function(value) {
            return isFinite(value) ?
                (value == Math.round(value)) :
                false;
            // Note: we use ==, not ===, as we can have Booleans as well
        };

        /**
         * Calculate the sign of a number
         * @param {number} x
         * @returns {*}
         */
        exports.sign = Math.sign || function(x) {
            if (x > 0) {
                return 1;
            } else if (x < 0) {
                return -1;
            } else {
                return 0;
            }
        };

        /**
         * Convert a number to a formatted string representation.
         *
         * Syntax:
         *
         *    format(value)
         *    format(value, options)
         *    format(value, precision)
         *    format(value, fn)
         *
         * Where:
         *
         *    {number} value   The value to be formatted
         *    {Object} options An object with formatting options. Available options:
         *                     {string} notation
         *                         Number notation. Choose from:
         *                         'fixed'          Always use regular number notation.
         *                                          For example '123.40' and '14000000'
         *                         'exponential'    Always use exponential notation.
         *                                          For example '1.234e+2' and '1.4e+7'
         *                         'engineering'    Always use engineering notation.
         *                                          For example '123.4e+0' and '14.0e+6'
         *                         'auto' (default) Regular number notation for numbers
         *                                          having an absolute value between
         *                                          `lower` and `upper` bounds, and uses
         *                                          exponential notation elsewhere.
         *                                          Lower bound is included, upper bound
         *                                          is excluded.
         *                                          For example '123.4' and '1.4e7'.
         *                     {number} precision   A number between 0 and 16 to round
         *                                          the digits of the number.
         *                                          In case of notations 'exponential' and
         *                                          'auto', `precision` defines the total
         *                                          number of significant digits returned
         *                                          and is undefined by default.
         *                                          In case of notation 'fixed',
         *                                          `precision` defines the number of
         *                                          significant digits after the decimal
         *                                          point, and is 0 by default.
         *                     {Object} exponential An object containing two parameters,
         *                                          {number} lower and {number} upper,
         *                                          used by notation 'auto' to determine
         *                                          when to return exponential notation.
         *                                          Default values are `lower=1e-3` and
         *                                          `upper=1e5`.
         *                                          Only applicable for notation `auto`.
         *    {Function} fn    A custom formatting function. Can be used to override the
         *                     built-in notations. Function `fn` is called with `value` as
         *                     parameter and must return a string. Is useful for example to
         *                     format all values inside a matrix in a particular way.
         *
         * Examples:
         *
         *    format(6.4);                                        // '6.4'
         *    format(1240000);                                    // '1.24e6'
         *    format(1/3);                                        // '0.3333333333333333'
         *    format(1/3, 3);                                     // '0.333'
         *    format(21385, 2);                                   // '21000'
         *    format(12.071, {notation: 'fixed'});                // '12'
         *    format(2.3,    {notation: 'fixed', precision: 2});  // '2.30'
         *    format(52.8,   {notation: 'exponential'});          // '5.28e+1'
         *    format(12345678, {notation: 'engineering'});        // '12.345678e+6'
         *
         * @param {number} value
         * @param {Object | Function | number} [options]
         * @return {string} str The formatted value
         */
        exports.format = function(value, options) {
            if (typeof options === 'function') {
                // handle format(value, fn)
                return options(value);
            }

            // handle special cases
            if (value === Infinity) {
                return 'Infinity';
            } else if (value === -Infinity) {
                return '-Infinity';
            } else if (isNaN(value)) {
                return 'NaN';
            }

            // default values for options
            var notation = 'auto';
            var precision = undefined;

            if (options) {
                // determine notation from options
                if (options.notation) {
                    notation = options.notation;
                }

                // determine precision from options
                if (exports.isNumber(options)) {
                    precision = options;
                } else if (options.precision) {
                    precision = options.precision;
                }
            }

            // handle the various notations
            switch (notation) {
                case 'fixed':
                    return exports.toFixed(value, precision);

                case 'exponential':
                    return exports.toExponential(value, precision);

                case 'engineering':
                    return exports.toEngineering(value, precision);

                case 'auto':
                    return exports
                        .toPrecision(value, precision, options && options.exponential)

                        // remove trailing zeros after the decimal point
                        .replace(/((\.\d*?)(0+))($|e)/, function() {
                            var digits = arguments[2];
                            var e = arguments[4];
                            return (digits !== '.') ? digits + e : e;
                        });

                default:
                    throw new Error('Unknown notation "' + notation + '". ' +
                        'Choose "auto", "exponential", or "fixed".');
            }
        };

        /**
         * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
         * @param {number} value
         * @param {number} [precision]  Number of digits in formatted output.
         *                              If not provided, the maximum available digits
         *                              is used.
         * @returns {string} str
         */
        exports.toExponential = function(value, precision) {
            return new NumberFormatter(value).toExponential(precision);
        };

        /**
         * Format a number in engineering notation. Like '1.23e+6', '2.3e+0', '3.500e-3'
         * @param {number} value
         * @param {number} [precision]  Number of digits in formatted output.
         *                              If not provided, the maximum available digits
         *                              is used.
         * @returns {string} str
         */
        exports.toEngineering = function(value, precision) {
            return new NumberFormatter(value).toEngineering(precision);
        };

        /**
         * Format a number with fixed notation.
         * @param {number} value
         * @param {number} [precision=0]        Optional number of decimals after the
         *                                      decimal point. Zero by default.
         */
        exports.toFixed = function(value, precision) {
            return new NumberFormatter(value).toFixed(precision);
        };

        /**
         * Format a number with a certain precision
         * @param {number} value
         * @param {number} [precision=undefined] Optional number of digits.
         * @param {{lower: number, upper: number}} [options]  By default:
         *                                                    lower = 1e-3 (excl)
         *                                                    upper = 1e+5 (incl)
         * @return {string}
         */
        exports.toPrecision = function(value, precision, options) {
            return new NumberFormatter(value).toPrecision(precision, options);
        };

        /**
         * Count the number of significant digits of a number.
         *
         * For example:
         *   2.34 returns 3
         *   0.0034 returns 2
         *   120.5e+30 returns 4
         *
         * @param {number} value
         * @return {number} digits   Number of significant digits
         */
        exports.digits = function(value) {
            return value
                .toExponential()
                .replace(/e.*$/, '') // remove exponential notation
                .replace(/^0\.?0*|\./, '') // remove decimal point and leading zeros
                .length
        };

        /**
         * Minimum number added to one that makes the result different than one
         */
        exports.DBL_EPSILON = Number.EPSILON || 2.2204460492503130808472633361816E-16;

        /**
         * Compares two floating point numbers.
         * @param {number} x          First value to compare
         * @param {number} y          Second value to compare
         * @param {number} [epsilon]  The maximum relative difference between x and y
         *                            If epsilon is undefined or null, the function will
         *                            test whether x and y are exactly equal.
         * @return {boolean} whether the two numbers are nearly equal
         */
        exports.nearlyEqual = function(x, y, epsilon) {
            // if epsilon is null or undefined, test whether x and y are exactly equal
            if (epsilon == null) {
                return x == y;
            }

            // use "==" operator, handles infinities
            if (x == y) {
                return true;
            }

            // NaN
            if (isNaN(x) || isNaN(y)) {
                return false;
            }

            // at this point x and y should be finite
            if (isFinite(x) && isFinite(y)) {
                // check numbers are very close, needed when comparing numbers near zero
                var diff = Math.abs(x - y);
                if (diff < exports.DBL_EPSILON) {
                    return true;
                } else {
                    // use relative error
                    return diff <= Math.max(Math.abs(x), Math.abs(y)) * epsilon;
                }
            }

            // Infinite and Number or negative Infinite and positive Infinite cases
            return false;
        };

    }, {
        "./NumberFormatter": 33
    }],
    44: [function(require, module, exports) {
        'use strict';

        /**
         * Clone an object
         *
         *     clone(x)
         *
         * Can clone any primitive type, array, and object.
         * If x has a function clone, this function will be invoked to clone the object.
         *
         * @param {*} x
         * @return {*} clone
         */
        exports.clone = function clone(x) {
            var type = typeof x;

            // immutable primitive types
            if (type === 'number' || type === 'string' || type === 'boolean' ||
                x === null || x === undefined) {
                return x;
            }

            // use clone function of the object when available
            if (typeof x.clone === 'function') {
                return x.clone();
            }

            // array
            if (Array.isArray(x)) {
                return x.map(function(value) {
                    return clone(value);
                });
            }

            if (x instanceof Number) return new Number(x.valueOf());
            if (x instanceof String) return new String(x.valueOf());
            if (x instanceof Boolean) return new Boolean(x.valueOf());
            if (x instanceof Date) return new Date(x.valueOf());
            if (x && x.isBigNumber === true) return x; // bignumbers are immutable
            if (x instanceof RegExp) throw new TypeError('Cannot clone ' + x); // TODO: clone a RegExp

            // object
            var m = {};
            for (var key in x) {
                if (x.hasOwnProperty(key)) {
                    m[key] = clone(x[key]);
                }
            }
            return m;
        };

        /**
         * Extend object a with the properties of object b
         * @param {Object} a
         * @param {Object} b
         * @return {Object} a
         */
        exports.extend = function(a, b) {
            for (var prop in b) {
                if (b.hasOwnProperty(prop)) {
                    a[prop] = b[prop];
                }
            }
            return a;
        };

        /**
         * Deep extend an object a with the properties of object b
         * @param {Object} a
         * @param {Object} b
         * @returns {Object}
         */
        exports.deepExtend = function deepExtend(a, b) {
            // TODO: add support for Arrays to deepExtend
            if (Array.isArray(b)) {
                throw new TypeError('Arrays are not supported by deepExtend');
            }

            for (var prop in b) {
                if (b.hasOwnProperty(prop)) {
                    if (b[prop] && b[prop].constructor === Object) {
                        if (a[prop] === undefined) {
                            a[prop] = {};
                        }
                        if (a[prop].constructor === Object) {
                            deepExtend(a[prop], b[prop]);
                        } else {
                            a[prop] = b[prop];
                        }
                    } else if (Array.isArray(b[prop])) {
                        throw new TypeError('Arrays are not supported by deepExtend');
                    } else {
                        a[prop] = b[prop];
                    }
                }
            }
            return a;
        };

        /**
         * Deep test equality of all fields in two pairs of arrays or objects.
         * @param {Array | Object} a
         * @param {Array | Object} b
         * @returns {boolean}
         */
        exports.deepEqual = function deepEqual(a, b) {
            var prop, i, len;
            if (Array.isArray(a)) {
                if (!Array.isArray(b)) {
                    return false;
                }

                if (a.length != b.length) {
                    return false;
                }

                for (i = 0, len = a.length; i < len; i++) {
                    if (!exports.deepEqual(a[i], b[i])) {
                        return false;
                    }
                }
                return true;
            } else if (a instanceof Object) {
                if (Array.isArray(b) || !(b instanceof Object)) {
                    return false;
                }

                for (prop in a) {
                    //noinspection JSUnfilteredForInLoop
                    if (!exports.deepEqual(a[prop], b[prop])) {
                        return false;
                    }
                }
                for (prop in b) {
                    //noinspection JSUnfilteredForInLoop
                    if (!exports.deepEqual(a[prop], b[prop])) {
                        return false;
                    }
                }
                return true;
            } else {
                return (typeof a === typeof b) && (a == b);
            }
        };

        /**
         * Test whether the current JavaScript engine supports Object.defineProperty
         * @returns {boolean} returns true if supported
         */
        exports.canDefineProperty = function() {
            // test needed for broken IE8 implementation
            try {
                if (Object.defineProperty) {
                    Object.defineProperty({}, 'x', {
                        get: function() {}
                    });
                    return true;
                }
            } catch (e) {}

            return false;
        };

        /**
         * Attach a lazy loading property to a constant.
         * The given function `fn` is called once when the property is first requested.
         * On older browsers (<IE8), the function will fall back to direct evaluation
         * of the properties value.
         * @param {Object} object   Object where to add the property
         * @param {string} prop     Property name
         * @param {Function} fn     Function returning the property value. Called
         *                          without arguments.
         */
        exports.lazy = function(object, prop, fn) {
            if (exports.canDefineProperty()) {
                var _uninitialized = true;
                var _value;
                Object.defineProperty(object, prop, {
                    get: function() {
                        if (_uninitialized) {
                            _value = fn();
                            _uninitialized = false;
                        }
                        return _value;
                    },

                    set: function(value) {
                        _value = value;
                        _uninitialized = false;
                    },

                    configurable: true,
                    enumerable: true
                });
            } else {
                // fall back to immediate evaluation
                object[prop] = fn();
            }
        };

        /**
         * Traverse a path into an object.
         * When a namespace is missing, it will be created
         * @param {Object} object
         * @param {string} path   A dot separated string like 'name.space'
         * @return {Object} Returns the object at the end of the path
         */
        exports.traverse = function(object, path) {
            var obj = object;

            if (path) {
                var names = path.split('.');
                for (var i = 0; i < names.length; i++) {
                    var name = names[i];
                    if (!(name in obj)) {
                        obj[name] = {};
                    }
                    obj = obj[name];
                }
            }

            return obj;
        };

        /**
         * Test whether an object is a factory. a factory has fields:
         *
         * - factory: function (type: Object, config: Object, load: function, typed: function [, math: Object])   (required)
         * - name: string (optional)
         * - path: string    A dot separated path (optional)
         * - math: boolean   If true (false by default), the math namespace is passed
         *                   as fifth argument of the factory function
         *
         * @param {*} object
         * @returns {boolean}
         */
        exports.isFactory = function(object) {
            return object && typeof object.factory === 'function';
        };

    }, {}],
    45: [function(require, module, exports) {
        'use strict';

        var formatNumber = require('./number').format;
        var formatBigNumber = require('./bignumber/formatter').format;

        /**
         * Test whether value is a string
         * @param {*} value
         * @return {boolean} isString
         */
        exports.isString = function(value) {
            return typeof value === 'string';
        };

        /**
         * Check if a text ends with a certain string.
         * @param {string} text
         * @param {string} search
         */
        exports.endsWith = function(text, search) {
            var start = text.length - search.length;
            var end = text.length;
            return (text.substring(start, end) === search);
        };

        /**
         * Format a value of any type into a string.
         *
         * Usage:
         *     math.format(value)
         *     math.format(value, precision)
         *
         * When value is a function:
         *
         * - When the function has a property `syntax`, it returns this
         *   syntax description.
         * - In other cases, a string `'function'` is returned.
         *
         * When `value` is an Object:
         *
         * - When the object contains a property `format` being a function, this
         *   function is invoked as `value.format(options)` and the result is returned.
         * - When the object has its own `toString` method, this method is invoked
         *   and the result is returned.
         * - In other cases the function will loop over all object properties and
         *   return JSON object notation like '{"a": 2, "b": 3}'.
         *
         * Example usage:
         *     math.format(2/7);                // '0.2857142857142857'
         *     math.format(math.pi, 3);         // '3.14'
         *     math.format(new Complex(2, 3));  // '2 + 3i'
         *     math.format('hello');            // '"hello"'
         *
         * @param {*} value             Value to be stringified
         * @param {Object | number | Function} [options]  Formatting options. See
         *                                                lib/utils/number:format for a
         *                                                description of the available
         *                                                options.
         * @return {string} str
         */
        exports.format = function(value, options) {
            if (typeof value === 'number') {
                return formatNumber(value, options);
            }

            if (value && value.isBigNumber === true) {
                return formatBigNumber(value, options);
            }

            if (value && value.isFraction === true) {
                if (!options || options.fraction !== 'decimal') {
                    // output as ratio, like '1/3'
                    return (value.s * value.n) + '/' + value.d;
                } else {
                    // output as decimal, like '0.(3)'
                    return value.toString();
                }
            }

            if (Array.isArray(value)) {
                return formatArray(value, options);
            }

            if (exports.isString(value)) {
                return '"' + value + '"';
            }

            if (typeof value === 'function') {
                return value.syntax ? String(value.syntax) : 'function';
            }

            if (value && typeof value === 'object') {
                if (typeof value.format === 'function') {
                    return value.format(options);
                } else if (value && value.toString() !== {}.toString()) {
                    // this object has a non-native toString method, use that one
                    return value.toString();
                } else {
                    var entries = [];

                    for (var key in value) {
                        if (value.hasOwnProperty(key)) {
                            entries.push('"' + key + '": ' + exports.format(value[key], options));
                        }
                    }

                    return '{' + entries.join(', ') + '}';
                }
            }

            return String(value);
        };

        /**
         * Recursively format an n-dimensional matrix
         * Example output: "[[1, 2], [3, 4]]"
         * @param {Array} array
         * @param {Object | number | Function} [options]  Formatting options. See
         *                                                lib/utils/number:format for a
         *                                                description of the available
         *                                                options.
         * @returns {string} str
         */
        function formatArray(array, options) {
            if (Array.isArray(array)) {
                var str = '[';
                var len = array.length;
                for (var i = 0; i < len; i++) {
                    if (i != 0) {
                        str += ', ';
                    }
                    str += formatArray(array[i], options);
                }
                str += ']';
                return str;
            } else {
                return exports.format(array, options);
            }
        }

    }, {
        "./bignumber/formatter": 35,
        "./number": 43
    }],
    46: [function(require, module, exports) {
        'use strict';

        /**
         * Determine the type of a variable
         *
         *     type(x)
         *
         * The following types are recognized:
         *
         *     'undefined'
         *     'null'
         *     'boolean'
         *     'number'
         *     'string'
         *     'Array'
         *     'Function'
         *     'Date'
         *     'RegExp'
         *     'Object'
         *
         * @param {*} x
         * @return {string} Returns the name of the type. Primitive types are lower case,
         *                  non-primitive types are upper-camel-case.
         *                  For example 'number', 'string', 'Array', 'Date'.
         */
        exports.type = function(x) {
            var type = typeof x;

            if (type === 'object') {
                if (x === null) return 'null';
                if (x instanceof Boolean) return 'boolean';
                if (x instanceof Number) return 'number';
                if (x instanceof String) return 'string';
                if (Array.isArray(x)) return 'Array';
                if (x instanceof Date) return 'Date';
                if (x instanceof RegExp) return 'RegExp';

                return 'Object';
            }

            if (type === 'function') return 'Function';

            return type;
        };

        /**
         * Test whether a value is a scalar
         * @param x
         * @return {boolean} Returns true when x is a scalar, returns false when
         *                   x is a Matrix or Array.
         */
        exports.isScalar = function(x) {
            return !((x && x.isMatrix) || Array.isArray(x));
        };

    }, {}],
    47: [function(require, module, exports) {
        function E() {
            // Keep this empty so it's easier to inherit from
            // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
        }

        E.prototype = {
            on: function(name, callback, ctx) {
                var e = this.e || (this.e = {});

                (e[name] || (e[name] = [])).push({
                    fn: callback,
                    ctx: ctx
                });

                return this;
            },

            once: function(name, callback, ctx) {
                var self = this;

                function listener() {
                    self.off(name, listener);
                    callback.apply(ctx, arguments);
                };

                listener._ = callback
                return this.on(name, listener, ctx);
            },

            emit: function(name) {
                var data = [].slice.call(arguments, 1);
                var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
                var i = 0;
                var len = evtArr.length;

                for (i; i < len; i++) {
                    evtArr[i].fn.apply(evtArr[i].ctx, data);
                }

                return this;
            },

            off: function(name, callback) {
                var e = this.e || (this.e = {});
                var evts = e[name];
                var liveEvents = [];

                if (evts && callback) {
                    for (var i = 0, len = evts.length; i < len; i++) {
                        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
                            liveEvents.push(evts[i]);
                    }
                }

                // Remove event from queue to prevent memory leak
                // Suggested by https://github.com/lazd
                // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

                (liveEvents.length) ?
                e[name] = liveEvents: delete e[name];

                return this;
            }
        };

        module.exports = E;

    }, {}],
    48: [function(require, module, exports) {
        /**
         * typed-function
         *
         * Type checking for JavaScript functions
         *
         * https://github.com/josdejong/typed-function
         */
        'use strict';

        (function(root, factory) {
            if (typeof define === 'function' && define.amd) {
                // AMD. Register as an anonymous module.
                define([], factory);
            } else if (typeof exports === 'object') {
                // OldNode. Does not work with strict CommonJS, but
                // only CommonJS-like environments that support module.exports,
                // like OldNode.
                module.exports = factory();
            } else {
                // Browser globals (root is window)
                root.typed = factory();
            }
        }(this, function() {
            // factory function to create a new instance of typed-function
            // TODO: allow passing configuration, types, tests via the factory function
            function create() {
                /**
                 * Get a type test function for a specific data type
                 * @param {string} name                   Name of a data type like 'number' or 'string'
                 * @returns {Function(obj: *) : boolean}  Returns a type testing function.
                 *                                        Throws an error for an unknown type.
                 */
                function getTypeTest(name) {
                    var test;
                    for (var i = 0; i < typed.types.length; i++) {
                        var entry = typed.types[i];
                        if (entry.name === name) {
                            test = entry.test;
                            break;
                        }
                    }

                    if (!test) {
                        var hint;
                        for (i = 0; i < typed.types.length; i++) {
                            entry = typed.types[i];
                            if (entry.name.toLowerCase() == name.toLowerCase()) {
                                hint = entry.name;
                                break;
                            }
                        }

                        throw new Error('Unknown type "' + name + '"' +
                            (hint ? ('. Did you mean "' + hint + '"?') : ''));
                    }
                    return test;
                }

                /**
                 * Retrieve the function name from a set of functions, and check
                 * whether the name of all functions match (if given)
                 * @param {Array.<function>} fns
                 */
                function getName(fns) {
                    var name = '';

                    for (var i = 0; i < fns.length; i++) {
                        var fn = fns[i];

                        // merge function name when this is a typed function
                        if (fn.signatures && fn.name != '') {
                            if (name == '') {
                                name = fn.name;
                            } else if (name != fn.name) {
                                var err = new Error('Function names do not match (expected: ' + name + ', actual: ' + fn.name + ')');
                                err.data = {
                                    actual: fn.name,
                                    expected: name
                                };
                                throw err;
                            }
                        }
                    }

                    return name;
                }

                /**
                 * Create an ArgumentsError. Creates messages like:
                 *
                 *   Unexpected type of argument (expected: ..., actual: ..., index: ...)
                 *   Too few arguments (expected: ..., index: ...)
                 *   Too many arguments (expected: ..., actual: ...)
                 *
                 * @param {String} fn         Function name
                 * @param {number} argCount   Number of arguments
                 * @param {Number} index      Current argument index
                 * @param {*} actual          Current argument
                 * @param {string} [expected] An optional, comma separated string with
                 *                            expected types on given index
                 * @extends Error
                 */
                function createError(fn, argCount, index, actual, expected) {
                    var actualType = getTypeOf(actual);
                    var _expected = expected ? expected.split(',') : null;
                    var _fn = (fn || 'unnamed');
                    var anyType = _expected && contains(_expected, 'any');
                    var message;
                    var data = {
                        fn: fn,
                        index: index,
                        actual: actual,
                        expected: _expected
                    };

                    if (_expected) {
                        if (argCount > index && !anyType) {
                            // unexpected type
                            message = 'Unexpected type of argument in function ' + _fn +
                                ' (expected: ' + _expected.join(' or ') + ', actual: ' + actualType + ', index: ' + index + ')';
                        } else {
                            // too few arguments
                            message = 'Too few arguments in function ' + _fn +
                                ' (expected: ' + _expected.join(' or ') + ', index: ' + index + ')';
                        }
                    } else {
                        // too many arguments
                        message = 'Too many arguments in function ' + _fn +
                            ' (expected: ' + index + ', actual: ' + argCount + ')'
                    }

                    var err = new TypeError(message);
                    err.data = data;
                    return err;
                }

                /**
                 * Collection with function references (local shortcuts to functions)
                 * @constructor
                 * @param {string} [name='refs']  Optional name for the refs, used to generate
                 *                                JavaScript code
                 */
                function Refs(name) {
                    this.name = name || 'refs';
                    this.categories = {};
                }

                /**
                 * Add a function reference.
                 * @param {Function} fn
                 * @param {string} [category='fn']    A function category, like 'fn' or 'signature'
                 * @returns {string} Returns the function name, for example 'fn0' or 'signature2'
                 */
                Refs.prototype.add = function(fn, category) {
                    var cat = category || 'fn';
                    if (!this.categories[cat]) this.categories[cat] = [];

                    var index = this.categories[cat].indexOf(fn);
                    if (index == -1) {
                        index = this.categories[cat].length;
                        this.categories[cat].push(fn);
                    }

                    return cat + index;
                };

                /**
                 * Create code lines for all function references
                 * @returns {string} Returns the code containing all function references
                 */
                Refs.prototype.toCode = function() {
                    var code = [];
                    var path = this.name + '.categories';
                    var categories = this.categories;

                    for (var cat in categories) {
                        if (categories.hasOwnProperty(cat)) {
                            var category = categories[cat];

                            for (var i = 0; i < category.length; i++) {
                                code.push('var ' + cat + i + ' = ' + path + '[\'' + cat + '\'][' + i + '];');
                            }
                        }
                    }

                    return code.join('\n');
                };

                /**
                 * A function parameter
                 * @param {string | string[] | Param} types    A parameter type like 'string',
                 *                                             'number | boolean'
                 * @param {boolean} [varArgs=false]            Variable arguments if true
                 * @constructor
                 */
                function Param(types, varArgs) {
                    // parse the types, can be a string with types separated by pipe characters |
                    if (typeof types === 'string') {
                        // parse variable arguments operator (ellipses '...number')
                        var _types = types.trim();
                        var _varArgs = _types.substr(0, 3) === '...';
                        if (_varArgs) {
                            _types = _types.substr(3);
                        }
                        if (_types === '') {
                            this.types = ['any'];
                        } else {
                            this.types = _types.split('|');
                            for (var i = 0; i < this.types.length; i++) {
                                this.types[i] = this.types[i].trim();
                            }
                        }
                    } else if (Array.isArray(types)) {
                        this.types = types;
                    } else if (types instanceof Param) {
                        return types.clone();
                    } else {
                        throw new Error('String or Array expected');
                    }

                    // can hold a type to which to convert when handling this parameter
                    this.conversions = [];
                    // TODO: implement better API for conversions, be able to add conversions via constructor (support a new type Object?)

                    // variable arguments
                    this.varArgs = _varArgs || varArgs || false;

                    // check for any type arguments
                    this.anyType = this.types.indexOf('any') !== -1;
                }

                /**
                 * Order Params
                 * any type ('any') will be ordered last, and object as second last (as other
                 * types may be an object as well, like Array).
                 *
                 * @param {Param} a
                 * @param {Param} b
                 * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
                 */
                Param.compare = function(a, b) {
                    // TODO: simplify parameter comparison, it's a mess
                    if (a.anyType) return 1;
                    if (b.anyType) return -1;

                    if (contains(a.types, 'Object')) return 1;
                    if (contains(b.types, 'Object')) return -1;

                    if (a.hasConversions()) {
                        if (b.hasConversions()) {
                            var i, ac, bc;

                            for (i = 0; i < a.conversions.length; i++) {
                                if (a.conversions[i] !== undefined) {
                                    ac = a.conversions[i];
                                    break;
                                }
                            }

                            for (i = 0; i < b.conversions.length; i++) {
                                if (b.conversions[i] !== undefined) {
                                    bc = b.conversions[i];
                                    break;
                                }
                            }

                            return typed.conversions.indexOf(ac) - typed.conversions.indexOf(bc);
                        } else {
                            return 1;
                        }
                    } else {
                        if (b.hasConversions()) {
                            return -1;
                        } else {
                            // both params have no conversions
                            var ai, bi;

                            for (i = 0; i < typed.types.length; i++) {
                                if (typed.types[i].name === a.types[0]) {
                                    ai = i;
                                    break;
                                }
                            }

                            for (i = 0; i < typed.types.length; i++) {
                                if (typed.types[i].name === b.types[0]) {
                                    bi = i;
                                    break;
                                }
                            }

                            return ai - bi;
                        }
                    }
                };

                /**
                 * Test whether this parameters types overlap an other parameters types.
                 * @param {Param} other
                 * @return {boolean} Returns true when there are conflicting types
                 */
                Param.prototype.overlapping = function(other) {
                    for (var i = 0; i < this.types.length; i++) {
                        if (contains(other.types, this.types[i])) {
                            return true;
                        }
                    }
                    return false;
                };

                /**
                 * Create a clone of this param
                 * @returns {Param} Returns a cloned version of this param
                 */
                Param.prototype.clone = function() {
                    var param = new Param(this.types.slice(), this.varArgs);
                    param.conversions = this.conversions.slice();
                    return param;
                };

                /**
                 * Test whether this parameter contains conversions
                 * @returns {boolean} Returns true if the parameter contains one or
                 *                    multiple conversions.
                 */
                Param.prototype.hasConversions = function() {
                    return this.conversions.length > 0;
                };

                /**
                 * Tests whether this parameters contains any of the provided types
                 * @param {Object} types  A Map with types, like {'number': true}
                 * @returns {boolean}     Returns true when the parameter contains any
                 *                        of the provided types
                 */
                Param.prototype.contains = function(types) {
                    for (var i = 0; i < this.types.length; i++) {
                        if (types[this.types[i]]) {
                            return true;
                        }
                    }
                    return false;
                };

                /**
                 * Return a string representation of this params types, like 'string' or
                 * 'number | boolean' or '...number'
                 * @param {boolean} [toConversion]   If true, the returned types string
                 *                                   contains the types where the parameter
                 *                                   will convert to. If false (default)
                 *                                   the "from" types are returned
                 * @returns {string}
                 */
                Param.prototype.toString = function(toConversion) {
                    var types = [];
                    var keys = {};

                    for (var i = 0; i < this.types.length; i++) {
                        var conversion = this.conversions[i];
                        var type = toConversion && conversion ? conversion.to : this.types[i];
                        if (!(type in keys)) {
                            keys[type] = true;
                            types.push(type);
                        }
                    }

                    return (this.varArgs ? '...' : '') + types.join('|');
                };

                /**
                 * A function signature
                 * @param {string | string[] | Param[]} params
                 *                         Array with the type(s) of each parameter,
                 *                         or a comma separated string with types
                 * @param {Function} fn    The actual function
                 * @constructor
                 */
                function Signature(params, fn) {
                    var _params;
                    if (typeof params === 'string') {
                        _params = (params !== '') ? params.split(',') : [];
                    } else if (Array.isArray(params)) {
                        _params = params;
                    } else {
                        throw new Error('string or Array expected');
                    }

                    this.params = new Array(_params.length);
                    for (var i = 0; i < _params.length; i++) {
                        var param = new Param(_params[i]);
                        this.params[i] = param;
                        if (i === _params.length - 1) {
                            // the last argument
                            this.varArgs = param.varArgs;
                        } else {
                            // non-last argument
                            if (param.varArgs) {
                                throw new SyntaxError('Unexpected variable arguments operator "..."');
                            }
                        }
                    }

                    this.fn = fn;
                }

                /**
                 * Create a clone of this signature
                 * @returns {Signature} Returns a cloned version of this signature
                 */
                Signature.prototype.clone = function() {
                    return new Signature(this.params.slice(), this.fn);
                };

                /**
                 * Expand a signature: split params with union types in separate signatures
                 * For example split a Signature "string | number" into two signatures.
                 * @return {Signature[]} Returns an array with signatures (at least one)
                 */
                Signature.prototype.expand = function() {
                    var signatures = [];

                    function recurse(signature, path) {
                        if (path.length < signature.params.length) {
                            var i, newParam, conversion;

                            var param = signature.params[path.length];
                            if (param.varArgs) {
                                // a variable argument. do not split the types in the parameter
                                newParam = param.clone();

                                // add conversions to the parameter
                                // recurse for all conversions
                                for (i = 0; i < typed.conversions.length; i++) {
                                    conversion = typed.conversions[i];
                                    if (!contains(param.types, conversion.from) && contains(param.types, conversion.to)) {
                                        var j = newParam.types.length;
                                        newParam.types[j] = conversion.from;
                                        newParam.conversions[j] = conversion;
                                    }
                                }

                                recurse(signature, path.concat(newParam));
                            } else {
                                // split each type in the parameter
                                for (i = 0; i < param.types.length; i++) {
                                    recurse(signature, path.concat(new Param(param.types[i])));
                                }

                                // recurse for all conversions
                                for (i = 0; i < typed.conversions.length; i++) {
                                    conversion = typed.conversions[i];
                                    if (!contains(param.types, conversion.from) && contains(param.types, conversion.to)) {
                                        newParam = new Param(conversion.from);
                                        newParam.conversions[0] = conversion;
                                        recurse(signature, path.concat(newParam));
                                    }
                                }
                            }
                        } else {
                            signatures.push(new Signature(path, signature.fn));
                        }
                    }

                    recurse(this, []);

                    return signatures;
                };

                /**
                 * Compare two signatures.
                 *
                 * When two params are equal and contain conversions, they will be sorted
                 * by lowest index of the first conversions.
                 *
                 * @param {Signature} a
                 * @param {Signature} b
                 * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
                 */
                Signature.compare = function(a, b) {
                    if (a.params.length > b.params.length) return 1;
                    if (a.params.length < b.params.length) return -1;

                    // count the number of conversions
                    var i;
                    var len = a.params.length; // a and b have equal amount of params
                    var ac = 0;
                    var bc = 0;
                    for (i = 0; i < len; i++) {
                        if (a.params[i].hasConversions()) ac++;
                        if (b.params[i].hasConversions()) bc++;
                    }

                    if (ac > bc) return 1;
                    if (ac < bc) return -1;

                    // compare the order per parameter
                    for (i = 0; i < a.params.length; i++) {
                        var cmp = Param.compare(a.params[i], b.params[i]);
                        if (cmp !== 0) {
                            return cmp;
                        }
                    }

                    return 0;
                };

                /**
                 * Test whether any of the signatures parameters has conversions
                 * @return {boolean} Returns true when any of the parameters contains
                 *                   conversions.
                 */
                Signature.prototype.hasConversions = function() {
                    for (var i = 0; i < this.params.length; i++) {
                        if (this.params[i].hasConversions()) {
                            return true;
                        }
                    }
                    return false;
                };

                /**
                 * Test whether this signature should be ignored.
                 * Checks whether any of the parameters contains a type listed in
                 * typed.ignore
                 * @return {boolean} Returns true when the signature should be ignored
                 */
                Signature.prototype.ignore = function() {
                    // create a map with ignored types
                    var types = {};
                    for (var i = 0; i < typed.ignore.length; i++) {
                        types[typed.ignore[i]] = true;
                    }

                    // test whether any of the parameters contains this type
                    for (i = 0; i < this.params.length; i++) {
                        if (this.params[i].contains(types)) {
                            return true;
                        }
                    }

                    return false;
                };

                /**
                 * Generate the code to invoke this signature
                 * @param {Refs} refs
                 * @param {string} prefix
                 * @returns {string} Returns code
                 */
                Signature.prototype.toCode = function(refs, prefix) {
                    var code = [];

                    var args = new Array(this.params.length);
                    for (var i = 0; i < this.params.length; i++) {
                        var param = this.params[i];
                        var conversion = param.conversions[0];
                        if (param.varArgs) {
                            args[i] = 'varArgs';
                        } else if (conversion) {
                            args[i] = refs.add(conversion.convert, 'convert') + '(arg' + i + ')';
                        } else {
                            args[i] = 'arg' + i;
                        }
                    }

                    var ref = this.fn ? refs.add(this.fn, 'signature') : undefined;
                    if (ref) {
                        return prefix + 'return ' + ref + '(' + args.join(', ') + '); // signature: ' + this.params.join(', ');
                    }

                    return code.join('\n');
                };

                /**
                 * Return a string representation of the signature
                 * @returns {string}
                 */
                Signature.prototype.toString = function() {
                    return this.params.join(', ');
                };

                /**
                 * A group of signatures with the same parameter on given index
                 * @param {Param[]} path
                 * @param {Signature} [signature]
                 * @param {Node[]} childs
                 * @constructor
                 */
                function Node(path, signature, childs) {
                    this.path = path || [];
                    this.param = path[path.length - 1] || null;
                    this.signature = signature || null;
                    this.childs = childs || [];
                }

                /**
                 * Generate code for this group of signatures
                 * @param {Refs} refs
                 * @param {string} prefix
                 * @param {Node | undefined} [anyType]  Sibling of this node with any type parameter
                 * @returns {string} Returns the code as string
                 */
                Node.prototype.toCode = function(refs, prefix, anyType) {
                    // TODO: split this function in multiple functions, it's too large
                    var code = [];

                    if (this.param) {
                        var index = this.path.length - 1;
                        var conversion = this.param.conversions[0];
                        var comment = '// type: ' + (conversion ?
                            (conversion.from + ' (convert to ' + conversion.to + ')') :
                            this.param);

                        // non-root node (path is non-empty)
                        if (this.param.varArgs) {
                            if (this.param.anyType) {
                                // variable arguments with any type
                                code.push(prefix + 'if (arguments.length > ' + index + ') {');
                                code.push(prefix + '  var varArgs = [];');
                                code.push(prefix + '  for (var i = ' + index + '; i < arguments.length; i++) {');
                                code.push(prefix + '    varArgs.push(arguments[i]);');
                                code.push(prefix + '  }');
                                code.push(this.signature.toCode(refs, prefix + '  '));
                                code.push(prefix + '}');
                            } else {
                                // variable arguments with a fixed type
                                var getTests = function(types, arg) {
                                    var tests = [];
                                    for (var i = 0; i < types.length; i++) {
                                        tests[i] = refs.add(getTypeTest(types[i]), 'test') + '(' + arg + ')';
                                    }
                                    return tests.join(' || ');
                                }.bind(this);

                                var allTypes = this.param.types;
                                var exactTypes = [];
                                for (var i = 0; i < allTypes.length; i++) {
                                    if (this.param.conversions[i] === undefined) {
                                        exactTypes.push(allTypes[i]);
                                    }
                                }

                                code.push(prefix + 'if (' + getTests(allTypes, 'arg' + index) + ') { ' + comment);
                                code.push(prefix + '  var varArgs = [arg' + index + '];');
                                code.push(prefix + '  for (var i = ' + (index + 1) + '; i < arguments.length; i++) {');
                                code.push(prefix + '    if (' + getTests(exactTypes, 'arguments[i]') + ') {');
                                code.push(prefix + '      varArgs.push(arguments[i]);');

                                for (var i = 0; i < allTypes.length; i++) {
                                    var conversion_i = this.param.conversions[i];
                                    if (conversion_i) {
                                        var test = refs.add(getTypeTest(allTypes[i]), 'test');
                                        var convert = refs.add(conversion_i.convert, 'convert');
                                        code.push(prefix + '    }');
                                        code.push(prefix + '    else if (' + test + '(arguments[i])) {');
                                        code.push(prefix + '      varArgs.push(' + convert + '(arguments[i]));');
                                    }
                                }
                                code.push(prefix + '    } else {');
                                code.push(prefix + '      throw createError(name, arguments.length, i, arguments[i], \'' + exactTypes.join(',') + '\');');
                                code.push(prefix + '    }');
                                code.push(prefix + '  }');
                                code.push(this.signature.toCode(refs, prefix + '  '));
                                code.push(prefix + '}');
                            }
                        } else {
                            if (this.param.anyType) {
                                // any type
                                code.push(prefix + '// type: any');
                                code.push(this._innerCode(refs, prefix, anyType));
                            } else {
                                // regular type
                                var type = this.param.types[0];
                                var test = type !== 'any' ? refs.add(getTypeTest(type), 'test') : null;

                                code.push(prefix + 'if (' + test + '(arg' + index + ')) { ' + comment);
                                code.push(this._innerCode(refs, prefix + '  ', anyType));
                                code.push(prefix + '}');
                            }
                        }
                    } else {
                        // root node (path is empty)
                        code.push(this._innerCode(refs, prefix, anyType));
                    }

                    return code.join('\n');
                };

                /**
                 * Generate inner code for this group of signatures.
                 * This is a helper function of Node.prototype.toCode
                 * @param {Refs} refs
                 * @param {string} prefix
                 * @param {Node | undefined} [anyType]  Sibling of this node with any type parameter
                 * @returns {string} Returns the inner code as string
                 * @private
                 */
                Node.prototype._innerCode = function(refs, prefix, anyType) {
                    var code = [];
                    var i;

                    if (this.signature) {
                        code.push(prefix + 'if (arguments.length === ' + this.path.length + ') {');
                        code.push(this.signature.toCode(refs, prefix + '  '));
                        code.push(prefix + '}');
                    }

                    var nextAnyType;
                    for (i = 0; i < this.childs.length; i++) {
                        if (this.childs[i].param.anyType) {
                            nextAnyType = this.childs[i];
                            break;
                        }
                    }

                    for (i = 0; i < this.childs.length; i++) {
                        code.push(this.childs[i].toCode(refs, prefix, nextAnyType));
                    }

                    if (anyType && !this.param.anyType) {
                        code.push(anyType.toCode(refs, prefix, nextAnyType));
                    }

                    var exceptions = this._exceptions(refs, prefix);
                    if (exceptions) {
                        code.push(exceptions);
                    }

                    return code.join('\n');
                };

                /**
                 * Generate code to throw exceptions
                 * @param {Refs} refs
                 * @param {string} prefix
                 * @returns {string} Returns the inner code as string
                 * @private
                 */
                Node.prototype._exceptions = function(refs, prefix) {
                    var index = this.path.length;

                    if (this.childs.length === 0) {
                        // TODO: can this condition be simplified? (we have a fall-through here)
                        return [
                            prefix + 'if (arguments.length > ' + index + ') {',
                            prefix + '  throw createError(name, arguments.length, ' + index + ', arguments[' + index + ']);',
                            prefix + '}'
                        ].join('\n');
                    } else {
                        var keys = {};
                        var types = [];

                        for (var i = 0; i < this.childs.length; i++) {
                            var node = this.childs[i];
                            if (node.param) {
                                for (var j = 0; j < node.param.types.length; j++) {
                                    var type = node.param.types[j];
                                    if (!(type in keys) && !node.param.conversions[j]) {
                                        keys[type] = true;
                                        types.push(type);
                                    }
                                }
                            }
                        }

                        return prefix + 'throw createError(name, arguments.length, ' + index + ', arguments[' + index + '], \'' + types.join(',') + '\');';
                    }
                };

                /**
                 * Split all raw signatures into an array with expanded Signatures
                 * @param {Object.<string, Function>} rawSignatures
                 * @return {Signature[]} Returns an array with expanded signatures
                 */
                function parseSignatures(rawSignatures) {
                    // FIXME: need to have deterministic ordering of signatures, do not create via object
                    var signature;
                    var keys = {};
                    var signatures = [];
                    var i;

                    for (var types in rawSignatures) {
                        if (rawSignatures.hasOwnProperty(types)) {
                            var fn = rawSignatures[types];
                            signature = new Signature(types, fn);

                            if (signature.ignore()) {
                                continue;
                            }

                            var expanded = signature.expand();

                            for (i = 0; i < expanded.length; i++) {
                                var signature_i = expanded[i];
                                var key = signature_i.toString();
                                var existing = keys[key];
                                if (!existing) {
                                    keys[key] = signature_i;
                                } else {
                                    var cmp = Signature.compare(signature_i, existing);
                                    if (cmp < 0) {
                                        // override if sorted first
                                        keys[key] = signature_i;
                                    } else if (cmp === 0) {
                                        throw new Error('Signature "' + key + '" is defined twice');
                                    }
                                    // else: just ignore
                                }
                            }
                        }
                    }

                    // convert from map to array
                    for (key in keys) {
                        if (keys.hasOwnProperty(key)) {
                            signatures.push(keys[key]);
                        }
                    }

                    // order the signatures
                    signatures.sort(function(a, b) {
                        return Signature.compare(a, b);
                    });

                    // filter redundant conversions from signatures with varArgs
                    // TODO: simplify this loop or move it to a separate function
                    for (i = 0; i < signatures.length; i++) {
                        signature = signatures[i];

                        if (signature.varArgs) {
                            var index = signature.params.length - 1;
                            var param = signature.params[index];

                            var t = 0;
                            while (t < param.types.length) {
                                if (param.conversions[t]) {
                                    var type = param.types[t];

                                    for (var j = 0; j < signatures.length; j++) {
                                        var other = signatures[j];
                                        var p = other.params[index];

                                        if (other !== signature &&
                                            p &&
                                            contains(p.types, type) && !p.conversions[index]) {
                                            // this (conversion) type already exists, remove it
                                            param.types.splice(t, 1);
                                            param.conversions.splice(t, 1);
                                            t--;
                                            break;
                                        }
                                    }
                                }
                                t++;
                            }
                        }
                    }

                    return signatures;
                }

                /**
                 * create a map with normalized signatures as key and the function as value
                 * @param {Signature[]} signatures   An array with split signatures
                 * @return {Object.<string, Function>} Returns a map with normalized
                 *                                     signatures as key, and the function
                 *                                     as value.
                 */
                function mapSignatures(signatures) {
                    var normalized = {};

                    for (var i = 0; i < signatures.length; i++) {
                        var signature = signatures[i];
                        if (signature.fn && !signature.hasConversions()) {
                            var params = signature.params.join(',');
                            normalized[params] = signature.fn;
                        }
                    }

                    return normalized;
                }

                /**
                 * Parse signatures recursively in a node tree.
                 * @param {Signature[]} signatures  Array with expanded signatures
                 * @param {Param[]} path            Traversed path of parameter types
                 * @return {Node}                   Returns a node tree
                 */
                function parseTree(signatures, path) {
                    var i, signature;
                    var index = path.length;
                    var nodeSignature;

                    var filtered = [];
                    for (i = 0; i < signatures.length; i++) {
                        signature = signatures[i];

                        // filter the first signature with the correct number of params
                        if (signature.params.length === index && !nodeSignature) {
                            nodeSignature = signature;
                        }

                        if (signature.params[index] != undefined) {
                            filtered.push(signature);
                        }
                    }

                    // sort the filtered signatures by param
                    filtered.sort(function(a, b) {
                        return Param.compare(a.params[index], b.params[index]);
                    });

                    // recurse over the signatures
                    var entries = [];
                    for (i = 0; i < filtered.length; i++) {
                        signature = filtered[i];
                        // group signatures with the same param at current index
                        var param = signature.params[index];

                        // TODO: replace the next filter loop
                        var existing = entries.filter(function(entry) {
                            return entry.param.overlapping(param);
                        })[0];

                        //var existing;
                        //for (var j = 0; j < entries.length; j++) {
                        //  if (entries[j].param.overlapping(param)) {
                        //    existing = entries[j];
                        //    break;
                        //  }
                        //}

                        if (existing) {
                            if (existing.param.varArgs) {
                                throw new Error('Conflicting types "' + existing.param + '" and "' + param + '"');
                            }
                            existing.signatures.push(signature);
                        } else {
                            entries.push({
                                param: param,
                                signatures: [signature]
                            });
                        }
                    }

                    // parse the childs
                    var childs = new Array(entries.length);
                    for (i = 0; i < entries.length; i++) {
                        var entry = entries[i];
                        childs[i] = parseTree(entry.signatures, path.concat(entry.param))
                    }

                    return new Node(path, nodeSignature, childs);
                }

                /**
                 * Generate an array like ['arg0', 'arg1', 'arg2']
                 * @param {number} count Number of arguments to generate
                 * @returns {Array} Returns an array with argument names
                 */
                function getArgs(count) {
                    // create an array with all argument names
                    var args = [];
                    for (var i = 0; i < count; i++) {
                        args[i] = 'arg' + i;
                    }

                    return args;
                }

                /**
                 * Compose a function from sub-functions each handling a single type signature.
                 * Signatures:
                 *   typed(signature: string, fn: function)
                 *   typed(name: string, signature: string, fn: function)
                 *   typed(signatures: Object.<string, function>)
                 *   typed(name: string, signatures: Object.<string, function>)
                 *
                 * @param {string | null} name
                 * @param {Object.<string, Function>} signatures
                 * @return {Function} Returns the typed function
                 * @private
                 */
                function _typed(name, signatures) {
                    var refs = new Refs();

                    // parse signatures, expand them
                    var _signatures = parseSignatures(signatures);
                    if (_signatures.length == 0) {
                        throw new Error('No signatures provided');
                    }

                    // parse signatures into a node tree
                    var node = parseTree(_signatures, []);

                    //var util = require('util');
                    //console.log('ROOT');
                    //console.log(util.inspect(node, { depth: null }));

                    // generate code for the typed function
                    var code = [];
                    var _name = name || '';
                    var _args = getArgs(maxParams(_signatures));
                    code.push('function ' + _name + '(' + _args.join(', ') + ') {');
                    code.push('  "use strict";');
                    code.push('  var name = \'' + _name + '\';');
                    code.push(node.toCode(refs, '  '));
                    code.push('}');

                    // generate body for the factory function
                    var body = [
                        refs.toCode(),
                        'return ' + code.join('\n')
                    ].join('\n');

                    // evaluate the JavaScript code and attach function references
                    var factory = (new Function(refs.name, 'createError', body));
                    var fn = factory(refs, createError);

                    //console.log('FN\n' + fn.toString()); // TODO: cleanup

                    // attach the signatures with sub-functions to the constructed function
                    fn.signatures = mapSignatures(_signatures);

                    return fn;
                }

                /**
                 * Calculate the maximum number of parameters in givens signatures
                 * @param {Signature[]} signatures
                 * @returns {number} The maximum number of parameters
                 */
                function maxParams(signatures) {
                    var max = 0;

                    for (var i = 0; i < signatures.length; i++) {
                        var len = signatures[i].params.length;
                        if (len > max) {
                            max = len;
                        }
                    }

                    return max;
                }

                /**
                 * Get the type of a value
                 * @param {*} x
                 * @returns {string} Returns a string with the type of value
                 */
                function getTypeOf(x) {
                    var obj;

                    for (var i = 0; i < typed.types.length; i++) {
                        var entry = typed.types[i];

                        if (entry.name === 'Object') {
                            // Array and Date are also Object, so test for Object afterwards
                            obj = entry;
                        } else {
                            if (entry.test(x)) return entry.name;
                        }
                    }

                    // at last, test whether an object
                    if (obj && obj.test(x)) return obj.name;

                    return 'unknown';
                }

                /**
                 * Test whether an array contains some entry
                 * @param {Array} array
                 * @param {*} entry
                 * @return {boolean} Returns true if array contains entry, false if not.
                 */
                function contains(array, entry) {
                    return array.indexOf(entry) !== -1;
                }

                // data type tests
                var types = [{
                        name: 'number',
                        test: function(x) {
                            return typeof x === 'number'
                        }
                    },
                    {
                        name: 'string',
                        test: function(x) {
                            return typeof x === 'string'
                        }
                    },
                    {
                        name: 'boolean',
                        test: function(x) {
                            return typeof x === 'boolean'
                        }
                    },
                    {
                        name: 'Function',
                        test: function(x) {
                            return typeof x === 'function'
                        }
                    },
                    {
                        name: 'Array',
                        test: Array.isArray
                    },
                    {
                        name: 'Date',
                        test: function(x) {
                            return x instanceof Date
                        }
                    },
                    {
                        name: 'RegExp',
                        test: function(x) {
                            return x instanceof RegExp
                        }
                    },
                    {
                        name: 'Object',
                        test: function(x) {
                            return typeof x === 'object'
                        }
                    },
                    {
                        name: 'null',
                        test: function(x) {
                            return x === null
                        }
                    },
                    {
                        name: 'undefined',
                        test: function(x) {
                            return x === undefined
                        }
                    }
                ];

                // configuration
                var config = {};

                // type conversions. Order is important
                var conversions = [];

                // types to be ignored
                var ignore = [];

                // temporary object for holding types and conversions, for constructing
                // the `typed` function itself
                // TODO: find a more elegant solution for this
                var typed = {
                    config: config,
                    types: types,
                    conversions: conversions,
                    ignore: ignore
                };

                /**
                 * Construct the typed function itself with various signatures
                 *
                 * Signatures:
                 *
                 *   typed(signatures: Object.<string, function>)
                 *   typed(name: string, signatures: Object.<string, function>)
                 */
                typed = _typed('typed', {
                    'Object': function(signatures) {
                        var fns = [];
                        for (var signature in signatures) {
                            if (signatures.hasOwnProperty(signature)) {
                                fns.push(signatures[signature]);
                            }
                        }
                        var name = getName(fns);

                        return _typed(name, signatures);
                    },
                    'string, Object': _typed,
                    // TODO: add a signature 'Array.<function>'
                    '...Function': function(fns) {
                        var err;
                        var name = getName(fns);
                        var signatures = {};

                        for (var i = 0; i < fns.length; i++) {
                            var fn = fns[i];

                            // test whether this is a typed-function
                            if (!(typeof fn.signatures === 'object')) {
                                err = new TypeError('Function is no typed-function (index: ' + i + ')');
                                err.data = {
                                    index: i
                                };
                                throw err;
                            }

                            // merge the signatures
                            for (var signature in fn.signatures) {
                                if (fn.signatures.hasOwnProperty(signature)) {
                                    if (signatures.hasOwnProperty(signature)) {
                                        if (fn.signatures[signature] !== signatures[signature]) {
                                            err = new Error('Signature "' + signature + '" is defined twice');
                                            err.data = {
                                                signature: signature
                                            };
                                            throw err;
                                        }
                                        // else: both signatures point to the same function, that's fine
                                    } else {
                                        signatures[signature] = fn.signatures[signature];
                                    }
                                }
                            }
                        }

                        return _typed(name, signatures);
                    }
                });

                /**
                 * Find a specific signature from a (composed) typed function, for
                 * example:
                 *
                 *   typed.find(fn, ['number', 'string'])
                 *   typed.find(fn, 'number, string')
                 *
                 * Function find only only works for exact matches.
                 *
                 * @param {Function} fn                   A typed-function
                 * @param {string | string[]} signature   Signature to be found, can be
                 *                                        an array or a comma separated string.
                 * @return {Function}                     Returns the matching signature, or
                 *                                        throws an errror when no signature
                 *                                        is found.
                 */
                function find(fn, signature) {
                    if (!fn.signatures) {
                        throw new TypeError('Function is no typed-function');
                    }

                    // normalize input
                    var arr;
                    if (typeof signature === 'string') {
                        arr = signature.split(',');
                        for (var i = 0; i < arr.length; i++) {
                            arr[i] = arr[i].trim();
                        }
                    } else if (Array.isArray(signature)) {
                        arr = signature;
                    } else {
                        throw new TypeError('String array or a comma separated string expected');
                    }

                    var str = arr.join(',');

                    // find an exact match
                    var match = fn.signatures[str];
                    if (match) {
                        return match;
                    }

                    // TODO: extend find to match non-exact signatures

                    throw new TypeError('Signature not found (signature: ' + (fn.name || 'unnamed') + '(' + arr.join(', ') + '))');
                }

                /**
                 * Convert a given value to another data type.
                 * @param {*} value
                 * @param {string} type
                 */
                function convert(value, type) {
                    var from = getTypeOf(value);

                    // check conversion is needed
                    if (type === from) {
                        return value;
                    }

                    for (var i = 0; i < typed.conversions.length; i++) {
                        var conversion = typed.conversions[i];
                        if (conversion.from === from && conversion.to === type) {
                            return conversion.convert(value);
                        }
                    }

                    throw new Error('Cannot convert from ' + from + ' to ' + type);
                }

                // attach types and conversions to the final `typed` function
                typed.config = config;
                typed.types = types;
                typed.conversions = conversions;
                typed.ignore = ignore;
                typed.create = create;
                typed.find = find;
                typed.convert = convert;

                // add a type
                typed.addType = function(type) {
                    if (!type || typeof type.name !== 'string' || typeof type.test !== 'function') {
                        throw new TypeError('Object with properties {name: string, test: function} expected');
                    }

                    typed.types.push(type);
                };

                // add a conversion
                typed.addConversion = function(conversion) {
                    if (!conversion ||
                        typeof conversion.from !== 'string' ||
                        typeof conversion.to !== 'string' ||
                        typeof conversion.convert !== 'function') {
                        throw new TypeError('Object with properties {from: string, to: string, convert: function} expected');
                    }

                    typed.conversions.push(conversion);
                };

                return typed;
            }

            return create();
        }));

    }, {}]
}, {}, [1]);

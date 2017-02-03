module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        mochaTest: {
            test: {
                options: {
                    //reporter:'list',
                    //reporter:'dot',
                    reporter: 'min',
                    captureFile: 'results.txt',
                    quiet: true,
                    clearRequireCache: true
                },
                src: ['server/firepick/*.js']
                //src: ['server/firepick/XYZCamera.js','server/firepick/FPD.js']
                //src: ['server/firepick/Focus.js']
            }
        },
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: 'www/js/services.js',
                dest: 'target/services.min.js'
            }
        },
        watch: {
            scripts: {
                files: ['server/firepick/*.js'],
                tasks: ['mochaTest'],
                options: {
                    spawn: true,
                },
            },
        },
        jshint: {
            all: ['Gruntfile.js', '**/*.js']
        },
        jsbeautifier: {
            files: ["Gruntfile.js", "js/**/*.js", "www/js/**/*.js"],
            options: {
                wrap_line_length: 50,
                keep_array_indentation: true
            }
        }
    });

    //grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-jsbeautifier');
    grunt.loadNpmTasks('grunt-npm-install');

    // Default task(s).
    grunt.registerTask('default', ['uglify']);
    grunt.registerTask('test', ['mochaTest']);

    var customizeJSON = function(original, custom) {
        for (var key in custom) {
            if (custom.hasOwnProperty(key)) {
                if (original.hasOwnProperty(key)) {
                    var customValue = custom[key];
                    var originalValue = original[key];
                    if (typeof customValue === "object" && typeof originalValue == "object") {
                        customizeJSON(originalValue, customValue);
                    } else {
                        original[key] = custom[key];
                    }
                } else {
                    original[key] = custom[key];
                }
            }
        }
    };

    var customizeJSONFile = function(original, customFile) {
        if (typeof customFile !== "undefined") {
            var custom = grunt.file.readJSON(customFile);
            customizeJSON(original, custom);
        }
    };

    grunt.registerTask('cfg-custom', 'Customize firenodejs JSON config file',
        function(config, custom1, custom2, custom3, custom4, custom5, customEnd) {
            if (typeof config === "undefined") {
                throw grunt.util.error(this.name + " expected path of firenodejs configuration file");
            }
            if (typeof custom1 === "undefined") {
                throw grunt.util.error(this.name + " expected path of firenodejs custom configuration file(s)");
            }
            if (typeof customEnd !== "undefined") {
                throw grunt.util.error(this.name + " too many customization filess");
            }
            var json = grunt.file.readJSON(config);
            customizeJSONFile(json, custom1);
            customizeJSONFile(json, custom2);
            customizeJSONFile(json, custom3);
            customizeJSONFile(json, custom4);
            customizeJSONFile(json, custom5);
            grunt.file.write(config, JSON.stringify(json, null, "  "));
        }
    );

    grunt.registerTask('cfg-version', 'Add version to given firenodejs JSON config file',
        function(src, dst, major, minor, patch) {
            if (typeof src === "undefined") {
                throw grunt.util.error(this.name + " expected path of source firenodejs configuration file");
            }
            if (typeof dst === "undefined") {
                throw grunt.util.error(this.name + " expected path of destination firenodejs configuration file");
            }
            if (typeof patch === "undefined") {
                throw grunt.util.error(this.name + " expected major, minor and patch version numbers");
            }

            var json = grunt.file.readJSON(src);
            json.firenodejs.version.major = major;
            json.firenodejs.version.minor = minor;
            json.firenodejs.version.patch = patch;
            grunt.file.write(dst, JSON.stringify(json, null, "  "));
            grunt.log.writeln("VERSION\t: " + dst + " v" + major + "." + minor + "." + patch);
        });
};

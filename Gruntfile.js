module.exports = function(grunt) {
    /* jshint node: true */

    require('load-grunt-tasks')(grunt);

    var webpack = require('webpack');

    var pkg = grunt.file.readJSON('package.json');

    grunt.initConfig({
        starttime: new Date(),
        pkg: pkg,

        jshint: {
            all : [
                'src/js/**/*.js',
                'Gruntfile.js'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        uglify : {
            options: {
                // fails with node 0.12.0 and grunt-contrib-uglify 0.4.1
                // https://github.com/gruntjs/grunt-contrib-uglify/issues/302
                // report: 'gzip',
                mangle: true,
                compress: {
                    booleans: true,
                    cascade :true,
                    conditionals: true,
                    dead_code: true,
                    drop_console: true,
                    evaluate: true,
                    if_return: true,
                    join_vars: true,
                    pure_getters: true,
                    sequences: true,
                    unused: true,
                    warnings: false
                }
            },
            player : {
                files: {
                    'bin-release/jwplayer.js': 'bin-debug/jwplayer.js'
                }
            }
        },

        watch : {
            jshint: {
                files: [
                    '.jshintrc',
                    '.jshintignore'
                ],
                tasks: ['jshint']
            },
            player: {
                files : ['src/js/**/*.js', 'src/js/*.js'],
                tasks: ['build-js']
            },
            flash: {
                files : [
                    'src/flash/com/longtailvideo/jwplayer/{,*/}*.as',
                    'src/flash/com/wowsa/{,*/}*.as'
                ],
                tasks: ['flash:debug']
            },
            grunt: {
                files: ['Gruntfile.js'],
                tasks: ['jshint']
            }
        },

        webpack : {
            build : {
                entry: {
                    jwplayer : './src/js/jwplayer.js'
                },
                output: {
                    path: 'bin-debug/',
                    filename: '[name].js'
                },
                resolve: {
                    modulesDirectories: [
                        'src/js/'
                    ],
                    alias: {
                        'underscore': 'utils/underscore'
                    }
                },
                devtool: 'source-map',
                plugins: [
                    new webpack.DefinePlugin({
                        __BUILD_VERSION__: '\'' + pkg.version + '\''
                    })
                ]
            }
        },

        clean: {
            dist: {
                files: [{
                    dot: true,
                    src: [
                        'bin-debug',
                        'bin-release'
                    ]
                }]
            }
        }
    });

    grunt.registerTask('flash', function(target) {
        var done = this.async();

        var flashAirOrFlexSdk = process.env.AIR_HOME || process.env.FLEX_HOME;
        if (!flashAirOrFlexSdk) {
            grunt.fail.warn('To compile ActionScript, you must set environment '+
                'variable $AIR_HOME or $FLEX_HOME for this task to locate mxmlc.');
        }
        var isDebug = target === 'debug';
        var isFlex = /flex/.test(flashAirOrFlexSdk);

        var command = {
            cmd: flashAirOrFlexSdk + '/bin/mxmlc',
            args: [
                'src/flash/com/longtailvideo/jwplayer/player/Player.as',
                '-compiler.source-path=src/flash',
                '-compiler.library-path=' + flashAirOrFlexSdk + '/frameworks/libs',
                '-default-background-color=0x000000',
                '-default-frame-rate=30',
                '-target-player=10.1.0',
                '-use-network=false'
            ]
        };

        // Framework specific optimizations
        if (isFlex) {
            command.args.push(
                '-static-link-runtime-shared-libraries=true'
            );
        } else {
            command.args.push(
               '-compiler.inline=true',
               '-compiler.remove-dead-code=true'
            );
        }

        if (isDebug) {
            command.args.push(
                '-output=bin-debug/jwplayer.flash.swf',
                '-strict=true',
                '-debug=true',
                '-define+=CONFIG::debugging,true'
            );
        } else {
            command.args.push(
                '-output=bin-release/jwplayer.flash.swf',
                '-compiler.optimize=true',
                '-compiler.omit-trace-statements=true',
                '-warnings=false',
                '-define+=CONFIG::debugging,false'
            );
        }

        // Build Version: {major.minor.revision}
        var revision = process.env.BUILD_NUMBER;
        if (revision === undefined) {
            var now = grunt.config('starttime');
            now.setTime(now.getTime()-now.getTimezoneOffset()*60000);
            revision = now.toISOString().replace(/[\.\-:Z]/g, '').replace(/T/g, '');
        }
        var buildVersion = pkg.version.replace(/\.\d*$/, '.' + revision);
        command.args.push(
            '-define+=JWPLAYER::version,\''+ buildVersion +'\''
        );

        grunt.log.writeln(command.cmd +' '+ command.args.join(' ').replace(/(version,'[^']*')/, '"$1"'));

        grunt.util.spawn(command, function(err, result) {
            grunt.log.subhead(result.stdout);
            if (err) {
                grunt.log.error(err.message);
            }
            done(!err);
        });
    });

    grunt.registerTask('build-js', [
        'webpack',
        'uglify'
    ]);

    grunt.registerTask('default', [
        'clean',
        'build-js',
        'flash:debug',
        'flash:release'
    ]);
};

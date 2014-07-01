var tests = Object.keys ( window.__karma__.files).filter(
    function (file) {
        return /\.test\.js$/.test(file);
    }
);
require({
    baseUrl: '/base/',
    paths: {
        'jquery' : 'lib/jquery',
        'underscore' : 'lib/underscore',
        'backbone' : 'lib/backbone',
        'dualStorage' : 'backbone.mobilestorage',
        'q' : 'lib/q'
    },
    shim: {
        underscore: {
            exports: '_'
        },
        jquery: {
            exports: '$'
        },
        backbone: {
            deps: ['underscore', 'jquery' ],
            exports: 'Backbone'
        },
        dualStorage: {
            deps: ['backbone'],
            exports: 'Backbone'
        }
    },
    deps: tests,
    callback: window.__karma__.start
});
document.write('<div id="main"></div>');
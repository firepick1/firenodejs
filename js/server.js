console.log("loading express...");
var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var parser = bodyParser.json();

var fsd = require("./firestep-driver");
var firestep = new fsd.FireStepDriver();
var cam = require("./camera");
var camera = new cam.Camera();

//var kue = require('kue');
//var jobs = kue.createQueue();
//var firepick = require('./fireick/firepick.js');

express.static.mime.define({
    'application/json': ['firestep']
});

app.use(parser);

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

var __appdir = path.join(__dirname, "../www");

var dirs = ['bootstrap', 'html', 'img', 'css', 'js', 'lib', 'partials'];
for (var i = 0; i < dirs.length; i++) {
    var urlpath = '/firerest/' + dirs[i];
    var filepath = path.join(__appdir, dirs[i]);
    app.use(urlpath, express.static(filepath));
    console.log("INFO\t: Mapping urlpath:" + urlpath + " to:" + filepath);
}

app.get('/firerest/index.html', function(req, res) {
    res.sendFile(path.join(__appdir, 'html/index.html'));
});
app.get('/', function(req, res) {
    res.redirect('/firerest/index.html');
});
app.get('/index.html', function(req, res) {
    res.redirect('/firerest/index.html');
});

//////////// REST protocol
app.get('/camera/image.jpg', function(req, res) {
    camera.capture(function(path) {
        console.log('INFO\t: HTTP GET /camera/image.jpg => ' + path);
        res.sendFile(path);
    }, function(error) {
        var no_image = path.join(__appdir, 'img/no-image.jpg');
        console.log('INFO\t: HTTP GET /camera/image.jpg => ' + no_image);
        res.sendFile(no_image);
    });
});
app.get('/camera/model', function(req, res) {
    res.send(camera.model());
});
app.get('/firestep/model', function(req, res) {
    res.send(firestep.model());
});
app.get('/firestep/history', function(req, res) {
    res.send(firestep.history());
});
post_firestep = function(req, res, next) {
    console.log("INFO\t: POST firestep");
    console.log(req.body);
    console.log(JSON.stringify(req.body));
};
app.post("/firestep", parser, post_firestep);

/////////// Startup

var firerest_port;

process.on('uncaughtException', function(error) {
    console.log("ERROR\t: " + error.message);
    throw error;
});

var listener = app.listen(80, function(data) {
    firerest_port = 80;
    console.log('INFO\t: firestep-cam REST service listening on port ' + firerest_port + ' data:' + data);
});
listener.on('error', function(error) {
    if (error.code === "EACCES") {
        console.log("WARN\t: insufficient user privilege for port 80 (trying 8080) ...");
        listener = app.listen(8080, function(data) {
            firerest_port = 8080;
            console.log('INFO\t: firestep-cam REST service listening on port ' + firerest_port);
        });
    } else {
        console.log("ERROR\t: listener:" + JSON.stringify(error));
        throw error;
    }
});

process.on('exit', function(data) {
    console.log("END\t: Exit with code:" + data);
});

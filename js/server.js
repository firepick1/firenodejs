console.log("INFO\t: loading firenodejs...");
var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var parser = bodyParser.json();

var fsd = require("./firestep-driver");
var firestep = new fsd.FireStepDriver();
var Camera = require("./camera").Camera;
var camera = new Camera();
var FireSight = require("./firesight").FireSight;
var firesight = new FireSight();
var Images = require("./images").Images;
var images = new Images(firestep, camera);

//var kue = require('kue');
//var jobs = kue.createQueue();

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
    var urlpath = '/firenodejs/' + dirs[i];
    var filepath = path.join(__appdir, dirs[i]);
    app.use(urlpath, express.static(filepath));
    console.log("INFO\t: firenodejs mapping urlpath:" + urlpath + " to:" + filepath);
}

app.get('/firenodejs/index.html', function(req, res) {
    res.sendFile(path.join(__appdir, 'html/index.html'));
});
app.get('/', function(req, res) {
    res.redirect('/firenodejs/index.html');
});
app.get('/index.html', function(req, res) {
    res.redirect('/firenodejs/index.html');
});

function restCapture(req, res, name) {
    var msStart = millis();
    var no_image = path.join(__appdir, 'img/no-image.jpg');
    camera.capture(function(path) {
        var msElapsed = millis() - msStart;
        console.log('INFO\t: firenodejs HTTP GET ' + req.url + ' => ' + path + ' ' +
            Math.round(msElapsed) + 'ms');
        res.sendFile(path || no_image);
    }, function(error) {
        console.log('INFO\t: firenodejs HTTP GET ' + req.url + ' => ' + error);
        res.status(501).sendFile(no_image);
    }, name);
}

//////////// REST protocol
function millis() {
    var hrt = process.hrtime();
    var ms = hrt[0] * 1000 + hrt[1] / 1000000;
    //console.log('TRACE\t: firenodejs millis() ' + ms);
    return ms;
}
app.get('/camera/image.jpg', function(req, res) {
    restCapture(req, res);
});
app.get('/camera/*/image.jpg', function(req, res) {
    var tokens = req.url.split("/");
    restCapture(req, res, tokens[2]);
});
app.get('/camera/model', function(req, res) {
    res.send(camera.getModel());
});
app.get('/firestep/model', function(req, res) {
    res.send(firestep.getModel());
});
app.get('/firestep/history', function(req, res) {
    res.send(firestep.history());
});
post_firestep = function(req, res, next) {
    console.log("INFO\t: firenodejs POST " + req.url + " " + JSON.stringify(req.body));
    var msStart = millis();
    if (firestep.model.isAvailable) {
        firestep.send(req.body, function(data) {
            res.send(data);
            var msElapsed = millis() - msStart;
            console.log("INFO\t: firenodejs POST " + req.url + " " + Math.round(msElapsed) + 'ms => ' + data);
        });
    } else {
        res.status(501).send({"error":"firestep unavailable"});
    }
};
app.post("/firestep", parser, post_firestep);
app.get('/firesight/model', function(req, res) {
    res.send(firesight.getModel());
});
app.get('/images/location', function(req, res) {
    res.send(images.location());
});

/////////// Startup

var firenodejs_port;

process.on('uncaughtException', function(error) {
    console.log("ERROR\t: firenodejs on(uncaughtException) " + error);
    throw error;
});

var listener = app.listen(80, function(data) {
    firenodejs_port = 80;
    console.log('INFO\t: firenodejs listening on port ' + firenodejs_port + ' data:' + data);
});
listener.on('error', function(error) {
    if (error.code === "EACCES") {
        console.log("WARN\t: firenodejs insufficient user privilege for port 80 (trying 8080) ...");
        listener = app.listen(8080, function(data) {
            firenodejs_port = 8080;
            console.log('INFO\t: firenodejs listening on port ' + firenodejs_port);
        });
    } else {
        console.log("ERROR\t: firenodejs listener:" + JSON.stringify(error));
        throw error;
    }
});

process.on('exit', function(data) {
    console.log("END\t: firenodejs exit with code:" + data);
});

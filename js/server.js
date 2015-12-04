console.log("START\t: loading firenodejs...");
var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var parser = bodyParser.json();
var __appdir = path.join(__dirname, "../www");
var path_no_image = path.join(__appdir, 'img/no-image.jpg');

var fsd = require("./firestep-driver");
var firestep = new fsd.FireStepDriver();
var Camera = require("./camera").Camera;
var camera = new Camera();
var Images = require("./images").Images;
var images = new Images(firestep, camera, {pathNoImage:path_no_image});
var FireSight = require("./firesight").FireSight;
var firesight = new FireSight(images);
var Measure = require("./measure").Measure;
var measure = new Measure(images, firesight);
var firenodejsType = new require("./firenodejs").firenodejs;
var firenodejs = new firenodejsType(images, firesight, measure);

express.static.mime.define({
    'application/json': ['firestep']
});

app.use(parser);

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});


///////////// REST /firenodejs
var dirs = ['bootstrap', 'html', 'img', 'css', 'js', 'lib', 'partials'];
for (var i = 0; i < dirs.length; i++) {
    var urlpath = '/firenodejs/' + dirs[i];
    var filepath = path.join(__appdir, dirs[i]);
    app.use(urlpath, express.static(filepath));
    console.log("HTTP\t: firenodejs mapping urlpath:" + urlpath + " to:" + filepath);
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
app.get('/firenodejs/models', function(req, res) {
    var data = JSON.stringify(firenodejs.syncModels());
    console.log("HTTP:\t: GET " + req.url + " => " + data);
    res.send(data);
});
app.post('/firenodejs/models', function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " " + JSON.stringify(req.body));
    var msStart = millis();
    if (firenodejs.isAvailable()) {
        var models = firenodejs.syncModels(req.body);
        res.send(models);
        var msElapsed = millis() - msStart;
        console.log("HTTP\t: POST " + req.url + " " + Math.round(msElapsed) + 'ms => ' + JSON.stringify(models));
    } else {
        var msElapsed = millis() - msStart;
        console.log("HTTP\t: POST " + req.url + " " + Math.round(msElapsed) + 'ms => HTTP503');
        res.status(503).send({
            "error": "firenodejs unavailable"
        });
    }
});
app.post('/firestep/test', function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " " + JSON.stringify(req.body));
    firestep.test(res, req.body);
});

function millis() {
    var hrt = process.hrtime();
    var ms = hrt[0] * 1000 + hrt[1] / 1000000;
    return ms;
}

//////////// REST /camera
function restCapture(req, res, name) {
    var msStart = millis();
    camera.capture(name, function(path) {
        var msElapsed = millis() - msStart;
        console.log('HTTP\t: GET ' + req.url + ' => ' + path + ' ' +
            Math.round(msElapsed) + 'ms');
        res.sendFile(path);
    }, function(error) {
        console.log('HTTP\t: GET ' + req.url + ' => ' + error);
        res.status(404).sendFile(path_no_image);
    });
}
app.get('/camera/image.jpg', function(req, res) {
    restCapture(req, res);
});
app.get('/camera/*/image.jpg', function(req, res) {
    var tokens = req.url.split("/");
    restCapture(req, res, tokens[2]);
});
app.get('/camera/model', function(req, res) {
    res.send(camera.syncModel());
});
app.get('/camera/*/model', function(req, res) {
    var tokens = req.url.split("/");
    res.send(camera.syncModel(tokens[2]));
});

//////////// REST /firestep
app.get('/firestep/model', function(req, res) {
    var msStart = millis();
    var model = firestep.syncModel();
    var msElapsed = millis() - msStart;
    console.log('HTTP\t: GET ' + req.url +
        ' => ' + JSON.stringify(model) + ' ' +
        Math.round(msElapsed) + 'ms');
    res.send(model);
});
app.get('/firestep/location', function(req, res) {
    res.send(firestep.getLocation());
});
app.get('/firestep/history', function(req, res) {
    res.send(firestep.history());
});
post_firestep = function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " " + JSON.stringify(req.body));
    var msStart = millis();
    if (firestep.model.available) {
        firestep.send(req.body, function(data) {
            res.send(data);
            var msElapsed = millis() - msStart;
            console.log("HTTP\t: POST " + req.url + " " + 
                Math.round(msElapsed) + 'ms => ' + JSON.stringify(data));
        });
    } else {
        res.status(501).send({
            "error": "firestep unavailable"
        });
    }
};
app.post("/firestep", parser, post_firestep);

//////////// REST /firesight
app.get('/firesight/model', function(req, res) {
    var msStart = millis();
    var model = firesight.model;
    var msElapsed = millis() - msStart;
    console.log('HTTP\t: GET ' + req.url + ' => ' + model + ' ' +
        Math.round(msElapsed) + 'ms');
    res.send(model);
});
app.get('/firesight/*/out.jpg', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    var savedPath = firesight.savedImage(camera);
    if (savedPath) {
        var msElapsed = millis() - msStart;
        console.log('HTTP\t: GET ' + req.url + ' => ' + savedPath + ' ' +
            Math.round(msElapsed) + 'ms');
        res.sendFile(savedPath || path_no_image);
    } else {
        console.log('HTTP\t: GET ' + req.url + ' => ' + path_no_image);
        res.status(404).sendFile(path_no_image);
    }
});
app.get('/firesight/*/out.json', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    var savedPath = firesight.savedJSON(camera);
    var noJSON = {
        "error": "no JSON data"
    };
    if (savedPath) {
        var msElapsed = millis() - msStart;
        console.log('HTTP\t: GET ' + req.url + ' => ' + savedPath + ' ' +
            Math.round(msElapsed) + 'ms');
        res.sendFile(savedPath || noJSON);
    } else {
        console.log('HTTP\t: GET ' + req.url + ' => ' + path_no_image);
        res.status(404).sendFile(noJSON);
    }
});
app.get('/firesight/*/calc-offset', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    firesight.calcOffset(camera, function(json) {
        var msElapsed = millis() - msStart;
        res.send(json);
        console.log('HTTP\t: GET ' + req.url + ' => ' + json + ' ' +
            Math.round(msElapsed) + 'ms');
    }, function(error) {
        var msElapsed = millis() - msStart;
        res.status(500).send(error);
        console.log('HTTP\t: GET ' + req.url + ' => HTTP500 ' + error +
            Math.round(msElapsed) + 'ms');
    });
});

//////////// REST /images
app.get('/images/location', function(req, res) {
    res.send(images.location());
});
app.get('/images/*/save', function(req, res) {
    var tokens = req.url.split("/");
    images.save(tokens[2], function(imagePath) {
        res.send(imagePath);
    }, function(error) {
        res.status(501).send(error);
    });
});
app.get("/images/*/image.jpg", function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    var savedPath = images.savedImage(camera);
    if (savedPath) {
        var msElapsed = millis() - msStart;
        console.log('HTTP\t: GET ' + req.url + ' => ' + savedPath + ' ' +
            Math.round(msElapsed) + 'ms');
        res.sendFile(savedPath || path_no_image);
    } else {
        console.log('HTTP\t: GET ' + req.url + ' => ' + path_no_image);
        res.status(404).sendFile(path_no_image);
    }
});

//////////// REST /measure
app.get('/measure/model', function(req, res) {
    var msStart = millis();
    var model = measure.model;
    var msElapsed = millis() - msStart;
    console.log('HTTP\t: GET ' + req.url + ' => ' + model + ' ' +
        Math.round(msElapsed) + 'ms');
    res.send(model);
});
post_jogPrecision = function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    console.log("HTTP\t: POST " + req.url + " " + JSON.stringify(req.body));
    var msStart = millis();
    if (measure.model.available) {
        measure.jogPrecision(camName, req.body, function(data) {
            res.send(data);
            var msElapsed = millis() - msStart;
            console.log("HTTP\t: POST " + req.url + " " + Math.round(msElapsed) + 'ms => ' + JSON.stringify(data));
        }, function(err) {
            res.status(500).send({
                "error": err
            });
        });
    } else {
        res.status(501).send({
            "error": "measure unavailable"
        });
    }
};
app.post("/measure/*/jog-precision", parser, post_jogPrecision);
post_lppPrecision = function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    console.log("HTTP\t: POST " + req.url + " " + JSON.stringify(req.body));
    var msStart = millis();
    if (measure.model.available) {
        measure.lppPrecision(camName, req.body, function(data) {
            res.send(data);
            var msElapsed = millis() - msStart;
            console.log("HTTP\t: POST " + req.url + " " + Math.round(msElapsed) + 'ms => ' + JSON.stringify(data));
        }, function(err) {
            res.status(500).send({
                "error": err
            });
        });
    } else {
        res.status(501).send({
            "error": "measure unavailable"
        });
    }
};
app.post("/measure/*/lpp-precision", parser, post_lppPrecision);

/////////// Startup

var firenodejs_port;

process.on('uncaughtException', function(error) {
    console.log("HTTP\t: firenodejs UNCAUGHT EXCEPTION:" + error);
    throw error;
});

var listener = app.listen(80, function(data) {
    firenodejs_port = 80;
    console.log('HTTP\t: firenodejs listening on port ' + firenodejs_port + ' data:' + data);
});
listener.on('error', function(error) {
    if (error.code === "EACCES") {
        console.log("WARN\t: firenodejs insufficient user privilege for port 80 (trying 8080) ...");
        listener = app.listen(8080, function(data) {
            firenodejs_port = 8080;
            console.log('HTTP\t: firenodejs listening on port ' + firenodejs_port);
        });
    } else {
        console.log("HTTP\t: firenodejs listener ERROR:" + error);
        throw error;
    }
});

process.on('exit', function(data) {
    console.log("END\t: firenodejs exit with code:" + data);
});

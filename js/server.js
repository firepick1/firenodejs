var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var parser = bodyParser.json();
var __appdir = path.join(__dirname, "../www");
var path_no_image = path.join(__appdir, 'img/no-image.jpg');

function help() {
    console.log("HELP\t: Launch firenodejs (normal):");
    console.log("HELP\t:    node js/server.js");
    console.log("HELP\t: Launch firenodejs with mock FirePick Delta motion control:");
    console.log("HELP\t:    node js/server.js --mock-fpd");
    console.log("HELP\t: Launch firenodejs with mock cartesian motion control:");
    console.log("HELP\t:    node js/server.js --mock-xyz");
    console.log("HELP\t: Launch firenodejs with TinyG motion control:");
    console.log("HELP\t:    node js/server.js --tinyg");
    console.log("HELP\t: Launch firenodejs with verbose logging:");
    console.log("HELP\t:    node js/server.js -v");
    console.log("HELP\t:    node js/server.js --verbose");
}
var options = {
    pathNoImage: path_no_image,
    version: {
        major: 0,
        minor: 11,
        patch: 0,
    },
};
console.log("START\t: firenodejs version:" + JSON.stringify(options.version));
process.argv.forEach(function(val, index, array) {
    options.verbose && console.log("iNFO\t: argv[" + index + "] ", val);
    if (val === "--mock-fpd") {
        options.mock = "MTO_FPD";
    } else if (val === "--mock-xyz") {
        options.mock = "MTO_XYZ";
    } else if (val === "--tinyg") {
        options.mock = "TINYG";
    } else if (val === "--verbose" || val === "-v") {
        options.verbose = true;
    } else if (val === "--help" || val === "-h") {
        help();
        process.exit(0);
    } else if (index > 1) {
        throw new Error("unknown argument:" + val);
    }
});

var FireStepService = require("./firestep/service");
var firestep = new FireStepService(options);
var Camera = require("./camera");
var camera = new Camera(options);
var Images = require("./images");
var images = new Images(firestep, camera, options);
var firesight = require("./firesight/FireSightRESTFactory").create(images, options);
var Measure = require("./measure");
var measure = new Measure(images, firesight, options);
var MeshREST = require("./mesh/MeshREST");
var mesh_rest = new MeshREST(images, firesight, options);
var FireKueREST = require("./FireKueREST");
var firekue_rest = new FireKueREST(images, firesight, mesh_rest, options);
var firenodejsType = new require("./firenodejs");
var firenodejs = new firenodejsType(images, firesight, measure, mesh_rest, firekue_rest, options);

express.static.mime.define({
    'application/json': ['firestep']
});

app.use(parser);

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

function respond_http(req, res, msStart, httpMethod, status, result) {
    res.status(status);
    if (status >= 500) {
        result = {
            error: result
        };
    }
    var sdata = JSON.stringify(result);
    sdata = sdata && sdata.length > 80 ? (sdata.substring(0, 80) + "...") : sdata;
    options.verbose && console.log('HTTP\t: ' + httpMethod + ' ' + req.url + ' => HTTP' + status + ' ' +
        Math.round(millis() - msStart) + 'ms ' + sdata);
    res.send(result);
}

function process_http(req, res, httpMethod, handlerOrData) {
    var msStart = millis();
    var result = handlerOrData;
    var status = 200;
    if (typeof handlerOrData === "function") {
        try {
            result = handlerOrData();
            if (result instanceof Error) {
                status = 404;
                result = result.message;
            }
        } catch (e) {
            console.log("WARN\t: Caught exception:", e);
            status = 500;
            result = e.message;
        }
    }
    respond_http(req, res, msStart, httpMethod, status, result);
}

function process_GET(req, res, handlerOrData) {
    process_http(req, res, "GET", handlerOrData);
}

function process_POST(req, res, handlerOrData) {
    options.verbose && console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    process_http(req, res, "POST", handlerOrData);
}


///////////// REST /firenodejs
var dirs = ['bootstrap', 'html', 'img', 'css', 'js', 'lib', 'partials'];
for (var i = 0; i < dirs.length; i++) {
    var urlpath = '/firenodejs/' + dirs[i];
    var filepath = path.join(__appdir, dirs[i]);
    app.use(urlpath, express.static(filepath));
    options.verbose && console.log("HTTP\t: firenodejs mapping urlpath:" + urlpath + " to:" + filepath);
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
    process_GET(req, res, function() {
        res.status(200);
        return firenodejs.syncModels();
    });
});
app.post('/firenodejs/models', function(req, res, next) {
    process_POST(req, res, function() {
        if (firenodejs.isAvailable()) {
            return firenodejs.syncModels(req.body);
        }
        throw {
            "error": "firenodejs unavailable"
        }
    });
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
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + path + ' ' +
            Math.round(millis() - msStart) + 'ms');
        res.sendFile(path);
    }, function(error) {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + error);
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
    process_GET(req, res, function() {
        camera.syncModel();
    });
});
app.get('/camera/*/model', function(req, res) {
    process_GET(req, res, function() {
        var tokens = req.url.split("/");
        return camera.syncModel(tokens[2]);
    });
});

//////////// REST /firestep
app.post('/firestep/test', function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    firestep.test(res, req.body);
});
app.get('/firestep/model', function(req, res) {
    process_GET(req, res, function() {
        return firestep.syncModel();
    });
});
app.get('/firestep/location', function(req, res) {
    process_GET(req, res, function() {
        return firestep.getLocation();
    });
});
app.get('/firestep/history', function(req, res) {
    process_GET(req, res, function() {
        return firestep.history();
    });
});
app.post("/firestep", parser, function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    var msStart = millis();
    if (firestep.model.available) {
        firestep.send(req.body, function(data) {
            respond_http(req, res, msStart, "POST", 200, data);
        });
    } else {
        respond_http(req, res, msStart, "POST", 501, "firestep unavailable");
    }
});

//////////// REST /firesight
app.get('/firesight/model', function(req, res) {
    process_GET(req, res, firesight.model);
});
app.get('/firesight/*/out.jpg', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    var outputPath = firesight.outputImagePath(camera);
    if (outputPath) {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + outputPath + ' ' +
            Math.round(millis() - msStart) + 'ms');
        res.sendFile(outputPath || path_no_image);
    } else {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + path_no_image);
        res.status(404).sendFile(path_no_image);
    }
});
app.get('/firesight/*/out.json', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    var outputPath = firesight.outputJsonPath(camera);
    var noJSON = {
        "error": "no JSON data"
    };
    if (outputPath) {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + outputPath + ' ' +
            Math.round(millis() - msStart) + 'ms');
        res.sendFile(outputPath || noJSON);
    } else {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + path_no_image);
        res.status(404).sendFile(noJSON);
    }
});
app.get('/firesight/*/calc-offset', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    firesight.processImage(camera, "CalcOffset", function(json) {
        res.send(json);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' +
            JSON.stringify(json) + ' ' +
            Math.round(millis() - msStart) + 'ms');
    }, function(error) {
        res.status(500).send(error);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => HTTP500 ' + error +
            Math.round(millis() - msStart) + 'ms');
    });
});
app.get('/firesight/*/calc-grid', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    firesight.processImage(camera, "CalcGrid", function(json) {
        res.send(json);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' +
            JSON.stringify(json) + ' ' +
            Math.round(millis() - msStart) + 'ms');
    }, function(error) {
        res.status(500).send(error);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => HTTP500 ' + error +
            Math.round(millis() - msStart) + 'ms');
    });
});
app.get('/firesight/*/calc-fg-rect', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    firesight.processImage(camera, "CalcFgRect", function(json) {
        res.send(json);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' +
            JSON.stringify(json) + ' ' +
            Math.round(millis() - msStart) + 'ms');
    }, function(error) {
        res.status(500).send(error);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => HTTP500 ' + error +
            Math.round(millis() - msStart) + 'ms');
    });
});
app.get('/firesight/*/read-qr', function(req, res) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var msStart = millis();
    firesight.processImage(camera, "ReadQR", function(json) {
        res.send(json);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' +
            JSON.stringify(json) + ' ' +
            Math.round(millis() - msStart) + 'ms');
    }, function(error) {
        res.status(500).send(error);
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => HTTP500 ' + error +
            Math.round(millis() - msStart) + 'ms');
    });
});

//////////// REST /images
app.get('/images/location', function(req, res) {
    process_GET(req, res, function() {
        return images.location();
    });
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
    var savedPath = images.savedImagePath(camera);
    if (savedPath) {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + savedPath + ' ' +
            Math.round(millis() - msStart) + 'ms');
        res.sendFile(savedPath || path_no_image);
    } else {
        options.verbose && console.log('HTTP\t: GET ' + req.url + ' => ' + path_no_image);
        res.status(404).sendFile(path_no_image);
    }
});

//////////// REST /measure
app.get('/measure/model', function(req, res) {
    process_GET(req, res, measure.model);
});
post_jogPrecision = function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    var msStart = millis();
    if (measure.model.available) {
        measure.jogPrecision(camName, req.body, function(data) {
            respond_http(req, res, msStart, "POST", 200, data);
        }, function(err) {
            respond_http(req, res, msStart, "POST", 500, err);
        });
    } else {
        respond_http(req, res, msStart, "POST", 501, "measure unavailable");
    }
};
app.post("/measure/*/jog-precision", parser, post_jogPrecision);
post_lppPrecision = function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    var msStart = millis();
    if (measure.model.available) {
        measure.lppPrecision(camName, req.body, function(data) {
            respond_http(req, res, msStart, "POST", 200, data);
        }, function(err) {
            respond_http(req, res, msStart, "POST", 500, err);
        });
    } else {
        respond_http(req, res, msStart, "POST", 501, "measure unavailable");
    }
};
app.post("/measure/*/lpp-precision", parser, post_lppPrecision);

//////////// REST /mesh
app.get('/mesh/model', function(req, res) {
    process_GET(req, res, mesh_rest.model);
});
app.post("/mesh/*/scan", parser, function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    var msStart = millis();
    if (mesh_rest.model.available) {
        mesh_rest.scan(camName, req.body, function(data) {
            respond_http(req, res, msStart, "POST", 200, data);
        }, function(err) {
            respond_http(req, res, msStart, "POST", 500, err);
        });
    } else {
        respond_http(req, res, msStart, "POST", 501, "mesh_rest unavailable");
    }
});

//////////// REST /firekue
app.get('/firekue/model', function(req, res) {
    process_GET(req, res, firekue_rest.model);
});
app.get('/firekue/job/*', function(req, res) {
    var tokens = req.url.split("/");
    process_GET(req, res, function() {
        res.status(200);
        return firekue_rest.job_GET(tokens.slice(3));
    });
});
app.get('/firekue/jobs/*', function(req, res) {
    var tokens = req.url.split("/");
    process_GET(req, res, function() {
        res.status(200);
        return firekue_rest.jobs_GET(tokens.slice(3));
    });
});
app.post('/firekue/job', function(req, res, next) {
    process_POST(req, res, function() {
        if (firekue_rest.isAvailable()) {
            return firekue_rest.job_POST(req.body);
        }
        throw {
            "error": "firekue unavailable"
        }
    });
});

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
        options.verbose && console.log("INFO\t: firenodejs insufficient user privilege for port 80 (trying 8080) ...");
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

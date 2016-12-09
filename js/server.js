var timeLaunch = new Date();
const Logger = require("../www/js/shared/Logger");
console.log("\n");
Logger.start("server starting");
var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var parser = bodyParser.json();
var __appdir = path.join(__dirname, "../www");
var path_no_image = path.join(__appdir, 'img/no-image.jpg');
var JsonUtil = require("../www/js/shared/JsonUtil");
var ServiceBus = require("./ServiceBus");
var multer = require('multer')
var upload = multer({
    dest: "/var/firenodejs/uploads"
});
var MTO_C3 = require("../www/js/shared/MTO_C3");

function help() {
    console.log("HELP\t: Launch firenodejs with FireStep FirePick Delta motion control (default):");
    console.log("HELP\t:    node js/server.js");
    console.log("HELP\t: Launch firenodejs with mock FirePick Delta motion control:");
    console.log("HELP\t:    node js/server.js --mock-fpd");
    console.log("HELP\t: Launch firenodejs with mock cartesian motion control (MTO_XYZ):");
    console.log("HELP\t:    node js/server.js --mock-xyz");
    console.log("HELP\t: Launch firenodejs with mock cartesian motion control (MTO_C3, FirePaste):");
    console.log("HELP\t:    node js/server.js --mock-c3");
    console.log("HELP\t: Launch firenodejs with TinyG motion control:");
    console.log("HELP\t:    node js/server.js --tinyg");
    console.log("HELP\t: Launch firenodejs with FireStep driver and 3-axis cartesian kinematics:");
    console.log("HELP\t:    node js/server.js --mto-c3");
    console.log("HELP\t: Launch firenodejs with verbose logging:");
    console.log("HELP\t:    node js/server.js -v");
    console.log("HELP\t:    node js/server.js --verbose");
}
var fnoptions = {
    timeLaunch: timeLaunch,
    pathNoImage: path_no_image,
    version: {},
};

var pkg = JSON.parse(fs.readFileSync("package.json"));
var ver = pkg.version.split(".");
fnoptions.version.major = Number(ver[0]);
fnoptions.version.minor = Number(ver[1]);
fnoptions.version.patch = Number(ver[2]);

Logger.start("server: firenodejs version:" + JSON.stringify(fnoptions.version));
process.argv.forEach(function(val, index, array) {
    fnoptions.verbose && console.log("iNFO\t: server: argv[" + index + "] ", val);
    if (val === "--mock-fpd") {
        fnoptions.mtoName = "MTO_FPD";
        fnoptions.driver = "mock";
    } else if (val === "--mock-xyz") {
        fnoptions.mtoName = "MTO_XYZ";
        fnoptions.driver = "mock";
    } else if (val === "--mock-c3") {
        fnoptions.mtoName = "MTO_C3";
        fnoptions.driver = "mock";
    } else if (val === "--firestep") {
        fnoptions.driver = "FireStep";
    } else if (val === "--tinyg") {
        fnoptions.driver = "TINYG";
    } else if (val === "--mto-c3") {
        fnoptions.mtoName = "MTO_C3";
    } else if (val === "--verbose" || val === "-v") {
        fnoptions.verbose = true;
        console.log("INFO\t: server: verbose logging enabled");
    } else if (val === "--help" || val === "-h") {
        help();
        process.exit(0);
    } else if (index > 1) {
        throw new Error("unknown argument:" + val);
    }
});

fnoptions.serviceBus = new ServiceBus(fnoptions);

var PositionService = require("./position/service");
var position = new PositionService(fnoptions);
var Camera = require("./camera");
var camera = new Camera(fnoptions);
var Images = require("./images");
var images = new Images(position, camera, fnoptions);
var firesight = require("./firesight/FireSightRESTFactory").create(images, fnoptions);
var Measure = require("./measure");
var measure = new Measure(images, firesight, fnoptions);
var MeshREST = require("./mesh/MeshREST");
var mesh_rest = new MeshREST(images, firesight, fnoptions);
var FireKueREST = require("./firekue/FireKueREST");
var firekue_rest = new FireKueREST(fnoptions);
var FirePaste = require("./firepaste");
var firepaste = new FirePaste();
var PcbServer = require("./pcb-server");
var pcb = new PcbServer();
var firenodejsType = new require("./firenodejs");
var firenodejs = new firenodejsType(
    images, position, firesight, measure, mesh_rest, firekue_rest, pcb, firepaste,
    fnoptions);

express.static.mime.define({
    'application/json': ['firestep', 'position']
});

app.use(parser);

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.locals.msStart = millis();
    if (req.method === "GET") {
        if (req.url.startsWith("/firenodejs/img/")) {
            // ignore static content logging
        } else if (req.url.startsWith("/firenodejs/js/")) {
            // ignore static content logging
        } else if (req.url.startsWith("/firenodejs/index")) {
            // ignore static content logging
        } else if (req.url.startsWith("/firenodejs/css/")) {
            // ignore static content logging
        } else if (req.url.startsWith("/firenodejs/lib/")) {
            // ignore static content logging
        } else if (req.url.startsWith("/firenodejs/partials/")) {
            // ignore static content logging
        } else {
            fnoptions.verbose && console.log("HTTP\t:", req.method, req.url);
        }
    } else {
        console.log("HTTP\t:", req.method, req.url, "<=", JsonUtil.summarize(req.body, (fnoptions.verbose ? null : 2)));
    }
    firekue_rest.observe_http(req);
    next();
});

function log_http(req, res, status, result) {
    (fnoptions.verbose || req.method !== "GET") &&
    console.log("HTTP\t:", req.method, req.url, Math.round(millis() - res.locals.msStart) + "ms=>" + status,
        JsonUtil.summarize(result, fnoptions.verbose ? null : 0));
}

function respond_http(req, res, status, result) {
    res.status(status);
    if (status >= 500) {
        result = {
            error: result
        };
    }
    res.send(result);
    log_http(req, res, status, result);
}

function processHttp(req, res, handler, next) {
    new Promise(function(resolve, reject) {
        handler(resolve, reject);
    }).then(function(result) {
        respond_http(req, res, 200, result);
    }).catch(function(err) {
        console.log("WARN\t: server: Caught exception:", err);
        console.log(err.stack);
        respond_http(req, res, 500, err.message);
    });
    next && next('route');
}

function processHttpSync(req, res, handlerOrData, next) {
    var httpMethod = req.method;
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
            console.log("WARN\t: server: Caught exception:", e);
            console.log(e.stack);
            status = 500;
            result = e.message;
        }
    }
    respond_http(req, res, status, result);
    next && next('route');
}

///////////// REST /firenodejs
var dirs = ['bootstrap', 'html', 'img', 'css', 'js', 'lib', 'partials', 'svg'];
for (var i = 0; i < dirs.length; i++) {
    var urlpath = '/firenodejs/' + dirs[i];
    var filepath = path.join(__appdir, dirs[i]);
    app.use(urlpath, express.static(filepath));
    //fnoptions.verbose && console.log("HTTP\t: firenodejs mapping urlpath:" + urlpath + " to:" + filepath);
}
app.use('/var', express.static('/var/firenodejs'));
app.use('/cp', express.static('node_modules/angular-bootstrap-colorpicker'));
app.use('/html', express.static(path.join(__appdir, 'html')));
app.use('/lib', express.static(path.join(__appdir, 'lib')));
app.use('/css', express.static(path.join(__appdir, 'css')));
app.use('/js', express.static(path.join(__appdir, 'js')));
app.use('/img', express.static(path.join(__appdir, 'img')));
app.use('/partials', express.static(path.join(__appdir, 'partials')));

app.get('/firenodejs/*.html', function(req, res) {
    var tokens = req.url.split("/");
    var file = path.join(__appdir, 'html', tokens[2]);
    res.sendFile(file);
    log_http(req, res, 200, file);
});
app.get('/firenodejs/index.html', function(req, res) {
    var file = path.join(__appdir, '/html/firenodejs.html');
    res.sendFile(file);
    log_http(req, res, 200, file);
});
app.get('/firepaste/index.html', function(req, res) {
    var file = path.join(__appdir, '/html/firepaste.html');
    res.sendFile(file);
    log_http(req, res, 200, file);
});
app.get('/firenodejs/grid-xy.html', function(req, res) {
    var file = path.join(__appdir, '/html/grid-xy.html');
    res.sendFile(file);
    log_http(req, res, 200, file);
});
app.get('/', function(req, res) {
    res.redirect('/html/index.html');
});
app.get('/index.html', function(req, res) {
    res.redirect('/html/index.html');
});
app.get('/firenodejs/hello', function(req, res, next) {
    processHttpSync(req, res, function() {
        res.status(200);
        return "hello";
    }, next);
});
app.post('/firenodejs/echo', parser, function(req, res, next) {
    processHttpSync(req, res, function() {
        if (firenodejs.isAvailable()) {
            return req.body;
        }
        throw {
            "error": "firenodejs unavailable"
        }
    }, next);
});
app.get('/firenodejs/models', function(req, res, next) {
    processHttpSync(req, res, function() {
        return firenodejs.getModels(res);
    }, next);
});
app.post('/firenodejs/models', function(req, res, next) {
    processHttpSync(req, res, function() {
        if (firenodejs.isAvailable()) {
            console.log("WARN\t: ***DEPRECATED REST INTERFACE***  POST /firenodejs/models");
            return firenodejs.updateModels(req.body, res);
        }
        throw {
            "error": "firenodejs unavailable"
        }
    }, next);
});
app.post('/firenodejs/sync', function(req, res, next) {
    processHttpSync(req, res, function() {
        if (firenodejs.isAvailable()) {
            return firenodejs.sync(req.body, res);
        }
        throw {
            "error": "firenodejs unavailable"
        }
    }, next);
});
app.post('/firenodejs/shell', function(req, res, next) {
    processHttpSync(req, res, function() {
        if (firenodejs.isAvailable()) {
            return firenodejs.shell(req, res);
        }
        throw {
            "error": "firenodejs unavailable"
        }
    }, next);
});

function millis() {
    var hrt = process.hrtime();
    var ms = hrt[0] * 1000 + hrt[1] / 1000000;
    return ms;
}

//////////// REST /camera
function restCapture(req, res, name) {
    camera.capture(name, function(path) {
        res.sendFile(path);
        log_http(req, res, 200, path);
    }, function(error) {
        res.status(404).sendFile(path_no_image);
        log_http(req, res, 404, path_no_image);
    });
}
app.get('/camera/image.jpg', function(req, res) {
    restCapture(req, res);
});
app.get('/camera/*/image.jpg', function(req, res) {
    var tokens = req.url.split("/");
    restCapture(req, res, tokens[2]);
});
app.get('/camera/model', function(req, res, next) {
    processHttpSync(req, res, function() {
        camera.syncModel();
    }, next);
});
app.get('/camera/*/model', function(req, res, next) {
    processHttpSync(req, res, function() {
        var tokens = req.url.split("/");
        return camera.syncModel(tokens[2]);
    }, next);
});

//////////// REST /firestep (DEPRECATED)
app.post('/firestep/test', function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    position.test(res, req.body);
    log_http(req, res, 200, "");
});
app.get('/firestep/model', function(req, res, next) {
    processHttpSync(req, res, function() {
        return position.syncModel();
    }, next);
});
app.get('/firestep/location', function(req, res, next) {
    processHttpSync(req, res, function() {
        return position.getLocation();
    }, next);
});
app.get('/firestep/history', function(req, res, next) {
    processHttpSync(req, res, function() {
        return position.history();
    }, next);
});
app.post("/firestep/reset", parser, function(req, res, next) {
    if (position.model.available) {
        position.reset(req.body, function(data) {
            respond_http(req, res, 200, data);
        });
    } else {
        respond_http(req, res, 501, "/position unavailable");
    }
});
app.post("/firestep", parser, function(req, res, next) {
    if (position.model.available) {
        position.send(req.body, function(data) {
            respond_http(req, res, 200, data);
        });
    } else {
        respond_http(req, res, 501, "/position unavailable");
    }
});

//////////// REST /position
app.post('/position/test', function(req, res, next) {
    console.log("HTTP\t: POST " + req.url + " <= " + JSON.stringify(req.body));
    position.test(res, req.body);
    log_http(req, res, 200, "");
});
app.get('/position/model', function(req, res, next) {
    processHttpSync(req, res, function() {
        return position.syncModel();
    }, next);
});
app.get('/position/location', function(req, res, next) {
    processHttpSync(req, res, function() {
        return position.getLocation();
    }, next);
});
app.get('/position/history', function(req, res, next) {
    processHttpSync(req, res, function() {
        return position.history();
    }, next);
});
app.post("/position/reset", parser, function(req, res, next) {
    if (position.model.available) {
        position.reset(req.body, function(data) {
            respond_http(req, res, 200, data);
        });
    } else {
        respond_http(req, res, 501, "/position unavailable");
    }
});
app.post("/position", parser, function(req, res, next) {
    if (position.model.available) {
        position.send(req.body, function(data) {
            respond_http(req, res, 200, data);
        });
    } else {
        respond_http(req, res, 501, "/position unavailable");
    }
});

//////////// REST /firesight
app.get('/firesight/model', function(req, res, next) {
    processHttpSync(req, res, firesight.model, next);
});
app.get('/firesight/*/out.jpg', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var outputPath = firesight.outputImagePath(camera, true);
    var file = (outputPath || path_no_image);
    res.sendFile(file);
    log_http(req, res, 200, file);
});
app.get('/firesight/*/out.json', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var outputPath = firesight.outputJsonPath(camera, true);
    var noJSON = {
        "error": "no JSON data"
    };
    var file = outputPath || noJSON;
    res.sendFile(file);
    log_http(req, res, 200, file);
});
app.get('/firesight/*/calc-offset', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    firesight.processImage(camera, "CalcOffset", function(json) {
        res.send(json);
        log_http(req, res, 200, json);
    }, function(error) {
        res.status(500).send(error);
        log_http(req, res, 500, error);
    }, req.query);
});
app.get('/firesight/*/calc-grid', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    firesight.processImage(camera, "CalcGrid", function(json) {
        res.send(json);
        log_http(req, res, 200, json);
    }, function(error) {
        var emsg = {
            error: error.message
        };
        res.status(500).send(emsg);
        log_http(req, res, 500, emsg);
    }, req.query);
});
app.get('/firesight/*/calc-fg-rect', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    firesight.processImage(camera, "CalcFgRect", function(json) {
        res.send(json);
        log_http(req, res, 200, json);
    }, function(error) {
        res.status(500).send(error);
        log_http(req, res, 500, error);
    }, req.query);
});
app.get('/firesight/*/read-qr', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    firesight.processImage(camera, "ReadQR", function(json) {
        res.send(json);
        log_http(req, res, 200, json);
    }, function(error) {
        res.status(500).send(error);
        log_http(req, res, 500, error);
    }, req.query);
});
app.get('/firesight/*/match-cds', function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    firesight.processImage(camera, "MatchCDS", function(json) {
        res.send(json);
        log_http(req, res, 200, json);
    }, function(error) {
        res.status(500).send(error);
        log_http(req, res, 500, error);
    }, req.query);
});

//////////// REST /images
app.get('/images/location', function(req, res, next) {
    processHttpSync(req, res, function() {
        return images.location();
    }, next);
});
app.get('/images/*/save', function(req, res, next) {
    var tokens = req.url.split("/");
    images.rest_save(tokens[2], function(imagePath) {
        imagePath.url = "http://" + req.hostname + ":" + firenodejs.port + imagePath.path;
        res.send(imagePath);
        log_http(req, res, 200, imagePath);
    }, function(error) {
        res.status(501).send(error);
        log_http(req, res, 501, error);
    }, req.query);
});
app.post('/images/*/save', function(req, res, next) {
    var tokens = req.url.split("/");
    images.rest_save(tokens[2], function(imagePath) {
        imagePath.url = "http://" + req.hostname + ":" + firenodejs.port + imagePath.path;
        res.send(imagePath);
        log_http(req, res, 200, imagePath);
    }, function(error) {
        res.status(501).send(error);
        log_http(req, res, 501, error);
    }, req.body);
});
app.get("/images/*/image.jpg", function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var savedPath = images.savedImagePath(camera);
    if (savedPath) {
        var file = (savedPath || path_no_image);
        res.sendFile(file);
        log_http(req, res, 200, file);
    } else {
        res.status(404).sendFile(path_no_image);
        log_http(req, res, 404, path_no_image);
    }
});
app.get("/images/*/*.jpg", function(req, res, next) {
    var tokens = req.url.split("/");
    var camera = tokens[2];
    var savedImage = tokens[3].substr(0, tokens[3].length - ".jpg".length);
    var savedPath = images.savedImagePath(camera, savedImage);
    if (savedPath) {
        var file = (savedPath || path_no_image);
        res.sendFile(file);
        log_http(req, res, 200, file);
    } else {
        res.status(404).sendFile(path_no_image);
        log_http(req, res, 404, path_no_image);
    }
});

//////////// REST /measure
app.get('/measure/model', function(req, res, next) {
    processHttpSync(req, res, measure.model, next);
});
post_jogPrecision = function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    if (measure.model.available) {
        measure.jogPrecision(camName, req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "measure unavailable");
    }
};
app.post("/measure/*/jog-precision", parser, post_jogPrecision);
post_lppPrecision = function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    if (measure.model.available) {
        measure.lppPrecision(camName, req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "measure unavailable");
    }
};
app.post("/measure/*/lpp-precision", parser, post_lppPrecision);

//////////// REST /mesh
app.get('/mesh/model', function(req, res, next) {
    processHttpSync(req, res, mesh_rest.model, next);
});
app.post('/mesh/ponoko/p1_corner_holes', function(req, res, next) {
    if (mesh_rest.isAvailable) {
        mesh_rest.rest_ponoko_p1_corner_holes(req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "mesh_rest unavailable");
    }
});
app.post('/mesh/ponoko/p1_xygrid', function(req, res, next) {
    if (mesh_rest.isAvailable) {
        mesh_rest.rest_ponoko_p1_xygrid(req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "mesh_rest unavailable");
    }
});
app.post('/mesh/configure', function(req, res, next) {
    if (mesh_rest.isAvailable) {
        mesh_rest.rest_configure(req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "mesh_rest unavailable");
    }
});
app.post('/mesh/mend', function(req, res, next) {
    if (mesh_rest.isAvailable) {
        mesh_rest.rest_mend(req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "mesh_rest unavailable");
    }
});
app.post('/mesh/calc-props', function(req, res, next) {
    if (mesh_rest.isAvailable) {
        mesh_rest.rest_calcProps(req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 500, err);
        });
    } else {
        respond_http(req, res, 501, "mesh_rest unavailable");
    }
});
app.post("/mesh/*/scan/vertex", parser, function(req, res, next) {
    var tokens = req.url.split("/");
    var camName = tokens[2];
    if (mesh_rest.isAvailable) {
        mesh_rest.rest_scan_vertex(camName, req.body, function(data) {
            respond_http(req, res, 200, data);
        }, function(err) {
            respond_http(req, res, 400, err);
        });
    } else {
        respond_http(req, res, 501, "mesh_rest unavailable");
    }
});
//app.post("/mesh/*/scan/roi", parser, function(req, res, next) {
//var tokens = req.url.split("/");
//var camName = tokens[2];
//if (mesh_rest.isAvailable) {
//mesh_rest.scan_roi(camName, req.body, function(data) {
//respond_http(req, res, 200, data);
//}, function(err) {
//respond_http(req, res, 500, err);
//});
//} else {
//respond_http(req, res, 501, "mesh_rest unavailable");
//}
//});

//////////// REST /pcb

app.use('/pcb/s', express.static('/var/firenodejs/pcb'));
app.post('/pcb/file', upload.any(), function(req, res, next) {
    processHttp(req, res, function(resolve, reject) {
        pcb.onPostFile(req, res, resolve, reject);
    });
});

//////////// REST /firekue
app.get('/firekue/model', function(req, res, next) {
    processHttpSync(req, res, firekue_rest.model, next);
});
app.get('/firekue/job/*', function(req, res, next) {
    var tokens = req.url.split("/");
    processHttpSync(req, res, function() {
        res.status(200);
        return firekue_rest.job_GET(tokens[3]);
    }, next);
});
app.delete('/firekue/job/*', function(req, res, next) {
    var tokens = req.url.split("/");
    processHttpSync(req, res, function() {
        res.status(200);
        return firekue_rest.job_DELETE(tokens[3]);
    }, next);
});
app.get('/firekue/jobs/*', function(req, res, next) {
    var tokens = req.url.split("/");
    processHttpSync(req, res, function() {
        res.status(200);
        return firekue_rest.jobs_GET(tokens.slice(3));
    }, next);
});
app.get('/firekue/step', function(req, res, next) {
    var stepped = firekue_rest.step_GET(function(err, status) {
        if (err == null) {
            respond_http(req, res, 200, status); // progress was made
        } else {
            respond_http(req, res, 500, err); // bad things happened
        }
    });
});
app.post('/firekue/job', function(req, res, next) {
    console.log("/firekue/job req.body:" + JSON.stringify(req.body));
    processHttpSync(req, res, function() {
        if (firekue_rest.isAvailable()) {
            return firekue_rest.job_POST(req.body);
        }
        throw {
            "error": "firekue unavailable"
        }
    }, next);
});

/////////// POST Process

app.all('*', function(req, res, next) {
    next();
});

/////////// Startup

process.on('uncaughtException', function(error) {
    console.log("HTTP\t: firenodejs UNCAUGHT EXCEPTION:" + error);
    throw error;
});

var listener = app.listen(80, function(data) {
    firenodejs.setPort(80);
    var msg = 'firenodejs listening on HTTP port ' + firenodejs.port + ' data:' + data;
    Logger.start(msg);
    console.log("HTTP\t:" + msg);
});
listener.on('error', function(error) {
    if (error.code === "EACCES") {
        fnoptions.verbose && console.log("INFO\t: server: firenodejs insufficient user privilege for port 80 (trying 8080) ...");
        listener = app.listen(8080, function(data) {
            firenodejs.setPort(8080);
            Logger.start('HTTP: firenodejs listening on port ' + firenodejs.port);
        });
    } else {
        console.log("HTTP\t: server: firenodejs listener ERROR:" + error);
        throw error;
    }
});

process.on('exit', function(data) {
    console.log("END\t: server: firenodejs exit with code:" + data);
});

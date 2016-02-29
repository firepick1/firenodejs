var should = require("should");
var math = require("mathjs");
var shared = require("../../www/js/shared/JsonUtil");
var Logger = require("../../www/js/shared/Logger");
var JsonUtil = require("../../www/js/shared/JsonUtil");
var DVSFactory = require("../lib/DVSFactory");
var LPPCurve = require("../lib/LPPCurve");
var MockFPD = require("./mock-fpd");

(function(exports) {
    ////////////////// constructor
    function FireStepPlanner(model, driver, options) {
        var that = this;

        should.exist(model);
        options = options || {};

        that.verbose = options.verbose;
        that.lppMoves = 0;
        that.driver = driver || new MockFPD(model, options);
        that.mto = that.driver.mto;
        that.mto.should.exist;
        that.driver.on("idle", function() {
            that.onIdle();
        });
        that.driver.on("response", function(response) {
            that.onResponse(response);
        });
        that.logger = options.logger || new Logger({
            nPlaces: 3
        });
        that.model = model;
        that.model.initialized = false;
        Logger.start("FireStepPlanner() driver:" + driver.name);

        return that;
    }

    FireStepPlanner.prototype.beforeRebase = function() {
        var that = this;
        if (that.serialPath !== that.model.rest.serialPath) {
            Logger.start('FireStepPlanner: new serial path:', that.model.rest.serialPath);
            if (that.model.available) {
                that.driver.close();
                setTimeout(function() {
                    that.driver.open(function() {
                        that.onStartup();
                    });
                }, 2000);
            } else {
                that.driver.open(function() {
                    that.onStartup()
                });
            }
        } else if (!that.model.available) {
            that.driver.open(function() {
                that.onStartup()
            });
        }
    }
    FireStepPlanner.prototype.syncModel = function(data) {
        var that = this;
        if (data) {
            var available = that.model.available;
            var initialized = that.model.initialized;
            var reads = that.model.reads;
            var writes = that.model.writes;
            var serialPath = that.model.rest.serialPath;
            //console.log("FireStepPlanner.syncModel() data:" + JSON.stringify(data));
            shared.applyJson(that.model, data);
            that.model.available = available;
            that.model.initialized = initialized;
            that.model.reads = reads;
            that.model.writes = writes;
            that.model.rest.serialPath = that.model.rest.serialPath || "/dev/ttyACM0";
            if (serialPath !== that.model.rest.serialPath) {
                console.log('INFO\t: FireStepPlanner: new serial path:', that.model.rest.serialPath);
                if (that.model.available) {
                    that.driver.close();
                    setTimeout(function() {
                        that.driver.open(function() {
                            that.onStartup();
                        });
                    }, 2000);
                } else {
                    that.driver.open(function() {
                        that.onStartup()
                    });
                }
            } else if (!that.model.available) {
                that.driver.open(function() {
                    that.onStartup()
                });
            }
        } else {
            that.driver.pushQueue({
                "sys": ""
            });
            that.driver.pushQueue({
                "dim": ""
            });
        }
        return that.model;
    }
    FireStepPlanner.prototype.moveLPP = function(x, y, z, onDone) {
        var that = this;
        var mpoPlan = that.mpoPlan;
        var cmdsUp = [];
        should.exist(x);
        should.exist(y);
        should.exist(z);
        if (mpoPlan && mpoPlan.x != null && mpoPlan.y != null && mpoPlan.z != null) {
            if (mpoPlan.x || mpoPlan.y || mpoPlan.z != that.model.rest.lppZ) {
                that.mto.delta.should.exist;
                var lpp = new LPPCurve({
                    zHigh: that.model.rest.lppZ,
                    delta: that.mto.delta,
                });
                var pts = lpp.laplacePath(mpoPlan.x, mpoPlan.y, mpoPlan.z);
                pts.reverse();
                that.mpoPlanSetXYZ(0, 0, pts[pts.length - 1].z, {
                    log: "LPP up"
                });
                var cmd = new DVSFactory().createDVS(pts);
                cmd.dvs.us = math.round(cmd.dvs.us / that.model.rest.lppSpeed);
                that.send1(cmd);
                that.lppMoves++;
                if (that.model.rest.homeLPP && (that.lppMoves % that.model.rest.homeLPP === 0)) {
                    that.send1({
                        hom:""
                    });
                    var ptsHome = lpp.laplacePath(0,0,0);
                    ptsHome.reverse();
                    that.mpoPlanSetXYZ(0, 0, ptsHome[ptsHome.length - 1].z, {
                        log: "LPP up from home"
                    });
                    var cmdHomeLPP = new DVSFactory().createDVS(pts);
                    cmdHomeLPP.dvs.us = math.round(cmd.dvs.us / that.model.rest.lppSpeed);
                    that.send1(cmdHomeLPP);
                }
            }
        } else {
            should.fail("TBD");
            //that.send1({
            //"hom": ""
            //});
            //that.send1(that.cmd_mpo());
            //that.send1({
            //mov: {z:that.model.rest.lppZ}
            //});
        }
        //that.send1(that.cmd_mpo());
        var pts = lpp.laplacePath(x, y, z);
        var ptN = pts[pts.length - 1];
        var cmd = new DVSFactory().createDVS(pts);
        cmd.dvs.us = math.round(cmd.dvs.us / that.model.rest.lppSpeed);
        that.mpoPlanSetXYZ(ptN.x, ptN.y, ptN.z, {
            log: "LPP down"
        });
        that.send1(cmd);
        that.send1(that.cmd_mpo(), onDone);
        return that;
    }
    FireStepPlanner.prototype.isLPPMove = function(cmd) {
        var that = this;
        if (that.mto.delta == undefined) {
            return false;
        }
        if (!cmd.hasOwnProperty("mov")) {
            return false;
        }
        if (that.model.rest.lppSpeed <= 0) {
            //console.log("FireStepPlanner.isLPPMove(lppSpeed <= 0) => false");
            return false;
        }
        if (!cmd.mov.hasOwnProperty("x") ||
            !cmd.mov.hasOwnProperty("y") ||
            !cmd.mov.hasOwnProperty("z")) {
            //console.log("FireStepPlanner.isLPPMove(not absolute) => false");
            return false;
        }
        if (cmd.mov.lpp === false) {
            //console.log("FireStepPlanner.isLPPMove(lpp:false) => false");
            return false;
        }
        return true;
    }
    FireStepPlanner.prototype.mpoPlanSetXYZ = function(x, y, z, options) {
        var that = this;
        options = options || {};
        x.should.exist;
        y.should.exist;
        z.should.exist;
        var xyz = {
            x: x,
            y: y,
            z: z
        };
        var pulses = that.mto.calcPulses(xyz);
        that.mpoPlan = that.mpoPlan || {};
        that.mpoPlan.p1 = pulses.p1;
        that.mpoPlan.p2 = pulses.p2;
        that.mpoPlan.p3 = pulses.p3;
        that.mpoPlan.xn = math.round(x, 3);
        that.mpoPlan.yn = math.round(y, 3);
        that.mpoPlan.zn = math.round(z, 3);
        var xyz = that.mto.calcXYZ(pulses);
        that.mpoPlan.x = xyz.x;
        that.mpoPlan.y = xyz.y;
        that.mpoPlan.z = xyz.z;
        if (options.log) {
            that.verbose && that.logger.withPlaces(3).info(
                "mpoPlanSetXYZ(", xyz, ") ", pulses, " context:", options.log);
        }
    }
    FireStepPlanner.prototype.mpoPlanSetPulses = function(p1, p2, p3, options) {
        var that = this;
        options = options || {};
        var pulses = {
            p1: p1,
            p2: p2,
            p3: p3
        };
        var xyz = that.mto.calcXYZ(pulses);
        var mpoPlan = that.mpoPlan = that.mpoPlan || {};
        mpoPlan.p1 = p1;
        mpoPlan.p2 = p2;
        mpoPlan.p3 = p3;
        mpoPlan.x = xyz.x;
        mpoPlan.y = xyz.y;
        mpoPlan.z = xyz.z;
        if (that.mpoPlan) {
            if (p1 !== that.mpoPlan.p1 || p2 !== that.mpoPlan.p2 || p3 !== that.mpoPlan.p3) {
                throw new Error("mpoPlanSetPulses() position sync error" +
                    " actual:" + JSON.stringify(that.mpoPlan) +
                    " expected:" + JSON.stringify(pulses));
            }
        }
        // if we don't have a plan, use current pulse position
        mpoPlan.xn = mpoPlan.xn == null ? xyz.x : mpoPlan.xn;
        mpoPlan.yn = mpoPlan.yn == null ? xyz.y : mpoPlan.yn;
        mpoPlan.zn = mpoPlan.zn == null ? xyz.z : mpoPlan.zn;
        if (options.log) {
            that.verbose && that.logger.withPlaces(3).info(
                "mpoPlanSetPulses(", that.mpoPlan, ") context:", options.log);
        }
    }
    FireStepPlanner.prototype.send1 = function(cmd, onDone) {
        var that = this;
        onDone = onDone || function(data) {}
        var mpoPlan = that.mpoPlan;
        var sendCmd = true;

        that.model.initialized && mpoPlan.should.exist;
        if (that.isLPPMove(cmd)) {
            that.moveLPP(cmd.mov.x, cmd.mov.y, cmd.mov.z, onDone);
            sendCmd = false;
        } else if (cmd.hasOwnProperty("hom")) {
            that.mpoPlanSetXYZ(that.model.home.x, that.model.home.y, that.model.home.z, {
                log: "send1.hom:"
            });
        } else if (cmd.hasOwnProperty("movxr")) {
            that.mpoPlanSetXYZ(mpoPlan.xn + cmd.movxr, mpoPlan.yn, mpoPlan.zn, {
                log: "send1.movxr:" + cmd.movxr
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        } else if (cmd.hasOwnProperty("movyr")) {
            that.mpoPlanSetXYZ(mpoPlan.xn, mpoPlan.yn + cmd.movyr, mpoPlan.zn, {
                log: "send1.movyr:" + cmd.movyr
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        } else if (cmd.hasOwnProperty("movzr")) {
            that.mpoPlanSetXYZ(mpoPlan.xn, mpoPlan.yn, mpoPlan.zn + cmd.movzr, {
                log: "send1.movzr:" + cmd.movzr
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        } else if (cmd.hasOwnProperty("mov")) {
            delete cmd.mov.lpp; // firenodejs attribute (FireStep will complain)
            mpoPlan.xn.should.exist;
            mpoPlan.yn.should.exist;
            mpoPlan.zn.should.exist;
            var x = cmd.mov.x == null ? mpoPlan.xn : cmd.mov.x;
            var y = cmd.mov.y == null ? mpoPlan.yn : cmd.mov.y;
            var z = cmd.mov.z == null ? mpoPlan.zn : cmd.mov.z;
            x = cmd.mov.xr == null ? x : x + cmd.mov.xr;
            y = cmd.mov.yr == null ? y : y + cmd.mov.yr;
            z = cmd.mov.zr == null ? z : z + cmd.mov.zr;
            that.mpoPlanSetXYZ(x, y, z, {
                log: "send1.non-lpp-mov(" + x + "," + y + "," + z + ")"
            });
            cmd = {
                "mov": {
                    x: mpoPlan.xn,
                    y: mpoPlan.yn,
                    z: mpoPlan.zn
                }
            };
        }
        that.verbose && mpoPlan && console.log("DEBUG\t: FireStepPlanner.send1 mpoPlan:" + JSON.stringify(mpoPlan));
        if (sendCmd) {
            that.driver.pushQueue(cmd, onDone);
        }
        that.driver.processQueue();
    }
    FireStepPlanner.prototype.send = function(jobj, onDone) {
        var that = this;

        if (!onDone) {
            onDone = function(data) {
                if (data.s) {
                    console.log("TTY\t: FireStepPlanner: FireStep response:" + data.s);
                }
            }
        }
        if (jobj instanceof Array) {
            if (jobj.length > 0) {
                for (var i = 0; i < jobj.length; i++) {
                    if (i < jobj.length - 1) {
                        that.send1(jobj[i]);
                    } else {
                        that.send1(jobj[i], onDone);
                    }
                }
            } else {
                onDone();
            }
        } else {
            that.send1(jobj, onDone);
        }
        that.driver.processQueue();
        if (that.driver.queueLength()) {
            console.log("TTY\t: FireStepPlanner.send() queued:", that.driver.queueLength());
        }
        return that;
    }
    FireStepPlanner.prototype.cmd_mpo = function() {
        var that = this;
        return {
            mpo: "",
            dpyds: 12,
        }
    }
    FireStepPlanner.prototype.onResponse = function(response) {
        var that = this;
        var r = response.r;
        //console.log("DEBUG\t: FireStepPlanner.onResponse(" + JSON.stringify(response) + ")");
        that.model.id = r.id || that.model.id;
        that.model.sys = r.sys || that.model.sys;
        that.model.dim = r.dim || that.model.dim;
        if (that.model.sys && that.model.sys.to === 1 && r.dim) {
            that.mto.updateDimensions(r.dim);
        }
        that.model.a = r.a || that.model.a;
        that.model.b = r.b || that.model.b;
        that.model.c = r.c || that.model.c;
        that.model.x = r.x || that.model.x;
        that.model.y = r.y || that.model.y;
        that.model.z = r.z || that.model.z;
        that.model.mpo = r.mpo || that.model.mpo;
        if (r.mpo && that.mpoPlan) {
            r.mpo.xn = that.mpoPlan.xn;
            r.mpo.yn = that.mpoPlan.yn;
            r.mpo.zn = that.mpoPlan.zn;
        }
        that.model.response = r;
    }
    FireStepPlanner.prototype.onIdle = function() {
        var that = this;
        if (that.model.response && that.model.response.mpo) {
            that.model.initialized = true;
            var mpo = that.model.response.mpo;
            var pulses = {
                p1: mpo["1"],
                p2: mpo["2"],
                p3: mpo["3"]
            };
            that.mpoPlanSetPulses(mpo["1"], mpo["2"], mpo["3"], {
                log: "FireStepPlanner.onIdle(initialized)"
            });
        } else {
            that.verbose && console.log("TTY\t: FireStepPlanner.onIdle(waiting) ...");
        }
        if (that.mpoPlan) {
            that.model.mpo = that.model.mpo || {};
            JsonUtil.applyJson(that.model.mpo, JSON.parse(JSON.stringify(that.mpoPlan)));
            // round for archival
            that.model.mpo.x = math.round(that.model.mpo.x, 3);
            that.model.mpo.y = math.round(that.model.mpo.y, 3);
            that.model.mpo.z = math.round(that.model.mpo.z, 3);
        }
        return that;
    }
    FireStepPlanner.prototype.onStartup = function(err) {
        // 1) Driver startup synchronizes information without movement
        // 2) Movement initialization is separate and must happen under operator control

        var that = this;
        if (err == null) {
            //console.log("INFO\t: FireStepPlanner.onStartup() available:", that.available);
            //that.available = that.model.available;
            //that.initialized = that.model.initialized;
            //that.reads = that.model.reads;
            //that.writes = that.model.writes;
            that.serialPath = that.model.rest.serialPath;

            that.driver.pushQueue({
                "id": ""
            }); // a simple, safe command
            that.driver.pushQueue({
                "sys": ""
            }); // required for systo
            that.driver.pushQueue({
                "dim": ""
            }); // required for mto.updateDimensions
        }
    }

    module.exports = exports.FireStepPlanner = FireStepPlanner;
})(typeof exports === "object" ? exports : (exports = {}));

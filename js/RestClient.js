var should = require("should");
var http = require("http");

(function(exports) {
    function RestClient(options) {
        var that = this;
        options = options || {};
        var ro = that.reqOptions = {
            host: options.host || "localhost",
            port: options.port || "8080",
            method: "GET",
            protocol: "http:",
        }
        return that;
    }

    RestClient.prototype.get = function(path, onSuccess, onFail) {
        var that = this;
        path.should.exist;
        var reqOptions = JSON.parse(JSON.stringify(that.reqOptions));
        reqOptions.path = path;
        console.log("HTTP\t: GET http://" + reqOptions.host + ":" + reqOptions.port + reqOptions.path);
        var req = http.request(reqOptions, function(res) {
            res.setEncoding('utf8');
            var body = "";
            res.on('data', function(chunk) {
                body += chunk;
            });
            res.on('end', function() {
                if (res.statusCode === 200) {
                    console.log("HTTP\t: => ", body);
                    onSuccess(body);
                } else {
                    console.log("HTTP\t: => HTTP" + res.statusCode, body);
                    onFail && onFail(new Error("HTTP" + res.StatusCode), body);
                }
            });
        });
        req.on('error', function(err) {
            onFail && onFail(err);
        })
        req.end();
    }
    RestClient.prototype.post = function(path, postData, onSuccess, onFail) {
        var that = this;
        path.should.exist;
        postData.should.exist;
        if (typeof postData !== "string") {
            postData = JSON.stringify(postData);
        }
        var reqOptions = JSON.parse(JSON.stringify(that.reqOptions));
        reqOptions.headers = reqOptions.headers || {};
        reqOptions.headers["Content-Type"] = 'application/json';
        reqOptions.headers["Content-Length"] = postData.length;
        reqOptions.path = path;
        reqOptions.method = "POST";
        console.log("HTTP\t: POST http://" + reqOptions.host + ":" + reqOptions.port + reqOptions.path);
        console.log("HTTP\t: <= ", postData);
        var req = http.request(reqOptions, function(res) {
            res.setEncoding('utf8');
            var body = "";
            res.on('data', function(chunk) {
                body += chunk;
            });
            res.on('end', function() {
                if (res.statusCode === 200) {
                    console.log("HTTP\t: => ", body);
                    if (body.startsWith("{")) {
                        body = JSON.parse(body);
                    }
                    onSuccess(body);
                } else {
                    console.log("HTTP\t: => HTTP" + res.statusCode, body);
                    onFail && onFail(new Error("HTTP" + res.StatusCode), body);
                }
            });
        });
        req.on('error', function(err) {
            onFail && onFail(err);
        })
        req.write(postData);
        req.end();
    }

    module.exports = exports.RestClient = RestClient;
})(typeof exports === "object" ? exports : (exports = {}));


(typeof describe === 'function') && describe("RestClient", function() {
    var RestClient = require("./RestClient");
    it("GET(path, onSuccess, onFail) sends HTTP request", function() {
        var rest = new RestClient();
        var resultGET;
        var resultPOST;

        rest.get("/firenodejs/hello", function(data) {
            resultGET = data;
        });
        rest.post("/firenodejs/echo", {a:123}, function(data) {
            resultPOST = data;
        });
        setTimeout(function() {
            resultGET.should.equal("hello");
            should.deepEqual(resultPOST, {
                a:124,
            });
        }, 1000);
    })
})

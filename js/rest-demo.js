var should = require("should");
var RestClient = require("./RestClient");

console.log("START\t: rest-demo.js");

var restOptions = {
    protocol: "http://",
    host: "localhost",
    port: "8080",
};

for (var i=1; i < process.argv.length; i++) {
    var arg = process.argv[i];
    if (arg === "-h") {
        (++i).should.below(process.argv.length);
        restOptions.host = process.argv[i];
    }
}

var rest = new RestClient(restOptions);

function step1() {
    console.log("Step 1. Homing...");
    rest.post("/firestep", [{hom:""},{mpo:""}], function(data) { // http response callback
        console.log("FPD is at position x:", data.r.mpo.x, " y:", data.r.mpo.y, " z:", data.r.mpo.z);
        step2(); // do AFTER step1 is done
    });
}

function step2() {
    console.log("Step 2. Move to (50,50)...");
    rest.post("/firestep", [{mov:{x:50,y:50}},{mpo:""}], function(data) { // http response callback
        console.log("FPD is at position x:", data.r.mpo.x, " y:", data.r.mpo.y, " z:", data.r.mpo.z);
    });
}

step1();
// step2(); <= DANGER! we can't just put step2 here because it will run in PARALLEL!

console.log("END\t: rest-demo.js");

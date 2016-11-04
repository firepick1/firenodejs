const jspcb = require("jspcb");
const fs = require("fs");

var xfmPath = process.argv[2] || "/var/firenodejs/pcb/transform.json";
if (!fs.existsSync(xfmPath)) {
    console.warn("WARN\t: PCB transformation JSON file not found:", xfmPath);
    process.exit(-1);
}
var xfmStr = fs.readFileSync(xfmPath);
var xfm = JSON.parse(xfmStr);
console.warn("INFO\t: loaded jspcb transformation file:", xfmPath);
var pcbTrans = new jspcb.PcbTransform(xfm);
pcbTrans.transform().then(function() {
    console.log("END\t: pcb-transform complete");
    process.exit(0);
});



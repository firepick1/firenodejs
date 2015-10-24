var kue = require('kue');
var jobs = kue.createQueue();

function newJob() {
    var job = jobs.create('new_job');
    job.save();
}
jobs.process('new_job', function(job, done) {
    console.log('Job', job.id, ' is done');
    done && done();
});
setInterval(newJob, 3000);

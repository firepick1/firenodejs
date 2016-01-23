var should = require("should");

(function(exports) {
    ////////////////// constructor
    function Steppable() {
        var that = this;

        that.progress = 0;
        that.err = null;
        that.isBusy = false;

        return that;
    }

    Steppable.prototype.status = function() {
        var that = this;
        return that;
    }
    Steppable.prototype.step = function(onStep) {
        var that = this;
        onStep.should.Function;
        if (that.isBusy) {
            return false;
        }
        if (that.progress >= 1) {
            return false;
        }
        that.isBusy = true;
        setTimeout(()=>{
            that.isBusy = false;
            that.progress = 1; // done
            onStep(that.status());
        },100);
        return true;
    }
    Steppable.isSteppable = function(obj, strict) {
        if ("function" != typeof obj.step) { 
            should(strict).not.True;
            return false;
        }
        if ("function" != typeof obj.status) { 
            should(strict).not.True;
            return false;
        }
        var status = obj.status();
        if (!status.hasOwnProperty("progress")) {
            should(strict).not.True;
            return false;
        }
        if ("number" != typeof status.progress) {
            should(strict).not.True;
            return false;
        }
        if (status.hasOwnProperty("progress") && status.err != null && !(status.err instanceof Error)) {
            should(strict).not.True;
            return false;
        }
        if (!status.hasOwnProperty("isBusy")) {
            should(strict).not.True;
            return false;
        }
        if ("boolean" != typeof status.isBusy) {
            should(strict).not.True;
            return false;
        }
        return true;
    }

    module.exports = exports.Steppable = Steppable;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Steppable", function() {
    var Steppable = exports.Steppable;
    it("isSteppable(obj) should return true if given object is Steppable object", function() {
        var st = new Steppable();
        Steppable.isSteppable(st, true).should.True;
        Steppable.isSteppable(st).should.True;
        Steppable.isSteppable({}).should.False;
    })
    it("status() should return current status", function() {
        var st = new Steppable();
        st.status().progress.should.equal(0); // nothing done yet
        st.status().isBusy.should.False; // ready for first step
        should(st.status().err).Null; // life is good
    })
    it("step(onStep) should return true if given object shall advance to the next step", function() {
        var st = new Steppable();
        var onStepProgress;
        var onStep = function(status) {
            onStepProgress = status.progress;
            status.progress.should.above(0); // monotonic increasing every step
            status.progress.should.not.above(1); // 1 is done
            status.isBusy.should.False; // ready for next step
        };
        st.step(onStep).should.True; // accepts step
        st.status().isBusy.should.True; // not accepting additional steps
        st.step(onStep).should.False; // rejects step request
        setTimeout(function() {
            st.status().progress.should.equal(1); // completed
            onStepProgress.should.equal(1); // onStep was called
            st.step(onStep).should.False; // nothing to do
            st.status().progress.should.equal(1); // we still have nothing to do
            should(st.status().err).Null; // life is good
        },200);
    })
})

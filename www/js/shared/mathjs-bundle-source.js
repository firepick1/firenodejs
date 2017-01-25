var core = require('mathjs/core');
var mathjs = core.create();
mathjs.import(require('mathjs/lib/type/matrix/Matrix'));
mathjs.import(require('mathjs/lib/type/matrix/DenseMatrix'));
mathjs.import(require('mathjs/lib/function/arithmetic/add'));
mathjs.import(require('mathjs/lib/function/arithmetic/subtract'));
mathjs.import(require('mathjs/lib/function/arithmetic/multiply'));
mathjs.import(require('mathjs/lib/function/matrix/inv'));
mathjs.import(require('mathjs/lib/function/matrix/transpose'));
mathjs.import(require('mathjs/lib/function/matrix/det'));

/*
(typeof describe === 'function') && describe("MTO_C4", function() {
    var should = require("should");
    it("TESTTESTmatrix", function() {
        var core = require('mathjs/core');
        var mathjs = core.create();
        mathjs.import(require('mathjs/lib/type/matrix/Matrix'));
        mathjs.import(require('mathjs/lib/type/matrix/DenseMatrix'));
        mathjs.import(require('mathjs/lib/function/arithmetic/add'));
        mathjs.import(require('mathjs/lib/function/arithmetic/subtract'));
        mathjs.import(require('mathjs/lib/function/arithmetic/multiply'));
        mathjs.import(require('mathjs/lib/function/matrix/inv'));
        mathjs.import(require('mathjs/lib/function/matrix/transpose'));
        mathjs.import(require('mathjs/lib/function/matrix/det'));
        var m = [[1,2],[3,4]];
        var vr = mathjs.multiply([1,1],m);
        should.deepEqual(vr, [4,6]);
        var minv = mathjs.inv(m);
        should.deepEqual(minv, [[-2,1], [1.5,-0.5]]);
        var mminv = mathjs.multiply(m, minv);
        should.deepEqual(mminv, [[1,0],[0,1]]);
        var mtrans = mathjs.transpose(m);
        should.deepEqual(mtrans, [[1,3],[2,4]]);
        mathjs.det(m).should.equal(-2);
    })
})
*/

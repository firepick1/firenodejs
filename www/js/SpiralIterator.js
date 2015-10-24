var firepick;
(function(firepick) {
    var SpiralIterator = (function() {
        function SpiralIterator(xSteps, ySteps) {
            this.xSteps = xSteps || 1;
            this.ySteps = ySteps || 1;
            if (!(xSteps > 0 && ySteps > 0)) throw "assert failed";
            this.xMax = this.xSteps / 2;
            this.yMax = ySteps ? ySteps / 2 : this.xMax;
            this.xScale = 1;
            this.yScale = 1;
            this.xOffset = 0;
            this.yOffset = 0;
            if (!(ySteps == 0 || ySteps == 1 || xSteps == 1 || ySteps == xSteps)) throw "assert failed";
            this.reset();
            return this;
        };
        SpiralIterator.prototype.getX = function() {
            return this.x * this.xScale + this.xOffset;
        };
        SpiralIterator.prototype.getY = function() {
            return this.y * this.yScale + this.yOffset;
        };
        SpiralIterator.prototype.setScale = function(xScale, yScale) {
            this.xScale = xScale;
            this.yScale = yScale;
            return this;
        }
        SpiralIterator.prototype.setOffset = function(xOffset, yOffset) {
            this.xOffset = xOffset;
            this.yOffset = yOffset;
            return this;
        }
        SpiralIterator.prototype.reset = function() {
            if (this.yMax < 1) {
                this.x = 0;
                this.y = 0;
                this.dx = 1;
                this.dy = 0;
                this.state = 6;
                this.mx = 0;
                this.my = 0;
            } else if (this.xMax < 1) {
                this.x = 0;
                this.y = 0;
                this.dx = 0;
                this.dy = 1;
                this.state = 6;
                this.mx = 0;
                this.my = 0;
            } else {
                this.x = 0;
                this.y = 0;
                this.dx = 1;
                this.dy = 0;
                this.state = 0;
                this.mx = 0;
                this.my = 0;
            }
            return this;
        };

        SpiralIterator.prototype.next = function() {
            if (this.x > this.xMax || this.y > this.yMax) {
                return false;
            }
            this.x += this.dx;
            this.y += this.dy;
            switch (this.state) {
                case 0:
                    this.state = 1;
                    this.mx++;
                    this.my++;
                    this.dx = 0;
                    this.dy = 1;
                    break;
                case 1:
                    if (this.y >= this.my) {
                        this.state = 2;
                        this.dx = -1;
                        this.dy = 0;
                    }
                    break;
                case 2:
                    if (this.x <= -this.mx) {
                        this.state = 3;
                        this.dx = 0;
                        this.dy = -1;
                    }
                    break;
                case 3:
                    if (this.y <= -this.my) {
                        this.state = 4;
                        this.dx = 1;
                        this.dy = 0;
                    }
                    break;
                case 4:
                    if (this.mx <= this.x) {
                        this.state = 5;
                        this.dx = 0;
                        this.dy = 1;
                    }
                    break;
                case 5:
                    if (0 <= this.y) {
                        this.state = 1;
                        this.mx++, this.my++;
                        this.x++;
                    }
                    break;
                case 6:
                    if (this.dx != 0) {
                        this.dx = -this.dx + (this.dx > 0 ? -1 : 1);
                    }
                    if (this.dy != 0) {
                        this.dy = -this.dy + (this.dy > 0 ? -1 : 1);
                    }
                    break;
                default:
                    throw "unknown state";
                    break;
            }

            return this.x <= this.xMax && this.y <= this.yMax ? true : false;
        };
        return SpiralIterator;
    })();
    firepick.SpiralIterator = SpiralIterator;
})(firepick || (firepick = {}));

<!-- @ifdef TEST -->
(function(firepick) {
    firepick.SpiralIteratorTest = function() {
        var ok = true;
        try {
            console.log("SpiralIteratorTest() BEGIN");
            var one = Object.create(firepick.SpiralIterator.prototype);
            var three = new firepick.SpiralIterator(3, 3);
            assert.equal(0, three.getX());
            assert.equal(0, three.getY());
            assert.equal(three, three.setScale(1, 10));
            assert.equal(three, three.setOffset(2, 3));
            assert.equal(2, three.getX());
            assert.equal(3, three.getY());
            assert.equal(true, three.next());
            assert.equal(3, three.getX());
            assert.equal(3, three.getY());
            assert.equal(true, three.next());
            assert.equal(3, three.getX());
            assert.equal(13, three.getY());
            assert.equal(true, three.next());
            assert.equal(2, three.getX());
            assert.equal(13, three.getY());
            assert.equal(true, three.next());
            assert.equal(1, three.getX());
            assert.equal(13, three.getY());
            assert.equal(true, three.next());
            assert.equal(1, three.getX());
            assert.equal(3, three.getY());
            assert.equal(true, three.next());
            assert.equal(1, three.getX());
            assert.equal(-7, three.getY());
            assert.equal(true, three.next());
            assert.equal(2, three.getX());
            assert.equal(-7, three.getY());
            assert.equal(true, three.next());
            assert.equal(3, three.getX());
            assert.equal(-7, three.getY());
            assert.equal(false, three.next());

            var four = new firepick.SpiralIterator(4, 4);
            assert.equal(0, four.getX());
            assert.equal(0, four.getY());
            assert.equal(true, four.next());
            assert.equal(1, four.getX());
            assert.equal(0, four.getY());
            assert.equal(true, four.next());
            assert.equal(1, four.getX());
            assert.equal(1, four.getY());
            assert.equal(true, four.next());
            assert.equal(0, four.getX());
            assert.equal(1, four.getY());
            assert.equal(true, four.next());
            assert.equal(-1, four.getX());
            assert.equal(1, four.getY());
            assert.equal(true, four.next());
            assert.equal(-1, four.getX());
            assert.equal(0, four.getY());
            assert.equal(true, four.next());
            assert.equal(-1, four.getX());
            assert.equal(-1, four.getY());
            assert.equal(true, four.next());
            assert.equal(0, four.getX());
            assert.equal(-1, four.getY());
            assert.equal(true, four.next());
            assert.equal(1, four.getX());
            assert.equal(-1, four.getY());
            assert.equal(true, four.next());
            assert.equal(2, four.getX());
            assert.equal(0, four.getY());
            assert.equal(true, four.next());
            assert.equal(2, four.getX());
            assert.equal(1, four.getY());
            assert.equal(true, four.next());
            assert.equal(2, four.getX());
            assert.equal(2, four.getY());
            assert.equal(true, four.next());
            assert.equal(1, four.getX());
            assert.equal(2, four.getY());
            assert.equal(true, four.next());
            assert.equal(0, four.getX());
            assert.equal(2, four.getY());
            assert.equal(true, four.next());
            assert.equal(-1, four.getX());
            assert.equal(2, four.getY());
            assert.equal(true, four.next());
            assert.equal(-2, four.getX());
            assert.equal(2, four.getY());
            assert.equal(true, four.next());
            assert.equal(-2, four.getX());
            assert.equal(1, four.getY());
            assert.equal(true, four.next());
            assert.equal(-2, four.getX());
            assert.equal(0, four.getY());
            assert.equal(true, four.next());
            assert.equal(-2, four.getX());
            assert.equal(-1, four.getY());
            assert.equal(true, four.next());
            assert.equal(-2, four.getX());
            assert.equal(-2, four.getY());
            assert.equal(true, four.next());
            assert.equal(-1, four.getX());
            assert.equal(-2, four.getY());
            assert.equal(true, four.next());
            assert.equal(0, four.getX());
            assert.equal(-2, four.getY());
            assert.equal(true, four.next());
            assert.equal(1, four.getX());
            assert.equal(-2, four.getY());
            assert.equal(true, four.next());
            assert.equal(2, four.getX());
            assert.equal(-2, four.getY());
            assert.equal(true, four.next());
            assert.equal(2, four.getX());
            assert.equal(-1, four.getY());
            assert.equal(false, four.next());

            var threeX = new firepick.SpiralIterator(3, 1);
            assert.equal(0, threeX.getX());
            assert.equal(0, threeX.getY());
            assert.equal(true, threeX.next());
            assert.equal(1, threeX.getX());
            assert.equal(0, threeX.getY());
            assert.equal(true, threeX.next());
            assert.equal(-1, threeX.getX());
            assert.equal(0, threeX.getY());
            assert.equal(false, threeX.next());

            var threeY = new firepick.SpiralIterator(1, 3);
            assert.equal(0, threeY.getX());
            assert.equal(0, threeY.getY());
            assert.equal(true, threeY.next());
            assert.equal(0, threeY.getX());
            assert.equal(1, threeY.getY());
            assert.equal(true, threeY.next());
            assert.equal(0, threeY.getX());
            assert.equal(-1, threeY.getY());
            assert.equal(false, threeY.next());
            console.log("SpiralIteratorTest() PASS");
        } catch (ex) {
            console.log("ERROR	: " + JSON.stringify(ex));
            ok = false;
        }
        return {
            name: "SpiralIteratorTest",
            outcome: ok,
            description: "Spiral movement generator"
        };
    }

})(firepick || (firepick = {}));
<!-- @endif -->

//exports.SpiralIterator = firepick.SpiralIterator;

var firepick;

(function(firepick) {
    var SpiralIterator = (function() {
        function SpiralIterator(xSteps, ySteps) {
            if (!(xSteps > 0 && ySteps > 0)) throw "assert failed";
            this.xSteps = xSteps;
            this.ySteps = ySteps;
            this.xMax = xSteps / 2;
            this.yMax = ySteps ? ySteps / 2 : this.xMax;
            this.xScale = 1;
            this.yScale = 1;
            this.xOffset = 0;
            this.yOffset = 0;
            if (!(ySteps == 0 || ySteps == 1 || xSteps == 1 || ySteps == xSteps)) throw "assert failed";
            this.reset();
        }
        SpiralIterator.prototype.clone = function() {
            return new SpiralIterator(this.xSteps, this.ySteps);
        };

        return SpiralIterator;
    })();
    firepick.SpiralIterator = SpiralIterator;
})(firepick || (firepick = {}));

//exports.SpiralIterator = firepick.SpiralIterator;

/*

--------------
SpiralIterator::SpiralIterator(int xSteps, int ySteps) {
  assert(xSteps > 0 && ySteps > 0);
  this->xMax = xSteps/2;
  this->yMax = ySteps ? ySteps/2 : this->xMax;
  this->xScale = 1;
  this->yScale = 1;
  this->xOffset = 0;
  this->yOffset = 0;
  assert(ySteps == 0 || ySteps == 1 || xSteps == 1 || ySteps == xSteps);
  reset();
  };

void SpiralIterator::reset() {
  if (yMax == 0) {
    this->x = -xMax;
    this->y = 0;
    this->dx = 1;
    this->dy = 0;
    this->state = 6;
    this->mx = 0;
    this->my = 0;
  } else if (xMax == 0) {
    this->x = 0;
    this->y = -yMax;
    this->dx = 0;
    this->dy = 1;
    this->state = 6;
    this->mx = 0;
    this->my = 0;
  } else {
    this->x = 0;
    this->y = 0;
    this->dx = 1;
    this->dy = 0;
    this->state = 0;
    this->mx = 0;
    this->my = 0;
  }
}

bool SpiralIterator::next() {
  if (x > xMax || y > yMax) { return FALSE; }
  x += dx; 
  y += dy; 
  switch (state) {
    case 0: state = 1; mx++; my++; dx = 0; dy = 1; break;
    case 1: if (y >= my) { state = 2; dx = -1; dy = 0; } break;
    case 2: if (x <= -mx ) { state = 3; dx = 0; dy = -1; } break;
    case 3: if (y <= -my ) { state = 4; dx = 1; dy = 0; } break;
    case 4: if (mx <= x) { state = 5; dx = 0; dy = 1; } break;
    case 5: if (0 <= y) { state = 1; mx++, my++; x++; } break;
    case 6: break;
    default: assert(FALSE); break;
  }
  // cout << "state:" << state << " mx:"<<mx << " my:"<<my << " dx:"<<dx << " dy:"<<dy << " x:"<<x << " y:"<<y << " xMax:"<<xMax<< endl;
  
  return x <= xMax && y <= yMax ? TRUE : FALSE;
}

*/

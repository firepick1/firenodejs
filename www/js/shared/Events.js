var should = require("should");

(function(exports) {

    // Accepts a MouseEvent as input and returns the x and y
    // coordinates relative to the target element.
    var getMouseXY = function(mouseEvent) {
        var result = {
            x: 0,
            y: 0
        };

        if (!mouseEvent) {
            mouseEvent = window.event;
        }

        if (mouseEvent.pageX || mouseEvent.pageY) {
            result.x = mouseEvent.pageX;
            result.y = mouseEvent.pageY;
        } else if (mouseEvent.clientX || mouseEvent.clientY) {
            result.x = mouseEvent.clientX + document.body.scrollLeft +
                document.documentElement.scrollLeft;
            result.y = mouseEvent.clientY + document.body.scrollTop +
                document.documentElement.scrollTop;
        }

        if (mouseEvent.target) {
            var offEl = mouseEvent.target;
            var offX = 0;
            var offY = 0;

            if (typeof(offEl.offsetParent) != "undefined") {
                while (offEl) {
                    offX += offEl.offsetLeft;
                    offY += offEl.offsetTop;

                    offEl = offEl.offsetParent;
                }
            } else {
                offX = offEl.x;
                offY = offEl.y;
            }

            result.x -= offX;
            result.y -= offY;
        }

        return result;
    };

    var Events = {
        getMouseXY: getMouseXY,
    }
    module.exports = exports.Events = Events;
})(typeof exports === "object" ? exports : (exports = {}));

// mocha -R min --inline-diffs *.js
(typeof describe === 'function') && describe("Events", function() {
    var Events = exports.Events;
    it("getCrossBrowserElementCoords(evt)", function() {});
})

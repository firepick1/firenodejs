firenodejs
----------

0.5.1
---
* NEW: demo firenodejs with mock FireStep: node js/server --mock-fpd

0.5
---
* NEW: LPP moves automatically introduced for absolute moves (i.e., mov)
* NEW: Delta kinematic model used for path planning and user interface validation
* NEW: Marks show warning symbol if position is not on microstep grid
* NEW: UI disabled while move in progress (no click ahead)
* NEW: lppSpeed controls LPP speed with conservative default for best precision
* NEW: lppZ controls LPP high point with default of Z50
* NEW: msSettle specifies time for camera autoexposure convergence with default of 600ms

0.4.1
---
* NEW: FireStep serial path can now be changed from web page (and REST)

0.4
---
* NEW: Accordion user interface
* NEW: Mutable state saved to /var/firenodejs/firenodejs.json
* NEW: Up to 6 marks can now be named and edited
* NEW: Initialization commands are saved and can be used for FireStep robots without EEPROM
* NEW: Measure now provides min, max, avg stats for xErr and yErr

0.3
---
* NEW: Images cycle through three standard sizes
* NEW: Images can have reticle and/or crosshair overlay for lining things up

0.2.1
---
* NEW: added link to calibration grid

0.2
---
* GUI: Display level
* GUI: Measure jog and LPP precision
* GUI: version number

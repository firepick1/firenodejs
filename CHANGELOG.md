firenodejs
----------

0.16.0
------
* NEW: Reimplemented browser/server synchronization protocol using Synchronizer.js
* NEW: Camera autoRefresh checkbox
* FIX: /firekue now uses hostname instead of localhost in responses

0.15.1
------
* FIX: node-install should have used ./npm instead of npm

0.15.0
------
* NEW: /firesight/match-cds matches crash dummy symbol
* FIX: progress works again

0.14.3
------
* FIX: --verbose works again

0.14.2
------
* FIX: Cannot read property 'x' of undefined (Thanks, Reef!)

0.14.1
------
* FIX: firenodejs.log cleanup. Remove confusing warnings and add FireSight EXEC information.

0.14.0
------
* NEW: Changed /firesight error handling to return HTTP200 and null fields instead of HTTP500 for expected errors (e.g., no calc-offset)
* NEW: Improved error handling with JsonError (Error is not serializable)
* NEW: firenodejs saves backup file and restores from backup if saved models are corrupt.
* NEW: install.sh now installs and builds FireSight if required
* FIX: UI panels are sticky when you change tabs
* FIX: SyncService synchronizes browser client with server changes made by FireKue jobs
    
0.13.1
------
* NEW: scripts/addjob.sh lets you upload FireKue jobs from command line
* NEW: scripts/stepjob.sh lets you step FireKue jobs from command line
* NEW: various UI tweaks to Jobs tab
* NEW: upgrade to bootstrap 3.3.6
* NEW: upgrade to angular 1.4.9
* NEW: upgrade to angular bootstrap 1.1.1

0.13.0
------
* NEW: Steppable /firekue with RESTworker test job(s)

0.12.2
------
* NEW: added support for x86 architecture

0.12.1
------
* NEW: Upgraded to node v5.5.0

0.12.0
------
* FIX: aspect ratio of displayed image now matches camera image
* NEW: save camera image to named file
* NEW: CalcOffset compares camera image with location image or named image file
* NEW: CalcFgRect compares camera image with location image or named image file

0.11.0
------
* NEW: scripts/startup.sh launches firenodejs as server daemon
* NEW: scripts/shutdown.sh kills all firenodejs processes
* NEW: added RMS Error (rmse) to /firesight/calc-grid
* NEW: input fields no longer lose focus during active typing (background save bug)
* NEW: preview of new Jobs tab
* NEW: Simplified and renamed FireStep initialization UI as Reset. 

0.10.0
------
* NEW: TinyG support for cartesian machines (Thank you, Anthony Webb!)
* NEW: New Calibrate tab splits and simplifies Home tab
* NEW: Scan /mesh accordion with DeltaMesh UI teaser (WIP)

0.9.0
-----
* NEW: ReadQR decodes QR code (sometimes)

0.8.2
-----
* FIX: Initialization startup JSON UI was unusable
* FIX: mock support for comments {"cmt":"anything"}

0.8.1
-----
* FIX: Regression error on measure.js

0.8
---
* NEW: CalcFgRect calculates bounding rectangle of foreground object
* RENAME: MeasureGrid renamed to CalcGrid

0.7
---
* NEW: 4mm calibration grid replaces 5mm calibration grid
* NEW: MeasureGrid measures grid
* NEW: CalcOffset UI provides better feedback on non-match
* FIX: Location-based images sometimes didn't update correctly

0.6
---
* NEW: tracks and displays XYZ nominal and microstep-grid position 
* NEW: pluggable kinematic models: mto-fpd, mto-xyz

0.5.2
---
* FIX: pushQueue bug fixed

0.5.1 (DO NOT USE)
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

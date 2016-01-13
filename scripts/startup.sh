#!/bin/bash
pushd $(dirname "$0")/.. > /dev/null
echo -e "INFO\t: launching firenodejs server daemon" > firenodejs.log
nohup node js/server.js 0<&- &>> firenodejs.log &
popd > /dev/null

exit 0

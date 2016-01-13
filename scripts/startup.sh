#!/bin/bash

scripts/shutdown.sh

pushd $(dirname "$0")/.. > /dev/null
echo -e "START\t: `pwd`/$0\t`date`" | tee -a firenodejs.log
echo -e "INFO\t: launching firenodejs server daemon as user:`whoami`" | tee -a firenodejs.log
nohup node js/server.js $@ 0<&- &>> firenodejs.log &
popd > /dev/null
echo -e "END\t: `pwd`/$0\t`date`" | tee -a firenodejs.log

exit 0

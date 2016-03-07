#!/bin/bash

scripts/shutdown.sh

pushd $(dirname "$0")/.. > /dev/null
mkdir -p logs
LOGNAME=logs/firenodejs`date +%F-%H%M`.log
ln -sf $LOGNAME firenodejs.log
echo -e "START\t: `pwd`/$0\t`date`" | tee $LOGNAME
echo -e "INFO\t: logging to $LOGNAME" | tee -a $LOGNAME
echo -e "INFO\t: launching firenodejs server daemon as user:`whoami`" | tee -a firenodejs.log
nohup ./node js/server.js $@ 0<&- &>> $LOGNAME &
popd > /dev/null
echo -e "END \t: `pwd`/$0\t`date`" | tee -a $LOGNAME

exit 0

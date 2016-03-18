#!/bin/bash

scripts/shutdown.sh

pushd $(dirname "$0")/.. > /dev/null
MONTHSTAMP=`date +%Y%m`
mkdir -p logs/$MONTHSTAMP
TIMESTAMP=`date +%Y%m-%d-%H%M`
LOGNAME=logs/$MONTHSTAMP/firenodejs$TIMESTAMP.log
JSONNAME=logs/$MONTHSTAMP/firenodejs$TIMESTAMP.json
ln -sf $LOGNAME firenodejs.log
echo -e "START\t: `pwd`/$0\t`date`" | tee $LOGNAME
echo -e "INFO\t: logging to $LOGNAME" | tee -a $LOGNAME
echo -e "INFO\t: launching firenodejs server daemon as user:`whoami`" | tee -a firenodejs.log
nohup ./node js/server.js $@ 0<&- &>> $LOGNAME &
sleep 3
echo -e "INFO\t: saving firenodejs state to $JSONNAME" | tee -a $LOGNAME
cp -r /var/firenodejs/firenodejs.json.bak $JSONNAME
popd > /dev/null
echo -e "END \t: `pwd`/$0\t`date`" | tee -a $LOGNAME

exit 0

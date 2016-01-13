#!/bin/bash
function killCommand {
    PID=`ps -eo pid,comm | grep $1 | sed -e "s/[^0-9]*//g"`
    if [ "$PID" == "" ]; then
        echo -e "INFO\t: no action taken ($1 not found)" | tee -a firenodejs.log
    else
        echo -e "INFO\t: killing $1 (PID$PID)" | tee -a firenodejs.log
        kill $PID
    fi
}

pushd $(dirname "$0")/.. > /dev/null
echo -e "\nSTART\t: `pwd`/$0\t`date`" | tee firenodejs.log
killCommand raspistill
killCommand node
killCommand firestep
echo -e "END\t: `pwd`/$0\t`date`" | tee -a firenodejs.log
popd > /dev/null

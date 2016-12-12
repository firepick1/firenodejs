#!/bin/bash
function killCommand {
    PID=`ps -eo pid,comm | grep $1 | sed -e "s/[^0-9]*//g"`
    if [ "$PID" == "" ]; then
        echo -e "INFO\t: $1 shutdown: not required" | tee -a firenodejs.log
    else
        echo -e "INFO\t: $1 shutdown: kill PID$PID" | tee -a firenodejs.log
        kill $PID
        echo -e "INFO\t: $1 shutdown: kill `pgrep -f firenodejs`" | tee -a firenodejs.log
        pkill -f firenodejs
    fi
}

pushd $(dirname "$0")/.. > /dev/null
echo -e "\nSTART\t: `pwd`/$0\t`date`" | tee -a firenodejs.log
killCommand raspistill
killCommand ./node
killCommand node
killCommand firestep
echo -e "INFO\t: firenodejs shutdown completed" | tee -a firenodejs.log
echo -e "END\t: `pwd`/$0\t`date`" | tee -a firenodejs.log
popd > /dev/null

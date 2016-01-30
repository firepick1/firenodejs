#!/bin/bash

echo -e "\nSTART\t: `pwd`/$0\t`date`"

PORT=8080
HOST=localhost
STEP=1

while [ "$1" != "" ]; do
    if [ "$1" == "-p" ]; then
        shift
        PORT=$1
        if [ "$PORT" == "" ]; then
            echo -e "ERROR\t: expected port number"
            echo -e "EXAMPLE\t: scripts/stepjob -p 8080 -h localhost"
            exit -1
        fi
    elif [ "$1" == "-a" ]; then
        STEP=0
    elif [ "$1" == "-h" ]; then
        shift
        HOST=$1
        if [ "$HOST" == "" ]; then
            echo -e "ERROR\t: expected host name"
            echo -e "EXAMPLE\t: scripts/stepjob -p 8080 -h localhost"
        fi
    fi
    shift
done

DONE=0
URL=http://$HOST:$PORT/firekue/step 
echo -e "INFO\t: URL:$URL"

TMP=`mktemp`
echo -e "INFO\t: TMP:$TMP"

until [ $DONE -eq 1 ]; do
    curl -s $URL > $TMP
    RC=$?; if [ $RC -ne 0 ]; then
        echo -e "FAIL\t: curl rc:$RC"
        exit -1
    fi
    grep -e ":1}" $TMP > /dev/null
    RC=$?; if [ $RC -eq 0 ]; then
        echo -e "INFO\t: No more jobs to execute"
        DONE=1
    else
        echo -e "INFO\t: `cat $TMP`"
    fi
    if [ $STEP -eq 1 ]; then
        DONE=1
    fi
done

echo -e "END\t: `pwd`/$0\t`date`"

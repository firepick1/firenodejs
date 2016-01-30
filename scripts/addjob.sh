#!/bin/bash

echo -e "\nSTART\t: `pwd`/$0\t`date`"

PORT=8080
HOST=localhost

while [ "$1" != "" ]; do
    if [ "$1" == "-p" ]; then
        shift
        PORT=$1
        if [ "$PORT" == "" ]; then
            echo -e "ERROR\t: expected port number"
            echo -e "EXAMPLE\t: scripts/addjob.sh -p 8080 -h localhost json/testjob.json"
            exit -1
        fi
    elif [ "$1" == "-h" ]; then
        shift
        HOST=$1
        if [ "$HOST" == "" ]; then
            echo -e "ERROR\t: expected host name"
            echo -e "EXAMPLE\t: scripts/addjob.sh -p 8080 -h localhost json/testjob.json"
        fi
    else
        JSON=$1
    fi
    shift
done

if [ "$JSON" == "" ]; then
    echo -e "ERROR\t: expected JSON file path"
    echo -e "EXAMPLE\t: scripts/addjob.sh -p 8080 -h localhost json/testjob.json"
    exit -1
fi

echo -e "INFO\t: PORT:$PORT"
echo -e "INFO\t: HOST:$HOST"
echo -e "INFO\t: JSON:$JSON"
URL=http://$HOST:$PORT/firekue/job 
echo -e "INFO\t: URL:$URL"

curl \
    -X POST \
    -H "Content-Type: application/json" \
    --data-binary @$JSON \
    $URL
RC=$?; if [ $RC -ne 0 ]; then
    echo -e "FAIL\t: curl rc:$RC"
    exit -1
fi

echo -e "\nEND\t: `pwd`/$0\t`date`"

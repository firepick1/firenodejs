#!/bin/bash

HOST=localhost:8080
if [ "$1" == "-h" ]; then
    HOST=$1
    if [ "$HOST" == "" ]; then
        HOST=localhost:8080
    fi
    shift
fi

JSON=$1
if [ "$JSON" == "" ]; then
    echo -e "ERROR\t: expected JSON file path"
    echo -e "EXAMPLE\t: scripts/addjob.sh -p 8080 -h localhost json/testjob.json"
    exit -1
fi

curl \
    -X POST \
    -H "Content-Type: application/json" \
    --data-binary @$JSON \
    http://$HOST/firekue/job 

echo

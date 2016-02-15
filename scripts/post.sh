#!/bin/bash

VERBOSE=0

function help() {
    echo -e "HELP\t: Send JSON POST request to firenodejs server at URL"
    echo -e "HELP\t:   scripts/post.sh [options] URL JSON"
    echo -e "HELP\t: Send CLONE sync request to localhost"
    echo -e "HELP\t:   scripts/post.sh http://localhost:8080/firenodejs/sync '{\"op\":\"CLONE\"}'"
    echo -e "HELP\t: Send CLONE sync request to localhost (verbose)"
    echo -e "HELP\t:   scripts/post.sh -v http://localhost:8080/firenodejs/sync '{\"op\":\"CLONE\"}'"
}

if [ $VERBOSE -eq 1 ]; then echo -e "\nSTART\t: `pwd`/$0\t`date`"; fi

while [ "$1" != "" ]; do
    if [ "$1" == "-v" ]; then
        VERBOSE=1
    elif [ "$URL" == "" ]; then
        URL=$1
    elif [ "$JSON" == "" ]; then
        JSON=$1
    fi
    shift
done
if [ "$URL" == "" ]; then
    echo -e "ERROR\t: expected URL"; 
    help
    exit -1
fi
if [ "$JSON" == "" ]; then
    echo -e "ERROR\t: expected JSON"; 
    help
    exit -1
fi

if [ $VERBOSE -eq 1 ]; then echo -e "INFO\t: JSON=$JSON"; fi
if [ $VERBOSE -eq 1 ]; then echo -e "INFO\t: URL=$URL"; fi
if [ $VERBOSE -eq 1 ]; then CURLOPTS=-v; fi

curl \
    $CURLOPTS \
    -X POST \
    -H "Content-Type: application/json" \
    --data-binary $JSON \
    $URL
RC=$?; if [ $RC -ne 0 ]; then
    echo -e "FAIL\t: curl rc:$RC"
    exit -1
fi

if [ $VERBOSE -eq 1 ]; then echo -e "\nEND\t: `pwd`/$0\t`date`"; fi
echo

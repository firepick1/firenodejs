#!/bin/bash

IMG=/var/img
if [ ! -e $IMG ]; then
    echo -e "INFO\t: creating $IMG as RAM disk for camera images"
    sudo mkdir -p $IMG
    RC=$?; if [ $RC -ne 0 ]; then
        echo -e "ERROR\t: could not create $IMG"
        exit $RC
    fi
fi
MOUNT="mount -t tmpfs -o size=64m tmpfs $IMG"
df /var/img |& grep -q tmpfs
RC=$?; if [ $RC -eq 0 ]; then
    echo -e "INFO\t: $IMG is mounted as tmpfs"
else
    echo -e "INFO\t: mounting $IMG as tmpfs"
    sudo $MOUNT
    RC=$?; if [ $RC -ne 0 ]; then
        echo -e "ERROR\t: sudo $MOUNT failed => $RC"
        exit $RC
    fi
fi
STARTUP=/etc/rc.local
if [ -e $STARTUP ]; then
    grep -q $IMG $STARTUP
    RC=$?; if [ $RC -ne 0 ]; then
        echo -e "INFO\t: configuring $STARTUP to mount $IMG as RAM disk"
        sudo sed -i -e "$ i $MOUNT" $STARTUP
    else 
        echo -e "INFO\t: $STARTUP will mount $IMG as RAM disk"
    fi
else
    echo -e "WARN\t: $STARTUP not found. Cannot mount $IMG as RAM disk on startup"
fi


#!/bin/bash

echo -e "\nSTART\t: `pwd`/$0\t `date`"

if [ "$SUDO_USER" != "" ]; then
  echo "ERROR	: This script must be run by non-root user"
  echo "TRY	:   scripts/install.sh"
  exit -1
fi

read -p "WARN	: This script may use sudo to change your system. Type \"y\" to proceed: " SUDOOK
if [ "$SUDOOK" != "y" ]; then
    echo -e "END\t: `pwd`/$0 (CANCELLED)"
	exit -1;
fi

function cmd() {
    echo -e "CMD\t: $1"
    $1
    RC=$?; 
    if [ $RC != 0 ]; then 
        echo "ERROR\t: $1 => $RC"; 
        if [ "$2" == "" ]; then 
            exit -1; 
        else
            $2
        fi
    fi
}

##################### firestep
#if [ "$(type -p firestep)" == "" ]; then
	echo "INFO	: Installing firestep..."
    pushd cli
    ./build
    sudo make install
	RC=$?; if [ $RC != 0 ]; then echo "ERROR	: installation failed ($RC)"; exit -1; fi
	popd
#fi
echo -e "INFO\t: firestep `firestep --version`"

####################### nodejs
scripts/node-v5-install

################## /var/firenodejs
FIRENODEJS=${FIRENODEJS}
if [ "$FIRENODEJS" == "" ]; then FIRENODEJS=/var/firenodejs; fi
if [ ! -e $FIRENODEJS ]; then
    echo -e "INFO\t: creating $FIRENODEJS for persistent storage"
    sudo mkdir -p $FIRENODEJS
    sudo chown $USER $FIRENODEJS
fi
echo -e "INFO\t: `ls -ld $FIRENODEJS`"

################## /var/img
IMG=${IMG}
if [ "$IMG" == "" ]; then IMG=/var/img; fi
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

############### streamer for USB cam
if [ "$(type -p streamer)" == "" ]; then
    echo -e "INFO\t: installing streamer for USB camera support"
    CMD="sudo apt-get install streamer"
    $CMD
    RC=$?; if [ $RC -ne 0 ]; then
        echo -e "ERROR\t: $CMD failed => $RC"
        exit $RC
    fi
fi
echo -e "INFO\t: streamer `streamer -h |& grep '(c)'`"

######################## END
echo -e "END\t: `pwd`/$0 (COMPLETE) `date`"

######################## build
scripts/build


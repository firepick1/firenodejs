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
if [ "$(type -p firestep)" == "" ]; then
	echo "INFO	: Installing firestep..."
    pushd cli
    ./build
    sudo make install
	RC=$?; if [ $RC != 0 ]; then echo "ERROR	: installation failed ($RC)"; exit -1; fi
	popd
fi
echo -e "INFO\t: firestep `firestep --version`"

####################### nodejs
if [ "$(type -p node)" == "" ]; then
	echo "INFO	: Installing nodejs..."
	sudo apt-get install -y nodejs npm
	RC=$?; if [ $RC != 0 ]; then echo "ERROR\t: installation failed ($RC)"; exit -1; fi
    if [ "$(type -p node)" == "" ]; then
        echo "WARN\t: node unavailable, creating symlink"
        if [ -e /usr/bin/nodejs ]; then
            cmd "sudo ln -s /usr/bin/nodejs /usr/bin/node"
        elif [ -e /usr/local/bin/nodejs ]; then
            cmd "sudo ln -s /usr/local/bin/nodejs /usr/local/bin/node"
        else
            echo "ERROR\t: could not create symlink to nodejs"
            exit -1
        fi
    else
        cmd "npm install serialport@2.0.2", "echo -e 'INFO\t: using firestep cli'"
    fi
fi
echo -e "INFO\t: node `node --version`"
cmd "npm install"

######################## END
echo -e "END\t: `pwd`/$0 (COMPLETE) `date`"

######################## build
scripts/build


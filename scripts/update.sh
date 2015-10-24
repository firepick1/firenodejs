#!/bin/bash

echo -e "\nSTART\t: `pwd`/$0\t `date`"

echo -e "INFO\t: updating git repository"
git fetch
git merge origin

######################## END
echo -e "END\t: `pwd`/$0 (COMPLETE) `date`"

######################## build
scripts/build


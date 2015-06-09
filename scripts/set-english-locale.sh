#!/bin/bash
echo "Setting english locale..."

## set locale before retrieving date, to be consistent with nodejs log
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
locale

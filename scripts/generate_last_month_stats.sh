#!/bin/bash
echo "Hello world, it's generate month"
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

## set locale before retrieving date, to be consistent with nodejs log
source $DIR/set-english-locale.sh

## load kermit env to be able to access SMTP_HOST variables
source $DIR/load-kermit-env.sh

LASTMONTH=$(date -d '15 days ago' '+%b %Y')

$DIR/generate-stat-for-date.sh "$LASTMONTH"

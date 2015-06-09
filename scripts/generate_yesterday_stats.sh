#!/bin/bash
echo "Hello world, it's generate yesterday"
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

## set locale before retrieving date, to be consistent with nodejs log
source $DIR/set-english-locale.sh

## load kermit env to be able to access SMTP_HOST variables
source $DIR/load-kermit-env.sh

YESTERDAY=$(date -d 'yesterday' '+%-d %b %Y')

$DIR/generate-stat-for-date.sh "$YESTERDAY"

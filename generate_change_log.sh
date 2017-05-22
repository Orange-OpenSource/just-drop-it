#!/bin/sh
RELEASE_COUNT=0
if [ $# -eq 1 ]
then
  RELEASE_COUNT=$1
fi
node_modules/conventional-changelog-cli/cli.js -i CHANGELOG.md -p angular -r$RELEASE_COUNT --config config_changelog.json -o CHANGELOG.md


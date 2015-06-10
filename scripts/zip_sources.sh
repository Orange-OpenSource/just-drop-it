#!/bin/bash
OUTFILE=just-drop-it.zip
SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PROJECT_DIR="$SCRIPT_DIR/../../just-drop-it"

cd $PROJECT_DIR
if [ ! -f $OUTFILE ]; then
    echo "Zipping folder $PROJECT_DIR"
    zip -r  $OUTFILE . -x "*.DS_Store" -x "*.git*" -x "*node_modules/*" -x "*.mp4" -x "*.zip" -x "*MACOSX" -x "*.idea/*" -x "*iml" -x "*.openshift/*"
else
    echo "File $OUTFILE already exists!"
fi


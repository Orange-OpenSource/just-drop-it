#!/bin/bash
echo "Loading kermit environment variables"

function load_env {
    [ -z "$1" ] && return 1
    [ -f "$1" ] || return 0


    local key=$(basename $1)
    export $key="$(< $1)"
}

for f in /etc/openshift/env/*
do
    load_env $f
done

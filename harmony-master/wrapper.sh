#!/usr/bash

charm_file="$HOME/.charm.exe"

if [ -f "$charm_file" ]; then
    touch "$charm_file"
    ./harmony "$@"
fi

#!/bin/bash
# Gas Charts Generation Wrapper
# This script ensures the correct Python interpreter is used

/usr/bin/python3 "$(dirname "$0")/generate-gas-charts.py" "$@"


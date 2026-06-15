#!/bin/bash

# Diagnostic script to detect serial fetch patterns (N+1 queries)
# usage: ./detect_n_plus_one.sh <directory>

SEARCH_DIR=${1:-"."}

echo "--- Searching for serial fetch patterns (await in loops/sequences) ---"

# Look for 'await' inside map, for, or consecutive lines
# This is a heuristic search
grep -r -n -C 2 "await" "$SEARCH_DIR" | grep -E "for|map|while|forEach" -A 2 -B 2

echo ""
echo "--- Searching for multiple await calls in the same block ---"
grep -r -n "await" "$SEARCH_DIR" | awk -F: '{print $1":"$2}' | uniq -d

echo "Note: These are heuristics. Please manually verify the context."

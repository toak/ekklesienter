#!/bin/bash

# Diagnostic script to identify components missing React.memo that are used in lists
# usage: ./audit_renders.sh <directory>

SEARCH_DIR=${1:-"."}

echo "--- Auditing list item components for React.memo ---"

# Find files that look like list items but don't contain 'memo'
# Typically they end with 'Item' or are inside 'components' folder of a feature
grep -rL "React.memo" "$SEARCH_DIR" --include="*Item.tsx"

echo ""
echo "--- Searching for .map() usage where the child component is not memoized ---"
# Searching for .map() usage where the child component is not memoized
grep -r -n "\.map(.*=>.*<[A-Z]" "$SEARCH_DIR"

echo "Check the identified components to see if they perform expensive renders."

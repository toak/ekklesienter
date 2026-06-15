#!/usr/bin/env bash
# detect_performance_issues.sh — Find React/Framer Motion performance anti-patterns
# Usage: bash detect_performance_issues.sh <target_dir>

set -euo pipefail

TARGET="${1:-.}"
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "=============================="
echo " PERFORMANCE ISSUE SCAN"
echo " Target: $TARGET"
echo "=============================="

echo ""
echo "${RED}🔴 CRITICAL: Full lodash import${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E "import\s+_\s+from\s+'lodash'|import\s+lodash|from\s+'lodash'" \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v "lodash/" || echo "  ✅ No full lodash imports"

echo ""
echo "${RED}🔴 CRITICAL: Full d3 import${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E "import\s+\*\s+as\s+d3\s+from|from\s+'d3'" \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v "d3-" || echo "  ✅ No full d3 imports"

echo ""
echo "${RED}🔴 CRITICAL: Zustand store without selector${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E 'use\w+Store\(\)' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | grep -v 'create<' || echo "  ✅ All store calls use selectors"

echo ""
echo "${YELLOW}🟡 WARNING: Inline functions in JSX (onClick={() => ...)${NC}"
echo "-------------------------------"
grep -rn --include='*.tsx' \
  -E 'on[A-Z]\w+=\{(\(\)|e|\w+)\s*=>' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | head -30 || echo "  ✅ None found"

echo ""
echo "${YELLOW}🟡 WARNING: Missing React.memo on list items${NC}"
echo "-------------------------------"
# Heuristic: components in files with "Item", "Row", "Card" in name, not wrapped in memo
for f in $(find "$TARGET" -name '*Item*.tsx' -o -name '*Row*.tsx' -o -name '*Card*.tsx' 2>/dev/null | grep -v node_modules); do
  if ! grep -q 'React.memo\|memo(' "$f" 2>/dev/null; then
    echo "  ⚠️  $f — list-like component without React.memo"
  fi
done
echo "  (End of check)"

echo ""
echo "${YELLOW}🟡 WARNING: Animating layout properties (height, width, top, left)${NC}"
echo "-------------------------------"
grep -rn --include='*.tsx' \
  -E "animate=\{[^}]*(height|width|top|left)" \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -15 || echo "  ✅ No layout animations found"

echo ""
echo "${CYAN}📊 INFO: Large files (>500 lines)${NC}"
echo "-------------------------------"
find "$TARGET" \( -name '*.ts' -o -name '*.tsx' \) ! -path '*/node_modules/*' ! -name '*.test.*' -exec awk 'END{if(NR>500) print NR" lines: "FILENAME}' {} \; 2>/dev/null || echo "  ✅ All files under 500 lines"

echo ""
echo "${CYAN}📊 INFO: Eager imports in App.tsx / router${NC}"
echo "-------------------------------"
grep -n --include='*.tsx' \
  -E "^import\s+\w+\s+from\s+'\./(features|pages)" \
  "$TARGET/App.tsx" "$TARGET/src/App.tsx" 2>/dev/null | grep -v 'lazy' || echo "  ✅ No eager feature imports found (or file not at expected path)"

echo ""
echo "=============================="
echo " SCAN COMPLETE"
echo "=============================="

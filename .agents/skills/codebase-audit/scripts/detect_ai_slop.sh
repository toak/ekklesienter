#!/usr/bin/env bash
# detect_ai_slop.sh — Find AI-generated technical debt patterns
# Usage: bash detect_ai_slop.sh <target_dir>

set -uo pipefail

TARGET="${1:-.}"
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "=============================="
echo " AI-SLOP PATTERN SCAN"
echo " Target: $TARGET"
echo "=============================="

# Setup Markdown Reporting
REPORT_DIR="docs/codebase-audit"
mkdir -p "$REPORT_DIR"
DATE=$(date +%Y-%m-%d)
REPORT_FILE="$REPORT_DIR/audit-$DATE.md"

{
  echo "# 🛡️ Codebase Audit Report — $DATE"
  echo ""
  echo "## 📊 Summary"
  echo "- **Target Directory**: \`$TARGET\`"
  echo "- **Scan Date**: $DATE"
} > "$REPORT_FILE"

# Helper to log findings
log_finding() {
  local title="$1"
  local output="$2"
  if [ -n "$output" ] && [ "$output" != " " ] && [ "$output" != "" ]; then
    echo "### $title" >> "$REPORT_FILE"
    echo "\`\`\`" >> "$REPORT_FILE"
    echo -e "$output" >> "$REPORT_FILE"
    echo "\`\`\`" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
  fi
}

# ──────────────────────────────────────────────
echo ""
echo "${CYAN}🧪 STEP: Running Automated Tests (npm run test)${NC}"
echo "-------------------------------"
if npm run test -- run > /tmp/audit_tests.log 2>&1 || npm run test > /tmp/audit_tests.log 2>&1; then
  echo "  ✅ Tests Passed"
  echo "- **Test Status**: ✅ Passed" >> "$REPORT_FILE"
else
  echo "  ❌ Tests Failed (Check /tmp/audit_tests.log)"
  echo "- **Test Status**: ❌ FAILED" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "### ❌ Test Failures" >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
  sed 's/\x1b\[[0-9;]*m//g' /tmp/audit_tests.log | tail -n 20 >> "$REPORT_FILE"
  echo "\`\`\`" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "## 🔍 Findings" >> "$REPORT_FILE"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: useCallback/useMemo called inside JSX${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' -E '\{\s*(useCallback|useMemo)\(' "$TARGET" 2>/dev/null | grep -v 'node_modules' || true)
echo "$RES" || echo "  ✅ No hooks in JSX found"
log_finding "Hooks inside JSX (Rule of Hooks Violation)" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: Hook called after Early Return (Violation)${NC}"
echo "-------------------------------"
RES=""
find "$TARGET" -name "*.tsx" | while read -r file; do
  # Find first early return (heuristic: return followed by semicolon or JSX, not at end of file)
  FIRST_RETURN=$(grep -nE 'return\s+(null|true|false|<|\[|\{)' "$file" | head -1 | cut -d: -f1)
  if [ -z "$FIRST_RETURN" ]; then continue; fi
  
  # Find hooks below this line
  HOOKS_BELOW=$(tail -n +"$((FIRST_RETURN + 1))" "$file" | grep -nE 'const.*=\s*use[A-Z]|use[A-Z][a-zA-Z]+\(' || true)
  if [ -n "$HOOKS_BELOW" ]; then
     # Check if this isn't just the very last return of the component
     LAST_LINE=$(wc -l < "$file" | tr -d ' ')
     if [ "$FIRST_RETURN" -lt $((LAST_LINE - 10)) ]; then
       MSG="🔴 $file — Hook called after return on line $FIRST_RETURN"
       echo "  $MSG"
       RES="${RES}${MSG}\n"
     fi
  fi
done | head -10
log_finding "Hooks after Early Returns" "$(echo -e "$RES")"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: JSON.stringify used for object comparison${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' \
  -E 'JSON\.stringify\(.+\)\s*(===|!==)\s*JSON\.stringify' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' || true)
echo "$RES" || echo "  ✅ No JSON.stringify comparison found"
log_finding "JSON.stringify Comparisons" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: useEffect that only calls setState (derived state)${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' --include='*.ts' \
  -B1 -A3 'useEffect.*=>' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | \
  grep -E 'set[A-Z]\w+\(' | head -20 || true)
echo "$RES" || echo "  ✅ No derived-state useEffect found"
log_finding "Derived State useEffect" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: 'as unknown as' double type cast${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' 'as unknown as' "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' || true)
echo "$RES" || echo "  ✅ No double casts found"
log_finding "Double Type Casts" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Local State for Global Modals${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' -E 'const \[.*(Modal|Dialog|Sheet).*, set.*\] = useState' "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -10 || true)
echo "$RES" || echo "  ✅ Modals seem managed globally."
log_finding "Local Modal State" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: Database Overfetching (select('*'))${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' -E "\.select\(\s*['\"]\s*\*\s*['\"]\s*\)" "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -10 || true)
echo "$RES" || echo "  ✅ No select('*') found"
log_finding "Database Overfetching" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Missing abortSignal in API Service${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' -E "export const .* = async \(.*\) => \{" "$TARGET" 2>/dev/null | grep -v 'abortSignal' | grep -v 'node_modules' | head -10 || true)
echo "$RES" || echo "  ✅ API services seem to handle abortSignal"
log_finding "Missing AbortSignal support" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: Ad-hoc Hex Colors${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' "text-\[#[0-9a-fA-F]*\]\|bg-\[#[0-9a-fA-F]*\]" "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -10 || true)
echo "$RES" || echo "  ✅ No ad-hoc hex colors found."
log_finding "Ad-hoc Hex Colors" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: File Size Limit Exceeded (> 500 lines)${NC}"
echo "-------------------------------"
RES=$(find "$TARGET" -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" | xargs wc -l | awk '$1 > 500 && $2 != "total" {print $2 ": " $1 " lines"}' | head -10 || true)
echo "$RES" || echo "  ✅ All files are under 500 lines."
log_finding "File Size Violations" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${CYAN}📱 TMA: Missing expand/ready on init${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' --include='*.ts' 'Telegram\.WebApp' "$TARGET" 2>/dev/null | grep -E 'features|App.tsx' | grep -v 'ready(\|expand(' || true)
echo "$RES" || echo "  ✅ TMA init looks good."
log_finding "TMA Initialization" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: Direct Zustand State Mutation${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' -E "state\.[a-zA-Z0-9_.]+\s*=" "$TARGET" 2>/dev/null | grep 'set(' | grep -v 'node_modules' || true)
echo "$RES" || echo "  ✅ No direct mutations found"
log_finding "Direct Object Mutation in Stores" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: Unmemoized Context Provider Value${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' -E '<.*\.Provider\s+value=\{\s*\{' "$TARGET" 2>/dev/null | grep -v 'node_modules' || true)
echo "$RES" || echo "  ✅ Context providers seem to use memoized values"
log_finding "Unmemoized Context Provider" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 CRITICAL: Missing unsubscribe for Auth side-effects${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' 'onAuthStateChange' "$TARGET" 2>/dev/null | grep -v 'unsubscribe' | grep -v 'node_modules' || true)
echo "$RES" || echo "  ✅ Auth listeners seem managed"
log_finding "Auth Listener Leaks" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Naked UUID in JSX${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' -E '>\s*\{.*[iI]d\s*\}\s*<' "$TARGET" 2>/dev/null | grep -v 'node_modules' || true)
echo "$RES" || echo "  ✅ No naked UUIDs found in JSX"
log_finding "Naked UUIDs in UI" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Non-semantic onClick (onClick on Div/Span)${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' -E '<(div|span|p|section|article|li)\s+[^>]*onClick=' "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -10 || true)
echo "$RES" || echo "  ✅ Clicking elements seem semantic"
log_finding "Non-semantic Interaction" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 MEMORY: Event Listener Leak${NC}"
echo "-------------------------------"
RES=""
find "$TARGET" -name "*.tsx" -o -name "*.ts" | xargs grep -l "addEventListener" 2>/dev/null | while read -r file; do
  if ! grep -q "removeEventListener" "$file"; then
    MSG="🔴 $file — Missing removeEventListener cleanup"
    echo "  $MSG"
    RES="${RES}${MSG}\n"
  fi
done
log_finding "Event Listener Leaks" "$(echo -e "$RES")"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 MEMORY: Interval Leak${NC}"
echo "-------------------------------"
RES=""
find "$TARGET" -name "*.tsx" -o -name "*.ts" | xargs grep -l "setInterval" 2>/dev/null | while read -r file; do
  if ! grep -q "clearInterval" "$file"; then
    MSG="🔴 $file — Missing clearInterval cleanup"
    echo "  $MSG"
    RES="${RES}${MSG}\n"
  fi
done
log_finding "Interval Leaks" "$(echo -e "$RES")"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 PERF: Array index as key${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' 'key={index}' "$TARGET" 2>/dev/null || true)
echo "$RES" || echo "  ✅ No index-based keys found."
log_finding "Index-based Keys" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${RED}🔴 PERF: Double JSON.stringify${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.ts' --include='*.tsx' 'JSON\.stringify(.*JSON\.stringify' "$TARGET" 2>/dev/null || true)
echo "$RES" || echo "  ✅ No nested stringify found."
log_finding "Nested JSON.stringify" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Generic variable names${NC}"
echo "-------------------------------"
RES=""
for name in "const data " "const result " "const response " "const item " "const value "; do
  COUNT=$(grep -rn --include='*.ts' --include='*.tsx' "$name" "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | grep -v 'interface' | grep -v 'type ' | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 5 ]; then
    MSG="⚠️  '$name' used ${COUNT} times — consider descriptive names"
    echo "  $MSG"
    RES="${RES}${MSG}\n"
  fi
done
log_finding "Generic Naming" "$RES"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Form State Overuse (>3 useState for inputs)${NC}"
echo "-------------------------------"
RES=""
find "$TARGET" -name "*.tsx" | while read -r file; do
  COUNT=$(grep "useState" "$file" | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 4 ]; then
    if ! grep -q "useForm" "$file"; then
       MSG="⚠️  $file — $COUNT useState hooks found. Consider react-hook-form."
       echo "  $MSG"
       RES="${RES}${MSG}\n"
    fi
  fi
done | head -10
log_finding "Form State Overuse" "$(echo -e "$RES")"

# ──────────────────────────────────────────────
echo ""
echo "${YELLOW}🟡 WARNING: Non-Standard Border Radii (rounded-md/lg)${NC}"
echo "-------------------------------"
RES=$(grep -rn --include='*.tsx' "rounded-md\|rounded-lg" "$TARGET" 2>/dev/null | head -10 || true)
echo "$RES" || echo "  ✅ Border radii follow design system."
log_finding "Non-Standard Border Radii" "$RES"

echo ""
echo "=============================="
echo " SCAN COMPLETE"
echo " Report generated: $REPORT_FILE"
echo "=============================="

{
  echo ""
  echo "---"
  echo "**Audit Completed Automatically by Antigravity**"
} >> "$REPORT_FILE"

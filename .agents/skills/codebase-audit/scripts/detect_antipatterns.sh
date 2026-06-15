#!/usr/bin/env bash
# detect_antipatterns.sh — Find DRY/YAGNI/KISS/WET architectural violations
# Usage: bash detect_antipatterns.sh <target_dir>

set -euo pipefail

TARGET="${1:-.}"
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "=============================="
echo " ARCHITECTURAL ANTI-PATTERN SCAN"
echo " Target: $TARGET"
echo "=============================="

echo ""
echo "${RED}🔴 CRITICAL: Business logic in components/ (should be in features/)${NC}"
echo "-------------------------------"
grep -rln --include='*.ts' --include='*.tsx' \
  -E "from\s+'[\.@/]*core/services/supabase'|from\s+'[\.@/]*db/db'|supabase\." \
  "$TARGET/components" "$TARGET/src/components" 2>/dev/null | grep -v 'node_modules' || echo "  ✅ No Supabase/DB calls in components/"

echo ""
echo "${RED}🔴 CRITICAL: console.log left in production code${NC}"
echo "-------------------------------"
COUNT=$(grep -rn --include='*.ts' --include='*.tsx' \
  'console\.log(' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | wc -l)
echo "  Found: $COUNT console.log statements"
if [ "$COUNT" -gt 20 ]; then
  echo "  ⚠️  High count — consider a logger utility"
fi

echo ""
echo "${RED}🔴 CRITICAL: Hardcoded strings (i18n violations)${NC}"
echo "-------------------------------"
# Heuristic: JSX text nodes that aren't wrapped in t() — checks for common patterns
grep -rn --include='*.tsx' \
  -E ">\s*[A-Z][a-z]+(\s+[a-z]+){2,}\s*<" \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | grep -v 'className' | head -15 || echo "  ✅ No obvious hardcoded strings found"

echo ""
echo "${YELLOW}🟡 WARNING: TODO/FIXME/HACK comments${NC}"
echo "-------------------------------"
TODO_COUNT=$(grep -rn --include='*.ts' --include='*.tsx' \
  -E 'TODO|FIXME|HACK|XXX' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | wc -l)
echo "  Found: $TODO_COUNT TODO/FIXME/HACK comments"
grep -rn --include='*.ts' --include='*.tsx' \
  -E 'TODO|FIXME|HACK|XXX' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -10

echo ""
echo "${YELLOW}🟡 WARNING: Commented-out code blocks (YAGNI)${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E '^\s*//\s*(import |const |let |function |export |return |await )' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -15 || echo "  ✅ No commented-out code found"

echo ""
echo "${YELLOW}🟡 WARNING: Direct window.Telegram access (should use SDK)${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E 'window\.Telegram|window as any.*Telegram|\(window as any\)\.Telegram' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | head -10 || echo "  ✅ No direct window.Telegram access"

echo ""
echo "${YELLOW}🟡 WARNING: dangerouslySetInnerHTML (XSS risk)${NC}"
echo "-------------------------------"
grep -rn --include='*.tsx' \
  'dangerouslySetInnerHTML' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' || echo "  ✅ No dangerouslySetInnerHTML found"

echo ""
echo "${YELLOW}🟡 WARNING: process.env usage (should be import.meta.env)${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  'process\.env' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v 'vite.config' || echo "  ✅ No process.env usage"

echo ""
echo "${CYAN}📊 INFO: Duplicate code blocks (potential DRY violations)${NC}"
echo "-------------------------------"
# Find files with similar function signatures — heuristic
echo "  Checking for repeated User construction patterns..."
USER_CONSTRUCT=$(grep -rn --include='*.ts' --include='*.tsx' \
  'const userWithDetails: User' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | wc -l)
echo "  \`userWithDetails: User\` constructed in $USER_CONSTRUCT places"
if [ "$USER_CONSTRUCT" -gt 2 ]; then
  echo "  ⚠️  DRY violation — extract to a shared \`buildUserFromProfile()\` utility"
fi

echo ""
echo "${CYAN}📊 INFO: Cross-feature imports (coupling check)${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E "from\s+'[\./@]*features/\w+/" \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v 'App.tsx' | grep -v 'index' | head -15 || echo "  ✅ No cross-feature imports detected"

echo ""
echo "=============================="
echo " SCAN COMPLETE"
echo "=============================="

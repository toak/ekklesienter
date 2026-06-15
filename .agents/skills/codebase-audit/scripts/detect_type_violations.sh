#!/usr/bin/env bash
# detect_type_violations.sh — Find TypeScript type safety violations
# Usage: bash detect_type_violations.sh <target_dir>

set -euo pipefail

TARGET="${1:-.}"
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "=============================="
echo " TYPE VIOLATION SCAN"
echo " Target: $TARGET"
echo "=============================="

echo ""
echo "${RED}🔴 CRITICAL: Explicit \`any\` usage${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E ':\s*any\b|<any>|as any|\bany\[|Record<string,\s*any>' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' || echo "  ✅ No \`any\` found"

echo ""
echo "${RED}🔴 CRITICAL: @ts-ignore / @ts-expect-error${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E '@ts-ignore|@ts-expect-error|@ts-nocheck' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' || echo "  ✅ No TS suppression found"

echo ""
echo "${YELLOW}🟡 WARNING: Non-null assertions (!)${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E '\w+!\.' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | head -20 || echo "  ✅ None found"

echo ""
echo "${YELLOW}🟡 WARNING: Type casts (as SomeType)${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E '\bas\s+[A-Z][a-zA-Z]+' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v 'as React' | grep -v '.test.' | head -20 || echo "  ✅ None found"

echo ""
echo "${YELLOW}🟡 WARNING: Missing return types on exported functions${NC}"
echo "-------------------------------"
grep -rn --include='*.ts' --include='*.tsx' \
  -E 'export (async )?function \w+\([^)]*\)\s*\{' \
  "$TARGET" 2>/dev/null | grep -v 'node_modules' | grep -v '.test.' | head -20 || echo "  ✅ All exported functions have return types"

echo ""
echo "=============================="
echo " SCAN COMPLETE"
echo "=============================="

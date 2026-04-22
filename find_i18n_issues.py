#!/usr/bin/env python3
"""Scan codebase for i18n issues: hardcoded strings and missing translation keys."""
import os
import re
import json

SRC_DIR = "src"
SKIP_DIRS = {"locales", "test", "node_modules", "__tests__", "types"}
SKIP_FILES = {"setup.tsx", "vite-env.d.ts"}

# Patterns for hardcoded strings in JSX (between > and <)
# Only multi-word or meaningful English strings
HARDCODED_JSX_RE = re.compile(
    r'>([A-Z][a-zA-Z\s]{2,}(?:\s[a-zA-Z]+)*)</',
)

# Patterns for t() calls with fallback values
T_KEY_RE = re.compile(r"""\bt\(\s*['"]([^'"]+)['"]""")
T_KEY_FALLBACK_RE = re.compile(r"""\bt\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]""")

# Scan for hardcoded labels, titles, placeholders in common patterns
HARDCODED_PROP_RE = re.compile(
    r'(?:label|title|placeholder|description|aria-label)\s*=\s*["\']([A-Z][a-zA-Z\s:,!?.\-]+)["\']'
)

# Hardcoded strings in toast/error calls
TOAST_RE = re.compile(
    r'(?:toast\.\w+|console\.warn|console\.error)\(\s*["\']([A-Z][a-zA-Z\s:,!?.]+)["\']'
)

def walk_source_files():
    for root, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES:
                continue
            if f.endswith((".tsx", ".ts")) and "locales" not in root and "test" not in root:
                yield os.path.join(root, f)

def main():
    all_t_keys = set()
    hardcoded_issues = []
    missing_fallbacks = []
    
    for filepath in walk_source_files():
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Collect all t() keys
        for m in T_KEY_RE.finditer(content):
            all_t_keys.add(m.group(1))
        
        # Find hardcoded strings in JSX
        lines = content.split("\n")
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Skip comments, imports, types
            if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("import"):
                continue
            
            # Check for hardcoded JSX text content
            for m in HARDCODED_JSX_RE.finditer(line):
                text = m.group(1).strip()
                # Skip dynamic content (has {), numbers only, single chars, technical stuff
                if "{" in text or len(text) < 3 or text.isdigit():
                    continue
                # Skip already internationalized patterns
                if "t(" in line or "t('" in line:
                    continue
                # Skip class names, CSS, technical
                if any(skip in text for skip in ["className", "flex", "grid", "text-", "bg-", "px-", "py-", "http"]):
                    continue
                hardcoded_issues.append({
                    "file": filepath,
                    "line": i,
                    "text": text,
                    "context": stripped[:120]
                })
            
            # Check for hardcoded prop values
            for m in HARDCODED_PROP_RE.finditer(line):
                text = m.group(1).strip()
                if "t(" in line or len(text) < 3:
                    continue
                if any(skip in text for skip in ["className", "flex", "grid"]):
                    continue
                hardcoded_issues.append({
                    "file": filepath,
                    "line": i,
                    "text": text,
                    "context": stripped[:120]
                })
    
    print(f"\n=== T() KEYS FOUND: {len(all_t_keys)} ===")
    
    print(f"\n=== HARDCODED STRING ISSUES: {len(hardcoded_issues)} ===")
    for issue in hardcoded_issues:
        relpath = issue["file"].replace("src/", "")
        print(f"  [{relpath}:{issue['line']}] \"{issue['text']}\"")
    
    # Output keys as JSON for further processing
    with open("i18n_keys_found.json", "w") as f:
        json.dump(sorted(list(all_t_keys)), f, indent=2)

if __name__ == "__main__":
    main()

---
name: codebase-audit
description: "Deep architectural, performance, and security audits for React/TypeScript/Supabase/Zustand/Dexie.js/Telegram Mini Apps codebases. Use when performing code reviews, detecting anti-patterns, checking for violations of YAGNI/DRY/WET/KISS principles, finding performance leaks (re-renders, memory, N+1 queries), identifying offline-sync race conditions, auditing TMA/Supabase security, or cleaning up AI-generated technical debt (JSON.stringify comparisons, redundant useEffect, copy-paste patterns, type cast hacks). Runs static analysis scripts and applies stack-specific reference constraints."
---

# Codebase Audit Skill

## Overview

Perform ruthless, stack-specific audits on codebases using:
React 19, TypeScript, Vite, Tailwind CSS v4, Supabase (+ Edge Functions), Zustand, Dexie.js (IndexedDB/offline-first), Telegram Mini Apps SDK, Framer Motion, i18next, dnd-kit, Recharts.

## Audit Pipeline

### Step 0: Dynamic Rule Discovery

**CRITICAL**: Before proceeding, check if the directory `.agent/rules/` exists in the project root.

- If it exists, **READ ALL** files within it (e.g., `design-system.md`, `architecture.md`).
- These rules take **absolute precedence** over the generic audit criteria below.
- Incorporate these project-specific constraints into your audit plan for this session.

### Step 1: Classify the Code Under Audit

Determine the code's domain category:

| Category | Signals | Reference File | Priority |
| :------- | :------ | :------------- | :------- |
| **AI-Slop / Tech Debt** | `JSON.stringify` comparisons, `useEffect` with only `setState`, `as unknown as`, copy-paste blocks, generic names (`data`, `result`) | `references/ai_slop_patterns.md` | Critical |
| **State Management** | Zustand stores, `create()`, `get()`, `set()`, selectors | `references/state_management.md` | High |
| **Database & API** | `select('*')`, `.filter()`, missing `AbortSignal`, N+1 `Promise.all` | `references/database_api.md` | High |
| **Offline Sync / Data** | Dexie tables, `mutation_queue`, `SyncService`, `bulkPut`, IndexedDB | `references/offline_sync.md` | Medium |
| **React Hooks** | `useEffect`, `useState`, `useMemo`, `useCallback`, subscriptions, cleanups | `references/react_hooks.md` | Critical |
| **UI Architecture** | Naked Modals, Flexbox Blowouts (`min-w-0`), Global Scroll Bans, CLS Skeletons | `references/ui_architecture.md` | High |
| **Architecture / Principles** | File structure, duplication, feature scope, dead code, naming | `references/code_principles.md` | Medium |
| **Styling & CSS** | Ad-hoc hex colors, CSS string concatenation, strict border radii, touch targets, `@theme` vs config | `references/styling_tailwind.md` | High |

If code spans multiple categories, read ALL relevant reference files before auditing.

### Step 2: Run Automated Detection Scripts

Before manual review, run the relevant scripts to get a quick anti-pattern baseline:

```bash
# Detect type violations, any usage, missing strict types
bash .agent/skills/codebase-audit/scripts/detect_type_violations.sh <target_dir>

# Detect performance issues: missing memo, inline handlers, missing deps
bash .agent/skills/codebase-audit/scripts/detect_performance_issues.sh <target_dir>

# Detect architectural anti-patterns: DRY/YAGNI/KISS violations
bash .agent/skills/codebase-audit/scripts/detect_antipatterns.sh <target_dir>

# Detect AI-generated technical debt: JSON.stringify, derived state, copy-paste, casts
bash .agent/skills/codebase-audit/scripts/detect_ai_slop.sh <target_dir>
```

### Step 3: Manual Deep Audit

Read the relevant reference file(s) identified in Step 1. Apply every constraint and self-correction rule from those files against the code under audit.

### Step 4: Output Report

Structure the audit report as:

```markdown
# 🔍 Audit Report: [component/feature name]

## Summary
- **Files audited:** [count]
- **Critical issues:** [count]
- **Warnings:** [count]
- **Passed checks:** [count]

## 🔴 Critical Issues
[Each with file, line, BAD→GOOD code example, and principle violated]

## 🟡 Warnings
[Non-critical but should-fix items]

## 🟢 Passed Checks
[Confirmed good patterns found in the code]

## Script Results
[Output from automated scripts, if run]
```

## Self-Correction Rules (Global)

1. **NEVER skip reading reference files.** The whole point is stack-specific depth. Generic advice = audit failure.
2. **NEVER mark something as "fine" without verifying** against the specific constraints in the reference file.
3. **ALWAYS provide BAD→GOOD code examples** for every issue found. No vague descriptions.
4. **ALWAYS check files for the 500-line limit** per the workspace rules.
5. **ALWAYS verify `any` is not used** — substitute with `unknown`, `Record<string, unknown>`, or proper types.
6. **ALWAYS check for AI-slop patterns** — `JSON.stringify` comparisons, `useEffect` that only sets state, `as unknown as` casts, and copy-pasted object construction. Read `references/ai_slop_patterns.md` for every audit.

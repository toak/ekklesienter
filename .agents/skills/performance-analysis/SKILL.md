---
name: performance-analysis
description: Skill for identifying and resolving performance bottlenecks in React TSX, Supabase, Zustand, and Telegram Mini Apps. Use this to audit codebases for slow loading, unnecessary re-renders, and inefficient database queries.
---

# Performance Analysis Skill

This skill provides a systematic approach for auditing and optimizing the performance of modern web applications, with a specific focus on the React + Supabase + Zustand + TMA stack.

## Workflow

1. **Rendering Audit**: Identify components with excessive re-renders.
    - Check selectors in Zustand/Jotai.
    - Audit `useEffect` dependencies.
    - Look for missing `React.memo` on expensive leaf nodes.
    - See [react_patterns.md](references/react_patterns.md) for details.

2. **Data Fetching Optimization**: Analyze Supabase and API service calls.
    - Check for "N+1" query patterns.
    - Ensure indexes are used in Postgres.
    - Verify that large lists are paginated or virtualized.
    - See [supabase_patterns.md](references/supabase_patterns.md) for details.

3. **State Management Audit**: Evaluate store/atom structure.
    - Ensure selectors are stable and usage of `useShallow` is correct.
    - Identify monolithic stores that trigger too many updates.
    - See [state_patterns.md](references/state_patterns.md) for details.

4. **Bundle & Asset Audit**: Analyze payload sizes and loading patterns.
    - Inspect `package.json` for heavy dependencies.
    - Look for "import-at-top" patterns on components that should be lazy-loaded.
    - Audit image/asset sizes and formats (WebP vs PNG).
    - See [investigation_patterns.md](references/investigation_patterns.md) for deep dive tools.

5. **Memory & Lifecycle Audit**: Identify resource leaks.
    - Audit `useEffect` cleanup functions.
    - Look for global event listeners or `setIntervals` that aren't cleared.
    - Identify large objects stored in global refs or stores that aren't purged.
    - See [investigation_patterns.md](references/investigation_patterns.md) for profiling steps.

6. **Network & Waterfall Audit**: Analyze fetch sequencing.
    - Identify serial `await` calls in components/services that could be parallelized.
    - Check for "loading skeleton" jumps caused by non-deterministic fetch order.

7. **Automated Auditing & Reporting**:
    - Use CLI tools for quantitative data.
    - Generate reports using the [reporting_template.md](references/reporting_template.md).

8. **TMA & Mobile Specifics**: Optimize for the Telegram Mini App environment.
    - Minimize main-thread work to prevent UI stutter.
    - Optimize viewport sync and scroll events.
    - See [tma_patterns.md](references/tma_patterns.md) and [tma_advanced_optimization.md](references/tma_advanced_optimization.md) for details.

9. **RUM (Real-User Monitoring)**:
    - Implement tracking for lag and bundle load times.
    - See [rum_patterns.md](references/rum_patterns.md) for implementation details.

## 🤖 AI Performance Linter (Self-Correction Rules)

When editing code, Antigravity MUST check for:

1. **Memoization Safety**: If updating a component in a list, ensure it's wrapped in `React.memo`.
2. **Selector Stability**: If adding a store hook, verify it uses a stable selector or `useShallow`.
3. **Draft Fetching**: If adding an `await` in a loop or multiple `await` calls in sequence, propose parallelization or RPC.
4. **Cleanup Hygiene**: If adding an `EventListener` or `setInterval` in `useEffect`, ensure the cleanup function is present and correct.

## 🛠 Diagnostic Scripts

Run these scripts from the skill directory to automate auditing:

- `scripts/detect_n_plus_one.sh`: Finds serial fetch patterns.
- `scripts/audit_renders.sh`: Identifies components likely needing `React.memo`.

## Core Principles

- **Measure First**: Use `react-scan`, Chrome DevTools, or Vercel Speed Insights before making changes.
- **Selector Stability**: The most common source of lag in Zustand/Jotai apps is unstable selectors.
- **Batching**: Always batch multiple related DB updates into a single RPC or transaction if possible.
- **Proactive Prevention**: Apply the **AI Performance Linter** rules during every code modification.

---
name: tests-creator
description: "High-precision test automation for React, Supabase, Zustand, TMA, and Electron applications. Generates unit, component, integration, and E2E tests with deep support for IPC, animations, and platform SDKs. Use for: creating tests, fixing failing tests, mocking complex dependencies, and increasing coverage."
---

# Tests Creator Skill

Precision-focused testing for modern cross-platform applications.

## Core Workflow

1. **Analyze**: Detect target logic and platform dependencies (Electron IPC, TMA SDK, Supabase, Framer Motion).
2. **Select Strategy**:
    * **Unit**: Pure logic and utilities. [unit_testing.md](references/unit_testing.md)
    * **Component**: UI interaction and transition logic. [component_testing.md](references/component_testing.md)
    * **Integration**: Service-to-DB or multi-component flows. [integration_testing.md](references/integration_testing.md)
    * **E2E**: Full platform user journeys. [e2e_testing.md](references/e2e_testing.md)
3. **Scaffold**: Run `scripts/create_test.py` on the target file.
4. **Mock (Precision Layer)**:
    * **IPC/Files**: [electron_precision.md](references/electron_precision.md) - Deep mocks for Main/Renderer and hardware.
    * **Telegram SDK**: [tma_precision.md](references/tma_precision.md)
    * **Animations**: [motion_precision.md](references/motion_precision.md)
    * **Complex DB**: [supabase_advanced.md](references/supabase_advanced.md)
5. **Verify**: Run the runner and iterate.

## Advanced Recipes

* **Mocking Z-Index Modals**: Use the global modal manager mock to ensure portals are correctly triggered.
* **Race Condition Testing**: Use `vi.useFakeTimers()` to verify interval logic (e.g., in `TimerSlideRenderer`).
* **I18n Testing**: Mock `react-i18next` to return keys instead of translations for deterministic string checks.

## Common Pitfalls

* **Leaking Async**: Always clean up `vi.clearAllMocks()` in `afterEach`.
* **Framer Motion Stalls**: Wrap component renders in `motion` in a generic div during tests if layout shifts cause timeouts.
* **IPC Handlers**: Ensure `ipcRenderer.invoke` returns a promise that resolves *after* the handler finishes.

## Reference Library

* [Platform Mocks Catalog](references/platform_mocks.md) - Common SDK snippets.
* [Electron Precision](references/electron_precision.md) - IPC & FS.
* [TMA Precision](references/tma_precision.md) - Telegram environment.
* [Motion Precision](references/motion_precision.md) - Animation testing.
* [Supabase Advanced](references/supabase_advanced.md) - Realtime & Auth.

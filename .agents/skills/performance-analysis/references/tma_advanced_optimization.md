# TMA Advanced Optimization (Low-End Devices)

## 1. Virtualization for Long Lists

On budget mobile devices, rendering >20 complex DOM nodes (like transaction rows) causes significant scroll lag.

- **Solution**: Use `tanstack/react-virtual`.
- **Instruction**: Ensure every list expected to grow >50 items is virtualized.

## 2. CSS-Only Animations

Avoid `framer-motion` for simple hover or transition effects on many items. Use standard CSS transitions/animations which are offloaded to the compositor thread.

- **Bad**: `whileHover={{ scale: 1.1 }}` on every list item.
- **Good**: `transition-transform duration-200 hover:scale-110`.

## 3. Component Depth Reduction

Deeply nested React trees increase reconciliation time.

- **Goal**: Keep component depth < 10 levels for critical UI paths.
- **Pattern**: Flattern layouts by using more utility classes and fewer wrapper `div`s.

## 4. Viewport Event Optimization

TMA's `Viewport` sync can trigger many re-renders.

- **Pattern**: Debounce or throttle updates to state that depend on viewport height/width.
- **Pattern**: Use CSS variables for dynamic sizing (e.g., `--tg-viewport-height`) instead of JS-driven height state where possible.

## 5. Image & Resource Management

- **WebP**: Always prefer WebP over PNG/JPG.
- **Skeleton Stability**: Ensure Skeletons match the EXACT dimensions of the final content to prevent layout shifts that trigger expensive "Reflows".

# TMA (Telegram Mini App) Performance

## 1. Preventing Layout Jumps

TMA environments often have dynamic headers or bottom bars. Use stable viewport hooks and avoid triggering layout shifts when keyboard opens/closes.

## 2. Smooth Scrolling

Telegram users expect "native-feeling" smoothness.

- Use `overflow-y-auto` with `-webkit-overflow-scrolling: touch`.
- Avoid heavy JS calculations during scroll events.
- Ensure that the main wrapper has `w-full max-w-full overflow-x-hidden` as per local rules.

## 3. Minimizing Main Thread Blocking

TMA is often run on low-end mobile devices.

- Debounce expensive operations (voice processing, heavy filtering).
- Use Web Workers for non-UI tasks if possible.

## 4. Asset Optimization

Keep icons (Lucide) and images small. Use SVGs where possible. Ensure all icons are imported via named imports to allow tree-shaking.

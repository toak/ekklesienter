# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-04-09

### Added

- **The Slide Design Studio**: A complete overhaul of the design panel, offering a professional suite of tools for managing layers and aesthetics with pixel-perfect precision.
- **Dynamic Slide Support**: Beyond standard slides, you now have dedicated support for **Video**, **Bible**, and **Timer** slides—tailored to the specific needs of each service segment.
- **Live Media Command**: Introducing a specialized media toolbar for video slides, allowing you to control playback and scrub through live video seamlessly while projecting.
- **Worry-Free Sharing (.ektp)**: Our advanced export format now automatically bundles every video, audio, and image into a single presentation file—guaranteeing your media is never missing on another computer.
- **Flexible Audio Timeline**: Rearrange your service’s atmosphere with ease by dragging and dropping audio clips to new positions directly on the timeline.
- **Premium Workspace Feel**: High-end animations for dragging slides and timeline items make the app feel as sleek and professional as the presentations you create.
- **Enhanced Creative Toolbar**: A redesigned main toolbar that puts your primary building blocks—Text, Images, and Shapes—just one click away.
- **Unified Override Dashboard**: We've brought the Church Logo and all screen overrides together into one simple command center for faster live transitions.
- **Stable Reading Environment**: Bible mode now features an interaction guard that prevents accidental zooming, ensuring a steady and focused scripture experience for everyone.
- **Intelligent Canvas Recovery**: The design viewport now automatically centers and resets its scale when switching modes, keeping your creative space perfectly framed.

### Fixed

- **Fixed bugs and minor stability improvements**: Continuous engine refinements to ensure the app stays fast and dependable during your most important moments.

## [2.0.0] - 2026-02-28

### Added

- **New "Presentation" Mode**: A major overhaul of the application, introducing a dedicated workspace for creating, managing, and delivering professional presentations.
- **Advanced Timeline Editor**:
  - Support for **Nested Presentations** (Stacks), allowing presentations to be modular and reusable.
  - **Expandable Blocks**: Drill down into nested content directly from the main timeline.
  - **Intelligent Slide Management**: Drag-and-drop reordering, duplication, and precise movement controls (Back/Forth/Start/End).
- **Pro Design Canvas Engine**:
  - **Layered Layout System**: Add multiple canvas items (Text, Images, Shapes) per slide with full Z-index control.
  - **Inline Text Editing**: Rich text support with live preview.
  - **Background Overrides**: Per-slide background styling including custom images and gradients.
  - **Global Styles**: Apply background settings across the entire presentation with one click.
- **Integrated Audio Ecosystem**:
  - **Audio Scopes**: Assign audio clips to specific slide ranges.
  - **Crossfade Engine**: Automatic fade-in and fade-out management between tracks.
  - **Overlap Detection**: Smart conflict resolution when adding or moving audio clips (Replace/Shift logic).
  - **Missing Asset Repair**: Automated re-linking of audio files by filename.
- **Service Management & Workflows**:
  - Introduction of **Service Files**: Manage entire church services as a single workflow.
  - **Master Presentations**: Each service now supports a master presentation to centralize core elements.
- **Enhanced Media Connectivity**:
  - **PPTX Import Service**: Import existing PowerPoint presentations directly into the engine.
  - **EKT/EKTP Support**: Native file format handling with robust asset packaging.
  - **Local Resource Protocol**: High-performance loading of local media assets via custom Electron protocols.
- **Studio Grade UI/UX**:
  - **Modern Typography**: Integrated Google Fonts library (Inter, Playfair Display, Montserrat, etc.).
  - **Dynamic Sidebar**: A 460px widened design panel for better accessibility to styling tools.
  - **Glassmorphic Components**: Modern, sleek aesthetics throughout the presenter interface.

### Changed

- Refactored core state management to use **Zustand** for global application consistency.
- Optimized rendering performance for large timelines and complex canvas layouts.
- Standardized file naming conventions and feature-based directory structure.

---

## [1.0.0] - 2026-01-15

### Added

- Initial release of Lumina Scripture Presenter.
- Basic bible browsing and verse selection.
- Single-slide projection support.
- Primary SQLite database integration for scripture storage.

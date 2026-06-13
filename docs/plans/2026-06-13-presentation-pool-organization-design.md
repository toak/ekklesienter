# Design Specification: Presentation Pool Organization & Filtering

Introduce starred presentations, custom tagging, and sorting/filtering capabilities in the presentations pool (`PresentationSelector.tsx`) to improve content discovery and management.

## 1. Schema Extensions
Add optional metadata properties to the `IPresentationFile` interface in `src/core/types.ts`:
```typescript
interface IPresentationFile {
    // ... existing fields
    isStarred?: boolean;
    tags?: string[];
}
```

## 2. UI Layout & Controls
Modify the presentations dropdown menu in `PresentationSelector.tsx`:
- **Search & Filters Row**: Add a controls row below the search input:
  - **Star Filter Toggle**: Button with a star icon (`Star`) that toggles filtering to starred-only items.
  - **Type Filter Dropdown**: Small dropdown (`All` / `Master` / `Usual`) to filter by presentation structure.
  - **Tag Filter Dropdown**: Dropdown listing all unique tags defined on presentations within the active service.
  - **Sort Dropdown**: Sort options: `Last Opened` (default), `Alphabetical`, and `Date Created`.
- **List Item Updates**:
  - Render a star icon (outline on hover, filled gold when active). Clicking the star toggles the status in IndexedDB immediately.
  - Render tag pills directly under the presentation name/title as small, colored badges.
- **Context Menu Options**:
  - Add **"Manage Tags..."**: Triggers a global prompt modal to edit tags (comma-separated list).

## 3. Data Flow & Duplication
- **Filtering Logic**: In-memory filtering within the `useMemo` of `PresentationSelector.tsx` using local states for current filters and active sort.
- **Duplication**: When duplicating a presentation, copy its tags to the duplicated clone, but set `isStarred = false` by default.

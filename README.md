# JSONForge

A production-ready, developer-focused JSON Formatter web application built with React, TypeScript, Monaco Editor, and React Flow. Handles large JSON payloads (5–20MB) with Web Worker-based parsing.

## Features

### Formatter Module
- Format / Pretty print JSON with configurable indentation (2, 4, 8 spaces)
- Minify JSON
- Copy to clipboard / Download as `.json`
- Upload JSON files (up to 50MB)
- Syntax highlighting with Monaco Editor (VS Code experience)
- Error line indicator with line/column info
- Collapsible sections, line numbers, bracket colorization
- Dark / Light mode

### Tree View Module
- Expandable/collapsible tree visualization
- Shows key, data type badge, and value preview per node
- Search by key, value, or JSON path
- JSON path display (`$.user.address.city`) with click-to-copy
- Expand All / Collapse All controls
- Virtualized rendering via `react-virtuoso` for large datasets

### Diagram View Module
- Visual node graph of JSON structure using React Flow
- Objects → colored nodes, Arrays → collection nodes, Nested → child nodes
- Pan, zoom, minimap, and controls
- Hover to view JSON path
- Export as PNG or SVG
- Auto-limits to 500 nodes for performance safety

### Schema Module
- Generate JSON Schema (Draft 2020-12 compatible)
- Infers: type, required fields, formats (date, email, URI), array item types
- Edit schema manually in Monaco Editor
- Validate JSON against schema with inline error display
- Download schema as `.json`

### Diff Module
- Side-by-side JSON comparison
- Structural diff: added, removed, changed, unchanged
- Swap left/right inputs
- Diff statistics summary
- Virtualized results list

### Developer Features
- **Keyboard shortcuts**: `⌘+Enter` Format, `⌘+M` Minify
- **Local storage persistence**: JSON input and theme preference saved
- **Status bar**: Line count, file size, parse time, validity status

## Architecture

```
src/
├── components/
│   ├── common/          # Shared: ErrorBoundary, Toast, JsonEditor (Monaco)
│   ├── layout/          # Header (tabs, theme, upload), StatusBar
│   ├── formatter/       # FormatterView, FormatterToolbar
│   ├── tree/            # TreeView (virtualized expandable tree)
│   ├── diagram/         # DiagramView (React Flow graph)
│   ├── schema/          # SchemaView (generator + validator)
│   └── diff/            # DiffView (side-by-side comparison)
├── hooks/
│   ├── useJsonWorker.ts       # Web Worker communication
│   ├── useKeyboardShortcuts.ts # Global keyboard shortcuts
│   └── useDebouncedPersist.ts  # LocalStorage debounced save
├── workers/
│   └── json.worker.ts    # Off-thread JSON parsing, formatting,
│                          # schema gen, validation, diff, tree building
├── stores/
│   └── AppStore.tsx       # React Context + useReducer state management
├── types/
│   └── index.ts           # Centralized TypeScript type definitions
├── utils/
│   └── index.ts           # Pure utility functions (copy, download, format)
├── App.tsx                # Root component with tab routing
├── main.tsx               # Entry point with providers
└── index.css              # Tailwind + CSS custom properties (theming)
```

### Performance Design

| Technique | Purpose |
|-----------|---------|
| **Web Workers** | JSON parsing, formatting, schema gen, validation, and diff run off the main thread |
| **Virtualized rendering** | Tree view and diff results use `react-virtuoso` for rendering only visible items |
| **Debounced parsing** | 300ms debounce on input changes prevents excessive re-parsing |
| **Debounced persistence** | 1000ms debounce on localStorage writes |
| **Node limits** | Diagram view caps at 500 nodes with depth limits |
| **Memoization** | `useMemo` for tree building, graph construction, and diff stats |

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS v4 + CSS Custom Properties |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Visualization | React Flow |
| Virtualization | react-virtuoso |
| Icons | Lucide React |
| Panels | react-resizable-panels |
| Error Handling | react-error-boundary |
| Export | html-to-image |

## Extension Guide

### Adding a new module/tab

1. Create component in `src/components/<module>/`
2. Add the tab entry in `src/components/layout/Header.tsx` (`tabs` array)
3. Add the case in `src/App.tsx` (conditional render)
4. If it needs new state, add to `AppStore.tsx`
5. Wrap in `<ErrorBoundaryWrapper>` for fault isolation

### Adding a new worker operation

1. Add request/response types in `src/types/index.ts`
2. Add handler in `src/workers/json.worker.ts`
3. Add method in `src/hooks/useJsonWorker.ts`

### Custom themes

Edit CSS custom properties in `src/index.css` under `:root` (light) and `.dark` (dark) selectors.

## Browser Support

Modern browsers with Web Worker and ES Module support (Chrome 80+, Firefox 80+, Safari 14+, Edge 80+).

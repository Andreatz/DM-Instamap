# Map Editor

The canvas map editor is available at `/editor` and at
`/projects/[projectId]/editor` for saved local projects.

It starts from a generated `MapDocument` and supports:

- canvas rendering
- pan and zoom
- undo and redo history for document edits
- grid rendering
- room selection
- document-level layers for Background, Terrain, Walls, Props, Lighting, GM Only, and Notes
- layer visibility, lock, and opacity controls
- visible floor, wall, and door tiles
- tile painting for floor, wall, and empty cells
- adding door markers
- adding local torch lights
- dragging assets from the sidebar onto the map
- moving placed assets on the canvas
- selecting multiple assets with Ctrl/Shift click
- selecting multiple assets with a canvas marquee
- rotating placed assets with free numeric values or 15 degree steps
- scaling placed assets
- horizontal and vertical placed asset flip
- moving selected assets between editable layers
- duplicating selected assets
- grouping and ungrouping selected assets
- copying and pasting selected assets through localStorage
- selecting all visible assets
- deleting selected placed assets
- editing light radius, color, intensity, and flicker
- previewing local fog of war with grid line-of-sight from map lights
- adding and editing GM notes anchored to map cells
- toggling the GM-only layer from the keyboard or layer panel
- tracking initiative entries with side, initiative value, and hit points
- saving the current `MapDocument` JSON to a textarea and localStorage
- saving directly back to a Project System project when opened from `/projects`
- loading a `MapDocument` from JSON
- inspecting local asset group matches for the selected room
- auto-furnishing rooms with sparse, normal, or rich density
- exporting PNG or WEBP images with optional grid lines and resolution scale
- **toolbar quick actions (I1, I2)**: a Snapshot button (also bound to
  `Ctrl+Shift+S`) that calls `POST /api/projects/[id]/snapshots` with an
  auto label `editor-<timestamp>`, and a Session Pack button that posts to
  `/api/projects/[id]/export` (`format: session-pack`) and triggers a
  direct zip download
- **AI Assist drawer (I3)**: side panel toggled by the toolbar AI Assist
  button with three actions — "Describe map" (calls `/api/ai/blueprint`),
  "Suggest assets for room" (calls `/api/assets/search`), and "Generate
  asset from prompt" (calls `/api/assets/generate`). Generated assets are
  appended to the Recently Generated palette section
- **Recently Generated palette section (I4)**: shows the last 12 assets
  generated from the inline AI drawer, persisted in
  `localStorage` under `dm-instamap-editor-recent-generated`, and
  drag-and-droppable on the canvas like any other palette entry

This editor is still intentionally compact. It does not include embedded asset
artwork in exports, autosave, or advanced grouped transforms yet.

## Hotkeys

- `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` — undo / redo
- `Ctrl+C` / `Ctrl+V` — copy / paste selected assets
- `Ctrl+Shift+S` — snapshot the current project
- `G` — toggle GM-only layer visibility

Layer locking prevents painting, placing, moving, deleting, duplicating, or
transforming content on that layer. Layer visibility and opacity affect the
canvas preview. Placed asset transforms, groups, GM notes, initiative entries,
and light settings are stored in the editable `MapDocument`, and raster exports
use rotation, scale, and flip values when rendering asset markers.

The room match debug panel uses the local asset matcher from `packages/assets`.
It explains selected `AssetGroup` results with kind, tag, theme, `usableFor`,
and quality score contributions.

# Map Editor

The canvas map editor is available at `/editor` and at
`/projects/[projectId]/editor` for saved local projects.

It starts from a generated `MapDocument` and supports:

- canvas rendering
- pan and zoom
- grid rendering
- room selection
- visible floor, wall, and door tiles
- tile painting for floor, wall, and empty cells
- adding door markers
- adding local torch lights
- dragging assets from the sidebar onto the map
- moving placed assets on the canvas
- deleting the selected placed asset
- saving the current `MapDocument` JSON to a textarea and localStorage
- saving directly back to a Project System project when opened from `/projects`
- loading a `MapDocument` from JSON
- inspecting local asset group matches for the selected room
- auto-furnishing rooms with sparse, normal, or rich density
- exporting PNG or WEBP images with optional grid lines and resolution scale

This editor is still intentionally compact. It does not include multi-select,
advanced layer management, embedded asset artwork in exports, or autosave yet.

The room match debug panel uses the local asset matcher from `packages/assets`.
It explains selected `AssetGroup` results with kind, tag, theme, `usableFor`,
and quality score contributions.

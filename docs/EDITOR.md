# Map Editor

The first map editor is available at `/editor`.

It starts from a generated `MapDocument` and supports:

- grid rendering
- room selection
- visible floor, wall, and door tiles
- dragging assets from the sidebar onto the map
- moving placed assets by dragging them to another cell
- deleting the selected placed asset
- saving the current `MapDocument` JSON to a textarea and localStorage
- loading a `MapDocument` from JSON
- inspecting local asset group matches for the selected room
- auto-furnishing rooms with sparse, normal, or rich density
- exporting PNG or WEBP images with optional grid lines and resolution scale

This editor is intentionally simple. It does not include advanced AI behavior,
multi-select tools, embedded asset artwork in exports, or tile painting yet.

The room match debug panel uses the local asset matcher from `packages/assets`.
It explains selected `AssetGroup` results with kind, tag, theme, `usableFor`,
and quality score contributions.

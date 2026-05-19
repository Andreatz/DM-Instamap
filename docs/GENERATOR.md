# Generator

The first procedural dungeon generator lives in `packages/generator`.

## Input

`generateDungeon` accepts:

- `widthCells`
- `heightCells`
- `roomCount`
- `theme`
- `requiredRooms`

## Output

The generator returns a `MapDocument` with:

- editable tile data
- non-overlapping rectangular room nodes
- corridor nodes connecting every room
- an entrance room
- a final room when `boss` or `final` is requested
- door segments between rooms and corridors
- wall segments around generated floors and doors

## Preview

The `/generate` page renders a simple tile preview of the generated map. It is a
local preview only and does not export images yet.

## Auto-Furnishing

`autoFurnishMap` places selected local assets into generated rooms. It supports
`sparse`, `normal`, and `rich` density. The service recognizes these room types:

- `entrance`
- `corridor`
- `crypt`
- `prison`
- `forge`
- `library`
- `chapel`
- `boss_room`
- `treasure_room`
- `storage`

The placement pass sorts large asset footprints first, then small props. It
only places assets on floor tiles inside room bounds and tracks occupied cells
to avoid major collisions. The editor exposes this through the `/editor`
auto-furnish controls.

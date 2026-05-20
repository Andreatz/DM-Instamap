# Data Model

DM-Instamap stores maps as editable local documents. The TypeScript types in
`packages/core` are inferred from Zod schemas, so runtime validation and compile
time types stay aligned.

## AssetMetadata

Describes one local asset discovered by the scanner, such as a tile, prop, wall,
door, light, texture, or reference image. Assets always use `source: "local"`.

## AssetGroup

Groups local asset ids into a reusable set, for example a stone dungeon pack or
a tavern furniture set. Generated groups can also include kind, asset count,
representative asset id, representative thumbnail, and tags for browsing.
Manual review can add `theme`, `themes`, `usableFor`, and `qualityScore`
signals for local room matching.

## ReferenceMapMetadata

Stores metadata for a local reference map image. It can include grid information
when the reference image has already been aligned. The reference registry also
tracks map type guesses, dominant colors, generated thumbnails, and filename or
folder tags.

## MapRequest

Captures the user's non-AI map request: map kind, theme, grid, required rooms,
reference maps, asset groups, and requested export formats.

## MapPlan

Represents the generated or manually adjusted plan before final editing. It
contains rooms, walls, doors, light sources, GM notes, initiative entries, and
asset placements.

## MapDocument

The editable map document. It includes grid settings, dimensions, optional plan
data, placed assets, and simple tile data used by the current starter generator.
Every valid document has `editable: true`.

## RoomNode

Defines a room, corridor, entrance, stairs, secret area, or service space with
bounds and room connections.

## WallSegment

Defines a wall line with start/end points, thickness, optional material, and
movement blocking behavior.

## DoorSegment

Defines a door position, width, rotation, lock/open state, and optional wall or
room associations.

## LightSource

Defines local lighting metadata such as type, position, color, radius, and
intensity. Editor lights can also store a `flicker` flag for local preview and
future VTT exports.

## MapNote

Defines a GM-only note anchored to a map coordinate. Notes have a title, body
text, and position so they can be edited with the map and hidden with the Notes
layer.

## InitiativeEntry

Defines a lightweight combat tracker row stored inside the map plan. Entries
include name, side, initiative value, optional hit points, optional armor class,
and optional notes.

## PlacedAsset

Defines a concrete asset placement on the editable map, including position,
layer, rotation, scale, lock state, optional group id, and tags.

## GridConfig

Defines the square grid used by map generation and editing: cell size, unit,
pixel density, dimensions, and origin.

## ExportJob

Tracks a requested export to PNG, WEBP, dd2vtt, or Foundry. Completed jobs must
include an output path, and failed jobs must include an error message.

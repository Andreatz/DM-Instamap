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

The `/generate` page renders a simple tile preview of the generated map. It has
two modes:

- `Simple` uses `generateDungeon` directly.
- `Narrative` builds a local `MapGenerationBlueprint` first, then converts that
  blueprint into a valid editable `MapDocument`.

Both modes can save the result as a local project.

## Narrative Blueprint

The semantic generator is intentionally local and heuristic. It does not call an
AI service. It creates a blueprint with:

- narrative room labels;
- room purpose;
- tactical role;
- tags;
- suggested assets;
- suggested lights;
- GM notes;
- preferred shape and minimum size hints.

Available functions:

```ts
createNarrativeBlueprint(input)
generateCryptBlueprint(input)
generateBuildingBlueprint(input)
generateDungeonBlueprint(input)
generateMapFromBlueprint(blueprint)
```

The first specialized crypt blueprint supports requests such as:

```txt
Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri.
```

It produces rooms like entrance from cathedral sacristy, hall of bound spirits,
reliquary, prison tomb, ossuary crossing, and final ritual chamber. The
resulting `MapDocument` remains editable in the project editor.

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

The placement pass now scores assets per room before placing them. It can use
single assets or `AssetGroup` representatives, plus optional narrative room
metadata and style tags.

Placement preferences:

- wall placement for bookshelves, shelves, bars, banners, and racks;
- central placement for altars, tables, sarcophagi, coffins, thrones, and ritual
  pieces;
- light placement near room edges;
- scatter placement for smaller props.

The output includes debug data for each placement: room id, room type,
footprint, placement preference, score, and match reasons. It also returns a
summary with room count, placed count, skipped count, and density. The editor
uses this summary in its auto-furnish status message.

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
six modes selectable from the toolbar:

- `Simple` uses `generateDungeon` directly (rectangular rooms + corridors).
- `Narrative` builds a local `MapGenerationBlueprint` first, then converts that
  blueprint into a valid editable `MapDocument`.
- `Cave` runs the cellular automata algorithm `generateCaveDungeon`.
- `Village` runs `generateVillageMap` with the subdivision block layout.
- `Outdoor` runs `generateOutdoorMap` (poisson-disc trees + optional river with
  bridges).
- `Multi-floor` runs `generateMultiFloorDungeon`. The preview shows the selected
  floor; "Save As Project" creates N linked projects (one per floor) via
  `POST /api/projects/multi-floor`, with cross-floor links stored in
  `project.json` under `relatedProjectIds`.

Every mode can save the result as a local project.

## Quality scoring

`scoreMapQuality(map)` assigns a local, deterministic 0-100 score to any
editable `MapDocument`. The score currently weighs:

- connectivity of walkable cells;
- walkable area balance;
- isolated or useless rooms;
- dead ends and narrow passages;
- tactical cover near playable spaces;
- line-of-sight breaks;
- points of interest such as doors, lights, notes, assets, stairs, boss/final
  rooms, water, shrines, libraries, and similar tagged areas.

The function returns:

- `score` and `rating` (`poor`, `usable`, `strong`);
- per-metric values and scores;
- human-readable warnings;
- debug tiles for dead ends, disconnected cells, and narrow passages.

The `/generate` preview shows the quality score, a compact debug panel, and a
tile overlay for the first flagged cells. This is intentionally heuristic: it
does not decide whether a map is beautiful, but it highlights maps that need
manual cleanup before export or play.

## Algorithms (C1)

All algorithms are deterministic per `seed` and return a fully validated
`MapDocument`.

```ts
import {
  generateCaveDungeon,
  generateVillageMap,
  generateOutdoorMap,
  generateMultiFloorDungeon
} from "@dm-instamap/generator";

const cave = generateCaveDungeon({
  heightCells: 36,
  seed: "torchlight",
  theme: "crypt",
  widthCells: 52
});

const village = generateVillageMap({
  blockCount: 6,
  heightCells: 36,
  seed: "river-village",
  theme: "village",
  widthCells: 52
});

const outdoor = generateOutdoorMap({
  heightCells: 36,
  river: true,
  seed: "deep-forest",
  theme: "forest",
  treeDensity: 0.2,
  widthCells: 52
});

const multiFloor = generateMultiFloorDungeon({
  floorCount: 3,
  heightCells: 36,
  perFloorRoomCount: 6,
  seed: "ossuary",
  theme: "crypt",
  widthCells: 52
});
// multiFloor.floors[0..N-1] are linked via stairs nodes at matching coordinates.
```

## Blueprint extensions (C2)

`createNarrativeBlueprint` extracts these fields from the request prompt and
returns them on the produced `MapGenerationBlueprint`:

- `structure`: `dungeon | cave | village | outdoor | building | mixed`
- `scale`: `small | medium | large`
- `mood`: free-form descriptor (e.g. "haunted", "festive")
- `hasWater`: boolean
- `hasVegetation`: boolean
- `ruinLevel`: 0..1 (heuristic from words like "ruined", "abandoned")

`generateMapFromBlueprint(blueprint)` reads `structure` and routes to the
matching C1 algorithm. Width/height defaults scale with `scale`.

```ts
import { createNarrativeBlueprint, generateMapFromBlueprint } from "@dm-instamap/generator";

const blueprint = createNarrativeBlueprint({
  heightCells: 40,
  request: "A ruined forest cave near a slow river, abandoned for ages.",
  roomCount: 7,
  theme: "wilds",
  widthCells: 60
});

const map = generateMapFromBlueprint(blueprint);
```

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

The room type inference also recognises the new outdoor and village kinds
introduced in C1/C3:

- `cave`
- `village_building`
- `tavern`
- `smithy`
- `shrine`
- `clearing`

`selectRooms` includes `kind === "service"` so outdoor clearings get furnished.

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

## Giocabilita verificata (invarianti + benchmark)

Oltre alle metriche di qualita, ogni mappa generata e verificata contro
invarianti "hard" tramite property-based test (`fast-check`, 200 seed per
algoritmo) in `packages/generator/src/invariants.test.ts`:

- solo tile validi (`floor`/`wall`/`door`/`empty`), nessun debug-tile;
- ogni porta su una cella walkable in bounds;
- ogni asset piazzato dentro la struttura e in bounds;
- ogni stanza giocabile raggiungibile dalla rete walkable principale;
- dungeon multipiano: scale accoppiate e coerenti tra i piani collegati.

Gli helper sono esportati: `checkMapInvariants(document)` e
`checkMultiFloorInvariants(result)`.

Il benchmark (`pnpm generator:benchmark`) copre 9 scenari deterministici con
soglie di qualita "strong" (almeno 8 mappe `strong`); le sintesi golden, con
content hash, sono congelate in `packages/generator/tests/fixtures/benchmark/`
come regression guard. Rigenerale con `pnpm --filter @dm-instamap/generator
benchmark --write` dopo cambi intenzionali al generatore.

# Foundry VTT Export

`packages/exporters` can generate a Foundry VTT module zip from a `MapDocument`.

Entry point:

```ts
import { exportFoundryModule } from "@dm-instamap/exporters";
```

The generated zip includes:

- `module.json`
- `scenes/<scene>.json`
- `packs/scenes.db`
- `maps/<scene>.webp` by default
- `packs/journal.db` and `journal/<id>.json` files when `includeJournals` is
  enabled (default).

The scene data includes:

- rendered map image path
- square grid size, distance, and units
- walls from `MapDocument.plan.walls`
- doors from `MapDocument.plan.doors`
- ambient lights from `MapDocument.plan.lights`
- scene notes for every `MapDocument.plan.gmNotes` entry (when journals are
  enabled): each note carries an `entryId` and `pageId` pointing to the matching
  page inside the GM Notes journal, plus the note coordinates and an icon. In
  Foundry this renders as a draggable pin that opens the linked journal page.

Example:

```ts
const moduleZip = await exportFoundryModule(mapDocument, {
  moduleId: "my-dungeon",
  moduleTitle: "My Dungeon"
});
```

## Journal entries

`exportFoundryModule` emits up to three journal entries derived from the
`MapDocument`:

- `<Name> - Rooms`: one page per `RoomNode` with bounds, tags, and connections.
- `<Name> - GM Notes`: one page per `MapNote` with the note title, body, and
  anchor coordinates. The scene notes array references these pages via
  `entryId`/`pageId`, so GM pins on the map open the corresponding journal page.
- `<Name> - Plan Notes`: one page collecting plan-level notes.

Pass `includeJournals: false` to revert to the journal-free behaviour (no
`journal.db`, no scene notes).

## Manual verification

The automated tests cover schema and content of the produced zip but not the
Foundry import side. After exporting:

1. Open Foundry as world admin.
2. Install the generated `.zip` via "Setup → Add-on Modules → Install module
   from file/URL".
3. Enable the module in your world and open "Compendiums" - the new packs
   (`Scenes` and, when enabled, `Journals`) should appear.
4. Drag the scene into the world. Confirm walls/doors/lights match the
   `MapDocument`.
5. Confirm GM note pins appear at the cell coordinates and that double-clicking
   them opens the matching journal page.

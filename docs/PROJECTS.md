# Project System

DM-Instamap projects are local folders under `data/projects`. They are intended
to be easy to inspect, back up, and remove without a database.

## Folder Layout

```txt
data/projects/
  crypt-under-cathedral/
    project.json
    map.dmimap.json
    exports/
    thumbnails/
```

`map.dmimap.json` is the editable `MapDocument` and remains the source of truth
for the map. `project.json` stores lightweight metadata such as project name,
creation time, selected local assets, selected references, Style DNA ids, and
`relatedProjectIds` for multi-floor dungeons (see [Multi-floor](#multi-floor)).

## Web Routes

- `/projects` lists saved local projects.
- `/projects/new` creates a new project from simple dungeon settings.
- `/projects/[projectId]` shows project details, snapshot panel (with diff
  vs current), AI describe button, linked floors list, and a delete action.
- `/projects/[projectId]/floors` is the multi-floor overview when the
  project is linked to other floors. Each floor renders as a card with a
  minimap statistic strip and Open/Editor/Export shortcuts.
- `/projects/[projectId]/editor` opens the saved `MapDocument` in the editor.
- `/projects/[projectId]/export` exports the current saved document.

The `/generate` preview can also save the generated dungeon as a local project.

## API

```txt
GET    /api/projects
POST   /api/projects
GET    /api/projects/[projectId]
PUT    /api/projects/[projectId]
DELETE /api/projects/[projectId]
POST   /api/projects/multi-floor
```

Project ids are slugged and validated before filesystem access. Project reads
and writes validate `MapDocument` with Zod, and writes use a temporary file plus
rename to avoid partial JSON files.

### Multi-floor

`POST /api/projects/multi-floor` accepts:

```json
{
  "name": "Crypt Below",
  "baseSlug": "Crypt Below",
  "documents": [/* MapDocument for floor 1 */, /* floor 2 */],
  "selectedAssetGroupIds": [],
  "selectedReferenceIds": [],
  "sourceRequest": "...",
  "styleDnaIds": []
}
```

It reserves a deterministic id sequence (`<slug>-floor-1`, `<slug>-floor-2`,
...) and creates one project per document. Each `project.json` lists the
other floor ids in `relatedProjectIds`, so the project page can offer the
"Open Floors Overview" link to `/projects/[id]/floors`.

## Limits

- There is no external database.
- Project thumbnails are prepared as folders but not generated yet.
- Export history is not tracked yet; exports remain explicit output actions.

## Snapshot CLI

```bash
pnpm snapshots:create <projectId> --label "before boss room"
pnpm snapshots:list <projectId>
pnpm snapshots:restore <projectId> <contentHash>
```

Snapshots are stored under `data/projects/<projectId>/snapshots/` and restore
replaces the saved `map.dmimap.json` through the same validated project writer
used by the web app.

## Campaign CLI

```bash
pnpm campaigns:list
pnpm campaigns:create --name "Whispering Woods" --tags fey,local
```

Campaigns remain local JSON files under `data/campaigns/<campaignId>/`.

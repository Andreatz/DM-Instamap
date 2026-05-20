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
creation time, selected local assets, selected references, and Style DNA ids.

## Web Routes

- `/projects` lists saved local projects.
- `/projects/new` creates a new project from simple dungeon settings.
- `/projects/[projectId]` shows project details and can delete the local folder.
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
```

Project ids are slugged and validated before filesystem access. Project reads
and writes validate `MapDocument` with Zod, and writes use a temporary file plus
rename to avoid partial JSON files.

## Limits

- There is no external database.
- Project thumbnails are prepared as folders but not generated yet.
- Export history is not tracked yet; exports remain explicit output actions.

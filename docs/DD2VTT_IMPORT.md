# dd2vtt Import And Export

`packages/exporters` can import and export Universal VTT / dd2vtt JSON files.

The importer reads:

- map size and pixels per grid from `resolution`
- embedded base64 map image when present
- walls from `line_of_sight`, `lineOfSight`, or `walls`
- doors and portals from `portals`
- lights from `lights`

The result is an editable `MapDocument` plus optional extracted image bytes.
The first importer pass stores all generated tiles as floor tiles and preserves
walls, doors, and lights in the document plan.

Supported entry points:

```ts
import {
  exportMapDocumentDd2Vtt,
  importDd2Vtt,
  importDd2VttFile
} from "@dm-instamap/exporters";
```

`importDd2VttFile` reads a local `.dd2vtt` or `.uvtt` file. `importDd2Vtt`
accepts already-loaded JSON, a JSON string, or a buffer.

`exportMapDocumentDd2Vtt` converts a `MapDocument` into dd2vtt-compatible JSON
with:

- grid resolution
- embedded rendered map image
- walls in `line_of_sight`
- doors in `portals`
- lights in `lights`

The export path is covered by an import-after-export test to make sure generated
dd2vtt JSON can be parsed back into an editable `MapDocument`.

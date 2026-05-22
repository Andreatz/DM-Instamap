# Export VTT - dd2vtt e Foundry

Guida operativa agli export verso Virtual Tabletop. Obiettivo: ridurre al minimo
le correzioni manuali dopo l'import.

## Universal VTT (.dd2vtt)

`exportMapDocumentDd2Vtt(document, options)` produce un oggetto Universal VTT
0.3 con `resolution`, `line_of_sight` (muri), `portals` (porte), `lights` e una
immagine battlemap codificata in base64.

### Allineamento griglia / immagine

Regola fondamentale dell'Universal VTT: l'immagine incorporata deve avere
esattamente `pixels_per_grid` pixel per cella, altrimenti la griglia del VTT non
si allinea alla mappa.

- L'immagine viene renderizzata a `grid.pixelsPerCell * scale` pixel per cella.
- `resolution.pixels_per_grid` e `resolution.image_size` derivano dai pixel reali
  dell'immagine, quindi l'invariante
  `image_size.x === map_size.x * pixels_per_grid` e sempre rispettata.
- Con `grid.pixelsPerCell = 70` (default) e `scale = 1` l'export e a 70 px/cella;
  per mappe ad alta risoluzione aumentare `scale` (es. `scale: 2` -> 140 px/cella).

### Opzioni rilevanti

| Opzione | Effetto |
|---|---|
| `embedImage` | Se `false`, nessuna immagine: `resolution` resta sui valori logici del grid. |
| `imageFormat` | `png` (default) o `webp`. |
| `includeGrid` | Disegna la griglia dentro l'immagine (di norma `false`: la griglia la mette il VTT). |
| `scale` | Moltiplicatore dei pixel per cella (1 = `grid.pixelsPerCell`). |

L'import (`importDd2Vtt` / `importDd2VttFile`) ricostruisce un `MapDocument`
editabile da muri, porte e luci, e estrae l'immagine incorporata.

## Foundry VTT (modulo .zip)

`exportFoundryModule(document, options)` produce un modulo installabile (ZIP) con
`module.json`, una scena, i pack `scenes.db`/`journal.db` e l'immagine mappa.
`buildFoundryModuleData(document, options)` espone gli stessi dati strutturali
senza renderizzare l'immagine (utile per test e confronti).

- Coordinate scena in pixel: `cella * grid.pixelsPerCell`.
- Muri -> `walls` con `door: 0`; porte -> `walls` con `door: 1` e `ds`
  (`0` chiusa, `1` aperta, `2` bloccata).
- Luci -> `lights` con `dim`/`bright` derivati dal raggio.
- Note GM -> voci journal + note di scena collegate alla pagina corrispondente.

### Compatibilita Foundry 12 vs 13

L'opzione `foundryVersion` imposta il blocco `compatibility` del manifest:

| `foundryVersion` | `compatibility.minimum` | `compatibility.verified` |
|---|---|---|
| `v12` (default) | `11` | `12` |
| `v13` | `12` | `13` |

Note sulle differenze tra le due major:

- Foundry 12: schema scene/wall stabile usato come baseline; il modulo generato
  importa senza migrazioni.
- Foundry 13: all'import puo apparire una migrazione automatica del documento
  scena; lo schema di muri (`c`, `door`, `ds`), luci (`config`) e note resta
  compatibile con quanto generato. Verificare dopo l'import che la scena non
  richieda di reimpostare `grid.size`.

Lo schema emesso (array `c` a 4 numeri per i muri, `config` per le luci, note di
scena con `entryId`/`pageId`) e volutamente il sottoinsieme comune a 12 e 13.

## Confronto export (manifest)

`buildVttExportManifest(document, options)` restituisce una sintesi strutturale
e senza immagine dei due formati, piu un blocco `consistency` con controlli
incrociati (porte, luci, muri e allineamento griglia/immagine). Serve per:

- snapshot di regressione (`tests/vtt-fidelity.test.ts`);
- verificare che lo stesso contenuto sopravviva coerente in dd2vtt e Foundry.

## Test

```bash
pnpm --filter @dm-instamap/exporters test
```

Copre coordinate, muri, porte, luci, note, dimensioni scena, allineamento
griglia/immagine, round-trip dd2vtt e compatibilita Foundry 12/13.

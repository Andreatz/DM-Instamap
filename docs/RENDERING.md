# Rendering: Debug e Artistic Battlemap

DM-Instamap separa nettamente i **dati logici** della mappa (il `MapDocument`,
sempre editabile) dalla loro **resa visiva**. Esistono due modalita di rendering
che leggono gli stessi dati senza modificarli:

- **Debug** (schematica): celle tinte piatte, token, utile per editing e
  ispezione. Resta sempre disponibile.
- **Artistic battlemap**: resa illustrata top-down con pavimenti/muri
  texturizzati, luci calde controllate, ombre morbide, griglia discreta e asset
  reali fusi nella scena.

Il `MapDocument`, lo schema Zod, l'editor, i salvataggi e gli export esistenti
non cambiano: l'artistic e un livello di rendering sopra i dati.

## Dove vive il codice

| Superficie | File | Note |
| --- | --- | --- |
| Preset di stile (puri) | [packages/core/src/render-style.ts](../packages/core/src/render-style.ts) | palette, grid, clamp luci, scelta preset; condiviso |
| Export debug (SVG→sharp) | [packages/exporters/src/raster.ts](../packages/exporters/src/raster.ts) | `renderMapDocumentSvg` |
| Export artistic (SVG→sharp) | [packages/exporters/src/artistic.ts](../packages/exporters/src/artistic.ts) | `renderArtisticMapSvg` |
| Canvas editor | [apps/web/src/lib/map-canvas-renderer.ts](../apps/web/src/lib/map-canvas-renderer.ts) | `renderStyle` opzionale |

L'export raster (`exportMapDocumentRaster`) accetta `renderMode: "debug" |
"artistic"` e delega all'uno o all'altro renderer; il compositing degli asset
reali (immagini) e condiviso fra le due modalita.

## Render Style Preset

Un preset (`RenderStylePreset`) raccoglie i parametri visivi:

- `palette`: `background`, `backgroundEdge`, `floor`, `floorAlt`, `wall`,
  `wallBorder`, `accentWarm`, `accentCool`;
- `contrast`: forza di rumore/ombre procedurali;
- `gridOpacity`: opacita della griglia (sempre <= 0.08, quasi invisibile);
- `floorTextureMode` / `wallTextureMode`: `texture` o `procedural`;
- `lightWarmth`: quanto le luci virano al caldo;
- `propDensity` / `clutterDensity`: hint di densita;
- `torchMaxIntensity` (0.45) / `magicMaxIntensity` (0.55): clamp delle luci;
- `lightRadiusCapCells`: raggio massimo del bagliore (≈ stanza, non l'intera mappa).

Preset disponibili: **dark-warm-crypt**, **tavern-topdown**, **cold-dungeon**
(default), **cave-natural**.

`deriveRenderPreset({ theme, tags, paletteTags })` sceglie il preset dai dati:
cripta/cattedrale → `dark-warm-crypt`, taverna → `tavern-topdown`,
caverna/naturale → `cave-natural`, altrimenti `cold-dungeon`. Le route di export
e l'editor derivano l'hint dai tag delle stanze e dal nome della mappa, quindi
la "Cripta sotto la Cattedrale" ottiene automaticamente `dark-warm-crypt`.

## Luci controllate

Per evitare overlay bianchi/rossi bruciati:

- le luci **ambient** non vengono dipinte (tingono l'intera scena);
- l'intensita e clampata per tipo (`clampLightIntensity`): torce ≤ 0.45, magia
  ≤ 0.55;
- il raggio del bagliore e cappato (`lightRadiusCapCells`), cosi una luce non
  copre piu di ~25-30% di una stanza;
- il bagliore e un gradiente morbido in alpha compositing con un picco basso
  (mai blob bianco); il colore vira al caldo secondo `lightWarmth`.

## Fallback procedurale

Se non ci sono texture floor/wall reali nella libreria locale, l'artistic NON
produce un risultato rosso/debug: usa un **fallback pittorico procedurale**
basato sul preset:

- pavimento: colore base + rumore deterministico per-cella (`floor`/`floorAlt`);
- muri: colore piu scuro con highlight in alto e ombra in basso (blocco
  scolpito) + bordo spesso;
- props senza artwork: placeholder sobri (ombra di contatto + forma smussata
  muta), non icone debug;
- luci: torce calde ambra, raggio limitato, blend morbido.

`exportMapDocumentRaster(...).usedProceduralFallback` indica se e stato usato il
fallback; l'editor mostra un avviso quando non ci sono asset locali.

## UI

Nell'inspector dell'editor, sezione **Resa**:

- toggle **Artistica (battlemap)** / **Debug (schematica)** (default: artistica);
- il canvas riflette subito la modalita (palette del preset, griglia discreta);
- l'export ("Esporta mappa artistica" / "Esporta mappa debug") usa la stessa
  modalita;
- un avviso segnala l'uso del fallback procedurale quando mancano asset locali.

## Test

- `packages/core/tests/render-style.test.ts`: scelta preset da Style DNA, clamp
  luci, grid opacity.
- `packages/exporters/tests/artistic.test.ts`: palette/fallback procedurale,
  grid opacity, e una **visual regression** che rasterizza una cripta e verifica
  l'assenza di grandi aree sovraesposte bianche o rosse.

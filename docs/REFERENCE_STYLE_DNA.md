# Reference Style DNA

La Reference Style DNA e un profilo derivato dalle mappe di riferimento locali
(`pnpm references:style`, indice in `data/indexes/reference-style-dna.json`). Da
sempre influenza **layout e tag** della generazione (densita stanze, dimensioni,
arredo) tramite `StyleDnaHint` (`densityBias`, `layoutBias`, `paletteTags`).

## Effetto sul rendering (RenderStylePreset)

Oltre a layout/tag, lo stile guida ora anche la **resa artistica** scegliendo un
`RenderStylePreset` (vedi [RENDERING.md](RENDERING.md)). La scelta avviene con
`deriveRenderPreset({ theme, tags, paletteTags })`:

| Tema/tag riconosciuti | Preset |
| --- | --- |
| crypt, cripta, cathedral, cattedrale, tomb, ossuar, undead, necro | `dark-warm-crypt` |
| tavern, taverna, inn, locanda, wood/legno | `tavern-topdown` |
| cave, caverna, grotto/grotta, natural | `cave-natural` |
| (tutto il resto) | `cold-dungeon` (default) |

L'hint puo arrivare da:

- i **tag delle stanze** e il **nome** del `MapDocument` (usato dall'editor e
  dalle route di export);
- una `ReferenceStyleDna` esplicita (tema/palette del riferimento) quando
  disponibile.

Il preset definisce palette, contrasto, opacita griglia, modalita texture
(`texture`/`procedural`), calore delle luci, densita suggerite e i clamp di
intensita/raggio delle luci.

## Reference per la cripta

Per una "Cripta sotto la Cattedrale" il preset corretto e **dark-warm-crypt**:

- background `#1b1715` su bordo `#100d0c`;
- pavimento grigio/marrone scuro (`#3b342b`), muro grigio scuro con bordi
  ombreggiati;
- accent torcia `#ff7a28`;
- opacita griglia 0.08 (massimo), bloom delle luci contenuto;
- dettagli piccoli e fitti.

Questi valori vivono in
[packages/core/src/render-style.ts](../packages/core/src/render-style.ts) e sono
coperti dai test in `packages/core/tests/render-style.test.ts`.

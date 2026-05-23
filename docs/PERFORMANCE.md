# Performance su librerie grandi

Questa pagina descrive le scelte che mantengono la UI fluida quando la libreria
asset diventa molto grande (Fase K della roadmap). L'obiettivo concreto: il
browser asset resta usabile con almeno 5.000 asset e l'apertura dell'editor non
ha blocchi percepibili anche con molti gruppi.

## Browser asset virtualizzato

Il browser asset ([apps/web/src/components/assets/asset-browser.tsx](../apps/web/src/components/assets/asset-browser.tsx))
non monta piu un nodo DOM per ogni asset filtrato. La griglia principale e
virtualizzata: monta solo le righe che intersecano la viewport, piu un piccolo
overscan.

La geometria e una funzione pura in
[apps/web/src/lib/virtual-grid.ts](../apps/web/src/lib/virtual-grid.ts):

- `computeColumns(containerWidth, minItemWidth, gap)` calcola quante colonne
  stanno nel contenitore (sempre almeno 1);
- `computeGridWindow(...)` traduce `scrollTop` + altezza viewport nello slice di
  item da renderizzare e nei due spacer (`paddingTop` / `paddingBottom`) che
  tengono la scrollbar a dimensione piena.

Il hook sottile [apps/web/src/hooks/use-virtual-grid.ts](../apps/web/src/hooks/use-virtual-grid.ts)
collega questa matematica a un contenitore scrollabile, misurando larghezza e
altezza con un `ResizeObserver` e l'offset con `onScroll`. La logica pura non
tocca il DOM, quindi e testabile senza browser.

**Invariante di performance**: il numero di item montati dipende dalla viewport,
mai dal totale degli asset. Con 200, 5.000 o 50.000 asset filtrati la finestra
renderizza lo stesso pugno di righe. Questo invariante e verificato in
[apps/web/src/lib/virtual-grid.test.ts](../apps/web/src/lib/virtual-grid.test.ts)
("keeps the rendered window bounded for very large libraries").

## Budget di hydration dell'editor

L'editor riceve i gruppi asset come props serializzate che Next.js poi idrata
sul client. Con una libreria enorme questo payload (e il lavoro per riviverlo)
cresce senza limiti, quindi il numero di gruppi spediti all'editor e limitato.

Il limite e un contratto esplicito in
[apps/web/src/lib/editor-hydration.ts](../apps/web/src/lib/editor-hydration.ts):

- `EDITOR_ASSET_GROUP_LIMIT` (500) e il tetto di gruppi idratati;
- `limitAssetGroupsForHydration(groups, limit)` taglia la lista e restituisce
  anche `truncated` e `omitted`, cosi il chiamante puo dire onestamente "N di M"
  invece di nascondere dati in silenzio.

La pagina editor
([apps/web/src/app/projects/[projectId]/editor/page.tsx](../apps/web/src/app/projects/%5BprojectId%5D/editor/page.tsx))
usa questo helper. Il comportamento e verificato simulando N gruppi grandi in
[apps/web/src/lib/editor-hydration.test.ts](../apps/web/src/lib/editor-hydration.test.ts)
(5.000 gruppi in ingresso, solo il budget idratato).

## Re-render dell'editor dopo lo split hook (Fase C)

Dopo lo split di `use-map-editor-state` nei sotto-hook coesi della Fase C, i
riferimenti delle closure dell'editor sono stabilizzati con `useCallback` dove
vengono passati a componenti figli o a dipendenze di `useEffect`. Il
ridisegno del canvas e isolato in un `useEffect` dedicato che dipende solo dallo
stato di disegno, e il dimensionamento del canvas usa un `ResizeObserver` invece
di ricalcolare a ogni render.

Linee guida quando si lavora sull'editor:

- non creare nuove funzioni inline come prop di componenti memoizzati: avvolgerle
  in `useCallback`;
- mantenere lo stato di disegno separato dallo stato dei form, cosi una modifica
  in un pannello non forza il ridisegno del canvas;
- liste lunghe (palette, browser, gruppi) passano sempre dalla virtualizzazione
  o dal budget di hydration descritti sopra.

## Come misurare

```bash
pnpm --filter @dm-instamap/web test   # invarianti virtual-grid + hydration budget
```

Per un controllo manuale con libreria grande: genera un dataset sintetico
(`pnpm data:seed-demo` per la demo, oppure uno scan di una cartella ampia),
apri il browser asset e verifica che lo scroll resti fluido e che l'apertura
dell'editor non si blocchi.

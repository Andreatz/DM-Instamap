# DM-Instamap - Roadmap unica

Ultimo consolidamento: 2026-05-21.

Questo file sostituisce e fonde la roadmap tecnica storica, il piano feature A-E per uso personale in 3-6 mesi e il consolidamento F-L post fase E.

Da ora in poi esiste una sola fonte di verita per roadmap, stato e criteri di verifica: questo documento.

---

## Contesto

DM-Instamap e un generatore modulare local-first di mappe D&D. Il progetto deve generare mappe giocabili, modificabili e riesportabili usando asset locali, mappe di riferimento e un bridge opzionale verso ChatGPT o provider AI configurabili.

Monorepo:

- `apps/web`: editor visuale, UI, project manager, campagne, bridge AI.
- `apps/worker`: worker Python FastAPI per job locali lunghi.
- `packages/core`: schemi dati condivisi, snapshot, campagne, MapDocument.
- `packages/assets`: scanner, classificazione, audit, gruppi, importer, embedding, image generation.
- `packages/generator`: dungeon, building, city, cave, village, outdoor, multi-floor, auto-furnish.
- `packages/exporters`: PNG, WEBP, dd2vtt, Foundry, Session Pack.
- `packages/ai-bridge`: bridge manuale ChatGPT e orchestrazione AI opzionale.
- `docs`: manuali e riferimento operativo.

Scelta di prodotto:

- Uso personale per un DM.
- Niente distribuzione pubblica come obiettivo.
- Niente cloud obbligatorio.
- Niente API a pagamento obbligatorie.
- Ogni output deve restare editabile.
- Export futuri e presenti devono restare compatibili con PNG, WEBP, dd2vtt, Foundry VTT e formato locale.

---

## Principi obbligatori

### 1. Local-first

Il progetto deve funzionare localmente. API e provider remoti sono ammessi solo come opzioni configurabili, mai come requisito.

Accettabile:

- analisi locale con Node/Python;
- Sharp;
- euristiche locali;
- embedding locali o endpoint locali/remoti opzionali;
- ChatGPT Bridge manuale via copia/incolla;
- provider AI opzionali dietro env var.

Non accettabile come requisito:

- login obbligatorio;
- database cloud obbligatorio;
- upload remoto obbligatorio;
- OpenAI/Anthropic/Replicate richiesti per usare il prodotto.

### 2. Asset binari fuori da Git

Non committare asset pesanti, mappe, immagini di pack o output generati.

Percorsi locali previsti:

```txt
data/
  assets/
  indexes/
  previews/
  projects/
  exports/
  campaigns/
```

### 3. Sviluppo incrementale

Tenere task piccoli. Ogni feature deve poter essere verificata con test o controllo manuale chiaro.

Comandi base:

```bash
pnpm lint
pnpm test
pnpm build
```

Per il worker:

```bash
pnpm worker:install
pnpm --filter @dm-instamap/worker lint
pnpm --filter @dm-instamap/worker test
```

### 4. Schemi stabili

`packages/core` e la fonte degli schemi principali. Ogni modifica a `MapDocument`, asset metadata, export, snapshot o campaign schema deve essere retrocompatibile oppure accompagnata da migrazione.

### 5. Test per ogni feature

Minimo richiesto:

- unit test per funzioni pure;
- fixture piccole;
- test schema;
- test edge case;
- test import/export quando applicabile.

### 6. UI tecnica ma chiara

Ogni sezione UI deve avere stati empty/loading/error dove servono, feedback dopo salvataggio e testo comprensibile. La UI principale deve rimanere in italiano.

---

## Stato consolidato

### Fasi legacy 1-10

La roadmap storica ha portato il progetto da prototipo tecnico a tool locale con UI, asset intelligence, generazione, editor ed export.

| Fase | Stato | Esito |
| --- | --- | --- |
| 1. Stabilizzazione tecnica | Completata | CI, `.env.example`, README, `.gitignore`, asset storage docs. |
| 2. Worker Python reale | Completata | Job persistenti SQLite, subprocess CLI, cancellazione, progress. |
| 3. Asset intelligence avanzata | Completata | Scan, preview, classificazione, audit, duplicati, quality score. |
| 4. Reference Style DNA | Completata | Palette, mood, layout traits, grid detection base, prompt summary. |
| 5. Project System locale | Completata | Progetti locali in `data/projects`, API e pagine progetto. |
| 6. Editor visuale canvas | Completata | Canvas, paint tools, inspector, save/reopen, editing asset. |
| 7. Generatore semantico/narrativo | Completata | Blueprint narrativi e tattici, room roles, generator pipeline. |
| 8. AI bridge manuale avanzato | Completata | Prompt packet, import risposta, validazione, repair locale. |
| 9. Export professionale | Completata | PNG, WEBP, dd2vtt, Foundry, player/GM map, dmimap. |
| 10. UX finale guidata | Completata | Home, wizard nuova mappa, navigazione principale. |

### Novita storiche integrate

| Novita | Stato | Esito |
| --- | --- | --- |
| Style DNA reference maps | Completata | DNA locale riusabile da generator e AI bridge. |
| Generatore narrativo + tattico | Completata | Blueprint coerenti, ruoli tattici, stanze semantiche. |
| Batch review intelligente | Completata | Code prioritarie per asset critici, duplicati, ignoti, bassa qualita. |
| Local visual search | Completata | Ricerca testo/immagine locale con embedding opzionali. |
| Auto-furnish avanzato | Completata | Regole wall/center/scatter/light, debug, vincoli anti-overlap. |

### Fasi A-E: piano feature 3-6 mesi

| Fase | Stato | Esito |
| --- | --- | --- |
| A. Pipeline reale | Completata | Worker reale, export PNG/WEBP, dd2vtt completo. |
| B. Editor da DM serio | Completata | Layer, undo/redo, luci, fog preview, note GM, initiative tracker. |
| C. Generator potenziato | Completata | Cave, village, outdoor, multi-floor, blueprint estesi, auto-furnish esteso. |
| D. AI integrata opzionale | Completata | Provider Anthropic/OpenAI opzionali, embedding remoto, image generation. |
| E. Quality of life | Completata | Pack importer, snapshot, session pack, Foundry journal, campagne. |

### Fasi F-L: consolidamento post-E

| Fase | Stato | Esito |
| --- | --- | --- |
| F. Integration fixes | Completata | AI auto con contesto, multi-floor completo, rescan asset generato, snapshot diff, Foundry notes, localizzazione UI. |
| G. CLI surface | Completata | CLI import pack, generate asset, snapshots, AI smoke, session pack, campaigns. |
| H. Worker offload | Completata | Job worker per import, generate, ai plan, session pack, proxy web e progress UI. |
| I. Editor canvas integration | Completata | Snapshot toolbar, Session Pack quick export, AI drawer, Recently Generated palette. |
| J. Documentazione | Completata | Docs generator, Foundry, worker, AI, image generation, snapshots, campaigns, importer. |
| K. Test web | Completata/parziale | Route API e helper coperti; componenti React coperti indirettamente senza testing-library/jsdom. |
| L. Polish | Parziale | L1/L4/L5 completati; L2 outdoor noise e L3 AI streaming rimandati. |

---

## Dettaglio implementazione per fase

### Fase A - Pipeline reale

Stato: completata a livello repo/test automatici.

- Worker con persistenza SQLite locale in `~/.dm-instamap/jobs.db`.
- `assets/scan`, `references/scan`, `images/analyze` eseguiti via CLI/subprocess.
- Export raster PNG/WEBP con MapDocument, walls, doors, props, lights, layer separati e qualita WEBP.
- Export dd2vtt con immagine base64, walls/lights/portals, bounds porte e fallback line-of-sight dai tile wall.

Verifica manuale ancora utile:

- import reali in Foundry/Roll20;
- apertura artefatti generati su mappe grandi.

### Fase B - Editor da DM serio

Stato: completata a livello repo/test automatici.

- Layer document-level: background, terrain, walls, props, lighting, GM-only, notes.
- Undo/redo, visibilita/lock/opacita, rotazione, scaling, flip, cambio layer, duplicazione.
- Multi-selezione Ctrl/Shift, marquee selection, select visible, group/ungroup, copy/paste.
- Luci con raggio/colore/intensita/flicker.
- Fog-of-war preview grid-based con line-of-sight.
- Note GM ancorate a celle, toggle GM-only, initiative tracker minimale.

Verifica manuale ancora utile:

- proiezione al tavolo;
- comportamento con asset library ampia;
- round-trip export Foundry/Roll20.

### Fase C - Generator potenziato

Stato: completata a livello repo/test automatici.

- `generateCaveDungeon`: cellular automata + flood fill della regione piu grande.
- `generateVillageMap`: subdivision blocks + porte automatiche.
- `generateMultiFloorDungeon`: N piani con stairs link bidirezionali.
- `generateOutdoorMap`: poisson-disc trees + fiume opzionale con bridges.
- `MapGenerationBlueprint` esteso con `structure`, `scale`, `mood`, `hasWater`, `hasVegetation`, `ruinLevel`.
- `createNarrativeBlueprint` riconosce cave/village/outdoor.
- `generateMapFromBlueprint` sceglie l'algoritmo corretto.
- Auto-furnish esteso a cave, village buildings, tavern, smithy, shrine, clearing.

Verifica manuale ancora utile:

- qualita visiva cave;
- layout villaggi su scale grandi;
- usabilita outdoor.

### Fase D - AI integrata opzionale

Stato: completata a livello repo/test automatici.

- Provider HTTP diretti: `createAnthropicProvider`, `createOpenAiProvider`, `createCustomProvider`.
- Config via `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_MAX_TOKENS`.
- Orchestrazione in `packages/ai-bridge/src/orchestration.ts`.
- `generateMapPlanWithAi` con retry e repair prompt.
- `generateNarrativeBlueprintWithAi`, `suggestAssetsForRoomWithAi`, `describeMapWithAi`.
- Embedding provider remoto opzionale con fallback locale.
- Image generation provider: Replicate, Automatic1111, custom test provider.
- Import asset generato nella libreria locale.

Verifica manuale ancora utile:

- chiamate reali con chiavi Anthropic/OpenAI;
- embedding service CLIP reale;
- Replicate/Automatic1111 reali;
- pipeline end-to-end generate asset -> library -> manifest -> editor.

### Fase E - Quality of life

Stato: completata a livello repo/test automatici.

- `packages/assets/src/pack-importer.ts` con preset `forgotten-adventures`, `two-minute-tabletop`, `czepeku`, `generic`.
- Snapshot MapDocument con `contentHash`, dedup, list/read/restore/diff.
- Session Pack zip con mappe full/GM/player, note, description, initiative e manifest.
- Foundry export con journal entries: Rooms, GM Notes, Plan Notes.
- Campaign schema: `Campaign`, `CampaignMapLink`, `CampaignSession`.
- UI per import pack, asset generate, campaigns, snapshots, export session pack, AI auto.

Verifica manuale ancora utile:

- workflow end-to-end con asset reali;
- import Foundry/Roll20 reali;
- chiamate AI e image generation reali.

### Fase F - Integration fixes

Stato: completata.

- AI auto bridge riceve asset groups e references dalla server component e li invia a `/api/ai/plan`.
- Multi-floor salva tutti i piani come progetti collegati con `relatedProjectIds`.
- Asset generato aggiorna il manifest con scan parziale.
- Snapshot diff API e UI.
- Foundry scene notes collegate ai journal.
- UI tradotta in italiano nelle sezioni residue: asset browser/review, gruppi asset, riferimenti, AI Bridge, editor, campagne, progetti, export, snapshot, worker status.

### Fase G - CLI surface

Stato: completata.

Comandi disponibili:

```bash
pnpm assets:import-pack --root <path> --preset <preset> --default-tags a,b
pnpm assets:generate --prompt "..." --classification prop --seed 123
pnpm snapshots:create <projectId> --label <label>
pnpm snapshots:list <projectId>
pnpm snapshots:restore <projectId> <contentHash>
pnpm ai:blueprint "crypt below cathedral"
pnpm ai:plan "..."
pnpm exports:session-pack <projectId> --scale 2 --output <path>
pnpm campaigns:list
pnpm campaigns:create --name "Whispering Woods" --tags a,b
```

### Fase H - Worker offload

Stato: completata.

- Job `assets/import-pack`.
- Job `assets/generate`.
- Job `ai/plan`.
- Job `exports/session-pack`.
- `apps/web/src/lib/worker-client.ts`.
- Proxy web per job.
- `useJob`.
- `JobProgressBar`.
- UI pack importer con toggle worker locale.

### Fase I - Editor canvas integration

Stato: completata.

- Pulsante Snapshot in toolbar editor e hotkey `Ctrl+Shift+S`.
- Quick export Session Pack dall'editor.
- Drawer AI Assist con descrizione mappa, suggerimenti asset e generazione asset.
- Palette Recently Generated con drag-and-drop.

### Fase J - Documentazione

Stato: completata.

Documenti aggiornati o creati:

- `docs/GENERATOR.md`
- `docs/FOUNDRY_EXPORT.md`
- `docs/WORKER.md`
- `docs/AI_BRIDGE.md`
- `docs/IMAGE_GENERATION.md`
- `docs/SNAPSHOTS.md`
- `docs/CAMPAIGNS.md`
- `docs/PACK_IMPORTER.md`

### Fase K - Test web

Stato: completata/parziale.

- Coperti helper web come bridge mappers e worker client.
- Coperti endpoint API con mock filesystem/provider/worker.
- Non introdotte dipendenze pesanti per testing-library + jsdom.
- Componenti React veri restano coperti indirettamente da lib di supporto, route API e test esistenti.

### Fase L - Polish

Stato: parziale.

Completato:

- L1: API delta snapshot in `packages/core/src/snapshots.ts` (`computeMapDocumentDelta`, `applyMapDocumentDelta`, `createDeltaSnapshot`, `restoreDeltaSnapshot`).
- L4: `POST /api/ai/describe` e `ProjectDescribeButton`.
- L5: `/projects/[id]/floors` per progetti multi-floor collegati.

Rimandato:

- L2: outdoor con perlin/simplex noise + erosione.
- L3: streaming SSE per provider AI.

---

## Prossime priorita

Questa e la parte viva della roadmap.

### P0 - Verifica manuale end-to-end

Obiettivo: dimostrare che DM-Instamap e utile in una sessione reale.

- Importare un pack asset reale.
- Eseguire scan, group, audit e batch review su libreria non banale.
- Generare un dungeon, una caverna, un villaggio, una mappa outdoor e un multi-floor.
- Salvare come progetto locale.
- Aprire in editor, modificare, arredare, aggiungere note/luci/initiative.
- Creare snapshot, diff e restore.
- Esportare PNG/WEBP, dd2vtt, Foundry, Session Pack.
- Importare davvero in Foundry e/o Roll20.

### P1 - Stabilita build Next

La build Next puo fallire per import client di moduli Node (`node:fs/promises`) tracciati da `packages/core/src/index.ts` e Turbopack. Non e un problema di prodotto visibile in dev/test, ma va risolto per avere build production pulita.

Direzione consigliata:

- separare entrypoint browser-safe e server-only in `packages/core`;
- evitare che componenti client importino barrel che esportano moduli filesystem;
- spostare snapshot/file helpers dietro entrypoint server-only.

### P2 - Migrazioni dati

Oggi `version: 1` e dichiarato, ma non c'e un sistema completo di migrazione documenti.

Task:

- `migrateMapDocument(input): MapDocument`;
- fixture di versioni precedenti;
- test di compatibilita;
- documentare policy di breaking changes.

### P3 - Outdoor polish

Migliorare `generateOutdoorMap`:

- fiumi piu naturali;
- radure piu giocabili;
- densita alberi piu controllabile;
- punti tattici e percorsi leggibili.

### P4 - AI streaming e UX lunga durata

Solo se l'uso reale mostra attrito:

- SSE provider Anthropic/OpenAI;
- progressivo display in UI;
- cancellazione richiesta;
- storico raw response.

---

## Checklist maturita

### Core

- [x] Schemi Zod stabili.
- [ ] Migrazioni versioni documento.
- [x] Test schema.
- [x] Snapshot full.
- [x] Delta snapshot API.
- [x] Campaign schema.

### Assets

- [x] Scan.
- [x] Preview.
- [x] Classification.
- [x] Manual overrides.
- [x] Audit.
- [x] Duplicates.
- [x] Quality score.
- [x] Batch review.
- [x] Local visual search.
- [x] Pack importer.
- [x] Image generation import.

### References

- [x] Scan.
- [x] Preview.
- [x] Map type.
- [x] Review override.
- [x] Style DNA.
- [x] Grid detection base.
- [x] Prompt summary.

### Generator

- [x] Simple dungeon.
- [x] Narrative blueprint.
- [x] Crypt/building/dungeon blueprint.
- [x] Cave.
- [x] Village.
- [x] Outdoor.
- [x] Multi-floor.
- [x] Tactical roles.
- [x] Auto-furnish advanced.
- [ ] Outdoor polish con noise/erosione.

### Web

- [x] Home.
- [x] Projects.
- [x] New map wizard.
- [x] Asset browser.
- [x] Asset review.
- [x] Asset group review.
- [x] Reference browser/review.
- [x] AI bridge manuale.
- [x] AI auto workspace.
- [x] Editor canvas.
- [x] Campaign dashboard.
- [x] Export page.
- [x] Snapshot panel.
- [x] UI italiana.

### Worker

- [x] Health.
- [x] Jobs.
- [x] SQLite persistence.
- [x] Cancellation.
- [x] Asset scan endpoint.
- [x] Reference scan endpoint.
- [x] Image analysis endpoint.
- [x] Import pack job.
- [x] Asset generation job.
- [x] AI plan job.
- [x] Session pack job.
- [x] Web progress polling.

### Export

- [x] PNG.
- [x] WEBP.
- [x] dd2vtt.
- [x] Foundry.
- [x] Player safe map.
- [x] GM map.
- [x] dmimap.
- [x] Session Pack.
- [ ] Verifica manuale import Foundry/Roll20 su artefatti reali.

### Quality

- [x] CI.
- [x] README.
- [x] Roadmap unica.
- [x] Docs feature.
- [x] Tests.
- [x] No generated data in Git.
- [x] No external API requirement.
- [ ] Build production Next pulita.

---

## File critici

- Schemi dati: `packages/core/src/`
- Snapshot: `packages/core/src/snapshots.ts`
- Campaign schema: `packages/core/src/campaign.ts`
- Worker jobs: `apps/worker/src/dm_instamap_worker/jobs.py`
- Worker models: `apps/worker/src/dm_instamap_worker/models.py`
- Asset scanner: `packages/assets/src/scanner.ts`
- Asset audit: `packages/assets/src/audit.ts`
- Asset groups: `packages/assets/src/groups.ts`
- Pack importer: `packages/assets/src/pack-importer.ts`
- Reference Style DNA: `packages/assets/src/reference-style.ts`
- Generator: `packages/generator/src/`
- Auto-furnish: `packages/generator/src/furnishing.ts`
- Editor web: `apps/web/src/components/editor/map-editor.tsx`
- Project storage: `apps/web/src/lib/projects.ts`
- AI bridge: `packages/ai-bridge/src/`
- Exporters: `packages/exporters/src/`

---

## Pattern da riusare

- Zod schemas in `packages/core`.
- `MapDocument` come source of truth editabile.
- Manifest asset locale come base di classificazione/search.
- Override manuali separati dal manifest generato.
- `scanSingleAsset` + append manifest per aggiornamenti incrementali.
- `diffSnapshots` e snapshot helpers per versioning.
- CLI pnpm come interfaccia stabile tra web, worker e package.
- UI locale con feedback esplicito invece di operazioni mute.

---

## Verifica consigliata

### Automatica

```bash
pnpm lint
pnpm test
pnpm --filter @dm-instamap/web lint
pnpm --filter @dm-instamap/web test
pnpm --filter @dm-instamap/worker test
```

### Manuale

1. Avviare worker e app web.
2. Importare un pack asset locale.
3. Generare gruppi e audit.
4. Revisionare qualche gruppo e asset.
5. Generare una mappa da wizard e una da generator preview.
6. Modificare in editor.
7. Usare snapshot, restore e diff.
8. Esportare Session Pack.
9. Esportare Foundry e dd2vtt.
10. Importare gli artefatti in VTT reali.

---

## Definizione di progetto maturo

DM-Instamap puo considerarsi maturo quando:

- puoi creare una nuova mappa da wizard;
- puoi scegliere asset e reference;
- puoi generare una bozza coerente;
- puoi modificarla in editor canvas;
- puoi arredarla automaticamente;
- puoi correggere asset senza controllarli tutti uno per uno;
- puoi usare il ChatGPT manual bridge senza API;
- puoi usare provider AI opzionali quando configurati;
- puoi esportare player map, GM map, Foundry, dd2vtt, PNG, WEBP e Session Pack;
- puoi riaprire progetti salvati;
- puoi gestire campagne locali;
- test e CI sono verdi;
- non c'e dipendenza obbligatoria da servizi esterni.

---

## Nota finale

DM-Instamap non deve diventare un generatore magico e fragile.

La strategia corretta resta:

```txt
Asset locali analizzati bene
+ Reference Style DNA
+ Blueprint narrativo
+ Generatore geometrico controllabile
+ Editor manuale
+ Auto-furnish
+ Export professionale
+ ChatGPT Bridge opzionale
= Tool realmente utile per un DM
```

Ogni mappa generata deve restare correggibile, editabile e riesportabile.

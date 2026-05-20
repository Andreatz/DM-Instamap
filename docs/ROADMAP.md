# DM-Instamap — Analisi Esperta, Punteggio e Piano Feature (3-6 mesi, uso personale)

## Context

Progetto: **DM-Instamap**, generatore modulare di mappe D&D local-first. Monorepo pnpm con:
- `apps/web` — Next.js 16.2.6 + React 19 (editor, browser asset, project manager)
- `apps/worker` — FastAPI Python 3.12+ (job queue, **placeholder**)
- `packages/core` — Schemi Zod (`MapDocument`, `AssetMetadata`, ecc.)
- `packages/assets` — Scanner, classify, group, audit (Sharp)
- `packages/generator` — Dungeon/building/city procedurali
- `packages/exporters` — PNG/WEBP/dd2vtt/Foundry (**fondamenta**)
- `packages/ai-bridge` — Bridge ChatGPT manuale (no API)

Scelta esplicita dell'utente: il tool è **per uso personale**, niente distribuzione, niente collaboration, niente packaging pubblico. Focus su **nuove feature in 3-6 mesi**.

Questo documento serve a:
1. Dare un giudizio tecnico onesto del progetto allo stato attuale (commit `b38ee61`, 2026-05-20).
2. Identificare cosa manca per renderlo concretamente utile al singolo DM.
3. Proporre una roadmap di feature priorizzata su 3-6 mesi.

> **Consolidamento post-E**: una volta chiuse le fasi A-E, restano gap di integrazione, CLI, worker offload, editor UX, docs e test. La roadmap di consolidamento (fasi F-L) e' in [ROADMAP_POST_E.md](ROADMAP_POST_E.md).

### Aggiornamento implementazione - 2026-05-20

- FASE A completata a livello repo/test automatici.
- A1: il worker persiste i job in SQLite locale (`~/.dm-instamap/jobs.db`), esegue CLI locali reali via subprocess, supporta cancellazione del processo in corso e salva output/exit code per step.
- A1: `assets/scan` invoca `pnpm assets:scan`; `references/scan` invoca `pnpm references:scan` e poi `pnpm references:style`; `images/analyze` invoca l'analisi Sharp locale con dimensioni, trasparenza e colori dominanti.
- A2: l'export raster PNG/WEBP compone `MapDocument`, walls, doors, props e lights, supporta layer separati trasparenti, bundle zip dei layer e qualita WEBP configurabile.
- A3: l'export dd2vtt produce JSON con immagine base64, walls/lights/portals, bounds espliciti delle porte e fallback line-of-sight dai tile wall quando mancano segmenti plan.
- Nota verifica manuale: import reali in Foundry/Roll20 restano da fare fuori dai test automatici, usando gli artefatti generati dalla pipeline A.
- FASE B completata a livello repo/test automatici: il modello dati ora include layer document-level, gruppi asset, note GM ancorate, initiative tracker e luci con flicker.
- B1/B2: l'editor supporta undo/redo, visibilita/lock/opacita layer, rotazione/scaling/flip asset, cambio layer asset, duplicazione, multi-selezione Ctrl/Shift, marquee selection, selezione asset visibili, group/ungroup e copy/paste locale tra editor.
- B3/B4: l'editor supporta modifica raggio/colore/intensita/flicker luci, preview fog-of-war grid-based con line-of-sight, note GM ancorate a celle, toggle rapido layer GM-only e initiative tracker minimale.
- Nota verifica manuale: proiezione al tavolo, import Foundry/Roll20 reali e comportamento con asset library ampia restano da verificare fuori dai test automatici.
- FASE C completata a livello repo/test automatici: nuovi algoritmi procedurali, blueprint estesi e auto-furnishing per i nuovi room types.
- C1: `generateCaveDungeon` (cellular automata 5-iter + flood fill della regione piu grande), `generateVillageMap` (subdivision blocks + porte automatiche), `generateMultiFloorDungeon` (N piani con stairs link bidirezionali), `generateOutdoorMap` (poisson-disc trees + opzionale fiume con bridges). Tutti deterministici via seed.
- C2: `MapGenerationBlueprint` ora include `structure`, `scale`, `mood`, `hasWater`, `hasVegetation`, `ruinLevel`. `createNarrativeBlueprint` riconosce cave/village/outdoor e `generateMapFromBlueprint` instrada automaticamente all'algoritmo C1 corretto. Le dimensioni di default scalano con `scale` (small/medium/large).
- C3: `FURNISHING_ROOM_TYPES` esteso con `cave`, `village_building`, `tavern`, `smithy`, `shrine`, `clearing`. `inferFurnishingRoomType` riconosce le stanze nuove (anche `kind === "service"` per le clearing outdoor). `selectRooms` include ora il kind `service` cosi le aperture outdoor vengono effettivamente arredate.
- Nota verifica manuale: qualita visiva delle cave, layout dei villaggi su scale grandi e usabilita degli outdoor restano da valutare dentro l'editor; gli algoritmi sono coperti solo da test su forma del MapDocument.
- FASE D completata a livello repo/test automatici: AI bridge via API, embedding provider remoto, generazione tile/asset on-demand. Tutto configurabile via env, niente SDK pesanti aggiunti (HTTP diretto via fetch).
- D1: nuovi provider `createAnthropicProvider` e `createOpenAiProvider` (HTTP diretto verso `/v1/messages` e `/v1/chat/completions`), piu `createCustomProvider` per testing. `resolveAiConfigFromEnv`/`createProviderFromEnv` leggono `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_MAX_TOKENS`. `getBridgeStatus(env)` ora segnala `mode: "api"` quando il provider e disponibile.
- D1: orchestrazione AI in `packages/ai-bridge/src/orchestration.ts`. `generateMapPlanWithAi` riusa `buildChatGptBridgePrompt` e `validateBridgeResponse` con retry automatico via `buildRepairPrompt`. `generateNarrativeBlueprintWithAi` produce blueprint Zod-validati. `suggestAssetsForRoomWithAi` filtra le suggestion alla asset library locale per non inventare id. `describeMapWithAi` produce testo narrativo per il DM.
- D2: nuovo `createRemoteEmbeddingProvider({endpoint, model, headers, dimensions})` che parla con qualunque servizio CLIP/embedding via HTTP (OpenAI embeddings, server `@xenova/transformers` locale, ecc.). `resolveEmbeddingConfigFromEnv`/`createEmbeddingProviderFromEnv` leggono `EMBEDDINGS_PROVIDER=remote|local`, `EMBEDDINGS_ENDPOINT`, `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_DIMENSIONS`. Fallback automatico al provider locale se la config remota e incompleta.
- D3: nuovo modulo `packages/assets/src/image-generation.ts` con astrazione `ImageGenerationProvider` e tre implementazioni: `createReplicateImageGenerationProvider` (predict + polling + download), `createAutomatic1111Provider` (txt2img base64 → buffer) e `createCustomImageGenerationProvider` per testing. `importGeneratedAssetToLibrary` scrive il file nella asset library locale e ritorna un `GeneratedAssetMetadata` pronto per essere passato allo scanner. Env: `IMAGE_GEN_PROVIDER=replicate|automatic1111`, `IMAGE_GEN_API_KEY`, `IMAGE_GEN_MODEL`, `IMAGE_GEN_VERSION`, `IMAGE_GEN_BASE_URL`.
- Nota verifica manuale: chiamate reali contro Anthropic/OpenAI, embedding service CLIP e Replicate/Automatic1111 restano da provare con chiavi reali; i test automatici usano mock del `fetch`. La pipeline end-to-end "genera asset da prompt → importa nella library → rescan" e da convalidare con un asset di prova.
- FASE E completata a livello repo/test automatici: importer batch, snapshot/versioning, session pack, journal Foundry e schema campagna sono in piedi. Resta UI di "campagna" e workflow end-to-end da convalidare manualmente.
- E1: nuovo modulo `packages/assets/src/pack-importer.ts` con preset `forgotten-adventures`, `two-minute-tabletop`, `czepeku`, `generic`. `importAssetPack` riusa `scanAssets` poi applica regole regex per filename/cartella, aggiungendo tag specifici per preset e riclassificando solo gli asset `unknown`/automatici. `applyPackRulesToEntry` e' chiamabile su entry gia esistenti, utile per ri-tagging.
- E2: nuovo modulo `packages/core/src/snapshots.ts`. `createMapSnapshot` produce un record con `contentHash` (SHA-256 troncato), label, timestamp e MapDocument. `writeSnapshotToDirectory` salva sotto `data/projects/<id>/snapshots/` con dedup automatico per `contentHash`. `listSnapshotsInDirectory`, `readSnapshotFromDirectory`, `restoreSnapshotFromDirectory` per il flusso "torna a 30 minuti fa". `diffSnapshots` confronta due record e ritorna i campi cambiati (rooms/walls/doors/lights/tiles/assets/notes/initiative).
- E3: nuovo modulo `packages/exporters/src/session-pack.ts`. `exportSessionPack` produce un zip con `maps/<slug>-full.png`, `maps/<slug>-gm.png`, `maps/<slug>-player.png` (sfruttando `applyVisibilityMode`), `notes/gm-notes.json`, `notes/plan-notes.txt`, `notes/description.txt`, `initiative/initiative.json` e `manifest.json`. Workflow "preparo la sessione → un click" coperto, formato grafico tunable (png/webp), initiative opzionale.
- E4: `exportFoundryModule` ora genera anche journal entries dal MapDocument. Tre journal: "Rooms" (un page per RoomNode con bounds/tags/connections), "GM Notes" (un page per MapNote ancorata), "Plan Notes" (notes plan-level). Il manifest aggiunge il pack `journal` di tipo `JournalEntry`. `includeJournals: false` mantiene la compatibilita pre-E4.
- E5: nuovi schema in `packages/core/src/campaign.ts` con `Campaign`, `CampaignMapLink`, `CampaignSession`. `createCampaign` produce un record validato Zod con maps e sessions opzionali. Schema pensato per uso personale: niente sync, solo aggregazione locale di mappe e timeline sessioni.
- Nota verifica manuale: workflow end-to-end con asset reali, import Foundry/Roll20 reali e chiamate AI/CLIP/Replicate reali restano da provare fuori dai test automatici.
- UI gap chiuso a livello repo/test automatici: tutti i feature C/D/E sono ora esposti nell'app web.
- UI C1/C2: `dungeon-generator-preview` ha un selettore Mode con `simple`, `narrative`, `cave`, `village`, `outdoor`, `multi-floor`. Campi seed deterministico, building count, river/tree density, floor count compaiono on-demand. Il blueprint summary mostra structure/scale/mood/water/vegetation/ruin.
- UI E3/E4: `project-export-panel` aggiunge i format `session-pack` (con campo description e toggle initiative) e il toggle "include journals" per Foundry. Backend: `/api/export` e `/api/projects/[id]/export` instradano a `exportSessionPack` e passano `includeJournals` a `exportFoundryModule`.
- UI E2: `ProjectSnapshotsPanel` su `/projects/[id]` con create / list / restore. API: `/api/projects/[id]/snapshots` (GET/POST) e `/api/projects/[id]/snapshots/[contentHash]` (GET/POST per restore via `updateProject`).
- UI E1: pagina `/assets/import-pack` con dropdown preset, default tags e summary (asset indexed, preset tags applied, reclassified). API: `/api/assets/import-pack`.
- UI E5: pagine `/campaigns` (lista + form crea) e `/campaigns/[id]` (linked maps + timeline sessioni). API: `/api/campaigns` e `/api/campaigns/[id]`. Storage locale in `data/campaigns/<id>/campaign.json` via `apps/web/src/lib/campaigns.ts`.
- UI D1: `AiAutoWorkspace` su `/ai-bridge` che mostra status del provider (env-config) e bottoni "Generate Blueprint" / "Generate Map Plan". Plan importabile come progetto via `/api/ai-bridge/import`. API: `/api/ai/status`, `/api/ai/blueprint`, `/api/ai/plan`.
- UI D2/D3: `/api/assets/search` ora usa `createEmbeddingProviderFromEnv` (D2). Nuova pagina `/assets/generate` con `AssetGeneratorForm` per prompt/seed/steps/style tags; salvataggio diretto nella library via `/api/assets/generate`.
- Header e home aggiornati: link a Campaigns, Import Pack, Generate Asset; nav header con "AI Bridge (auto + manual)". CSS minimo per snapshot-list, campaign-list, field-row in `globals.css`.

---

## 1. Roadmap Feature (3-6 mesi, uso personale)

Priorità basata su: (a) impatto concreto sull'uso al tavolo, (b) effort ragionevole per singolo dev, (c) sfruttamento delle fondamenta già esistenti.

### FASE A — Sbloccare la pipeline reale (settimane 1-3)

Obiettivo: trasformare i placeholder in funzionalità reali. Senza questo, il resto è inutilizzabile.

#### A1. Worker Python: esecuzione job reale
- File: [apps/worker/src/dm_instamap_worker/jobs.py](apps/worker/src/dm_instamap_worker/jobs.py)
- Sostituire `run_placeholder_job()` con esecutori reali:
  - `assets/scan` → invoca lo scanner TS via subprocess o porta la logica in Python (preferibile: subprocess sul CLI `pnpm assets:scan` esistente, con cattura progress).
  - `references/scan` → idem con `pnpm references:style`.
  - `images/analyze` → analisi Sharp via subprocess o porting Python (Pillow + colorthief).
- Aggiungere persistenza job (SQLite via `sqlite3` stdlib in `~/.dm-instamap/jobs.db`) per sopravvivere a restart del worker.
- Background tasks reali via `asyncio` + `BackgroundTasks` di FastAPI, con cancellation.

#### A2. Exporter PNG/WEBP funzionante
- File: [packages/exporters/](packages/exporters/)
- Composizione raster: Sharp per comporre `MapDocument` (tiles + nodes + walls) in PNG single-image alla risoluzione scelta (es. 70px/cell).
- Layer separati esportabili: floor / walls / props / lighting (per import VTT).
- WEBP con compression tunable.

#### A3. Exporter dd2vtt completo
- Formato dd2vtt = JSON con base64 PNG + walls/lights/portals come array di coordinate.
- Mappare `MapNode` walls → wall segments dd2vtt.
- Mappare luci dell'editor (vedi B3) → lights array.
- Test contro Foundry/Roll20 reali.

### FASE B — Editor da DM serio (settimane 4-8)

Obiettivo: rendere l'editor uno strumento utilizzabile durante la prep di una sessione, non un demo.

#### B1. Manipolazione asset avanzata
- File: [apps/web/src/](apps/web/src/) sezione editor
- Rotazione libera (15° snap + free), scaling proporzionale e libero, flip H/V.
- Multi-selezione con marquee + group/ungroup.
- Undo/redo stack persistente (command pattern, ricicla `MapDocument` immutabile).
- Copy/paste tra mappe diverse dello stesso progetto.

#### B2. Layer system
- Layer: Background / Terrain / Walls / Props / Lighting / GM-only / Notes.
- Toggle visibilità, lock, opacity per layer.
- Riflesso nel `MapDocument` schema in [packages/core](packages/core/).

#### B3. Lighting & Fog of War (preview)
- Light sources con raggio, colore, intensità, flicker.
- Calcolo line-of-sight grid-based (shadowcasting o Bresenham) per preview in editor.
- Esporta dati luci in dd2vtt/Foundry (compatibilità nativa).
- *Non* serve real-time multi-player — solo preview e export.

#### B4. Strumenti DM al tavolo
- "Initiative tracker" minimale embeddato nell'editor (uso personale, niente sync).
- Note ancorate a coordinate sulla mappa (visibili solo a te).
- Hotkey per nascondere/mostrare layer GM durante reveal narrativo (utile se proietti la mappa).

### FASE C — Generator potenziato (settimane 7-12)

Obiettivo: generazione che produca mappe non banali, riducendo il lavoro manuale.

#### C1. Algoritmi aggiuntivi
- File: [packages/generator/src/](packages/generator/src/)
- **Cave organiche**: cellular automata (4-5 rule, 5 iterazioni) per dungeon naturali.
- **Città/villaggi**: subdivision-based block layout + road network (L-system o A* connection).
- **Dungeon multi-piano**: link verticali (scale, botole), generazione consistente cross-floor.
- **Outdoor**: foreste con poisson-disk sampling, fiumi con perlin noise + erosione semplice.

#### C2. Blueprint-driven generation
- Estendere `narrativeBlueprint` in [docs/GENERATOR.md](docs/GENERATOR.md) con: tipo struttura, scala, mood, presenza acqua/vegetazione, livello di rovina.
- Da blueprint → selezione automatica algoritmo + parametri.

#### C3. Auto-furnishing intelligente
- Usa asset audit + classification per popolare stanze in modo contestuale:
  - Tavern → tavoli/sedie/bar/camino con regole di posizionamento.
  - Crypt → sarcofagi/altari/candelabri.
  - Library → scaffali lungo i muri, tavoli al centro.
- Constraint-based placement (no overlap, no blocking doors, density target).

### FASE D — AI integrata seria (settimane 10-16)

Obiettivo: ridurre la frizione del "manual ChatGPT bridge" e sbloccare nuove possibilità.

#### D1. AI bridge automatico (Claude/OpenAI)
- Trasformare [packages/ai-bridge/](packages/ai-bridge/) da manual → API.
- Provider configurabile (`.env`: `AI_PROVIDER=anthropic|openai`, `AI_API_KEY=...`).
- Costruisce prompt automaticamente da contesto attuale (asset groups + style DNA + user request) e parsea la risposta con gli schemi Zod esistenti.
- Funzioni:
  - "Genera blueprint narrativo da idea testuale" → produce `narrativeBlueprint` valido.
  - "Suggerisci asset coerenti per questa stanza" → query asset library locale + suggerimenti AI.
  - "Scrivi descrizione narrativa di questa mappa" → testo per il DM.

#### D2. Embeddings reali per asset search
- Integrare CLIP locale (via `@xenova/transformers` in Node, o `clip-onnx` Python nel worker) per embedding immagini.
- File: arricchire `pnpm assets:embed` per generare embeddings reali.
- API `/api/assets/search-by-image` usa cosine similarity su embeddings veri (oggi solo hash visivo).
- Text-to-image search ("dark gothic library") via CLIP text encoder.

#### D3. Generazione tile/asset on-demand (opzionale)
- Integrazione opzionale Replicate / Stable Diffusion locale (Automatic1111 API) per:
  - Generare tile mancanti coerenti con lo style DNA.
  - Generare prop singoli da prompt testuale, taglio automatico background.
- File risultanti vengono **importati nella asset library** come asset locali (no dipendenza runtime).

### FASE E — Quality of life (settimane 14-24, continuative)

#### E1. Importer batch da pacchetti asset esistenti
- Importer per pacchetti famosi (Forgotten Adventures, 2-Minute Tabletop, ecc.): auto-tagging basato su nomi file/cartelle, classification preset.
- Resta local-first: importi solo ciò che hai già su disco.

#### E2. Snapshot/versioning progetti
- Ogni save crea snapshot diff-based in `data/projects/<id>/snapshots/`.
- UI per "torna a 30 minuti fa" durante prep.

#### E3. Export "session pack"
- Da progetto → zip con: mappa PNG full, mappa GM con note, mappa player senza note, handout slice, initiative tracker JSON, descrizioni narrative.
- Workflow "preparo la sessione → un click → tutto pronto".

#### E4. Integrazione Foundry VTT module
- Completare [docs/FOUNDRY_EXPORT.md](docs/FOUNDRY_EXPORT.md): produrre un vero `.zip` module installabile.
- Scene con walls, lights, doors, journal entries pre-popolati.

#### E5. Dashboard "campagna"
- Vista d'insieme: tutte le mappe di una campagna, link tra di esse, timeline sessioni.
- Solo per uso personale, niente sync.

---

## 2. File critici di riferimento

Per ogni fase, questi sono i punti di ingresso da leggere prima di toccare:

- **Schemi dati centrali**: [packages/core/src/](packages/core/src/) — qualunque feature che tocca i dati passa da qui.
- **Worker**: [apps/worker/src/dm_instamap_worker/jobs.py](apps/worker/src/dm_instamap_worker/jobs.py), [apps/worker/src/dm_instamap_worker/models.py](apps/worker/src/dm_instamap_worker/models.py).
- **Asset audit/DNA** (da riusare): [packages/assets/src/audit.ts](packages/assets/src/audit.ts), [packages/assets/src/reference-style.ts](packages/assets/src/reference-style.ts).
- **Generator**: [packages/generator/src/index.ts](packages/generator/src/index.ts).
- **Editor**: [apps/web/src/app/projects/[projectId]/editor/](apps/web/src/app/projects/) (verificare path esatto in dev).
- **AI bridge**: [packages/ai-bridge/src/index.ts](packages/ai-bridge/src/index.ts).
- **Roadmap esistente**: [docs/ROADMAP.md](docs/ROADMAP.md) — già contiene 10 fasi pianificate, allineare la nuova roadmap con quella esistente.

---

## 3. Utility e pattern già esistenti da riusare (non re-implementare)

- `clamp`, `toTitle`, `unique` — utility centralizzate in `packages/core` o `packages/assets`.
- `AssetMetadata`, `MapDocument`, `MapNode`, `MapTile`, `ExportJob` — schemi Zod completi, riusare invece di crearne di nuovi.
- `createAssetCandidate`, `classifyAsset`, `scanAssets` — pattern verb-noun, mantenere coerenza nei nuovi moduli.
- Quality scoring weighted di `audit.ts` — pattern riutilizzabile per scoring di asset generati AI.
- Visual-hash di `audit.ts` — riusare per deduplicazione di asset generati AI.

---

## 4. Verifica

Ogni fase ha criteri di verifica chiari:

- **Fase A**: avviare worker, lanciare `POST /jobs/assets/scan` da curl/Postman → vedere job passare `queued → running → completed` con risultati reali. Esportare una mappa di test in PNG e aprirla, in dd2vtt e importarla in Foundry.
- **Fase B**: prendere una mappa pre-esistente, ruotare/scalare 10 asset, fare 20 undo, salvare, riaprire, verificare integrità. Test luci: una torcia in stanza buia mostra cono di luce nell'editor.
- **Fase C**: generare 5 dungeon caverna, 3 villaggi, 1 foresta → ispezione visiva qualità. Auto-furnish di una taverna → conta oggetti, no overlap, no blocco porte.
- **Fase D**: configurare `AI_API_KEY`, chiedere "genera blueprint per cripta sotto un monastero" → ricevere JSON validato da Zod. Search "dark gothic library" → top-10 risultati visivamente coerenti.
- **Fase E**: preparare una sessione end-to-end, click "session pack" → zip aperto contiene tutti gli artefatti previsti, importabili in Foundry.

---

## 5. Note finali

- **Stack ML locale**: per CLIP locale considerare `@xenova/transformers` (browser/Node, no Python) — evita di appesantire il worker Python.
- **Niente collaboration / cloud / packaging**: deliberatamente fuori scope per uso personale.
- **Stima realistica solo dev**: Fase A 2-3 settimane, Fase B 4-5 settimane, Fase C 4-6 settimane, Fase D 4-6 settimane, Fase E continuativa. Totale ~4-6 mesi a ritmo serale/weekend.

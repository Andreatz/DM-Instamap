# DM-Instamap — Roadmap Post-E (consolidamento, 6-10 settimane)

## Context

Fasi A → E sono complete a livello package, API e UI (vedi [ROADMAP.md](ROADMAP.md)). L'app web espone tutte le feature ma restano gap concreti emersi durante la chiusura della UI. Questo documento li raggruppa in sei fasi (F → L) ordinate per impatto e dipendenze, in modo da poter essere chiuse a ritmo serale/weekend in 6-10 settimane totali.

I gap identificati sono raggruppati in:

1. **Bug / integrazioni incomplete** — feature presenti ma non funzionanti end-to-end (FASE F).
2. **CLI mancanti** — comandi `pnpm` per automazione e smoke test (FASE G).
3. **Worker offload** — operazioni lunghe ancora in-process nel server Next (FASE H).
4. **Editor canvas integration** — feature accessibili solo dalla project page (FASE I).
5. **Documentazione disallineata** — `.md` non riflettono C/D/E (FASE J).
6. **Test web mancanti** — i nuovi componenti React e le nuove route API non hanno copertura (FASE K).
7. **Polish QoL** — orchestrazione AI completa, snapshot diff-based, outdoor migliorato (FASE L).

---

## FASE F — Integration fixes (settimana 1-2)

Obiettivo: chiudere i bug che rendono visibilmente "rotte" feature che il ROADMAP marca come complete.

### Stato implementazione (2026-05-21)

- F1 chiuso: `AiAutoWorkspace` riceve `assetGroups` e `references` da `apps/web/src/app/ai-bridge/page.tsx`, li trasforma via `toBridgeAssetGroup`/`toBridgeReference` (estratti in `apps/web/src/lib/bridge-mappers.ts`) e li invia a `/api/ai/plan`. UI mostra contatori del contesto inviato.
- F2 chiuso: aggiunto `relatedProjectIds` a `ProjectMetadataSchema`, nuova `createMultiFloorProjects` in `apps/web/src/lib/projects.ts`, route `/api/projects/multi-floor`, segmented control "Floor N" e salvataggio multi-piano in `dungeon-generator-preview`, sezione "Linked Floors" nella project page. Coperto da test `projects.test.ts`.
- F3 chiuso: nuovi `scanSingleAsset` e `appendAssetToManifest` in `packages/assets/src/scanner.ts`; `/api/assets/generate` aggiorna il manifest dopo `importGeneratedAssetToLibrary` e l'UI di `asset-generator-form` mostra "Added to manifest" / count.
- F4 chiuso: nuova route `GET /api/projects/[id]/snapshots/[hash]/diff?against=current|<hash>` e bottone "Diff vs current" nel `ProjectSnapshotsPanel`. Riusa `diffSnapshots` e `createMapSnapshot` da `@dm-instamap/core`.
- F5 chiuso: `FoundrySceneData` ora include `notes: FoundrySceneNoteData[]` con `entryId`/`pageId` agganciati alle pagine del journal "GM Notes". Quando `includeJournals: false` le note di scena non vengono emesse. Coperto da nuovi test in `foundry.test.ts`.

### F1. AI auto bridge passa contesto locale

- File: [apps/web/src/components/ai-bridge/ai-auto-workspace.tsx](apps/web/src/components/ai-bridge/ai-auto-workspace.tsx), [apps/web/src/app/api/ai/plan/route.ts](apps/web/src/app/api/ai/plan/route.ts), [apps/web/src/app/ai-bridge/page.tsx](apps/web/src/app/ai-bridge/page.tsx).
- Far ricevere `assetGroups` e `references` dalla server component come props (come fa `AiBridgeWorkspace`).
- Trasformarli in `BridgeAssetGroupSummary[]` / `BridgeReferenceSummary[]` (esiste già in `ai-bridge-workspace.tsx`).
- Inviarli a `/api/ai/plan` invece di array vuoti, così il provider produce assetId reali e si possono usare le suggestions di `validatePlanSemantics`.
- Verifica: chiamata reale a `/api/ai/plan` con env configurato e asset library indicizzata → la `MapPlan` ritornata referenzia almeno un `assetGroupId` o asset locale.

### F2. Multi-floor salva tutti i piani

- File: [apps/web/src/components/generate/dungeon-generator-preview.tsx](apps/web/src/components/generate/dungeon-generator-preview.tsx), [apps/web/src/lib/projects.ts](apps/web/src/lib/projects.ts), nuova route `/api/projects/multi-floor` o estensione di `/api/projects`.
- Opzioni di scope (scegliere una):
  - **A**: salvare N progetti collegati (`<theme>-floor-1`, `<theme>-floor-2`, ...) con cross-link tag `link-floor-N`.
  - **B**: aggiungere un campo `floors` opzionale al `MapDocument` schema (richiede migrazione, sconsigliato per uso personale).
- Aggiungere selettore di piano nella preview (segmented control sui floor index).
- Salvataggio: opzione A, con un campo `relatedProjectIds: string[]` in `project.json`.
- Verifica: generare 3 piani con seed deterministico, salvare, navigare nei 3 progetti dalla project page; ogni piano referenzia gli altri via tag stairs.

### F3. Asset generato triggera rescan parziale

- File: [apps/web/src/app/api/assets/generate/route.ts](apps/web/src/app/api/assets/generate/route.ts), [apps/web/src/components/assets/asset-generator-form.tsx](apps/web/src/components/assets/asset-generator-form.tsx), nuova funzione `scanSingleAsset` in `packages/assets/src/scanner.ts`.
- Dopo `importGeneratedAssetToLibrary`, eseguire uno scan mirato sul singolo file e accodare la nuova entry al manifest senza rilanciare l'intero scan.
- UI: pulsante "Re-scan library" o conferma "Asset added to manifest" subito dopo la generazione.
- Verifica: dopo generate, l'asset compare in `/assets` senza rilanciare `pnpm assets:scan`.

### F4. Snapshot diff UI

- File: [apps/web/src/app/api/projects/[projectId]/snapshots/[contentHash]/route.ts](apps/web/src/app/api/projects/[projectId]/snapshots/[contentHash]/route.ts), [apps/web/src/components/projects/project-snapshots-panel.tsx](apps/web/src/components/projects/project-snapshots-panel.tsx).
- Aggiungere endpoint `GET /api/projects/[id]/snapshots/[hash]/diff?against=<otherHash>` che ritorna `SnapshotDiff`.
- Nel panel: per ogni snapshot, bottone "Diff vs current" che apre un popover con la lista dei `changedFields`.
- Verifica: modificare 1 stanza, snapshot, modificare 2 stanze e una nota, snapshot, diff tra i due → restituisce `["rooms", "gmNotes"]`.

### F5. Foundry scene → journal linkages

- File: [packages/exporters/src/foundry.ts](packages/exporters/src/foundry.ts), [packages/exporters/tests/foundry.test.ts](packages/exporters/tests/foundry.test.ts).
- Aggiungere `notes` o `journal` references nel `FoundrySceneData` puntando alle entry journal con coordinate (per i GM notes ancorati) o link "Open in journal" per la lista room.
- Schema Foundry: usare `notes` array con `{ _id, entryId, pageId, x, y, icon }` per i `MapNote`.
- Verifica: importare lo zip in Foundry → le note ancorate appaiono come pin sulla mappa e linkano alle pagine del journal.

---

## FASE G — CLI surface (settimana 2-3)

Obiettivo: rendere ogni feature pilotabile da script senza avviare Next.

### G1. `pnpm assets:import-pack`

- File: `packages/assets/src/cli/import-pack.ts`, registrare in [packages/assets/package.json](packages/assets/package.json).
- Args: `--preset <name>` (default `generic`), `--root <path>`, `--default-tags <comma>`.
- Riusa `importAssetPack` e stampa il summary (asset count, preset tags applied, reclassified, errors).
- Verifica: `pnpm assets:import-pack --preset forgotten-adventures --root ./local-assets/fa` produce manifest aggiornato.

### G2. `pnpm assets:generate`

- File: `packages/assets/src/cli/generate.ts`.
- Args: `--prompt "..."`, `--classification door`, `--seed N`, `--style-tags a,b`, `--provider replicate|automatic1111`.
- Legge env per la config provider, chiama `createImageGenerationProviderFromEnv` + `importGeneratedAssetToLibrary`.
- Verifica: con Automatic1111 locale, il comando salva un file in `data/assets/generated/`.

### G3. CLI snapshots

- File: `apps/web/src/lib/cli/snapshots.ts` (o nuovo package `packages/cli` se cresce).
- Sotto-comandi:
  - `pnpm snapshots:create <projectId> [--label foo]`
  - `pnpm snapshots:list <projectId>`
  - `pnpm snapshots:restore <projectId> <contentHash>`
- Verifica: i tre comandi operano correttamente sulla cartella `data/projects/<id>/snapshots/`.

### G4. AI smoke tests

- File: `packages/ai-bridge/src/cli/blueprint.ts`, `packages/ai-bridge/src/cli/plan.ts`.
- `pnpm ai:blueprint "crypt below cathedral"` — chiama `generateNarrativeBlueprintWithAi` con `createProviderFromEnv` e stampa il blueprint.
- `pnpm ai:plan "..."` — chiama `generateMapPlanWithAi` con `assetGroups`/`references` caricati dai file locali.
- Utile per verificare che la chiave funzioni senza Next.

### G5. `pnpm exports:session-pack <projectId>`

- File: `packages/exporters/src/cli/session-pack.ts`.
- Args: `--scale 2`, `--include-initiative`, `--description "..."`, `--output <path>`.
- Riusa `exportSessionPack` + scrittura su disco.
- Verifica: produce uno zip identico (a meno del timestamp manifest) a quello generato dalla UI.

### G6. Campaigns CLI

- File: `apps/web/src/lib/cli/campaigns.ts`.
- `pnpm campaigns:list` — lista campagne locali con map count / session count.
- `pnpm campaigns:create --name "Whispering Woods"` — crea cartella + `campaign.json`.
- Verifica: campagne create da CLI compaiono in `/campaigns`.

---

## FASE H — Worker offload (settimana 3-5)

Obiettivo: spostare le operazioni lunghe nel worker Python con progress reportabile.

### H1. Job `assets/import-pack`

- File: [apps/worker/src/dm_instamap_worker/jobs.py](apps/worker/src/dm_instamap_worker/jobs.py), nuovo handler.
- Invoca `pnpm assets:import-pack` (post-G1) via subprocess.
- Espone progress (file scanned / total).
- API web: `POST /api/jobs` con `type: "assets/import-pack"`.

### H2. Job `assets/generate`

- Per Replicate: il job può polling-are direttamente il prediction id, evitando di tenere aperta la connessione Next.
- Per Automatic1111: stessa logica, ma il job rappresenta una singola call.
- Risultato: percorso del file appena salvato in library.

### H3. Job `ai/plan` con retry

- Il job consuma un payload `BridgePromptInput`, chiama `generateMapPlanWithAi` con `maxRetries` dal client.
- Espone i rawResponses per debug.
- Necessario perché `generateMapPlanWithAi` può fare 2-3 round-trip da 30s.

### H4. Job `exports/session-pack`

- Il rendering a scala 4x può richiedere 10-30s; offload nel worker libera la UI.
- Il client polling-a `/jobs/{id}` e scarica `outputPath` al completamento.

### H5. Progress in UI

- File: [apps/web/src/components/projects/project-export-panel.tsx](apps/web/src/components/projects/project-export-panel.tsx), [apps/web/src/components/assets/asset-generator-form.tsx](apps/web/src/components/assets/asset-generator-form.tsx), [apps/web/src/components/ai-bridge/ai-auto-workspace.tsx](apps/web/src/components/ai-bridge/ai-auto-workspace.tsx), [apps/web/src/components/assets/pack-importer-form.tsx](apps/web/src/components/assets/pack-importer-form.tsx).
- Hook condiviso `useJob(jobId)` che fa polling su `/api/jobs/{id}` e ritorna `{ status, progress, message, result }`.
- Tutte le form lunghe diventano "fire and forget" con barra di progresso.

---

## FASE I — Editor canvas integration (settimana 5-7)

Obiettivo: portare le feature di prep dentro l'editor canvas, non solo nella project page.

### I1. Snapshot button + hotkey

- File: [apps/web/src/components/editor/map-editor.tsx](apps/web/src/components/editor/map-editor.tsx).
- Pulsante toolbar "Snapshot" + hotkey `Ctrl+Shift+S`.
- Chiama `POST /api/projects/[id]/snapshots` con label auto (`autosave-<timestamp>` o input inline).
- Indicatore visivo "Snapshot taken" temporaneo.

### I2. Quick action "Export Session Pack"

- Pulsante toolbar nell'editor con default `scale=1`, `gm` mode, `includeInitiative=true`.
- Download diretto senza navigare alla project page.

### I3. AI inline panel

- Toggle "AI assist" nell'editor che apre un drawer laterale con:
  - Input rapido per chiamare `generateMapPlanWithAi` sul contesto corrente.
  - Suggestion box "Suggest assets for selected room" che usa `suggestAssetsForRoomWithAi`.
  - Pulsante "Describe this map" che chiama `describeMapWithAi` per produrre testo narrativo da incollare nei plan notes.

### I4. Generated asset → immediately placeable

- Dopo `assets:generate`, l'asset compare in una corsia "Recently Generated" della asset palette dell'editor.
- Drag-and-drop diretto sulla mappa senza dover ricaricare la pagina.
- Dipende da F3 (rescan parziale).

---

## FASE J — Documentazione (settimana 7-8)

Obiettivo: chiudere il gap tra "feature implementata" e "feature trovabile/usabile in docs".

### J1. Aggiornare `docs/GENERATOR.md`

- Aggiungere sezione "Algorithms (C1)" con esempio per ogni algoritmo (cave/village/multi-floor/outdoor).
- Aggiungere sezione "Blueprint extensions (C2)" con structure/scale/mood/water/vegetation/ruin.
- Snippet di codice per `createNarrativeBlueprint` + `generateMapFromBlueprint`.

### J2. Aggiornare `docs/FOUNDRY_EXPORT.md`

- Documentare `includeJournals: boolean`.
- Schema dei journal entries prodotti (rooms / GM notes / plan notes).
- Sezione "Manual verification" per import in Foundry e attesa visuale.

### J3. Aggiornare `docs/WORKER.md`

- Sostituire la nota "placeholder" con la realtà (SQLite + CLI subprocess + cancellation).
- Documentare i job type post-H1/H2/H3/H4.

### J4. Nuovi docs

- `docs/AI_BRIDGE.md` — env var (`AI_PROVIDER`, `AI_API_KEY`, ...), API endpoints (`/api/ai/*`), schema delle risposte, retry policy, esempio CLI (G4).
- `docs/IMAGE_GENERATION.md` — provider supportati, env var, schema `GeneratedAssetMetadata`, integrazione con il manifest.
- `docs/SNAPSHOTS.md` — content-hash, storage layout, restore behavior, diff fields.
- `docs/CAMPAIGNS.md` — schema, storage layout, link tra mappe e sessioni.
- `docs/PACK_IMPORTER.md` — preset disponibili, regole regex per preset, integrazione con scanner.

---

## FASE K — Test web (settimana 8-9)

Obiettivo: portare la copertura web allo stesso livello dei package.

### K1. Test componenti React

- File: `apps/web/src/components/**/*.test.tsx` (vitest + testing-library).
- Componenti da coprire:
  - `ProjectSnapshotsPanel` (mock di fetch GET/POST)
  - `PackImporterForm`
  - `AiAutoWorkspace` (mock di /api/ai/status + plan)
  - `AssetGeneratorForm`
  - `CampaignEditor` + `NewCampaignForm`
  - `DungeonGeneratorPreview` per i nuovi mode

### K2. Test route API

- File: `apps/web/src/app/api/**/route.test.ts`.
- Coprire `/api/ai/{status,plan,blueprint}`, `/api/assets/{import-pack,generate}`, `/api/campaigns/*`, `/api/projects/[id]/snapshots/*`.
- Mock del filesystem e dei provider via `vi.spyOn`.

---

## FASE L — Polish (continuativo)

Lavoro a bassa priorità, da affrontare quando l'uso reale mostra attrito.

### L1. Snapshot diff-based storage

- Oggi i snapshot duplicano l'intero `MapDocument`. Migrare a "snapshot zero" + diff JSON Patch (`fast-json-patch`).
- Vincolo: restore deve restare deterministico e veloce.

### L2. Outdoor con perlin noise + erosione

- File: [packages/generator/src/algorithms.ts](packages/generator/src/algorithms.ts), funzione `generateOutdoorMap`.
- Sostituire il random walk del fiume con perlin noise (`simplex-noise`) + erosione semplice (ampliamento per livello dovuto al noise vicino).
- Verifica: i fiumi seguono linee curve naturali invece di trembolio rettilineo.

### L3. AI streaming responses

- File: [packages/ai-bridge/src/providers.ts](packages/ai-bridge/src/providers.ts), aggiungere `stream(request)` opzionale.
- Per Anthropic: SSE su `/v1/messages` con `stream: true`.
- Per OpenAI: SSE su `/v1/chat/completions`.
- UI: progressivo display nella `AiAutoWorkspace`.

### L4. Orchestrazione AI completa

- Esporre nella UI `suggestAssetsForRoomWithAi` e `describeMapWithAi` (anche fuori dall'editor, dentro la project page o la asset palette).
- Sblocca: "Suggest assets for the Library room" diretto dalla room list, e "Generate session prep prose" dalla project page.

### L5. Multi-floor "true" UX

- Se F2 ha scelto opzione A (N progetti collegati), aggiungere una pagina `/projects/[id]/floors` che mostra i piani collegati come tab + minimap.
- Permette navigazione fluida durante una sessione.

---

## Stima

- FASE F: 1-2 settimane (5 task piccoli)
- FASE G: 1 settimana (6 CLI mechanici)
- FASE H: 2 settimane (4 job + hook UI)
- FASE I: 1-2 settimane (4 integrazioni editor)
- FASE J: 4-5 giorni (scrittura docs)
- FASE K: 1 settimana (test mechanici)
- FASE L: continuativo, 1-2 task al mese

Totale ragionevole: **6-10 settimane** a ritmo serale/weekend, con FASE L che resta aperta.

## Priorità suggerita

Se devi scegliere, parti da:

1. **F1 + F2** — i due bug più visibili (AI auto senza contesto, multi-floor che salva solo il piano 1).
2. **I1 + I2** — snapshot inline e session pack inline nell'editor, alto rapporto valore/effort.
3. **G1 + G2 + G4** — sblocca la pipeline "import → generate → smoke test AI" da terminale, utile per validare i provider reali.
4. **J1 + J2** — documentare le feature che già funzionano è meno divertente ma evita di re-derivarle ad ogni sessione di lavoro.

Il resto può aspettare di sapere quali attriti emergono dall'uso reale.

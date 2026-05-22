# DM-Instamap - Legacy roadmap

Questo documento archivia le roadmap precedenti consolidate prima della roadmap verso 9.5.

---

## ROADMAP.md precedente

# DM-Instamap - Analisi critica e nuova roadmap

## Stato avanzamento

Aggiornamento Fase 0:

- Fase 0 completata: `.gitignore` ora esclude `data/indexes/` e
  `data/previews/`;
- aggiunto `pnpm repo:audit` per bloccare dati locali generati e binari
  inattesi tracciati in Git;
- aggiunta la guida `docs/LOCAL_DATA.md`;
- gli artefatti gia tracciati sotto `data/` sono stati rimossi dall'indice Git
  senza cancellare i file locali;
- verifiche passate: `pnpm repo:audit`, `pnpm lint`, `pnpm test`,
  `pnpm build`, `pnpm --filter @dm-instamap/worker test`.

Avanzamento Fase 1:

- aggiunto `apps/web/src/lib/local-paths.ts` come validatore path web condiviso;
- applicato a import pack diretto, import pack via worker e ricerca asset per
  immagine;
- aggiunti test per path relativo valido, traversal, assoluto fuori workspace,
  path broad/system e path inesistente;
- l'editor di progetto ora limita i gruppi asset passati al client per evitare
  hydration lenta con librerie locali molto grandi; la ricerca asset resta
  disponibile tramite API;
- restano da allineare eventuali future route con input file-system e da
  consolidare la policy in un modulo condiviso tra web e worker.

Avanzamento Fase 2:

- Playwright ora copre un flusso editor reale: creazione progetto via API,
  apertura editor, attesa idratazione client, modifica canvas, salvataggio,
  verifica del documento salvato e export PNG;
- Playwright copre snapshot create/diff/restore usando un progetto temporaneo e
  verificando che il documento torni allo stato precedente;
- Playwright copre export API per WEBP, dd2vtt e Session Pack, inclusi content
  type, formato dd2vtt e ZIP valido;
- aggiunto un marker `data-hydrated` all'editor per evitare click su markup SSR
  prima che React abbia agganciato gli handler;
- restano da coprire undo/redo esplicito, copy/paste asset, Foundry e import
  pack fixture.

Avanzamento Fase 3:

- `apps/web/src/components/editor/map-editor.tsx` e passato da 2391 a 38 righe e
  ora e solo un orchestratore che compone i sottocomponenti;
- estratto il rendering canvas puro in `apps/web/src/lib/map-canvas-renderer.ts`
  (testabile senza DOM tramite context 2D mock);
- estratte le funzioni di supporto pure in `apps/web/src/lib/map-editor-view.ts`
  (mappatura livelli, label IT, clamp/parse, bounds marquee, drag payload,
  storage asset generati);
- estratti gli hook `useEditorHistory`, `useCanvasViewport` e l'hook master
  `useMapEditorState` sotto `apps/web/src/hooks/`;
- estratti i pannelli React `EditorAssetSidebar`, `EditorCanvasToolbar`,
  `MapCanvas`, `EditorAiPanel`, `EditorInspector`;
- nessuna feature editor rimossa: strumenti, undo/redo, selezione, copy/paste,
  layer, luci, note, iniziativa, arredamento, export e JSON restano invariati;
- aggiunti test unitari per `map-editor-view` e `map-canvas-renderer`
  (rendering base + helper puri);
- verifiche passate: `pnpm lint`, `pnpm test` (108 test), `pnpm build`,
  `pnpm test:e2e` (8/8, incluso save canvas + export PNG dell'editor reale);
- restano da estrarre, se servira, sotto-pannelli piu granulari dall'inspector
  (522 righe) e da valutare uno split ulteriore dell'hook master.

Avanzamento Fase 4:

- aggiunta cronologia export per progetto: `apps/web/src/lib/project-export-history.ts`
  registra ogni export in `data/projects/<id>/exports/history.json` (best-effort,
  non blocca il download); la route `POST /api/projects/[projectId]/export` la
  scrive dopo ogni export riuscito;
- aggiunta thumbnail progetto come mini-mappa SVG deterministica
  (`apps/web/src/lib/project-thumbnail.ts`, run-length per riga, nessun testo
  utente inline) con il componente server `ProjectThumbnail`;
- aggiunta pagina "Pronto per la sessione"
  (`/projects/[projectId]/session-ready`) con checklist requisiti/consigliati
  (`apps/web/src/lib/project-readiness.ts`) ed export consigliati;
- aggiunto `ProjectQuickExport`: Session Pack e PNG giocatori esportabili in un
  clic dalla pagina progetto (rispetta il limite dei 3 clic);
- la pagina progetto mostra ora preview, stato di preparazione, export recenti e
  azioni principali; la lista progetti mostra thumbnail e stato per card;
- aggiunto stato libreria asset in home (`apps/web/src/lib/asset-library-status.ts`):
  numero asset, ultima scansione, duplicati ed elementi da rivedere;
- migliorati i messaggi vuoti (home, lista progetti) con call-to-action;
- progress feedback job lunghi gia coperto da `JobProgressBar` + `useJob`
  (polling worker), riutilizzato dove servono job;
- aggiunti test unitari per readiness, export history, asset library status e
  thumbnail; aggiunto E2E `home -> progetto -> session ready -> export` che
  verifica anche la registrazione della cronologia;
- verifiche passate: `pnpm lint`, `pnpm test` (122 test), `pnpm build`,
  `pnpm test:e2e` (9/9).

Avanzamento Fase 5:

- aggiunto harness benchmark in `packages/generator/src/benchmark.ts` con 7
  scenari deterministici (cripta, dungeon con boss, rovina, caverna, villaggio,
  accampamento, taverna) a input/seed fissi;
- introdotte 6 metriche DM (allineamento tema, varieta stanze, densita elementi,
  routing, leggibilita, affordance tattica) che riusano il quality scorer del
  core ed estendono con metriche di struttura;
- ogni scenario ha soglie codificate: il test `tests/benchmark.test.ts` fallisce
  se il punteggio scende sotto soglia o si discosta dalle sintesi salvate in
  `tests/fixtures/benchmark/` (snapshot seed-based);
- aggiunte note GM deterministiche per ruolo stanza
  (`packages/generator/src/gm-notes.ts`): `inferRoomRole`, `generateRoomRoleNotes`,
  `withRoomRoleNotes`, idempotenti e senza randomness;
- aggiunto un primo aggancio Reference Style DNA
  (`packages/generator/src/style-dna.ts`): palette tags e densita influenzano i
  tag stanza e la densita di arredamento; influenza sul layout ancora parziale;
- aggiunto report CLI `pnpm generator:benchmark` (stampa tabella, `--write`
  rigenera le sintesi, esce non-zero sotto soglia);
- run del 2026-05-22: 7/7 scenari sopra soglia, 5 "strong" e 2 "usable";
  report manuale in `docs/manual-test-reports/generator-benchmark-2026-05-22.md`;
- verifiche passate: `pnpm lint`, `pnpm test` (generator 46 test; workspace
  intero verde, incluso worker), `pnpm build`, `pnpm generator:benchmark` (7/7).

Avanzamento Fase 6:

- corretto un disallineamento di fidelity dd2vtt: l'immagine incorporata ora e
  renderizzata a `grid.pixelsPerCell * scale` px/cella e `pixels_per_grid` /
  `image_size` derivano dai pixel reali, garantendo
  `image_size = map_size * pixels_per_grid` (prima l'immagine era a 28 px/cella
  ma il file dichiarava 70: griglia disallineata all'import);
- aggiunta opzione `cellPixels` al raster exporter per render a risoluzione
  griglia esatta;
- estratto `buildFoundryModuleData` (dati strutturali Foundry senza render) e
  aggiunta opzione `foundryVersion` (`v12` default = 11/12, `v13` = 12/13);
- aggiunto `buildVttExportManifest`: confronto strutturale image-free tra dd2vtt
  e Foundry con controlli di coerenza (porte, luci, muri, allineamento griglia);
- aggiunta fixture realistica versionata
  (`packages/exporters/tests/fixtures/realistic-map.ts`) e snapshot manifest;
- nuovi test: allineamento griglia/immagine (immagine decodificata con sharp),
  scala, round-trip dd2vtt, compatibilita Foundry 12/13, dimensioni scena,
  coordinate muri/porte/luci/note;
- documentazione: `docs/VTT_EXPORT.md` (incluso Foundry 12 vs 13) e report
  manuale `docs/manual-test-reports/vtt-export-2026-05-22.md`;
- verifiche passate: `pnpm lint`, `pnpm test` (exporters 43 test; workspace
  intero verde, incluso worker), `pnpm build`, e l'E2E export dd2vtt del web.

Avanzamento Fase 7:

- aggiunto log sintetico persistente sui job worker (`log.lastCommand`,
  `durationMs`, `stdoutTail`, `stderrTail`, `interrupted`);
- health worker arricchito con versione, repo root, db path, conteggi job,
  job running e limite concorrenza;
- aggiunto limite concorrenza configurabile
  `DM_INSTAMAP_WORKER_CONCURRENCY`;
- aggiunto cleanup automatico dei job terminali vecchi o in eccesso
  (`DM_INSTAMAP_JOBS_RETENTION_DAYS`,
  `DM_INSTAMAP_JOBS_MAX_TERMINAL`);
- i job running interrotti da restart vengono marcati failed con
  `log.interrupted`;
- aggiunto proxy web `GET /api/jobs` e visualizzazione stderr sintetico in
  `JobProgressBar`;
- documentata recovery dopo crash in `docs/WORKER.md`.

Avanzamento Fase 8:

- aggiunti `MapDocumentV2Schema` e `upgradeMapDocumentToV2` come percorso
  esplicito di preparazione v2 senza forzare ancora il salvataggio dei
  progetti a v2;
- aggiunta metadata v2 per export history, thumbnail e schema changelog;
- aggiunto validator `validateMapDocumentAssetReferences` per asset mancanti
  in document asset placements e plan asset placements;
- aggiunta classificazione usage asset: `tile-texture`, `semantic-object`,
  `asset-placement`;
- aggiunta fixture `document-v2-basic.json` e test v1 -> v2.

Avanzamento Fase 9:

- aggiunto `pnpm run doctor` (`scripts/doctor.ts`) con controlli Node, pnpm,
  Python, worker requirements, Sharp, template env e porte 3000/8000;
- aggiunta `.env.local.example` con variabili locali worker/AI;
- aggiunta guida `docs/WINDOWS_SETUP.md`;
- aggiunto report manuale
  `docs/manual-test-reports/local-packaging-2026-05-22.md`;
- aggiunti test per parsing versioni e classificazione check doctor.

Avanzamento Fase 10:

- aggiunto provider AI mock locale (`AI_PROVIDER=mock`) senza chiavi e senza
  chiamate esterne;
- `getBridgeStatus` espone `localOnly` e distingue `manual-only`, `api` e
  `mock`;
- `createProviderFromEnv` crea il provider mock per test e demo offline;
- documentato il mock provider in `docs/AI_BRIDGE.md`.

## Nuova roadmap

Questa roadmap parte dalla baseline positiva documentata in:

```txt
docs/manual-test-reports/baseline-2026-05-21.md
```

Ogni fase deve restare piccola e chiudersi con documentazione e test.

Comandi minimi di chiusura per ogni fase tecnica:

```bash
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

Se la fase tocca flussi UI:

```bash
pnpm test:e2e
```

## Fase 0 - Pulizia repository e dati locali

Priorita: P0

Obiettivo: separare in modo definitivo codice versionabile e dati locali.

Task:

- aggiungere a `.gitignore` anche `data/indexes/` e `data/previews/`;
- rimuovere dal tracking Git i file generati sotto `data/` con `git rm --cached`;
- mantenere solo fixture piccole e intenzionali sotto `packages/**/tests/fixtures`;
- creare `docs/LOCAL_DATA.md` con spiegazione di cosa vive in `data/`;
- aggiungere uno script di audit che fallisce se asset binari grandi entrano in
  Git;
- documentare come rigenerare indici e preview.

Definition of Done:

- `git ls-files data` non mostra preview o manifest locali generati;
- il repo resta sotto una dimensione ragionevole per codice sorgente;
- un nuovo clone puo partire da zero con `pnpm install` e scanner locale.

Test:

- `pnpm lint`
- `pnpm test`
- verifica manuale `git ls-files data`

## Fase 1 - Validazione path unica per web e worker

Priorita: P0

Obiettivo: avere una policy unica per ogni path locale ricevuto da UI, API e
worker.

Task:

- estrarre un modulo condiviso di validazione path lato Node;
- applicarlo a import pack, search-by-image, preview route, export output e
  ogni route che legge/scrive su disco;
- allineare la semantica con il worker: no home root, no drive root, no Windows,
  no Program Files, no path fuori workspace salvo directory esplicitamente
  consentite;
- aggiungere messaggi errore chiari in UI;
- documentare quando usare path assoluti e quando usare path relativi.

Definition of Done:

- ogni route web con input path ha test su path valido, path traversal, drive
  root e directory di sistema;
- worker e web rifiutano le stesse classi di path pericolosi;
- `DM_INSTAMAP_ALLOW_REMOTE=true` non cambia la validazione file-system.

Test:

- test unitari route/lib;
- test worker sicurezza;
- `pnpm lint && pnpm test && pnpm --filter @dm-instamap/worker test`.

## Fase 2 - Playwright sui flussi reali

Priorita: P0

Obiettivo: trasformare Playwright da smoke test a rete di sicurezza sulle
azioni da sessione reale.

Task:

- creare fixture temporanee isolate per progetto, asset e export;
- aggiungere E2E: crea progetto dal wizard, apri editor, dipingi celle, salva,
  ricarica e verifica persistenza;
- aggiungere E2E undo/redo/copy/paste asset;
- aggiungere E2E snapshot create/restore/diff;
- aggiungere E2E export PNG, WEBP, dd2vtt e Session Pack;
- aggiungere E2E import pack minimo con asset fixture;
- salvare screenshot e artifact solo in cartelle ignorate.

Definition of Done:

- `pnpm test:e2e` copre almeno editor save/undo/export;
- i test non dipendono da asset personali;
- i test puliscono i dati temporanei o usano una root isolata.

Test:

- `pnpm test:e2e`
- `pnpm test`

## Fase 3 - Refactor editor in moduli

Priorita: P1

Obiettivo: ridurre il rischio di regressione nell'editor.

Task:

- estrarre `useMapEditorState`;
- estrarre `useEditorHistory`;
- estrarre `useCanvasViewport`;
- estrarre `MapCanvas`;
- estrarre `EditorToolbar`, `LayerPanel`, `AssetPalette`, `ExportPanel`,
  `AiAssistPanel`, `JsonPanel`;
- spostare il rendering canvas in un modulo puro testabile;
- aggiungere test per hit-testing, viewport, comandi e rendering base.

Definition of Done:

- `map-editor.tsx` scende sotto 700 righe;
- rendering e comandi principali hanno test dedicati;
- nessuna feature editor viene rimossa.

Test:

- unit test `apps/web/src/lib/map-editor*`;
- Playwright editor flow.

## Fase 4 - Migliorare UX operativa

Priorita: P1

Obiettivo: far sentire il tool meno "laboratorio" e piu "strumento da DM".

Task:

- aggiungere thumbnail progetto;
- aggiungere cronologia export per progetto;
- aggiungere stato asset library: numero asset, ultimo scan, errori, duplicati;
- creare una pagina "Session Ready" con export consigliati e checklist;
- migliorare messaggi vuoti: nessun asset, nessun riferimento, nessun progetto;
- aggiungere progress feedback coerente per job lunghi.

Definition of Done:

- dalla home si capisce subito cosa fare;
- ogni progetto mostra preview, stato, ultimi export e azioni principali;
- una mappa pronta e esportabile in massimo 3 click dalla pagina progetto.

Test:

- Playwright su home -> progetto -> session ready -> export;
- unit test sulle funzioni di summary progetto/export.

## Fase 5 - Qualita generativa misurabile

Priorita: P1

Obiettivo: passare da "genera una mappa" a "genera una mappa giocabile".

Task:

- creare un set di scenari benchmark: cripta, taverna, caverna, villaggio,
  accampamento, rovina, dungeon boss;
- salvare fixture JSON seed-based per ogni scenario;
- introdurre metriche su tema, densita asset, varieta stanze, routing,
  leggibilita e tactical affordance;
- aggiungere report `generator:benchmark`;
- usare Reference Style DNA per influenzare palette, densita e disposizione;
- aggiungere note GM generate deterministicamente per room role.

Definition of Done:

- ogni algoritmo produce output deterministico e confrontabile;
- i benchmark falliscono se la qualita scende sotto soglie definite;
- almeno 5 mappe benchmark sono considerate usabili dopo revisione manuale.

Test:

- unit test generator;
- snapshot test JSON;
- report manuale in `docs/manual-test-reports/`.

## Fase 6 - Fidelity export VTT

Priorita: P1

Obiettivo: ridurre correzioni manuali dopo import in VTT.

Task:

- creare fixture dd2vtt e Foundry piu realistiche;
- verificare porte, muri, luci, note, journal e scene dimensions;
- aggiungere export comparison su manifest JSON;
- aggiungere `includeGrid`, scala e pixel-per-cell nei casi limite;
- documentare compatibilita Foundry 12/13 separatamente.

Definition of Done:

- import Foundry e dd2vtt verificato con fixture versionate piccole;
- test automatici coprono coordinate, mura, porte e luci;
- manual report aggiornato per ogni cambio di formato.

Test:

- `pnpm --filter @dm-instamap/exporters test`
- E2E manuale VTT su release candidate.

## Fase 7 - Worker robusto per job lunghi

Priorita: P2

Obiettivo: rendere il worker affidabile su pack grandi e sessioni lunghe.

Task:

- aggiungere log per job con ultimo comando, stdout/stderr sintetici e durata;
- aggiungere cleanup job vecchi;
- aggiungere limite concorrenza configurabile;
- aggiungere retry solo per task idempotenti;
- esporre stato health piu ricco: versione, repo root, db path, job running;
- documentare recovery dopo crash.

Definition of Done:

- un job interrotto viene marcato correttamente;
- la UI mostra errore utile e log breve;
- database job non cresce senza controllo.

Test:

- unit test worker;
- test cancellazione e restart;
- test route web `/api/jobs`.

## Fase 8 - Data model v2

Priorita: P2

Obiettivo: preparare mappe, progetti e asset a evoluzioni future senza rotture.

Task:

- definire `MapDocument` v2 solo quando serve davvero;
- introdurre changelog schema;
- aggiungere validator per asset references mancanti;
- distinguere meglio asset placement, tile texture e semantic object;
- aggiungere metadata export history e thumbnail nel progetto;
- mantenere import v1 -> v2 automatico.

Definition of Done:

- ogni documento v1 continua ad aprirsi;
- ogni nuova proprieta ha default e migrazione;
- i test fixture coprono vecchi documenti.

Test:

- `packages/core/tests/migrations.test.ts`;
- fixture v1/v2;
- read/write progetto.

## Fase 9 - Packaging locale

Priorita: P2

Obiettivo: rendere semplice avviare DM-Instamap su una macchina nuova.

Task:

- aggiungere script `pnpm doctor`;
- controllare Node, pnpm, Python, worker deps, Sharp, porte occupate;
- aggiungere guida Windows passo-passo;
- preparare `.env.local.example`;
- valutare launcher locale semplice senza introdurre servizi esterni.

Definition of Done:

- un utente puo clonare, installare, avviare e importare asset seguendo una
  guida unica;
- `pnpm doctor` identifica i problemi piu comuni.

Test:

- test script doctor con env simulato;
- manual setup report.

## Fase 10 - AI opzionale, ma realmente opzionale

Priorita: P3

Obiettivo: mantenere AI Bridge utile senza rendere il progetto dipendente da
provider esterni.

Task:

- separare meglio manual bridge, provider HTTP e provider locale;
- aggiungere provider mock per test e demo;
- documentare chiaramente quali funzioni sono local-only e quali no;
- evitare chiavi reali nei test;
- aggiungere fallback UX quando provider non e configurato.

Definition of Done:

- tutte le feature core funzionano senza AI;
- la UI segnala lo stato AI senza bloccare workflow;
- test automatici non chiamano provider reali.

Test:

- unit test ai-bridge;
- Playwright con provider non configurato;
- Playwright con provider mock.

## Ordine consigliato

1. Fase 0 - pulizia repository.
2. Fase 1 - validazione path unica.
3. Fase 2 - Playwright reale.
4. Fase 3 - refactor editor.
5. Fase 4 - UX operativa.
6. Fase 5 - qualita generativa.
7. Fase 6 - export VTT.
8. Fasi 7-10 in parallelo quando il nucleo e stabile.

## Metriche di maturita

Il progetto puo essere considerato "8/10" quando:

- `data/` non contiene file generati tracciati;
- `pnpm test:e2e` copre editor save/undo/export;
- `map-editor.tsx` e stato diviso in moduli;
- ogni input path web/worker usa la stessa policy;
- almeno 5 benchmark generator sono stabili e documentati;
- una nuova macchina puo avviare il progetto seguendo un'unica guida.

Il progetto puo essere considerato "9/10" quando:

- export Foundry/dd2vtt hanno fixture realistiche e report manuale periodico;
- la UI progetto ha thumbnail, export history e session checklist;
- il worker gestisce bene code lunghe, cancellazioni, restart e log;
- i dati locali hanno backup/restore documentato;
- il generatore produce mappe giocabili con interventi minimi.

## Prossima azione raccomandata

Partire dalla Fase 0. Prima di aggiungere nuove feature, rimuovere dal tracking
Git tutti gli artefatti generati sotto `data/` e bloccare la ricomparsa di file
binari locali nel repository.


---

## ROADMAP_OLD.md precedente

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


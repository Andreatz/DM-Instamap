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

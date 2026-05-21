# DM-Instamap - Analisi critica e nuova roadmap

Data revisione: 2026-05-21

## Giudizio sintetico

DM-Instamap e gia oltre lo stadio di MVP tecnico: ha un monorepo coerente,
moduli separati, test automatici, test E2E manuali passati, editor, worker,
scanner asset, generatore, esportatori e documentazione ampia.

Il progetto pero non e ancora "maturo" come prodotto mantenibile nel tempo. I
punti piu fragili sono: igiene del repository, copertura E2E ancora leggera,
editor troppo monolitico, sicurezza dei path non uniforme tra web e worker,
qualita generativa ancora euristica e UX operativa ancora densa.

## Punteggio

Punteggio complessivo: **7.2 / 10**

## Stato avanzamento

Aggiornamento 2026-05-22:

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

| Area | Voto | Motivo |
|---|---:|---|
| Visione prodotto | 8.0 | Direzione chiara: local-first, mappe editabili, asset reali, export VTT. |
| Architettura | 7.5 | Monorepo ben diviso; boundary browser/server migliorato; alcuni moduli sono ancora troppo grandi. |
| Core data model | 7.5 | Schemi Zod e migrazioni presenti; serve una strategia piu esplicita per versioni future. |
| Asset pipeline | 7.0 | Scanner, classificazione, gruppi, audit e preview funzionano; serve migliore gestione di dataset grandi. |
| Generator | 6.7 | Molte modalita, seed deterministici e scoring; qualita ancora piu tecnica che artistica/tattica. |
| Editor | 6.5 | Molte funzioni utili; componente principale troppo grande e difficile da estendere in sicurezza. |
| Export | 7.5 | PNG, WEBP, dd2vtt, Foundry, dmimap e Session Pack coperti; serve regression suite con fixture VTT reali. |
| Worker | 7.0 | FastAPI locale con SQLite e job cancellabili; manca robustezza operativa su code, log e cleanup. |
| Test | 7.0 | Buona base unitaria e manual E2E positivo; Playwright copre solo smoke flow. |
| Sicurezza locale | 6.8 | Host guard presente; validazione path buona nel worker ma non uniforme nelle route web. |
| Igiene repository | 4.0 | `data/` risulta tracciata con oltre 50.000 file e circa 321 MB di preview/indici. |
| Documentazione | 8.0 | Molto ampia; va resa piu decisionale e meno storica. |

## Cosa funziona bene

- La visione local-first e rispettata: le funzioni principali lavorano su file
  locali e non richiedono API esterne.
- Il workspace e leggibile: `apps/web`, `apps/worker`, `packages/core`,
  `packages/assets`, `packages/generator`, `packages/exporters`,
  `packages/ai-bridge`.
- Gli schemi condivisi in `packages/core` sono una buona base per mantenere le
  mappe editabili.
- Gli export principali sono gia presenti e testati a livello automatico e
  manuale.
- La baseline manuale del 2026-05-21 indica E2E-01..E2E-12 tutti PASS.
- Il worker locale evita che alcuni task pesanti blocchino necessariamente una
  request Next.js.
- La documentazione e ricca e rende il progetto recuperabile anche dopo pause
  lunghe.

## Critica principale

### 1. Repository troppo pesante

`data/` contiene asset derivati e preview tracciati in Git. La scansione ha
rilevato circa 50.930 file tracciati sotto `data/`, quasi tutti immagini
generate, per circa 321 MB.

Questo e il problema piu urgente per la salute del progetto. Non e un bug
funzionale immediato, ma peggiora checkout, diff, backup, review e rischio di
committare materiale locale o coperto da licenze asset.

### 2. Playwright non prova ancora i veri flussi critici

I test Playwright attuali sono smoke test: home, generator, wizard, campagne e
progetti. Sono utili, ma non provano ancora i flussi che determinano se il tool
regge una sessione reale:

- creazione progetto completa;
- apertura editor;
- modifica canvas;
- undo/redo;
- salvataggio e riapertura;
- export PNG/WEBP/dd2vtt/Foundry;
- import pack via worker;
- snapshot restore.

### 3. Editor molto potente ma monolitico

`apps/web/src/components/editor/map-editor.tsx` supera le 2.100 righe. Dentro
convivono stato React, canvas rendering, input handling, export, AI assist,
snapshot, localStorage, palette e UI.

La feature density e buona, ma ogni nuova modifica rischia regressioni. Il
prossimo salto di qualita richiede separare engine, rendering, comandi, toolbar
e pannelli.

### 4. Sicurezza path non uniforme

Il worker ha `validate_local_path`, blocca path larghi o di sistema e controlla
i path relativi. Alcune route web, invece, risolvono path assoluti o relativi
in modo piu permissivo. In un tool locale questo e accettabile solo finche non
si espone la LAN, ma il progetto prevede `DM_INSTAMAP_ALLOW_REMOTE=true`.

La regola dovrebbe essere unica: ogni input file-system passa dallo stesso
validatore.

### 5. Qualita generativa ancora da misurare con scenari reali

Il generatore ha modalita interessanti e scoring, ma il punteggio e ancora
basato su euristiche tecniche: connettivita, dead-end, coperture, POI. Mancano
benchmark "da DM":

- mappa leggibile al tavolo;
- spazi tattici vari;
- stanze con scopo;
- asset coerenti con tema;
- export VTT usabile senza correzioni;
- tempo medio per arrivare a una mappa pronta.

### 6. Documentazione molto ampia ma poco gerarchica

La documentazione copre quasi tutto, ma deve diventare piu operativa:

- una guida "happy path" breve;
- una guida troubleshooting;
- una matrice feature -> test -> documento;
- changelog manuale delle baseline.

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

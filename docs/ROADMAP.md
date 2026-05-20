# DM-Instamap — Roadmap tecnica per Codex

Questo documento contiene una roadmap operativa per sviluppare DM-Instamap in 10 fasi, più le novità prioritarie da integrare nel progetto:

1. Style DNA delle mappe reference.
2. Generatore narrativo + tattico.
4. Batch review intelligente per migliaia di assets.
5. Local visual search.
6. Auto-furnish avanzato.

L’obiettivo è trasformare DM-Instamap da prototipo tecnico a vero tool local-first per generare, modificare, arredare ed esportare mappe D&D usando assets locali, reference maps e un bridge manuale verso ChatGPT senza API obbligatorie.

---

## Principi generali obbligatori per Codex

Prima di modificare il codice, Codex deve rispettare questi principi.

### 1. Local-first

DM-Instamap deve funzionare senza API esterne obbligatorie.

Non introdurre dipendenze da servizi cloud o API a pagamento. Ogni funzione AI deve avere fallback locale/manuale.

Accettabile:

- analisi locale con Node/Python;
- sharp;
- algoritmi euristici;
- embeddings locali semplici;
- eventuale supporto opzionale a modelli locali;
- bridge manuale ChatGPT tramite copia/incolla.

Non accettabile come requisito obbligatorio:

- OpenAI API;
- servizi cloud per embedding;
- database cloud obbligatorio;
- login obbligatorio;
- upload remoto assets.

### 2. Assets binari fuori da Git

Non committare assets pesanti, mappe, immagini di pack o output generati.

Gli output locali devono stare in:

```txt
data/
  indexes/
  previews/
  projects/
  exports/
```

Assicurarsi che `.gitignore` protegga correttamente questi percorsi, lasciando eventualmente solo fixture minuscole per i test.

### 3. Sviluppo incrementale

Non tentare di implementare tutto in un unico commit.

Ogni fase deve produrre una PR o commit verificabile con:

```bash
pnpm lint
pnpm test
pnpm build
```

Quando la fase tocca il worker Python:

```bash
pnpm worker:install
pnpm --filter @dm-instamap/worker lint
pnpm --filter @dm-instamap/worker test
```

### 4. Non rompere gli schemi esistenti

`packages/core` contiene gli schemi principali. Ogni modifica a `MapDocument`, `MapPlan`, `AssetMetadata`, `AssetGroup`, ecc. deve essere retrocompatibile oppure accompagnata da migrazione.

### 5. Ogni nuova feature deve avere test

Minimo:

- unit test per funzioni pure;
- test su fixture piccole;
- test di validazione schema;
- test di edge case;
- test di import/export quando applicabile.

### 6. UI tecnica ma chiara

Per ogni feature web, aggiungere sempre:

- stato empty;
- stato loading se serve;
- stato error;
- feedback dopo salvataggio;
- testo chiaro per l’utente;
- nessuna rotta muta o nascosta senza spiegazione.

---

# Stato attuale da cui partire

Il progetto è un monorepo `pnpm`.

Struttura prevista:

```txt
apps/
  web/
  worker/

packages/
  core/
  assets/
  generator/
  exporters/
  ai-bridge/

docs/
```

Comandi root già previsti:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm dev
pnpm worker:dev
pnpm worker:install
pnpm assets:scan <folder>
pnpm assets:group
pnpm assets:embed
pnpm references:scan <folder>
```

Codex deve mantenere questa struttura.

---

# Fase 1 — Stabilizzazione tecnica del progetto

## Stato

Completata il 2026-05-20.

Implementato:

- GitHub Actions CI per install, worker install, lint, test e build.
- `.env.example` con percorsi locali.
- README aggiornato con setup, comandi, rotte e troubleshooting.
- `.gitignore` aggiornato per proteggere asset pesanti, progetti locali ed export locali.
- Documentazione asset storage aggiornata.

Verificato con:

```bash
pnpm install --frozen-lockfile
pnpm worker:install
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

## Obiettivo

Rendere il repository affidabile, verificabile e pronto allo sviluppo incrementale.

Questa fase non deve aggiungere grandi feature. Deve mettere ordine.

## Prompt da dare a Codex

```txt
Analizza il repository DM-Instamap e implementa la Fase 1: stabilizzazione tecnica.

Obiettivi:
1. Aggiungi una GitHub Actions CI che esegua install, lint, test e build per il monorepo pnpm.
2. Aggiungi test minimi dove mancano, senza riscrivere l’architettura.
3. Migliora README e documentazione di setup.
4. Verifica che data/, previews, indexes, projects ed exports siano ignorati da Git se contengono output generati.
5. Aggiungi .env.example con variabili locali utili.
6. Non introdurre API esterne obbligatorie.
7. Mantieni compatibilità con Node 24+, pnpm 10+ e Python 3.12+.

Alla fine fornisci:
- elenco file modificati;
- comandi da eseguire;
- eventuali limiti rimasti.
```

## Task dettagliati

### 1.1 Creare CI

File da creare:

```txt
.github/workflows/ci.yml
```

Workflow consigliato:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.3

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - run: pnpm install --frozen-lockfile

      - run: pnpm worker:install

      - run: pnpm lint

      - run: pnpm test

      - run: pnpm build
```

Se Node 24 non è disponibile nel runner, usare la versione stabile più vicina ma documentare la scelta.

### 1.2 Migliorare `.gitignore`

Verificare o aggiungere:

```gitignore
node_modules/
.pnpm-store/
.next/
dist/
coverage/
.env
.env.local

data/indexes/
data/previews/
data/projects/
data/exports/

*.log
.DS_Store
```

Valutare se tenere fixture di test sotto:

```txt
fixtures/
packages/*/test/fixtures/
apps/*/tests/fixtures/
```

### 1.3 Aggiungere `.env.example`

File:

```txt
.env.example
```

Contenuto suggerito:

```env
DM_INSTAMAP_WORKSPACE_ROOT=.
DM_INSTAMAP_DATA_DIR=./data
DM_INSTAMAP_ASSETS_DIR=./local-assets
DM_INSTAMAP_REFERENCES_DIR=./local-references
DM_INSTAMAP_WORKER_URL=http://127.0.0.1:8000
```

### 1.4 Migliorare README

Il README deve spiegare:

- cos’è DM-Instamap;
- cosa funziona oggi;
- cosa è ancora MVP;
- requisiti;
- setup;
- comandi;
- scansione assets;
- scansione reference;
- uso AI bridge manuale;
- export;
- struttura cartelle;
- troubleshooting.

### 1.5 Aggiungere test minimi

Aggiungere test per:

```txt
packages/core
packages/assets
packages/generator
packages/exporters
packages/ai-bridge
apps/worker
```

Esempi test minimi:

- `createMapDocument` crea documento valido;
- `classifyAsset` classifica per keyword;
- `generateDungeon` genera stanze, porte e muri;
- `validateBridgeResponse` accetta JSON valido e rifiuta JSON errato;
- `exportMapDocumentDd2Vtt` produce oggetto coerente;
- worker `/health` restituisce status ok.

## Criteri di completamento

La fase è completa se:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm worker:install
pnpm --filter @dm-instamap/worker test
```

passano senza errori.

---

# Fase 2 — Worker Python reale con job progress

## Stato

Completata il 2026-05-20.

Implementato:

- Job store locale in memoria.
- Modello job con id, type, status, progress, message, createdAt, updatedAt, result ed error.
- Endpoint `/jobs`, `/jobs/{job_id}` e `/jobs/{job_id}/cancel`.
- Endpoint placeholder `/jobs/assets/scan`, `/jobs/references/scan` e `/jobs/images/analyze`.
- Test Python con `FastAPI TestClient`.
- Documentazione `docs/WORKER.md`.

Limite noto:

- I job sono in memoria e vengono persi al riavvio del worker.

## Obiettivo

Trasformare `apps/worker` da semplice `/health` a motore locale per task pesanti.

Il worker deve gestire job asincroni locali, progressi e risultati, senza dipendere da servizi esterni.

## Prompt da dare a Codex

```txt
Implementa la Fase 2 del worker Python per DM-Instamap.

Obiettivi:
1. Mantieni /health.
2. Aggiungi un sistema job locale in memoria per task lunghi.
3. Aggiungi endpoint per creare, leggere e cancellare job.
4. Prepara endpoint placeholder ma funzionanti per asset scan, reference scan e image analysis.
5. Ogni job deve avere id, type, status, progress, createdAt, updatedAt, result, error.
6. Aggiungi test Python.
7. Non collegare ancora forzatamente il worker alla UI Next.js, ma documenta come usarlo.

Non usare servizi esterni.
```

## API da implementare

```txt
GET  /health
GET  /jobs
GET  /jobs/{job_id}
POST /jobs/{job_id}/cancel

POST /jobs/assets/scan
POST /jobs/references/scan
POST /jobs/images/analyze
```

## Modello Job

Creare un modello simile:

```py
class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
```

```json
{
  "id": "job_...",
  "type": "assets.scan",
  "status": "running",
  "progress": 42,
  "message": "Scanning thumbnails...",
  "createdAt": "...",
  "updatedAt": "...",
  "result": null,
  "error": null
}
```

## File suggeriti

```txt
apps/worker/src/dm_instamap_worker/main.py
apps/worker/src/dm_instamap_worker/jobs.py
apps/worker/src/dm_instamap_worker/models.py
apps/worker/src/dm_instamap_worker/routes/
  __init__.py
  jobs.py
  assets.py
  references.py
  images.py
apps/worker/tests/
  test_health.py
  test_jobs.py
```

## Implementazione minima

Per ora i job possono essere in memoria.

Non serve ancora Celery, Redis o database.

Per simulare task lunghi usare `BackgroundTasks` o `asyncio.create_task`, ma mantenere codice semplice.

## Criteri di completamento

- `/health` ancora funziona.
- `POST /jobs/assets/scan` crea un job.
- `GET /jobs/{id}` restituisce stato.
- Il job arriva a `completed` con result mock o minimale.
- Test worker passano.

---

# Fase 3 — Asset intelligence avanzata

## Stato

Completata il 2026-05-20.

Implementato:

- Firma visiva locale `visualHash` basata su aspect ratio, trasparenza e colori dominanti.
- Quality score automatico con segnali di risoluzione, trasparenza, sharpness euristica, confidence e filename/tag signal.
- Campi manifest retrocompatibili: `visualHash`, `qualityScore`, `qualitySignals`, `duplicateGroupId`, `duplicateConfidence`, `reviewPriority`.
- Deduplicazione per file hash e visual hash.
- Report `data/indexes/asset-audit.json`.
- CLI `pnpm assets:audit`.
- Funzioni pure esportate da `packages/assets`.
- Test unitari per quality score, hash visivo, duplicati, review queue e scrittura audit.
- Documentazione `docs/ASSET_PIPELINE.md` aggiornata.

Verificato con:

```bash
pnpm --filter @dm-instamap/assets test
pnpm --filter @dm-instamap/assets lint
pnpm --filter @dm-instamap/assets build
pnpm assets:audit
```

Limite noto:

- La firma visiva è una euristica leggera su metadati già estratti; non è ancora un perceptual hash pixel-level.

## Obiettivo

Migliorare la qualità della classificazione degli assets e ridurre drasticamente il lavoro manuale.

Questa fase include:

- deduplicazione;
- quality score automatico;
- asset review intelligente;
- report di affidabilità.

## Prompt da dare a Codex

```txt
Implementa la Fase 3: Asset Intelligence avanzata.

Obiettivi:
1. Aggiungi perceptual hashing leggero o firma visiva locale per individuare assets duplicati o quasi duplicati.
2. Aggiungi quality score automatico basato su dimensioni, trasparenza, nitidezza euristica, classificazione e coerenza.
3. Estendi il manifest assets con campi retrocompatibili.
4. Crea un report JSON di asset audit.
5. Aggiungi funzioni pure e test.
6. Non rompere il formato esistente.
7. Non committare assets binari pesanti.

Output atteso:
- data/indexes/asset-audit.json
- funzioni esportate da packages/assets
- test su fixture piccole.
```

## Nuovi campi suggeriti per asset manifest

Estendere `AssetManifestEntry` in modo retrocompatibile:

```ts
visualHash?: string;
qualityScore?: number;
qualitySignals?: {
  resolution: number;
  transparency: number;
  sharpness: number;
  classificationConfidence: number;
  filenameSignal: number;
};
duplicateGroupId?: string | null;
duplicateConfidence?: number | null;
reviewPriority?: "low" | "medium" | "high" | "critical";
```

## Nuovo file audit

```txt
data/indexes/asset-audit.json
```

Struttura:

```json
{
  "generatedAt": "...",
  "assetCount": 20000,
  "needsReviewCount": 312,
  "duplicateGroupCount": 420,
  "lowQualityCount": 328,
  "classificationWarnings": [],
  "duplicateGroups": [],
  "reviewQueue": []
}
```

## Funzioni da creare

In `packages/assets/src/audit.ts`:

```ts
export function calculateAssetQualityScore(...)
export function createVisualHash(...)
export function findDuplicateGroups(...)
export function buildAssetReviewQueue(...)
export async function auditAssets(...)
```

## CLI da aggiungere

Root script:

```json
"assets:audit": "pnpm --filter @dm-instamap/assets audit"
```

Package script:

```json
"audit": "tsx src/cli/audit.ts"
```

Comando:

```bash
pnpm assets:audit
```

## Criteri review priority

`critical` se:

- classification unknown;
- confidence molto bassa;
- asset corrotto;
- immagine senza dimensioni;
- possibile duplicato con conflitto di classificazione.

`high` se:

- confidence < 0.35;
- qualityScore < 35;
- tag vuoti;
- classifica sospetta.

`medium` se:

- confidence < 0.60;
- qualityScore < 55.

`low` altrimenti.

## Criteri di completamento

- `pnpm assets:scan <folder>` continua a funzionare.
- `pnpm assets:audit` genera audit.
- Test passano.
- La review queue contiene solo assets prioritari.

---

# Fase 4 — Reference Style DNA

## Obiettivo

Questa fase implementa la novità 1: “Style DNA” delle mappe reference.

Il tool deve analizzare le reference maps locali e creare una scheda testuale/strutturata dello stile, utile sia al generatore sia al bridge ChatGPT.

## Prompt da dare a Codex

```txt
Implementa la Fase 4: Reference Style DNA.

Obiettivi:
1. Estendi la scansione reference maps con analisi stile locale.
2. Crea un file data/indexes/reference-style-dna.json.
3. Per ogni reference map calcola palette, mood euristico, densità, probabile tipo layout, grid detection base e tag suggeriti.
4. Esponi i dati nella UI reference/ai-bridge.
5. Usa solo analisi locale: niente API.
6. Aggiungi test su fixture piccole.

Il risultato deve aiutare ChatGPT manual bridge e il generatore locale a capire lo stile di una mappa reference.
```

## Nuovo tipo

In `packages/assets/src/reference-style.ts`:

```ts
export type ReferenceStyleDna = {
  id: string;
  referenceId: string;
  generatedAt: string;
  mapType: string;
  confidence: number;
  palette: Array<{
    hex: string;
    population: number;
    role: "background" | "floor" | "wall" | "accent" | "unknown";
  }>;
  mood: string[];
  layoutTraits: string[];
  density: "sparse" | "medium" | "dense";
  grid: {
    detected: boolean;
    estimatedCellSizePx: number | null;
    confidence: number;
  };
  visualTags: string[];
  recommendedAssetTags: string[];
  promptSummary: string;
};
```

## Euristiche minime

### Palette

Usare dominant colors già presenti, ma arricchire con ruolo:

- colori scuri → background/wall;
- marroni/grigi → stone/floor/wall;
- gialli/arancio → light/accent;
- verdi → wilderness/terrain;
- blu → water/magic/cold.

### Mood

Esempi:

```txt
dark
gothic
stone
warm-lit
cold
natural
urban
ruined
sacred
cryptic
```

### Layout traits

Esempi:

```txt
corridor-heavy
room-cluster
central-axis
symmetrical
organic-cave
open-field
dense-urban
island-layout
ship-deck
```

Anche se all’inizio sono euristici, devono essere utili nel prompt.

### Grid detection base

Implementazione iniziale semplice:

- cercare linee verticali/orizzontali ripetute;
- valutare intervalli dominanti;
- se non sicuro, `detected: false`.

Non deve essere perfetta.

## CLI

Aggiungere:

```bash
pnpm references:style
```

Root script:

```json
"references:style": "pnpm --filter @dm-instamap/assets references:style"
```

## UI

Aggiungere pagina o sezione:

```txt
/references
```

Oppure integrare in AI bridge:

- mostra reference style summary;
- mostra promptSummary;
- mostra palette;
- mostra visualTags;
- permette di scegliere reference preferite.

## Esempio promptSummary

```txt
Gothic crypt battlemap with dark stone palette, warm torch accents, corridor-heavy layout, side chambers, medium density, likely square grid.
```

## Criteri di completamento

- `pnpm references:scan <folder>` continua a funzionare.
- `pnpm references:style` genera `reference-style-dna.json`.
- AI bridge include lo Style DNA nei prompt.
- Test passano.

---

# Fase 5 — Project System locale

## Obiettivo

Introdurre un sistema di progetti salvati localmente.

Oggi molte mappe sono generate in memoria. Serve poter creare, aprire, modificare, salvare ed esportare progetti.

## Prompt da dare a Codex

```txt
Implementa la Fase 5: Project System locale.

Obiettivi:
1. Crea un formato progetto locale DM-Instamap.
2. Salva i progetti in data/projects.
3. Aggiungi API Next.js per list/create/read/update/delete projects.
4. Aggiungi pagine web per lista progetti, nuovo progetto e dettaglio progetto.
5. Integra generateDungeon con la creazione di un progetto.
6. Non usare database esterno.
7. Mantieni MapDocument come source of truth della mappa.
```

## Struttura cartelle

```txt
data/projects/
  crypt-under-cathedral/
    project.json
    map.dmimap.json
    exports/
    thumbnails/
```

## Tipo progetto

In `packages/core` o `apps/web/src/lib/projects.ts`:

```ts
export type DmInstamapProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceRequest?: string;
  selectedAssetGroupIds: string[];
  selectedReferenceIds: string[];
  styleDnaIds: string[];
  document: MapDocument;
};
```

## API Next.js

```txt
GET    /api/projects
POST   /api/projects
GET    /api/projects/[projectId]
PUT    /api/projects/[projectId]
DELETE /api/projects/[projectId]
```

## Pagine

```txt
/projects
/projects/new
/projects/[projectId]
/projects/[projectId]/editor
/projects/[projectId]/export
```

## Criteri importanti

- ID progetto slug sicuro.
- Validare ogni `MapDocument` con Zod.
- Scrittura atomica su file: scrivere file temp e poi rinominare.
- Non permettere path traversal.
- Gestire progetto mancante con 404.

## Criteri di completamento

- posso creare progetto da UI;
- posso vedere lista progetti;
- posso aprire progetto;
- posso aggiornare `MapDocument`;
- posso cancellare progetto;
- test passano.

---

# Fase 6 — Vero editor visuale canvas

## Obiettivo

Sostituire la preview statica con un editor reale.

Questa è la fase più importante per trasformare il progetto in tool utilizzabile.

## Prompt da dare a Codex

```txt
Implementa la Fase 6: editor visuale canvas per DM-Instamap.

Obiettivi:
1. Crea un editor canvas per MapDocument.
2. Supporta pan, zoom, selezione, griglia, layer e strumenti base.
3. Integra caricamento e salvataggio del Project System.
4. Permetti modifica tile base e posizionamento assets placeholder.
5. Mantieni codice modulare e testabile.
6. Se serve scegliere una libreria, preferisci una soluzione semplice e stabile. Evita over-engineering.
7. Non rompere export e schema MapDocument.
```

## Scelta tecnica consigliata

Opzione A: Canvas custom React.

Pro:

- meno dipendenze;
- controllo totale;
- abbastanza per MVP.

Opzione B: Konva / React Konva.

Pro:

- drag/drop e layer più facili;
- selezione oggetti più semplice.

Per questa fase si consiglia **React Konva** se compatibile con Next.js, altrimenti canvas custom.

## Struttura componenti

```txt
apps/web/src/components/editor/
  map-editor.tsx
  editor-toolbar.tsx
  editor-canvas.tsx
  editor-layer-panel.tsx
  editor-inspector.tsx
  editor-state.ts
  editor-actions.ts
  editor-geometry.ts
```

## Tool minimi

```ts
type EditorTool =
  | "select"
  | "paint-floor"
  | "paint-wall"
  | "erase"
  | "door"
  | "light"
  | "asset";
```

## Funzioni MVP

### Canvas

- rendering tile;
- rendering assets;
- rendering porte;
- rendering luci;
- rendering griglia;
- zoom con wheel;
- pan con middle mouse o space + drag;
- coordinate cella sotto mouse.

### Editing

- paint floor/wall/empty;
- click per aggiungere porta;
- click per aggiungere luce;
- selezione asset/porta/luce;
- cancellazione elemento selezionato;
- update inspector.

### Stato

- `MapDocument` resta source of truth;
- editor state separato per zoom, pan, tool, selection;
- salvataggio manuale;
- autosave opzionale dopo questa fase.

## Inspector

Mostrare:

- elemento selezionato;
- posizione;
- layer;
- assetId;
- rotation;
- scale;
- locked;
- tags.

## Criteri di completamento

- `/projects/[id]/editor` apre editor;
- posso modificare tile;
- posso aggiungere porta;
- posso aggiungere luce;
- posso salvare;
- riaprendo il progetto vedo le modifiche;
- export usa il documento aggiornato.

---

# Fase 7 — Generatore semantico/narrativo + tattico

## Obiettivo

Implementare la novità 2: generatore narrativo + tattico.

Il generatore non deve creare solo rettangoli. Deve generare una mappa coerente con la richiesta narrativa.

## Prompt da dare a Codex

```txt
Implementa la Fase 7: generatore narrativo + tattico.

Obiettivi:
1. Estendi il generator con un livello semantico prima della geometria.
2. Crea tipi per NarrativeRoom, TacticalRole e MapGenerationBlueprint.
3. Aggiungi generatori specializzati almeno per crypt, dungeon generico e building.
4. Trasforma una richiesta strutturata in blueprint e poi in MapDocument.
5. Integra asset groups e reference style DNA come segnali opzionali.
6. Aggiungi test per una cripta sotto una cattedrale con morti non ostili ma prigionieri.
```

## Nuovi tipi suggeriti

In `packages/generator/src/blueprint.ts`:

```ts
export type TacticalRole =
  | "entrance"
  | "social"
  | "combat"
  | "puzzle"
  | "treasure"
  | "hazard"
  | "boss"
  | "transition"
  | "secret"
  | "safe";

export type NarrativeRoom = {
  id: string;
  label: string;
  purpose: string;
  tacticalRole: TacticalRole;
  tags: string[];
  suggestedAssets: string[];
  suggestedLights: string[];
  suggestedNotes: string[];
  minSize: { width: number; height: number };
  preferredShape: "rectangular" | "long" | "wide" | "square" | "organic";
};

export type MapGenerationBlueprint = {
  id: string;
  name: string;
  theme: string;
  mapKind: "dungeon" | "building" | "city" | "cave" | "ship";
  rooms: NarrativeRoom[];
  connections: Array<{
    from: string;
    to: string;
    type: "open" | "door" | "locked" | "secret" | "stairs";
  }>;
  globalTags: string[];
  gmNotes: string[];
};
```

## Pipeline

```txt
User Request / Structured Input
        ↓
Blueprint narrativo
        ↓
Layout graph
        ↓
Geometria stanze/corridoi
        ↓
Muri/porte/luci
        ↓
Auto-furnish
        ↓
MapDocument
```

## Esempio test obbligatorio

Input:

```txt
Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri.
```

Output atteso:

- presenza entrance;
- presenza chapel o cathedral access;
- presenza crypt cells / prison;
- presenza reliquary o sealed chamber;
- almeno una stanza social;
- almeno una stanza puzzle/hazard;
- boss opzionale ma non obbligatorio;
- tags: crypt, cathedral, prison, undead, non-hostile o bound;
- notes narrative.

## Funzioni da creare

```ts
export function createNarrativeBlueprint(input: NarrativeGenerationInput): MapGenerationBlueprint
export function generateMapFromBlueprint(blueprint: MapGenerationBlueprint): MapDocument
export function generateCryptBlueprint(...)
export function generateBuildingBlueprint(...)
```

## Criteri di completamento

- il vecchio `generateDungeon` continua a funzionare;
- esiste nuova funzione semantica;
- UI generator può scegliere modalità “Simple” o “Narrative”;
- test passano;
- output è ancora `MapDocument` valido.

---

# Fase 8 — AI bridge manuale avanzato

## Obiettivo

Potenziare il bridge ChatGPT senza usare API.

Il bridge deve diventare un flusso completo:

1. costruisci contesto locale;
2. copi prompt;
3. incolli risposta;
4. validi;
5. ripari;
6. importi in progetto;
7. apri editor.

## Prompt da dare a Codex

```txt
Implementa la Fase 8: AI bridge manuale avanzato.

Obiettivi:
1. Integra Style DNA, asset groups, blueprint schema e MapPlan schema nel prompt.
2. Aggiungi export di un Prompt Packet in Markdown.
3. Aggiungi import della risposta ChatGPT come progetto o come piano nel progetto corrente.
4. Aggiungi validazione più utile: asset mancanti, stanze fuori bounds, porte senza stanza, asset placement non valido.
5. Aggiungi suggerimenti locali per sostituire asset inesistenti.
6. Non usare API esterne.
```

## Prompt packet

Creare funzione:

```ts
export function buildPromptPacket(input: PromptPacketInput): string
```

Output markdown:

```md
# DM-Instamap Prompt Packet

## User Request

...

## Local Asset Groups

...

## Reference Style DNA

...

## Required Output

Return JSON only.

## Schema

...
```

## Import risposta

API:

```txt
POST /api/ai-bridge/import-plan
```

Input:

```json
{
  "projectId": "optional",
  "response": "{...json...}",
  "mode": "new-project | update-project"
}
```

Output:

```json
{
  "ok": true,
  "projectId": "...",
  "warnings": []
}
```

## Validazioni aggiuntive

Oltre Zod:

- room bounds dentro mappa;
- door position dentro mappa;
- light radius valido;
- assetId esiste negli asset groups o nel manifest;
- wall non ha start=end;
- duplicate ids;
- connections puntano a stanze esistenti.

## Repair locale

Se asset non esiste:

```json
{
  "type": "missing_asset",
  "assetId": "golden_coffin",
  "suggestions": [
    "group_stone_sarcophagus",
    "group_crypt_coffin",
    "group_bone_pile"
  ]
}
```

## Criteri di completamento

- bridge include Style DNA;
- posso esportare prompt packet `.md`;
- posso importare JSON valido in un progetto;
- errori sono leggibili;
- suggerimenti asset funzionano;
- test passano.

---

# Fase 9 — Export professionale

## Obiettivo

Rendere gli export realmente utilizzabili al tavolo e nei VTT.

## Prompt da dare a Codex

```txt
Implementa la Fase 9: export professionale.

Obiettivi:
1. Aggiungi export player map e GM map.
2. Aggiungi opzioni con/senza griglia.
3. Raffina export Foundry e dd2vtt.
4. Aggiungi export proprietario .dmimap.
5. Integra export nella UI progetto.
6. Non rompere gli exporter esistenti.
```

## Tipi export

```txt
PNG
WEBP
dd2vtt
Foundry module ZIP
dmimap JSON
```

## Modalità

```txt
player
gm
clean
with-grid
without-grid
```

## Player safe

La player map deve rimuovere:

- note GM;
- secret rooms;
- secret doors;
- annotations GM;
- trap markers;
- nomi spoiler.

## API

```txt
POST /api/projects/[projectId]/export
```

Input:

```json
{
  "format": "png",
  "mode": "player",
  "includeGrid": true,
  "scale": 2
}
```

## UI

Pagina:

```txt
/projects/[projectId]/export
```

Con:

- scelta formato;
- scelta modalità;
- include grid;
- scale;
- download.

## Criteri di completamento

- posso esportare progetto corrente;
- export player non include layer segreti;
- Foundry ZIP resta valido;
- dd2vtt resta valido;
- test passano.

---

# Fase 10 — UX finale guidata

## Obiettivo

Trasformare la UI da dashboard tecnica a prodotto utilizzabile da un DM.

## Prompt da dare a Codex

```txt
Implementa la Fase 10: UX guidata finale.

Obiettivi:
1. Crea una home orientata all’utente.
2. Aggiungi wizard Nuova Mappa.
3. Rendi accessibili Asset Library, Reference Maps, Projects, AI Bridge ed Export.
4. Migliora stati empty/error/help.
5. Mantieni design sobrio, chiaro, fantasy-tool, non SaaS generico.
6. Non rompere le rotte tecniche esistenti.
```

## Navigazione finale

```txt
/
  Home

/projects
  Progetti

/projects/new
  Nuova Mappa

/projects/[id]/editor
  Editor

/assets
  Asset Library

/assets/review
  Asset Review

/references
  Reference Maps

/ai-bridge
  ChatGPT Bridge

/projects/[id]/export
  Export
```

## Wizard Nuova Mappa

Step consigliati:

```txt
1. Descrivi la mappa
2. Scegli tipo mappa
3. Scegli reference style
4. Scegli asset groups
5. Genera bozza
6. Apri editor
```

## Home

Mostrare:

- crea nuova mappa;
- ultimi progetti;
- stato assets;
- stato references;
- azioni rapide.

## Criteri di completamento

- un utente non tecnico capisce cosa fare;
- si può creare una mappa senza sapere la struttura interna;
- le vecchie pagine restano raggiungibili;
- UI responsive;
- build passa.

---

# Novità 1 — Style DNA delle mappe reference

Questa novità è implementata principalmente nella Fase 4, ma deve influenzare anche Fasi 7, 8 e 10.

## Obiettivo funzionale

L’utente può dire:

```txt
Usa uno stile simile a questa reference map.
```

Il tool non deve copiare la mappa, ma estrarre uno stile:

- palette;
- mood;
- densità;
- tipo layout;
- tag visuali;
- asset consigliati;
- prompt summary.

## Istruzione specifica per Codex

```txt
Integra Style DNA in tutto il flusso:
- nella pagina references mostra la scheda stile;
- nel generatore usa Style DNA come input opzionale;
- nel bridge ChatGPT inserisci promptSummary e recommendedAssetTags;
- nel project system salva quali Style DNA sono stati usati.
```

## Done

- `reference-style-dna.json` generato.
- UI mostra Style DNA.
- AI bridge lo include.
- Project salva `styleDnaIds`.

---

# Novità 2 — Generatore narrativo + tattico

Questa novità è implementata nella Fase 7.

## Obiettivo funzionale

Il generatore deve capire la funzione narrativa delle stanze.

Non basta:

```txt
Room 1
Room 2
Room 3
```

Serve:

```txt
Entrance from cathedral sacristy
Hall of chained spirits
Reliquary of broken vows
Sealed prison tomb
Final ritual chamber
```

## Istruzione specifica per Codex

```txt
Aggiungi un layer blueprint prima della geometria.
Ogni stanza deve avere:
- label;
- purpose;
- tacticalRole;
- tags;
- suggestedAssets;
- suggestedLights;
- suggestedNotes;
- minSize;
- preferredShape.
```

## Done

- esiste `MapGenerationBlueprint`;
- esiste almeno `generateCryptBlueprint`;
- UI mostra i nomi stanza generati;
- MapDocument resta valido;
- test con cripta sotto cattedrale.

---

# Novità 4 — Batch review intelligente per 20.000 assets

Questa novità è implementata nella Fase 3.

## Obiettivo funzionale

L’utente non deve validare 20.000 assets manualmente.

Il tool deve dire:

```txt
Assets probabilmente corretti: 18.940
Da controllare subito: 312
Duplicati probabili: 420
Qualità bassa: 328
```

## Istruzione specifica per Codex

```txt
Crea una review queue intelligente basata su:
- confidence;
- classification unknown;
- qualityScore;
- duplicati;
- conflitti tra file simili;
- tag mancanti;
- dimensioni sospette;
- trasparenza incoerente.
```

## UI consigliata

Pagina:

```txt
/assets/review/batches
```

Batch:

```txt
Critical
High priority
Duplicates
Low quality
Unknown classification
Suspicious doors
Suspicious walls
Suspicious floors
```

## Done

- `asset-audit.json`;
- batch review UI;
- review prioritizzata;
- non serve controllare tutto.

---

# Novità 5 — Local visual search

## Obiettivo

Trovare assets simili a un testo o a un’immagine reference usando solo dati locali.

Il progetto ha già embeddings locali semplici. Questa feature li rende usabili.

## Prompt da dare a Codex

```txt
Implementa Local Visual Search.

Obiettivi:
1. Migliora gli embeddings locali esistenti senza API esterne.
2. Aggiungi ricerca testuale e ricerca per immagine reference.
3. Aggiungi API Next.js per search assets.
4. Aggiungi UI nell’asset browser e nell’editor.
5. Integra i risultati con auto-furnish e AI bridge.
```

## API

```txt
GET  /api/assets/search?q=crypt%20coffin&limit=20
POST /api/assets/search-by-image
```

## Funzioni

In `packages/assets`:

```ts
export async function searchAssetsByText(...)
export async function searchAssetsByImage(...)
export function explainAssetSearchResult(...)
```

## UI

In Asset Browser:

- barra “Visual/Text Search”;
- risultati ordinati per score;
- mostra reason: colore, tag, kind, path, similarity.

In Editor:

- pannello “Find matching assets”;
- se seleziono una stanza crypt, suggerisci assets crypt.

## Done

- ricerca testuale funziona;
- ricerca per reference image funziona;
- risultati hanno score;
- test passano;
- nessuna API esterna.

---

# Novità 6 — Auto-furnish avanzato

## Obiettivo

Potenziare l’auto-furnish esistente affinché arredi le stanze in modo credibile.

## Prompt da dare a Codex

```txt
Implementa Auto-Furnish avanzato.

Obiettivi:
1. Estendi autoFurnishMap con regole per room type, wall placement, central placement e collisioni migliori.
2. Usa Asset Groups invece di singoli asset quando possibile.
3. Usa NarrativeRoom e TacticalRole se disponibili.
4. Aggiungi densità e stile.
5. Aggiungi debug output utile.
6. Aggiungi test per crypt, library, prison, chapel e boss room.
```

## Regole di piazzamento

### Oggetti da muro

Esempi:

- bookshelf;
- torch;
- banner;
- shelf;
- weapon rack.

Posizionare lungo bordo stanza.

### Oggetti centrali

Esempi:

- altar;
- table;
- sarcophagus;
- throne.

Posizionare vicino al centro o asse principale.

### Oggetti sparsi

Esempi:

- bones;
- crates;
- rubble;
- small props.

Distribuire evitando collisioni.

### Luci

- vicino a porte;
- lungo corridoi;
- agli angoli;
- vicino ad altari o punti importanti.

## Input esteso

```ts
export type AutoFurnishOptions = {
  assets: FurnishingAsset[];
  assetGroups?: MatchableAssetGroup[];
  density?: FurnishingDensity;
  includeCorridors?: boolean;
  styleTags?: string[];
  narrativeRooms?: NarrativeRoom[];
  seed?: string;
};
```

## Output debug

```ts
export type AutoFurnishResult = {
  document: MapDocument;
  placed: FurnishingPlacementDebug[];
  skipped: Array<{
    assetId: string;
    reason: string;
    roomId: string;
  }>;
  summary: {
    roomCount: number;
    placedCount: number;
    skippedCount: number;
    density: string;
  };
};
```

## Criteri di completamento

- crypt riceve coffin/sarcophagus/bones/torch se disponibili;
- library riceve bookshelf/table;
- prison riceve chains/cage/bar se disponibili;
- chapel riceve altar/pew/light;
- collisioni evitate;
- output debug utile;
- test passano.

---

# Ordine consigliato di sviluppo

Non sviluppare le fasi in ordine casuale.

Ordine raccomandato:

```txt
1. Fase 1 — Stabilizzazione
2. Fase 2 — Worker job system
3. Fase 3 — Asset intelligence
4. Novità 4 — Batch review intelligente
5. Fase 4 — Reference Style DNA
6. Novità 5 — Local visual search
7. Fase 5 — Project System
8. Fase 6 — Editor canvas
9. Fase 7 — Generatore narrativo/tattico
10. Novità 6 — Auto-furnish avanzato
11. Fase 8 — AI bridge avanzato
12. Fase 9 — Export professionale
13. Fase 10 — UX guidata
```

Motivo:

- prima si stabilizza;
- poi si prepara il worker;
- poi si rende intelligente la libreria assets;
- poi si analizzano le reference;
- poi si crea il sistema progetti;
- poi si costruisce l’editor;
- poi si migliora la generazione;
- infine si rifiniscono bridge, export e UX.

---

# Prompt master da dare a Codex all’inizio

```txt
Sei Codex e stai lavorando sul repository DM-Instamap.

Contesto:
DM-Instamap è un tool local-first per generare, modificare ed esportare mappe D&D usando assets locali, reference maps e un bridge manuale ChatGPT senza API obbligatorie.

Regole obbligatorie:
- Non introdurre API esterne obbligatorie.
- Non committare assets binari pesanti.
- Mantieni il monorepo pnpm.
- Mantieni MapDocument e MapPlan come source of truth.
- Ogni modifica deve essere testata.
- Ogni nuova API deve validare input e impedire path traversal.
- Ogni feature deve avere stati UI chiari.
- Non rompere gli exporter esistenti.
- Non riscrivere tutto da zero.
- Procedi per fase.

Prima di modificare:
1. Leggi README.md.
2. Leggi docs/architecture.md.
3. Leggi packages/core/src/index.ts.
4. Leggi packages/assets/src.
5. Leggi packages/generator/src.
6. Leggi packages/exporters/src.
7. Leggi packages/ai-bridge/src.
8. Leggi apps/web/src.
9. Leggi apps/worker/src.

Poi implementa solo la fase richiesta.
Alla fine restituisci:
- cosa hai cambiato;
- file modificati;
- comandi eseguiti;
- test passati;
- limiti rimasti;
- prossima fase consigliata.
```

---

# Prompt breve per ogni PR

Usare questo schema per ogni fase:

```txt
Implementa solo la Fase X della roadmap DM-Instamap.

Non implementare fasi successive.
Non introdurre servizi esterni.
Mantieni retrocompatibilità.
Aggiungi test.
Aggiorna documentazione minima.
Esegui o indica questi comandi:
pnpm lint
pnpm test
pnpm build
```

---

# Definizione di “progetto maturo”

DM-Instamap può considerarsi maturo quando:

- l’utente può creare una nuova mappa da wizard;
- può scegliere assets e reference;
- può generare una bozza coerente;
- può modificarla in editor canvas;
- può arredarla automaticamente;
- può correggere assets senza controllarli tutti;
- può usare ChatGPT manual bridge senza API;
- può esportare player map, GM map, Foundry, dd2vtt e PNG;
- può riaprire progetti salvati;
- build/test/CI sono verdi.

---

# Checklist finale completa

## Core

- [ ] Schemi Zod stabili.
- [ ] Migrazioni versioni documento.
- [ ] Test schema.

## Assets

- [ ] Scan.
- [ ] Preview.
- [ ] Classification.
- [ ] Manual overrides.
- [ ] Audit.
- [ ] Duplicates.
- [ ] Quality score.
- [ ] Batch review.
- [ ] Local visual search.

## References

- [ ] Scan.
- [ ] Preview.
- [ ] Map type.
- [ ] Style DNA.
- [ ] Grid detection base.
- [ ] Prompt summary.

## Generator

- [ ] Simple dungeon.
- [ ] Narrative blueprint.
- [ ] Crypt generator.
- [ ] Building generator.
- [ ] Tactical roles.
- [ ] Auto-furnish advanced.

## Web

- [ ] Home.
- [ ] Projects.
- [ ] New map wizard.
- [ ] Asset browser.
- [ ] Asset review.
- [ ] Reference browser.
- [ ] AI bridge.
- [ ] Editor canvas.
- [ ] Export page.

## Worker

- [ ] Health.
- [ ] Jobs.
- [ ] Asset scan endpoint.
- [ ] Reference scan endpoint.
- [ ] Image analysis endpoint.
- [ ] Tests.

## Export

- [ ] PNG.
- [ ] WEBP.
- [ ] dd2vtt.
- [ ] Foundry.
- [ ] Player safe map.
- [ ] GM map.
- [ ] dmimap.

## Quality

- [ ] CI.
- [ ] README.
- [ ] Roadmap.
- [ ] Tests.
- [ ] No generated data in Git.
- [ ] No external API requirement.

---

# Nota finale per Codex

Il progetto non deve diventare un generatore “magico” fragile.

La strategia corretta è:

```txt
Assets locali analizzati bene
+ Reference Style DNA
+ Blueprint narrativo
+ Generatore geometrico controllabile
+ Editor manuale
+ Auto-furnish
+ Export professionale
+ ChatGPT bridge opzionale
= Tool realmente utile per un DM
```

Ogni funzione deve lasciare sempre possibilità di correzione manuale.

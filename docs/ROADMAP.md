# DM-Instamap — Roadmap correttiva + Manuale test end-to-end manuali

## Obiettivo del documento

Questo documento serve a trasformare DM-Instamap da **MVP tecnico avanzato** a **tool personale affidabile per creare, modificare ed esportare mappe D&D realmente usabili al tavolo**.

La roadmap corregge i problemi emersi dall’analisi:

1. boundary confuso tra codice browser-safe e server-only;
2. export raster ancora troppo simbolico e non pienamente asset-based;
3. mancanza di migrazioni dati per `MapDocument`;
4. sicurezza accettabile solo in locale, ma non abbastanza esplicitata;
5. test end-to-end reali ancora da eseguire con asset, editor ed export VTT;
6. qualità visiva/generativa ancora da validare con mappe reali;
7. test UI parziali.

---

# PARTE 1 — Roadmap correttiva dettagliata

## Regola generale

Ogni fase deve chiudersi con:

```bash
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

Una fase non è considerata completata se:

- il comando `pnpm build` fallisce;
- i test passano ma il flusso manuale principale non funziona;
- la feature esiste solo come codice ma non è verificabile in UI;
- l’export prodotto non può essere aperto/importato realmente.

---

## Fase 0 — Congelamento, backup e baseline

### Obiettivo

Creare una base sicura prima di modificare il progetto.

### Task

1. Creare un branch dedicato:

```bash
git checkout main
git pull
git checkout -b fix/maturity-roadmap
```

2. Salvare lo stato attuale:

```bash
git status
git log --oneline -5
```

3. Eseguire baseline tecnica:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

4. Salvare gli output in un file locale:

```txt
docs/manual-test-reports/baseline-YYYY-MM-DD.md
```

### Output atteso

Un report con:

```txt
Data:
Commit:
Sistema operativo:
Node:
pnpm:
Python:
pnpm lint: PASS/FAIL
pnpm test: PASS/FAIL
pnpm build: PASS/FAIL
worker test: PASS/FAIL
Problemi rilevati:
```

### Definition of Done

La baseline è documentata. Anche se qualcosa fallisce, deve essere scritto chiaramente cosa fallisce e con quale errore.

---

## Fase 1 — Separazione server-only / browser-safe

### Problema da risolvere

Il progetto rischia errori di build Next perché alcuni moduli condivisi possono trascinare import Node-only, come filesystem e path, dentro codice client. Questo è pericoloso soprattutto con Next, Turbopack e componenti React client.

### Obiettivo

Separare in modo netto:

```txt
codice usabile nel browser
codice usabile solo server/Node
schemi puri condivisi
```

### Nuova struttura consigliata

```txt
packages/core/src/
  schemas.ts
  map-document.ts
  campaign.ts
  browser.ts
  server.ts
  snapshots.ts
  snapshots.server.ts
  index.ts
```

### Regola di import

Nei componenti client:

```ts
import type { MapDocument } from "@dm-instamap/core/browser";
```

Nei route handler, CLI, worker bridge, export server:

```ts
import { readSnapshotFromDirectory } from "@dm-instamap/core/server";
```

### Task tecnici

1. Spostare tutti gli schemi Zod puri in `schemas.ts`.
2. Spostare funzioni che usano filesystem in entrypoint server-only.
3. Evitare che `packages/core/src/index.ts` esporti funzioni che importano `node:fs`, `node:path`, `node:crypto` se quell’entrypoint è usato anche lato client.
4. Aggiornare `package.json` di `@dm-instamap/core`:

```json
{
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./browser": {
      "import": "./src/browser.ts",
      "types": "./src/browser.ts"
    },
    "./server": {
      "import": "./src/server.ts",
      "types": "./src/server.ts"
    }
  }
}
```

5. Cercare import pericolosi:

```bash
grep -R "@dm-instamap/core" apps/web/src/components apps/web/src/app -n
```

Su PowerShell:

```powershell
Get-ChildItem apps/web/src -Recurse -Include *.ts,*.tsx | Select-String "@dm-instamap/core"
```

6. Correggere import nei componenti client.

### Test obbligatori

```bash
pnpm --filter @dm-instamap/core lint
pnpm --filter @dm-instamap/web lint
pnpm build
```

### Acceptance criteria

- `pnpm build` passa.
- Nessun componente client importa funzioni server-only.
- Gli schemi principali restano disponibili.
- Snapshot/campaign/export continuano a funzionare lato server.

### Priorità

**P0 — Critica.** Da fare prima di rifinire altre feature.

---

## Fase 2 — Export raster realmente asset-based

### Problema da risolvere

L’export PNG/WEBP deve comporre realmente gli asset grafici, non rappresentarli con simboli, cerchi o iniziali.

### Obiettivo

Quando un asset è piazzato nella mappa, l’export deve renderizzare la sua immagine reale nella posizione corretta.

### Nuovo comportamento atteso

Un `PlacedAsset` con:

```ts
{
  assetId: "asset_abc...",
  position: { x: 10, y: 6 },
  rotation: 45,
  scale: 1.2,
  flipX: false,
  flipY: true
}
```

deve diventare nell’export:

```txt
immagine reale caricata dal manifest
scalata
ruotata
flippata se necessario
posizionata sul layer corretto
```

### Modello dati consigliato

Creare un resolver:

```ts
export type AssetResolver = {
  resolveAssetPath(assetId: string): Promise<string | null>;
};
```

Oppure:

```ts
export type RasterAssetSource = {
  assetId: string;
  absolutePath: string;
  width?: number | null;
  height?: number | null;
};
```

L’export non dovrebbe leggere direttamente manifest globali senza controllo. Meglio passargli un resolver dal layer web/server.

### Task tecnici

1. Creare `packages/exporters/src/asset-resolver.ts`.
2. Creare funzione per leggere `data/indexes/assets.manifest.json`.
3. Collegare `assetId` a `relativePath`/`sourceRoot`.
4. Usare Sharp composite per inserire asset nel raster.
5. Supportare almeno:
   - PNG;
   - WEBP;
   - trasparenza;
   - scale;
   - rotation base;
   - flipX/flipY;
   - layer order.
6. Se un asset manca, renderizzare un marker di fallback ma aggiungere warning nel risultato export.

### Risultato export consigliato

```ts
export type RasterExportResult = {
  buffer: Buffer;
  filename: string;
  warnings: string[];
  usedAssets: string[];
  missingAssets: string[];
};
```

### Test automatici minimi

Creare fixture piccole:

```txt
packages/exporters/test-fixtures/
  floor.png
  chair.png
  torch.webp
```

Testare:

1. export con asset esistente;
2. export con asset mancante;
3. export con flip;
4. export con scale;
5. export con layer spento;
6. export player-safe senza asset GM-only.

### Test manuale obbligatorio

Creare una mappa con 5 asset veri:

- pavimento;
- muro/porta;
- tavolo;
- luce/torcia;
- oggetto scenico.

Esportare PNG e verificare visivamente che gli asset compaiano davvero.

### Acceptance criteria

- PNG/WEBP mostrano asset reali.
- Gli asset mancanti sono riportati come warning, non causano crash.
- Export player/GM rispettano visibilità e layer.
- Il file può essere aperto da visualizzatore immagini standard.

### Priorità

**P0 — Critica.** Senza questa fase il tool genera struttura, ma non ancora mappe belle.

---

## Fase 3 — Migrazioni dati `MapDocument`

### Problema da risolvere

Esiste `version: 1`, ma manca una pipeline di migrazione. Appena cambi lo schema, rischi di rompere progetti vecchi.

### Obiettivo

Ogni documento salvato deve poter essere letto anche dopo modifiche future allo schema.

### API consigliata

```ts
export function migrateMapDocument(input: unknown): MapDocument {
  // 1. riconosci versione
  // 2. applica migrazioni incrementali
  // 3. valida con MapDocumentSchema
}
```

### Struttura consigliata

```txt
packages/core/src/migrations/
  index.ts
  v0-to-v1.ts
  v1-to-v2.ts
  fixtures/
    document-v1-basic.json
    document-v1-with-assets.json
    document-v1-with-plan.json
```

### Task tecnici

1. Creare `migrateMapDocument`.
2. Usarla in `readProject` al posto di `MapDocumentSchema.parse` diretto.
3. Usarla negli import `.dmimap.json`.
4. Aggiungere fixture di documenti vecchi.
5. Aggiungere test di compatibilità.
6. Documentare regola: mai modificare schema senza migrazione.

### Acceptance criteria

- Un documento vecchio viene letto e aggiornato in memoria.
- Un documento corrotto produce errore chiaro.
- Un documento con campi sconosciuti non manda in crash l’app senza messaggio comprensibile.
- `readProject` non rompe vecchie mappe.

### Priorità

**P1 — Alta.** Da fare subito dopo export asset-based.

---

## Fase 4 — Hardening sicurezza locale

### Problema da risolvere

Il progetto è sicuro solo se resta locale. API web e worker non sono pensati per esposizione pubblica.

### Obiettivo

Rendere impossibile o molto evidente l’uso sbagliato su internet.

### Task tecnici

1. Aggiungere avviso forte nel README:

```txt
DM-Instamap non include autenticazione. Non esporre su internet. Usare solo localhost o rete locale fidata.
```

2. Far partire Next preferibilmente su localhost.
3. Far partire worker preferibilmente su localhost.
4. Aggiungere controllo opzionale:

```env
DM_INSTAMAP_ALLOW_REMOTE=false
```

5. Se host non è localhost e `ALLOW_REMOTE` non è true, mostrare errore.
6. Validare path ricevuti dal worker:
   - path assoluti ammessi solo se locali;
   - niente path traversal;
   - niente cartelle di sistema;
   - warning se la cartella è troppo ampia.

### Acceptance criteria

- README chiarisce il rischio.
- Il worker non viene trattato come servizio pubblico.
- Le route che cancellano/scrivono dati sono documentate come locali.
- Nessun comando automatico suggerisce deploy pubblico.

### Priorità

**P1 — Alta.** Per uso personale è sufficiente, ma deve essere esplicito.

---

## Fase 5 — Test end-to-end manuali obbligatori

### Problema da risolvere

Il progetto ha tanti moduli, ma la domanda vera è:

```txt
Riesco a creare una mappa utile per la sessione di domani?
```

### Obiettivo

Creare una procedura ripetibile che verifichi il flusso reale.

### Task

1. Creare cartella report:

```txt
docs/manual-test-reports/
```

2. Creare template:

```txt
docs/manual-test-reports/TEMPLATE.md
```

3. Eseguire test end-to-end su:
   - dungeon semplice;
   - caverna;
   - villaggio;
   - outdoor;
   - multi-floor;
   - export Foundry;
   - export dd2vtt;
   - Session Pack.

### Acceptance criteria

- Ogni test produce un report.
- Ogni fallimento ha screenshot o descrizione.
- Ogni export viene aperto/importato realmente.
- Ogni bug diventa issue/task.

### Priorità

**P0/P1 — Obbligatoria.** Non è una fase “nice to have”. È la prova che il progetto serve davvero.

---

## Fase 6 — Miglioramento qualità generativa

### Problema da risolvere

Il generatore può produrre layout tecnicamente validi ma non sempre belli o tatticamente interessanti.

### Obiettivo

Migliorare la qualità delle mappe generate.

### Task

1. Aggiungere scoring qualità mappa:

```txt
connettività
spazi troppo stretti
stanze inutili
percorsi leggibili
coperture tattiche
linee di vista
punti di interesse
```

2. Aggiungere debug overlay in editor/generator preview.
3. Migliorare outdoor:
   - fiumi più naturali;
   - radure giocabili;
   - densità alberi controllabile;
   - percorsi leggibili.
4. Migliorare cave:
   - evitare blob casuali;
   - garantire entrata/uscita;
   - aggiungere camere principali.
5. Migliorare villaggi:
   - strade;
   - piazza centrale;
   - edifici funzionali;
   - accessi chiari.

### Acceptance criteria

Per ogni tipo mappa, su 10 generazioni random almeno 7 devono essere giudicate “usabili con modifiche minime”.

### Priorità

**P2 — Media.** Dopo aver stabilizzato export e build.

---

## Fase 7 — Test UI mirati

### Problema da risolvere

I test UI veri sono parziali.

### Obiettivo

Coprire i flussi più fragili senza appesantire troppo il progetto.

### Test consigliati

Usare Playwright o test leggeri su route principali.

Flussi minimi:

1. home carica;
2. crea progetto da wizard;
3. apre editor;
4. salva documento;
5. riapre progetto;
6. crea snapshot;
7. esporta session pack;
8. apre pagina campaign;
9. asset browser non crasha senza manifest;
10. AI bridge manuale genera prompt packet.

### Acceptance criteria

- Almeno 8 flussi principali coperti.
- I test non richiedono API esterne.
- I test possono girare in CI.

### Priorità

**P2 — Media.** Utile dopo che il flusso manuale è stabile.

---

# PARTE 2 — Manuale dettagliato test end-to-end manuali obbligatori

## 1. Scopo dei test manuali

Questi test servono a rispondere a 5 domande:

1. Posso installare il progetto da zero?
2. Posso importare asset reali?
3. Posso creare e modificare una mappa?
4. Posso esportarla in formati realmente utili?
5. Posso riaprire tutto senza perdere dati?

Se la risposta è sì, DM-Instamap è utile.

Se la risposta è no, bisogna correggere prima di aggiungere nuove feature.

---

## 2. Preparazione ambiente

### Requisiti

Verificare:

```bash
node -v
pnpm -v
python --version
```

Versioni consigliate:

```txt
Node.js 24+
pnpm 10+
Python 3.12+
```

### Installazione pulita

Da root repository:

```bash
pnpm install
pnpm worker:install
```

### Baseline tecnica

```bash
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

### Esito atteso

Tutti i comandi dovrebbero passare.

Se fallisce `pnpm build`, registrare:

```txt
Comando fallito:
Errore completo:
File citati nello stacktrace:
È legato a client/server import?
```

---

## 3. Preparazione dati test

Creare una cartella fuori da Git:

```bash
mkdir -p local-assets/e2e-basic
mkdir -p local-references/e2e-basic
```

Su PowerShell:

```powershell
New-Item -ItemType Directory -Force local-assets/e2e-basic
New-Item -ItemType Directory -Force local-references/e2e-basic
```

Inserire almeno:

```txt
local-assets/e2e-basic/
  floor-stone.png
  wall-stone.png
  door-wood.png
  table.png
  torch.png
  chest.png
  statue.png

local-references/e2e-basic/
  reference-crypt.png
  reference-cave.png
```

Gli asset possono essere piccoli. Lo scopo non è la bellezza massima, ma verificare che la pipeline funzioni.

---

## 4. Avvio app e worker

Aprire due terminali.

### Terminale 1 — Worker

```bash
pnpm worker:dev
```

Esito atteso:

```txt
Uvicorn running on http://127.0.0.1:8000
```

Verifica:

```bash
curl http://127.0.0.1:8000/health
```

Su PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

### Terminale 2 — Web app

```bash
pnpm dev
```

Aprire:

```txt
http://localhost:3000
```

Esito atteso:

- home visibile;
- nessun crash;
- navigazione principale presente;
- testi in italiano.

---

## 5. Test E2E-01 — Import asset locali

### Obiettivo

Verificare che il tool legga asset reali e generi manifest/previews.

### Procedura CLI

```bash
pnpm assets:scan local-assets/e2e-basic
pnpm assets:group
pnpm assets:audit
```

### Procedura UI

1. Aprire `/assets`.
2. Verificare che gli asset appaiano.
3. Aprire `/asset-groups`.
4. Verificare che i gruppi siano visibili.
5. Aprire `/assets/review/batches`.
6. Verificare eventuali warning.

### Risultati attesi

- `data/indexes/assets.manifest.json` esiste.
- `data/previews/assets/` contiene thumbnails.
- Gli asset non vengono duplicati inutilmente.
- Gli errori sono leggibili.

### Fallimento critico se

- lo scan crasha;
- il manifest non viene scritto;
- la UI asset non carica;
- i path generati sono sbagliati.

---

## 6. Test E2E-02 — Import reference maps e Style DNA

### Procedura

```bash
pnpm references:scan local-references/e2e-basic
pnpm references:style
```

Poi aprire:

```txt
/references
/references/review
```

### Risultati attesi

- le mappe di riferimento compaiono;
- viene generato un riassunto stile;
- non serve nessuna API esterna;
- eventuali dati mancanti sono gestiti senza crash.

### Fallimento critico se

- `references:style` fallisce su immagini valide;
- la pagina references va in errore;
- il sistema pretende una chiave API.

---

## 7. Test E2E-03 — Creazione mappa da wizard

### Procedura

1. Aprire `/projects/new`.
2. Inserire descrizione:

```txt
Una cripta sotto una cattedrale. I morti non sono ostili ma prigionieri. Deve avere ingresso, sala centrale, cappella allagata, stanza segreta e uscita nascosta.
```

3. Scegliere tipo mappa: dungeon/crypt.
4. Selezionare asset group disponibili.
5. Selezionare reference map.
6. Generare progetto.

### Risultati attesi

- viene creato un progetto;
- si viene reindirizzati alla pagina progetto o editor;
- la mappa ha stanze coerenti;
- esiste un file:

```txt
data/projects/<project-id>/project.json
data/projects/<project-id>/map.dmimap.json
```

### Fallimento critico se

- il wizard non crea il progetto;
- il progetto non si apre;
- il file `map.dmimap.json` è invalido;
- la generazione produce una mappa vuota.

---

## 8. Test E2E-04 — Editor canvas

### Procedura

1. Aprire il progetto creato.
2. Entrare in editor.
3. Eseguire queste azioni:
   - pan;
   - zoom;
   - paint floor;
   - paint wall;
   - erase;
   - aggiungi porta;
   - aggiungi luce;
   - piazza almeno 3 asset;
   - ruota un asset;
   - scala un asset;
   - flip di un asset;
   - aggiungi nota GM;
   - undo;
   - redo;
   - salva.
4. Chiudere pagina.
5. Riaprire progetto.

### Risultati attesi

- le modifiche restano salvate;
- undo/redo non corrompe la mappa;
- gli asset piazzati restano nella posizione corretta;
- note/luci sono ancora presenti dopo riapertura.

### Fallimento critico se

- il salvataggio perde dati;
- dopo riapertura la mappa cambia;
- editor crasha dopo undo/redo;
- asset/luci/note spariscono.

---

## 9. Test E2E-05 — Snapshot, diff e restore

### Procedura

1. Aprire il progetto.
2. Creare snapshot con label:

```txt
before-manual-edit
```

3. Modificare la mappa.
4. Creare secondo snapshot:

```txt
after-manual-edit
```

5. Aprire diff.
6. Ripristinare il primo snapshot.
7. Riaprire editor.

### Risultati attesi

- snapshot creati senza duplicati inutili;
- diff mostra campi cambiati;
- restore riporta davvero la mappa allo stato precedente;
- nessun crash su reload.

### Fallimento critico se

- snapshot non leggibili;
- restore corrompe `map.dmimap.json`;
- diff è vuoto quando ci sono modifiche evidenti.

---

## 10. Test E2E-06 — Export PNG/WEBP

### Procedura

1. Aprire pagina export progetto.
2. Esportare:
   - PNG GM;
   - PNG player;
   - WEBP GM;
   - WEBP player.
3. Aprire i file esportati con visualizzatore immagini.

### Risultati attesi

- i file si aprono;
- dimensioni corrette;
- player map non mostra note/elementi GM-only;
- GM map mostra tutto;
- se implementata Fase 2, gli asset reali compaiono nell’immagine.

### Fallimento critico se

- export genera file illeggibile;
- player map mostra segreti;
- asset reali non compaiono dopo la Fase 2;
- luci/layer causano crash.

---

## 11. Test E2E-07 — Export dd2vtt

### Procedura

1. Esportare formato dd2vtt.
2. Aprire il file JSON.
3. Verificare che contenga:
   - immagine embedded o riferimento valido;
   - walls;
   - doors/portals;
   - lights se presenti;
   - dimensioni mappa.
4. Importare in un VTT compatibile o plugin Universal VTT.

### Risultati attesi

- il file JSON è valido;
- il VTT importa la scena;
- muri e porte sono coerenti;
- la scala griglia è sensata.

### Fallimento critico se

- JSON invalido;
- import VTT fallisce;
- muri completamente sballati;
- porte fuori posizione.

---

## 12. Test E2E-08 — Export Foundry VTT

### Procedura

1. Esportare Foundry module zip.
2. Aprire Foundry.
3. Installare/importare il modulo.
4. Aprire la scena generata.
5. Verificare:
   - mappa visibile;
   - muri presenti;
   - porte presenti;
   - luci presenti;
   - journal entries presenti se abilitate;
   - note GM non visibili ai player.

### Risultati attesi

- modulo installabile;
- scena apribile;
- griglia coerente;
- muri/porte/luci accettabili;
- journal leggibili.

### Fallimento critico se

- Foundry rifiuta il modulo;
- scena non appare;
- immagine mancante;
- muri/luci inutilizzabili;
- dati GM finiscono lato player.

---

## 13. Test E2E-09 — Session Pack

### Procedura CLI

```bash
pnpm exports:session-pack <project-id> --scale 2 --include-initiative
```

Oppure da UI usare quick export Session Pack.

### Verificare zip

Lo zip dovrebbe contenere:

```txt
manifest.json
map-full.png o .webp
map-gm.png o .webp
map-player.png o .webp
gm-notes.md
plan-notes.md
initiative.json o .md
```

### Risultati attesi

- zip apribile;
- manifest coerente;
- mappe presenti;
- note leggibili;
- player map sicura.

### Fallimento critico se

- zip corrotto;
- manifest assente;
- mappe mancanti;
- contenuti GM appaiono nella player map.

---

## 14. Test E2E-10 — Multi-floor

### Procedura

1. Aprire `/generate`.
2. Scegliere multi-floor.
3. Generare almeno 3 piani.
4. Salvare come progetti collegati.
5. Aprire pagina floors del progetto.
6. Aprire ogni piano.
7. Verificare scale/stairs link.

### Risultati attesi

- ogni piano è progetto separato;
- `relatedProjectIds` collega gli altri piani;
- la pagina floors mostra tutti;
- ogni mappa è apribile/esportabile.

### Fallimento critico se

- alcuni piani non vengono salvati;
- link tra piani rotti;
- export funziona solo sul primo piano.

---

## 15. Test E2E-11 — AI Bridge manuale senza API

### Procedura

1. Aprire `/ai-bridge`.
2. Inserire prompt:

```txt
Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri. Usa asset locali disponibili e mantieni la mappa editabile.
```

3. Generare prompt packet.
4. Copiarlo in ChatGPT.
5. Incollare risposta JSON nel bridge.
6. Validare.
7. Importare come progetto.

### Risultati attesi

- il prompt packet contiene asset disponibili;
- la validazione intercetta errori JSON;
- repair locale aiuta a correggere problemi comuni;
- il progetto importato si apre in editor.

### Fallimento critico se

- il bridge inventa asset inesistenti senza avviso;
- JSON valido ma semantica rotta;
- import crea progetto inutilizzabile.

---

## 16. Test E2E-12 — Worker jobs lunghi

### Procedura

Da UI, dove disponibile, usare worker per:

- import pack;
- asset generate;
- AI plan opzionale;
- session pack.

Oppure via API worker:

```bash
curl -X POST http://127.0.0.1:8000/jobs/assets/scan \
  -H "Content-Type: application/json" \
  -d '{"folder":"local-assets/e2e-basic"}'
```

Poi controllare job:

```bash
curl http://127.0.0.1:8000/jobs
```

### Risultati attesi

- job passa da queued a running a completed;
- progress visibile;
- in caso errore, stdout/stderr sono utili;
- cancel funziona per job lunghi.

### Fallimento critico se

- job resta bloccato;
- errore senza messaggio;
- cancellazione non termina subprocess;
- worker perde stato al restart senza indicarlo.

---

# Template report manuale

Creare file:

```txt
docs/manual-test-reports/e2e-YYYY-MM-DD.md
```

Contenuto:

```md
# DM-Instamap Manual E2E Report

## Ambiente

- Data:
- Commit:
- OS:
- Node:
- pnpm:
- Python:
- Browser:
- Foundry/Roll20 version:

## Baseline

| Comando | Esito | Note |
|---|---|---|
| pnpm lint | PASS/FAIL | |
| pnpm test | PASS/FAIL | |
| pnpm build | PASS/FAIL | |
| worker test | PASS/FAIL | |

## Asset usati

- Pack/cartella:
- Numero asset:
- Formati:
- Reference maps:

## Test

| ID | Nome | Esito | Bug aperto | Note |
|---|---|---|---|---|
| E2E-01 | Import asset | PASS/FAIL | | |
| E2E-02 | References | PASS/FAIL | | |
| E2E-03 | Wizard | PASS/FAIL | | |
| E2E-04 | Editor | PASS/FAIL | | |
| E2E-05 | Snapshot | PASS/FAIL | | |
| E2E-06 | PNG/WEBP | PASS/FAIL | | |
| E2E-07 | dd2vtt | PASS/FAIL | | |
| E2E-08 | Foundry | PASS/FAIL | | |
| E2E-09 | Session Pack | PASS/FAIL | | |
| E2E-10 | Multi-floor | PASS/FAIL | | |
| E2E-11 | AI manual bridge | PASS/FAIL | | |
| E2E-12 | Worker jobs | PASS/FAIL | | |

## Bug critici

### Bug 1

- Descrizione:
- Passi per riprodurre:
- Risultato atteso:
- Risultato ottenuto:
- Log:
- Screenshot:
- Priorità:

## Giudizio finale

La build è utilizzabile per una sessione reale? Sì/No

Motivo:
```

---

# Ordine consigliato di esecuzione

Non fare tutto insieme. L’ordine migliore è:

```txt
Giorno 1
- Fase 0 baseline
- E2E-01 asset
- E2E-02 references
- E2E-03 wizard

Giorno 2
- E2E-04 editor
- E2E-05 snapshot
- E2E-06 PNG/WEBP

Giorno 3
- E2E-07 dd2vtt
- E2E-08 Foundry
- E2E-09 Session Pack

Giorno 4
- E2E-10 multi-floor
- E2E-11 AI bridge manuale
- E2E-12 worker jobs
```

---

# Criterio finale di maturità

DM-Instamap può essere considerato pronto per uso personale serio quando:

- `pnpm lint`, `pnpm test`, `pnpm build` passano;
- almeno una mappa viene creata da wizard;
- almeno una mappa viene modificata in editor e riaperta correttamente;
- snapshot/diff/restore funzionano;
- export PNG/WEBP mostra asset reali;
- export Foundry viene importato davvero;
- export dd2vtt viene importato davvero;
- Session Pack produce zip completo;
- AI manual bridge funziona senza API;
- worker gestisce job lunghi senza bloccare la UI;
- nessun dato GM finisce nella player map;
- il tool resta chiaramente locale e non esposto online.

---

# Priorità sintetica

| Priorità | Intervento | Perché |
|---|---|---|
| P0 | Separare browser/server entrypoints | Stabilizza build Next |
| P0 | Export raster asset-based | Rende le mappe davvero usabili |
| P0 | Test E2E manuali | Dimostra utilità reale |
| P1 | Migrazioni MapDocument | Protegge mappe future/vecchie |
| P1 | Sicurezza locale esplicita | Evita uso pericoloso online |
| P2 | Miglioramento generator | Aumenta qualità delle mappe |
| P2 | Test UI mirati | Riduce regressioni |

---

# Conclusione operativa

Non aggiungere nuove feature finché non sono chiuse queste tre cose:

```txt
1. pnpm build stabile
2. export con asset reali
3. almeno un test manuale completo Foundry/dd2vtt superato
```

Dopo questi tre punti, DM-Instamap smette di essere solo un progetto tecnicamente ambizioso e diventa un tool personale davvero utilizzabile per preparare sessioni D&D.


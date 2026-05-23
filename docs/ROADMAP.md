# DM-Instamap - Roadmap verso 9.5 e completezza

> **Stato: completata (2026-05-23).** Tutte le fasi A-M sono implementate,
> testate e documentate; gli obiettivi 9.5/10 e "feature-complete per uso DM
> personale" sono raggiunti. Questo documento resta come piano storico e
> riferimento delle Definition of Done. Le novita per fase sono riassunte in
> [CHANGELOG.md](../CHANGELOG.md).

## Premessa

Questa roadmap parte dalla baseline attuale, valutata circa **8/10** in una
analisi completa (architettura monorepo pulita, 315 test verdi tra TS e worker
Python, TypeScript `strict` + `noUncheckedIndexedAccess` con zero `any` nel
sorgente, repository senza dati locali tracciati, CI di base, documentazione per
modulo). Le fasi 0-10 della roadmap precedente
([docs/LEGACY_ROADMAP.md](LEGACY_ROADMAP.md)) sono considerate chiuse.

Obiettivo: portare il progetto a **9.5/10** e a uno stato "feature-complete"
per l'uso da DM personale, chiudendo le lacune residue di tooling, copertura,
modularita, giocabilita e onboarding.

Principi invariati (da [AGENTS.md](../AGENTS.md)):

- local-first, nessuna API a pagamento obbligatoria;
- ogni feature ha test;
- ogni mappa generata resta editabile;
- task piccoli, ogni fase si chiude con test e documentazione;
- tutto il testo UI resta in italiano, identificatori e docs tecniche in
  inglese.

## Lacune che questa roadmap chiude

Dall'analisi della baseline 8/10:

1. lo script `lint` e solo `tsc --noEmit`: manca un linter vero (ESLint/Biome) e
   un formatter; il worker Python ha solo `compileall`, senza ruff/mypy;
2. la CI non esegue gli E2E e non ha gate di coverage;
3. file molto grandi: `apps/web/src/hooks/use-map-editor-state.ts` (1121 righe),
   `packages/ai-bridge/src/index.ts` (1039), `packages/generator/src/algorithms.ts`
   (1006);
4. la copertura E2E e parziale (mancano undo/redo, copy/paste, Foundry,
   import-pack con fixture, multi-floor, campagne);
5. backup/restore locale non e documentato ne testato (era gia un requisito 9/10
   non soddisfatto nella roadmap precedente);
6. la validazione path non copre ancora ogni route file-system;
7. la giocabilita del generatore e misurata con metriche interne ma non
   verificata con invarianti "hard";
8. mancano audit di accessibilita, un onboarding "one-command" e governance di
   base (licenza, changelog, policy dipendenze).

## Comandi minimi di chiusura per ogni fase

```bash
pnpm format:check
pnpm lint           # ESLint/Biome (non piu solo tsc)
pnpm typecheck      # tsc --noEmit, separato dal lint
pnpm test
pnpm test:coverage
pnpm build
pnpm --filter @dm-instamap/worker lint   # ruff + mypy
pnpm --filter @dm-instamap/worker test
```

Se la fase tocca flussi UI:

```bash
pnpm test:e2e
```

---

## Fase A - Tooling di qualita reale

Priorita: P0

Obiettivo: separare lint, formattazione e typecheck e introdurre regole reali
su TypeScript e Python.

Task:

- introdurre un linter vero. Opzione consigliata: **Biome** (lint + format
  unico, veloce, una sola config) oppure **ESLint flat config** con
  `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-import` e
  `eslint-plugin-jsx-a11y` piu Prettier. Scegliere una sola strada e
  documentarla;
- rinominare gli script in ogni package: `typecheck` = `tsc --noEmit`, `lint` =
  linter scelto, `format` / `format:check` = formatter;
- aggiornare lo script root `lint` perche aggreghi il linter, non il typecheck;
- introdurre nel worker `ruff` (lint + format) e `mypy --strict`, con config
  tracciata in `apps/worker/pyproject.toml` o `ruff.toml`;
- correggere o sopprimere in modo esplicito i warning iniziali; nessuna regola
  disattivata silenziosamente;
- aggiungere una regola che impedisca la reintroduzione di `any`
  (`@typescript-eslint/no-explicit-any` o equivalente Biome).

Definition of Done:

- `pnpm lint`, `pnpm typecheck` e `pnpm format:check` sono comandi distinti e
  verdi;
- `pnpm --filter @dm-instamap/worker lint` esegue ruff + mypy ed e verde;
- nessun `any` nel sorgente non-test (gia vero oggi, ora reso impossibile da
  reintrodurre).

Test:

- `pnpm lint && pnpm typecheck && pnpm format:check`;
- ruff + mypy sul worker.

---

## Fase B - CI completa e gate di merge

Priorita: P0

Obiettivo: trasformare la CI da build base a vera rete di sicurezza pre-merge.

Task:

- aggiungere un job E2E Playwright in [.github/workflows/ci.yml](../.github/workflows/ci.yml)
  con cache dei browser;
- aggiungere copertura con `vitest --coverage` e soglie minime che fanno
  fallire la build (es. core/generator/exporters 80% righe, web lib 65%);
- aggiungere lint Python (ruff) e mypy al workflow;
- eseguire la pipeline su `ubuntu-latest` **e** `windows-latest`, dato che il
  target reale e Windows;
- separare gli step: `format:check`, `lint`, `typecheck`, `test:coverage`,
  `build`, `test:e2e`;
- documentare in `docs/` i required check e la branch protection consigliata su
  `main`.

Definition of Done:

- ogni PR esegue format + lint + typecheck + test + coverage + e2e su ubuntu e
  windows;
- il merge e bloccato se un gate e rosso o se la coverage scende sotto soglia;
- gli artifact e2e/coverage finiscono solo in cartelle ignorate.

Test:

- una PR di prova che deve risultare verde end-to-end.

---

## Fase C - Split dei moduli grandi e budget dimensione file

Priorita: P1

Obiettivo: ridurre la superficie di regressione e i re-render dei file piu
grandi rimasti dopo il refactor editor.

Task:

- spezzare [apps/web/src/hooks/use-map-editor-state.ts](../apps/web/src/hooks/use-map-editor-state.ts)
  in sotto-hook coesi: `useAssetSelection`, `useAssetClipboard`,
  `useNotesAndInitiative`, `useLightingTools`, lasciando `useMapEditorState`
  come sola composizione;
- spezzare [packages/ai-bridge/src/index.ts](../packages/ai-bridge/src/index.ts)
  separando provider, orchestrazione e costruzione prompt;
- spezzare [packages/generator/src/algorithms.ts](../packages/generator/src/algorithms.ts)
  un file per algoritmo (cave, village, multi-floor, outdoor) con un barrel;
- aggiungere un gate "nessun file applicativo oltre ~700 righe senza eccezione
  motivata" (regola `max-lines` o script di audit);
- stabilizzare i riferimenti tra closure dell'editor (useCallback dove serve)
  per ridurre i re-render.

Definition of Done:

- nessun file applicativo supera ~700 righe senza motivazione documentata;
- ogni sotto-hook estratto ha test dedicati;
- nessuna feature editor rimossa; e2e editor verde.

Test:

- unit test dei nuovi sotto-hook e moduli;
- Playwright editor flow.

---

## Fase D - Copertura E2E completa

Priorita: P1

Obiettivo: chiudere i flussi E2E ancora mancanti dalla Fase 2 originale.

Task:

- E2E undo/redo, copy/paste asset e group/ungroup nell'editor reale;
- E2E export Foundry (zip valido + toggle journal) e WEBP/PNG/dd2vtt/Session
  Pack se non gia coperti;
- E2E import-pack con una fixture asset minimale versionata (no asset
  personali);
- E2E multi-floor: creazione N piani e navigazione `/projects/[id]/floors`;
- E2E campagne: crea campagna, collega progetto, aggiungi sessione;
- E2E AI bridge con `AI_PROVIDER=mock` (nessuna chiamata esterna, nessuna
  chiave).

Definition of Done:

- tutti i flussi elencati nella Fase 2 originale sono coperti;
- gli E2E girano in CI (Fase B) e non dipendono da dati personali;
- ogni test isola e pulisce i propri dati temporanei.

Test:

- `pnpm test:e2e`.

---

## Fase E - Backup e restore locale

Priorita: P1

Obiettivo: soddisfare il requisito 9/10 mancante: dati locali con backup e
restore documentati.

Task:

- aggiungere `pnpm data:backup`: crea un archivio versionato di
  `data/projects/`, `data/campaigns/` e indici opzionali, con manifest e
  checksum;
- aggiungere `pnpm data:restore <archivio>` con `--dry-run`, verifica integrita
  (checksum) e gestione conflitti (nessuna sovrascrittura senza conferma);
- rifiutare path non sicuri riusando `validateLocalPath`;
- documentare in [docs/LOCAL_DATA.md](LOCAL_DATA.md): cosa includere, cosa
  escludere, rotazione e dove conservare i backup.

Definition of Done:

- round-trip testato: progetto -> backup -> wipe -> restore produce un documento
  identico per content hash;
- restore segnala chiaramente conflitti e file mancanti;
- `--dry-run` non scrive nulla.

Test:

- unit test backup/restore e CLI;
- E2E o test CLI sul round-trip.

---

## Fase F - Validazione path universale

Priorita: P1

Obiettivo: chiudere la coda della Fase 1 originale ("future routes" con input
file-system).

Task:

- audit di ogni route e handler web/worker che legge o scrive su disco: deve
  passare da [apps/web/src/lib/local-paths.ts](../apps/web/src/lib/local-paths.ts)
  o da un wrapper di workspace condiviso;
- estrarre la policy in un unico modulo/documento e allineare la semantica
  web<->worker;
- aggiungere un test di guardia che fallisce se una route file-system non usa
  il validator (lint custom o test che ispeziona gli handler).

Definition of Done:

- il 100% delle route file-system usa la stessa policy;
- esiste un test di guardia contro nuove route non validate;
- `DM_INSTAMAP_ALLOW_REMOTE=true` non rilassa la validazione path.

Test:

- unit test route/lib su valido, traversal, assoluto fuori workspace, drive
  root, system folder;
- test del worker;
- test di guardia.

---

## Fase G - Giocabilita verificata, non solo misurata

Priorita: P1

Obiettivo: passare da metriche interne a invarianti "hard" verificati su molte
seed.

Task:

- definire invarianti obbligatori per ogni mappa generata: ogni stanza
  raggiungibile (connettivita), nessun asset fuori dai muri, ogni porta tra due
  celle valide, scale multi-floor accoppiate e coerenti, nessun debug-tile
  nell'output finale;
- aggiungere property-based test (`fast-check`) che verificano gli invarianti su
  N seed casuali per ogni algoritmo;
- congelare un set di "golden map" riviste manualmente e considerate "strong";
- alzare le soglie del benchmark esistente da "usable" a "strong" dove
  possibile.

Definition of Done:

- invarianti verificati su almeno 200 seed per algoritmo;
- almeno 8 golden map classificate "strong";
- il gate benchmark e piu alto e resta verde.

Test:

- property-based test generator;
- snapshot/benchmark con soglie alzate;
- report manuale aggiornato in `docs/manual-test-reports/`.

---

## Fase H - Reference Style DNA con effetto reale sul layout

Priorita: P2

Obiettivo: far influenzare alla Style DNA non solo i tag ma anche la geometria.

Task:

- usare densita, grid e layout della Reference Style DNA per modulare dimensioni
  stanze, lunghezza corridoi e densita di arredamento;
- garantire un effetto deterministico: stessa seed con e senza DNA produce
  layout misurabilmente diversi e coerenti col riferimento.

Definition of Done:

- esiste un test che mostra una divergenza controllata tra output con e senza
  DNA;
- [docs/GENERATOR.md](GENERATOR.md) documenta come la DNA influenza il layout.

Test:

- unit test generator con e senza DNA a parita di seed.

---

## Fase I - Accessibilita e i18n completa

Priorita: P2

Obiettivo: rendere l'interfaccia accessibile e verificare che sia interamente in
italiano.

Task:

- audit accessibilita con `eslint-plugin-jsx-a11y` e un controllo `axe` dentro
  un E2E: focus order, ruoli ARIA, contrasto, label sui form, navigazione da
  tastiera dell'editor;
- aggiungere uno script che cerca stringhe UI hardcoded in inglese e fallisce se
  ne trova (la regola del progetto vuole UI in italiano);
- uniformare la gestione errori UI: empty state, error boundary, messaggi
  coerenti.

Definition of Done:

- l'audit `axe` non riporta violazioni critiche;
- nessuna stringa UI in inglese residua;
- le azioni principali dell'editor sono usabili da tastiera.

Test:

- E2E con audit `axe`;
- test dello script anti-stringhe-EN.

---

## Fase J - Onboarding e packaging "one-command"

Priorita: P2

Obiettivo: estendere la Fase 9 fino a un avvio davvero immediato su una macchina
nuova.

Task:

- aggiungere `pnpm setup` unico: install + `worker:install` + `doctor` +
  dataset demo opzionale;
- generare un dataset demo sintetico (asset placeholder generati, non binari
  reali) per provare scan -> genera -> edita -> esporta senza librerie
  personali;
- aggiungere un primo avvio guidato in UI: dallo stato vuoto si crea la demo;
- aggiungere un launcher locale che avvia web e worker insieme su `127.0.0.1`.

Definition of Done:

- da clone pulito: `pnpm setup` poi `pnpm start` porta a una mappa esportata in
  meno di 5 minuti senza asset personali;
- `pnpm doctor` resta la diagnosi unica dei problemi comuni.

Test:

- test dello script setup/launcher con env simulato;
- report manuale di setup aggiornato.

---

## Fase K - Performance su librerie grandi

Priorita: P2

Obiettivo: mantenere la UI fluida con librerie asset molto grandi.

Task:

- virtualizzare la palette/browser asset (liste lunghe) in
  [apps/web/src/components/assets/](../apps/web/src/components/assets/);
- rendere misurato il limite di hydration gia introdotto, con un test che simula
  N gruppi grandi;
- profilare i re-render dell'editor dopo lo split hook della Fase C.

Definition of Done:

- il browser asset resta fluido con almeno 5.000 asset (test/bench);
- nessun blocco UI percepibile in apertura editor con libreria grande.

Test:

- bench/test con dataset sintetico grande.

---

## Fase L - Hardening sicurezza locale e import

Priorita: P2

Obiettivo: rendere robusti i parser di import e gli export verso formati esterni.

Task:

- test di robustezza/fuzz sui parser di import (`dmimap`, `dd2vtt`, plan AI):
  input malformati non devono crashare e devono dare errori chiari;
- sanitizzare il testo di note e plan negli export Foundry journal (no HTML
  injection nei journal entry);
- aggiungere un'opzione di rate-limit o allowlist IP per il caso LAN consentito
  (`DM_INSTAMAP_ALLOW_REMOTE`).

Definition of Done:

- input rotti/malevoli producono errori gestiti, non crash;
- i journal Foundry sono sanitizzati;
- [docs/EXPORTS.md](EXPORTS.md) e la sezione sicurezza del README sono
  aggiornate.

Test:

- test parser su input malformati;
- test di sanitizzazione export journal.

---

## Fase M - Sostenibilita e governance

Priorita: P3

Obiettivo: rendere il progetto manutenibile nel tempo anche da soli.

Task:

- aggiungere `LICENSE` (anche per uso personale, esplicita i termini),
  `CHANGELOG.md` e brevi ADR in `docs/adr/`;
- definire una policy di aggiornamento dipendenze (Renovate/Dependabot
  opzionale, oppure checklist trimestrale);
- consolidare le soglie di coverage come gate stabile;
- aggiornare il README: nuovo punteggio e link a questa roadmap.

Definition of Done:

- il repo ha licenza, changelog e ADR di base;
- esiste una policy chiara per gli aggiornamenti;
- README coerente con lo stato attuale.

Test:

- verifica manuale dei file di governance;
- `pnpm test:coverage` resta sopra le soglie.

---

## Metriche di maturita 9.5

Il progetto puo essere considerato **9.5/10** quando:

- `lint` (ESLint/Biome), `typecheck` e `format:check` sono comandi distinti e
  verdi su TypeScript; `ruff` + `mypy` sono verdi sul worker;
- la CI esegue format + lint + typecheck + test + coverage + e2e su `ubuntu` e
  `windows`, con gate di coverage e branch protection su `main`;
- nessun file applicativo supera ~700 righe senza motivazione;
- gli E2E coprono editor (save/undo/redo/copy/paste), tutti gli export,
  import-pack, multi-floor, campagne e AI mock;
- ogni route file-system usa la stessa policy di path, con test di guardia;
- backup e restore locali sono documentati e testati con round-trip;
- gli invarianti di giocabilita sono verificati con property-based su molte seed
  e ci sono almeno 8 golden map "strong";
- l'audit di accessibilita non ha violazioni critiche e la UI e interamente in
  italiano;
- da clone pulito si arriva a una mappa esportata in pochi minuti senza asset
  personali.

## Definizione di "completo" (feature-complete per uso DM personale)

- generazione, editing ed export coprono i casi reali di sessione senza
  workaround manuali;
- la qualita delle mappe e verificata, non solo dichiarata;
- i dati locali sono protetti da backup/restore;
- l'onboarding e immediato e ripetibile;
- il codice e tipizzato, controllato dal linter, formattato, testato e coperto
  da CI;
- la documentazione e allineata al comportamento reale.

## Ordine consigliato

1. Fase A - tooling di qualita (fondamenta).
2. Fase B - CI completa con gate.
3. Fase F - validazione path universale e Fase D - E2E completi (chiudono i
   debiti P0/P1 aperti).
4. Fase C - split moduli grandi (prima di lavorare su performance).
5. Fase E - backup/restore e Fase G - giocabilita verificata (valore DM).
6. Fasi H, I, J in parallelo quando il nucleo e stabile.
7. Fasi K e L - performance e hardening.
8. Fase M - governance a chiusura.

## Prossima azione raccomandata

Partire dalla Fase A. Senza un linter e un formatter reali, ogni fase
successiva accumula debito di stile e di qualita non rilevato; con A e B in
piedi, tutte le fasi seguenti vengono protette automaticamente dalla CI.

# Politica di aggiornamento dipendenze

DM-Instamap e mantenuto da una sola persona, quindi la politica e volutamente
leggera: niente automazione che apra PR a sorpresa, ma una checklist ripetibile
da eseguire a cadenza regolare.

## Cadenza

- Revisione **trimestrale** delle dipendenze (TS e Python).
- Aggiornamenti di **sicurezza** appena noti, fuori cadenza.

## Checklist trimestrale

1. Controlla gli aggiornamenti disponibili:
   - JS/TS: `pnpm outdated -r`
   - Python: `pip list --outdated` nell'ambiente del worker.
2. Applica prima patch e minor; valuta i major uno alla volta leggendo il
   changelog upstream.
3. Aggiorna e riallinea il lockfile: `pnpm install`.
4. Esegui il gate completo prima di committare:
   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test:coverage
   pnpm build
   pnpm --filter @dm-instamap/worker lint
   pnpm --filter @dm-instamap/worker test
   pnpm test:e2e
   ```
5. Annota gli aggiornamenti rilevanti in [CHANGELOG.md](../CHANGELOG.md).

## Vincoli

- Restano validi i principi di progetto: nessuna API a pagamento obbligatoria,
  local-first, ogni feature con test (vedi [adr/0002-local-first-no-auth.md](adr/0002-local-first-no-auth.md)).
- Le versioni di Node, pnpm e Python sono fissate nei requisiti del README; un
  loro cambio e una decisione a se, da motivare in un ADR.

## Automazione opzionale

Se in futuro si vuole automatizzare, abilitare **Dependabot** o **Renovate** con
raggruppamento degli aggiornamenti minori e PR limitate. Resta opzionale: la
checklist manuale e sufficiente per un progetto a singolo manutentore.

# DM-Instamap - Report benchmark generatore

## Ambiente

- Data: 2026-05-22
- Branch: main
- Comando: `pnpm generator:benchmark`
- Sistema operativo: Microsoft Windows 11 Home
- Node: v24.x
- pnpm: 10.33.3

## Scopo

Misurare la qualita generativa su un set fisso di scenari deterministici
(Fase 5 della roadmap). Ogni scenario usa input/seed costanti, applica una
Style DNA e aggiunge note GM deterministiche per ruolo stanza prima dello
scoring. Le soglie sono codificate in `packages/generator/src/benchmark.ts`; il
test `tests/benchmark.test.ts` fallisce se la qualita scende sotto soglia o se
si discosta dalle sintesi salvate in `tests/fixtures/benchmark/`.

## Metriche

- Allineamento tema: stanze i cui tag includono il tema dello scenario.
- Varieta stanze: diversita di etichette e tipi di stanza.
- Densita elementi: porte, luci, note GM, asset e stanze speciali per stanza.
- Routing: connettivita e assenza di vicoli ciechi (dal core quality scorer).
- Leggibilita: bilanciamento spazio camminabile e utilita delle stanze.
- Affordance tattica: coperture e linee di vista spezzate.

## Risultati (run del 2026-05-22)

| Scenario | Dim | Stanze | Score | Rating | Tema | Varieta | Densita | Routing | Leggibilita | Tattica | Esito |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---|
| Cripta | 48x34 | 7 | 100 | strong | 100 | 87 | 100 | 100 | 100 | 100 | OK |
| Dungeon con boss | 52x36 | 8 | 100 | strong | 100 | 87 | 100 | 100 | 100 | 100 | OK |
| Rovina | 44x30 | 6 | 100 | strong | 100 | 87 | 100 | 100 | 100 | 100 | OK |
| Caverna | 48x34 | 1 | 76 | usable | 100 | 73 | 40 | 100 | 60 | 90 | OK |
| Villaggio | 48x34 | 6 | 99 | strong | 100 | 87 | 80 | 100 | 100 | 95 | OK |
| Accampamento | 46x32 | 2 | 73 | usable | 100 | 87 | 100 | 50 | 91 | 80 | OK |
| Taverna | 64x44 | 4 | 86 | strong | 100 | 72 | 100 | 100 | 49 | 100 | OK |

Esito complessivo: 7/7 scenari sopra soglia, 5 valutati "strong" e 2 "usable".

## Revisione manuale

- Cripta / Dungeon con boss / Rovina: layout a stanze rettangolari ben
  collegate, ingresso e boss/finale chiari, note GM per ruolo coerenti. Usabili
  al tavolo con rifinitura leggera.
- Villaggio: blocchi distinti e buona varieta; usabile.
- Taverna: dal blueprint edificio, ruoli sociali corretti; leggibilita piu
  bassa per la densita di stanze interne, comunque usabile.
- Caverna: forma organica con una sola "stanza" registrata; routing pieno ma
  densita bassa - va arredata prima della sessione.
- Accampamento: mappa aperta outdoor; routing piu basso atteso per la natura
  non a corridoi - usabile come scena di transito.

Almeno 5 mappe (cripta, dungeon, rovina, villaggio, taverna) sono giudicate
pronte all'uso dopo revisione manuale, soddisfacendo la Definition of Done.

## Come rigenerare

```bash
pnpm generator:benchmark            # stampa la tabella ed esce non-zero se sotto soglia
pnpm generator:benchmark -- --write # riscrive le sintesi in packages/generator/tests/fixtures/benchmark
pnpm --filter @dm-instamap/generator test
```

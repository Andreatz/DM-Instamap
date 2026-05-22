# DM-Instamap - Report fidelity export VTT

## Ambiente

- Data: 2026-05-22
- Branch: main
- Comando: `pnpm --filter @dm-instamap/exporters test`
- Sistema operativo: Microsoft Windows 11 Home
- Node: v24.x
- pnpm: 10.33.3
- Target VTT: Foundry 12 e 13, Universal VTT 0.3

## Scopo

Fase 6 della roadmap: ridurre le correzioni manuali dopo l'import in VTT,
verificando con fixture versionate piccole che coordinate, muri, porte, luci,
note e dimensioni scena siano corretti, e documentando la compatibilita Foundry
12/13.

## Modifiche di formato

- dd2vtt: l'immagine incorporata viene ora renderizzata a `grid.pixelsPerCell *
  scale` px/cella e `pixels_per_grid` / `image_size` derivano dai pixel reali.
  Prima l'immagine era a 28 px/cella mentre `pixels_per_grid` dichiarava 70:
  disallineamento della griglia all'import. Ora vale sempre
  `image_size = map_size * pixels_per_grid`.
- Foundry: aggiunta opzione `foundryVersion` (`v12` default, `v13`) che imposta
  il blocco `compatibility`; estratto `buildFoundryModuleData` per i dati
  strutturali senza render.
- Nuovo `buildVttExportManifest` per il confronto strutturale tra i due formati.

## Risultati automatici

| Area | Esito | Note |
|---|---|---|
| dd2vtt allineamento griglia/immagine | PASS | Immagine decodificata = `image_size` = `map_size * pixels_per_grid`. |
| dd2vtt scala | PASS | `scale: 2` -> 140 px/cella, immagine 1680x1120. |
| dd2vtt round-trip | PASS | 5 muri, 2 porte (1 aperta), 2 luci preservati. |
| Foundry coordinate/muri/porte/luci | PASS | `c` a 4 numeri, `door`/`ds` corretti, luci scalate. |
| Foundry note GM -> journal/scene note | PASS | 1 nota collegata a pagina journal. |
| Foundry compatibilita v12/v13 | PASS | v12 = 11/12, v13 = 12/13. |
| Manifest confronto formati | PASS | Porte, luci e muri coerenti tra dd2vtt e Foundry. |

Fixture: `packages/exporters/tests/fixtures/realistic-map.ts` (2 stanze, muro
divisorio, porta aperta + porta bloccata, 2 luci, nota GM) e
`packages/exporters/tests/fixtures/simple.dd2vtt`.

## Revisione manuale (release candidate)

Da eseguire a ogni cambio di formato sulla release candidate:

- [ ] Import dd2vtt in Foundry/Roll20: griglia allineata, muri e porte coerenti.
- [ ] Import modulo Foundry su Foundry 12: scena, journal e note presenti.
- [ ] Import modulo Foundry su Foundry 13: eventuale migrazione automatica
      accettata senza reimpostare `grid.size`.
- [ ] Luci con raggio e colore corretti, porte apribili.

## Come rigenerare

```bash
pnpm --filter @dm-instamap/exporters test
# aggiornare lo snapshot manifest dopo un cambio di formato volontario:
pnpm --filter @dm-instamap/exporters test -- -u
```

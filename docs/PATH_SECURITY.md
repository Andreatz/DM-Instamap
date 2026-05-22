# Validazione path e accesso al filesystem

Questo documento descrive la policy unica con cui DM-Instamap valida ogni
accesso al filesystem (Fase F della [roadmap](ROADMAP.md)). Lo scopo e impedire
path traversal e accessi a cartelle ampie o di sistema, mantenendo l'app
local-first.

## Moduli di policy

- **Web**: [apps/web/src/lib/local-paths.ts](../apps/web/src/lib/local-paths.ts)
- **Worker**: [apps/worker/src/dm_instamap_worker/security.py](../apps/worker/src/dm_instamap_worker/security.py)

Ogni route/handler che legge o scrive su disco deve passare da uno di questi
moduli (direttamente o tramite una libreria che li usa).

## Primitive (web)

| Funzione | Quando usarla |
| --- | --- |
| `validateLocalPath({ inputPath, workspaceRoot, ... })` | Path **forniti dall'utente** (es. cartella di un pack da importare, immagine per la ricerca visuale). |
| `assertSafeWorkspaceId(id, label)` | Id usati come **segmento di path** (project/campaign/asset/reference id). Rifiuta separatori, `..`, dot iniziale, byte nulli. |
| `resolveWithinWorkspace(workspaceRoot, ...segmenti)` | Costruzione di path **interni** sotto il workspace (preview, indici). Garantisce che il risultato resti dentro il workspace. |
| `findWorkspaceRoot(cwd)` | Risoluzione della root del workspace. |

I validatori di dominio si appoggiano alla policy condivisa:
`assertSafeProjectId` (projects) e `isSafeCampaignId` (campaigns) chiamano
`assertSafeWorkspaceId` prima di applicare la propria regola di slug.

## Invarianti applicati

Validi sia per web sia per worker:

1. **Path relativi**: risolti sotto la workspace root; se escono (`..`) vengono
   rifiutati.
2. **Cartelle ampie o di sistema**: home, root del disco/anchor,
   `Windows`/`Program Files` (Windows), `/`, `/bin`, `/etc`, `/proc`, ... (POSIX)
   sono sempre rifiutate.
3. **Id come segmento**: devono essere segmenti singoli sicuri (niente
   separatori o traversal).
4. **Path interni**: costruiti con `resolveWithinWorkspace`, non possono uscire
   dal workspace nemmeno per errore.

### Differenza intenzionale web vs worker

I **path assoluti** fuori dal workspace:

- nel **web** sono rifiutati salvo opt-in esplicito
  (`allowAbsoluteOutsideWorkspace: true`, usato solo dall'import-pack);
- nel **worker** sono ammessi se non broad/system, perche il worker scansiona
  librerie asset locali che vivono fuori dal repo (e il suo scopo).

In entrambi i casi le cartelle broad/system restano vietate.

## DM_INSTAMAP_ALLOW_REMOTE non rilassa la validazione

`DM_INSTAMAP_ALLOW_REMOTE=true` abilita solo l'accesso da host non-locale (LAN):

- web: [apps/web/src/lib/local-security.ts](../apps/web/src/lib/local-security.ts) (`shouldBlockRemoteRequest`) e il proxy;
- worker: `remote_access_allowed()` usato solo da `reject_remote_requests`.

La validazione dei path (`validateLocalPath` / `validate_local_path`) **non**
consulta questa variabile: traversal e cartelle di sistema restano rifiutati
anche con `ALLOW_REMOTE=true`. Coperto dal test
`AllowRemoteIndependenceTests` nel worker.

## Test di guardia

- **Web**: [apps/web/src/lib/fs-route-policy.test.ts](../apps/web/src/lib/fs-route-policy.test.ts)
  ispeziona ogni `route.ts`: se importa `node:fs`/`node:fs/promises` deve anche
  usare la policy (`@/lib/local-paths`). Fallisce se una nuova route legge/scrive
  su disco senza validare.
- **Web unit**: [apps/web/src/lib/local-paths.test.ts](../apps/web/src/lib/local-paths.test.ts)
  (valido, traversal, assoluto fuori workspace, drive root, system folder, id e
  resolve).
- **Worker**: [apps/worker/tests/test_security.py](../apps/worker/tests/test_security.py).

## Aggiungere una nuova route che tocca il filesystem

1. Se accetta un path dall'utente: passa da `validateLocalPath` (web) o
   `validate_local_path` (worker).
2. Se costruisce path da un id: valida l'id con `assertSafeWorkspaceId` e
   componi con `resolveWithinWorkspace`.
3. Non importare `node:fs` in una route senza usare la policy: il guard test
   fallirebbe.

# Windows Setup

Percorso rapido local-first per una nuova macchina Windows. Per una panoramica
del progetto parti da [../README.md](../README.md).

## Requisiti

- Node.js 24 o superiore.
- pnpm 10 o superiore.
- Python 3.12 o superiore quando usi il worker.
- Git.

## Installazione

```powershell
pnpm install
pnpm worker:install
pnpm doctor
```

Copia il template locale solo quando servono override specifici della macchina:

```powershell
Copy-Item .env.local.example .env.local
```

Lascia vuote le variabili AI per la modalita local-first/manuale.

## Diagnosi

```powershell
pnpm doctor
```

Il doctor controlla Node, pnpm, Python, requisiti worker, Sharp, template env e
porte predefinite web/worker.

I warning sono spesso recuperabili. Le failure vanno sistemate prima di
importare un pack asset grande.

## Avvio

Terminale 1:

```powershell
pnpm dev
```

Terminale 2, solo quando usi il worker per job lunghi:

```powershell
pnpm worker:dev
```

Apri:

```txt
http://127.0.0.1:3000
```

## Primo Import Asset

Metti pack personali o con licenza fuori dai file tracciati da Git, ad esempio
sotto `local-assets/`, poi esegui:

```powershell
pnpm assets:scan .\local-assets
pnpm assets:group
pnpm assets:audit
```

Indici e preview generati vivono sotto `data/` e sono ignorati da Git.

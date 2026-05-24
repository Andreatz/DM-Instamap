# ROADMAP CODEX — Asset Taxonomy & Dungeondraft Tags Integration for DM-Instamap

## Obiettivo

Integrare nel progetto **DM-Instamap** la tassonomia asset già costruita dai file `.dungeondraft_tags`, senza riclassificare da zero i circa 34k asset.

La pipeline deve usare i tag Dungeondraft come **fonte primaria**, conservarli, normalizzarli in una tassonomia multilivello e renderli interrogabili dal generatore mappe.

Il risultato finale deve permettere al generatore di cercare asset con query precise come:

```ts
findAssets({
  macroCategory: "furniture",
  assetGroups: ["table", "dining"],
  themeTags: ["tavern", "wood"],
  status: "approved"
});
```

Non bisogna appiattire tutto in categorie generiche. La struttura corretta è:

```txt
sourceTags originali -> sourcePacks -> macroCategory -> assetGroups -> assetSubGroups -> themeTags -> placementTags -> usageRules
```

---

## File generati da importare

Sono stati generati questi file v3:

```txt
dm_instamap_tag_audit_report_v3.md
dm_instamap_merged_dungeondraft_tags_v3.json
dm_instamap_taxonomy_merged_v3.json
dm_instamap_asset_manifest_from_tags_v3.json
dm_instamap_tags_taxonomy_bundle_v3.zip
```

### Dove metterli nel repository

Creare questa struttura:

```txt
data/
  assets/
    imports/
      dm_instamap_merged_dungeondraft_tags_v3.json
    taxonomy/
      dm_instamap_taxonomy_merged_v3.json
    manifests/
      dm_instamap_asset_manifest_from_tags_v3.json
    reports/
      dm_instamap_tag_audit_report_v3.md
    overrides/
      asset-overrides.json
```

Il file `dm_instamap_asset_manifest_from_tags_v3.json` può essere usato subito come manifest iniziale, ma l'obiettivo è arrivare a generarlo con script ripetibili.

---

## Decisione importante su `VM`

Molti degli ultimi tag/path hanno la dicitura `VM`.

Decisione definitiva:

```txt
VM va mantenuto nei dati originali.
VM NON va usato come gruppo semantico normalizzato.
```

Quindi:

```json
{
  "sourceTags": [".VM Table", ".VM Tavern"],
  "sourcePacks": ["VM"],
  "assetGroups": ["table", "tavern"]
}
```

Non fare questo:

```json
{
  "assetGroups": ["vm-table", "vm-tavern"]
}
```

Motivo: `VM` sembra un prefisso pack/vendor, non una categoria utile per il generatore. Va preservato per tracciabilità, deduplica e debug, ma rimosso dai gruppi semantici.

---

## Stato dati v3

La versione v3 contiene:

```txt
File tag analizzati: 47
Tag sorgente unici: 323
Asset/path unici: 34.026
Associazioni tag->asset deduplicate: 59.159
Asset con più tag: 18.889
Asset collegati a VM: 22.079
Light sospette dopo regole anti-carpet/rug/runner/banner: 0
```

Distribuzione macro-categorie v3:

```txt
prop: 10.261
terrain: 9.972
furniture: 3.529
floor: 2.205
decoration: 2.117
water: 1.421
wall: 1.231
light: 763
token: 708
unknown: 701
roof: 545
door: 381
window: 192
```

Gli `unknown` devono rimanere `needs-review` finché non vengono gestiti da override manuale o nuove regole di mapping.

---

## Principio tecnico

Non riclassificare tutto da zero.

Fare invece:

```txt
1. importare i tag Dungeondraft
2. deduplicare tag/path
3. normalizzare sourceTags in tassonomia multilivello
4. preservare sourceTags originali
5. estrarre sourcePacks come VM
6. arricchire con metadata file reali
7. validare anomalie
8. generare asset-manifest.json
9. collegare manifest al generatore mappe
```

---

## Schema finale asset

Ogni asset nel manifest finale deve avere questo schema logico:

```ts
type AssetManifestItem = {
  id: string;
  path: string;
  sourceTags: string[];
  sourcePacks: string[];

  macroCategory:
    | "floor"
    | "wall"
    | "door"
    | "window"
    | "furniture"
    | "prop"
    | "decoration"
    | "light"
    | "terrain"
    | "water"
    | "roof"
    | "token"
    | "unknown";

  assetGroups: string[];
  assetSubGroups: string[];
  themeTags: string[];
  placementTags: string[];

  usageRules: {
    preferredMapTypes: string[];
    preferredRooms: string[];
    avoidMapTypes: string[];
    avoidRooms: string[];
    canBeLightEmitter: boolean;
    canBeFloorOverlay: boolean;
    canBeWallMounted: boolean;
    canBeCenterpiece: boolean;
  };

  metadata: {
    width?: number;
    height?: number;
    aspectRatio?: number;
    hasTransparency?: boolean;
    fileSize?: number;
    extension?: string;
    hash?: string;
    perceptualHash?: string;
  };

  qualityFlags: string[];
  status: "approved" | "needs-review" | "quarantine" | "rejected";
};
```

---

## Regole di mapping fondamentali

### MacroCategory

Le macro-categorie servono al motore, non devono sostituire i gruppi specifici.

Esempi:

```txt
.Table, .Chair, .Desk, .Dining, .Barrel, .Crate, .Storage -> furniture
.Carpet, .Rug, .Banner, .Art, .Pillar, .Decor, .Rubble -> decoration
.Lighting, .Fire, .Torch, .Candle, .Lantern -> light
.Floor, .Texture, .Path -> floor oppure terrain, secondo assetGroup
.Wall -> wall
.Door, .Gate, .Hatch -> door
.Window, .Windows, .Shutter -> window
.Roof -> roof
.River, .Water, .Sea, .Lake, .Seaflora -> water oppure terrain+water
.Cave, .Rock, .Mountain, .Hills, .Tree, .Trees, .Plant, .Mushroom -> terrain
.Creature -> token
.Ship, .Boat, .Cart, .Airship, .Mechanism, .Gears, .Tools, .Treasure, .Weapon, .Armor -> prop
```

### Regole anti-errore obbligatorie

Queste regole devono avere priorità più alta del mapping generico:

```txt
carpet, rug, runner, tapestry, banner -> decoration
carpet/rug/runner/tapestry/banner NON devono mai essere light
red-carpet NON deve mai essere light
```

Se un asset ha sourceTag `.Lighting` ma filename/path contiene `carpet`, `rug`, `runner`, `tapestry` o `banner`, forzare:

```json
{
  "macroCategory": "decoration",
  "assetGroups": ["carpet"],
  "usageRules": {
    "canBeLightEmitter": false,
    "canBeFloorOverlay": true
  }
}
```

### Regole VM

Normalizzare così:

```txt
VM_Table -> sourcePacks: ["VM"], assetGroups: ["table"]
VM Rocks -> sourcePacks: ["VM"], assetGroups: ["rock"]
VM_Tavern -> sourcePacks: ["VM"], themeTags: ["tavern"]
```

Non creare gruppi `vm_table`, `vm_rocks`, `vm_tavern`.

---

## Comandi da implementare

Aggiungere script al `package.json` root:

```json
{
  "scripts": {
    "assets:import-tags": "tsx scripts/assets/import-dungeondraft-tags.ts",
    "assets:map-taxonomy": "tsx scripts/assets/map-taxonomy.ts",
    "assets:metadata": "tsx scripts/assets/enrich-metadata.ts",
    "assets:audit": "tsx scripts/assets/audit-manifest.ts",
    "assets:manifest": "tsx scripts/assets/build-manifest.ts",
    "assets:contact-sheets": "tsx scripts/assets/contact-sheets.ts",
    "assets:validate": "tsx scripts/assets/validate-manifest.ts"
  }
}
```

### 1. `pnpm assets:import-tags`

Input:

```bash
pnpm assets:import-tags -- "path/to/default.dungeondraft_tags"
```

Deve anche supportare cartelle:

```bash
pnpm assets:import-tags -- "assets/**/*.dungeondraft_tags"
```

Requisiti:

- parser permissivo per trailing comma
- deduplica per `sourceTag + path`
- preserva sourceTags originali
- produce `data/assets/imports/imported-tags.json`

Output minimo:

```json
{
  "sourceFiles": [],
  "tags": {
    ".Table": ["path/a.png", "path/b.png"]
  },
  "assets": {
    "path/a.png": {
      "sourceTags": [".Table"]
    }
  }
}
```

### 2. `pnpm assets:map-taxonomy`

Input:

```txt
data/assets/imports/imported-tags.json
```

Output:

```txt
data/assets/taxonomy/asset-taxonomy.json
data/assets/manifests/mapped-assets.json
```

Deve applicare:

- mapping tag -> macroCategory
- mapping tag -> assetGroups
- extraction sourcePacks, incluso VM
- filename/path rules
- anti-light rules
- status iniziale

Status iniziale:

```txt
approved: mapping chiaro
needs-review: unknown, multi-category conflittuale, metadata mancante
quarantine: file sospetto/corrotto/anomalia grave
rejected: solo via override manuale
```

### 3. `pnpm assets:metadata`

Input:

```txt
data/assets/manifests/mapped-assets.json
```

Output:

```txt
data/assets/manifests/mapped-assets.with-metadata.json
```

Deve aggiungere:

```txt
width
height
aspectRatio
hasTransparency
fileSize
extension
hash
```

Usare librerie locali come `sharp` se disponibile.

Non cambiare classificazione, salvo segnare `qualityFlags`.

### 4. `pnpm assets:audit`

Output:

```txt
data/assets/reports/audit-report.json
data/assets/reports/audit-report.md
```

Controlli obbligatori:

```txt
- file mancanti
- asset corrotti
- asset unknown
- asset senza sourceTags
- duplicati path
- light sospette
- carpet/rug/runner/banner classificati come light
- asset con category conflict
- asset molto piccoli
- furniture/prop/light senza trasparenza se sospetto
- path con VM non marcato sourcePacks VM
```

Il report deve mostrare conteggi e primi esempi.

### 5. `pnpm assets:manifest`

Output finale:

```txt
data/assets/asset-manifest.json
```

Questo è il file che il generatore deve usare.

Non usare più direttamente i tag Dungeondraft nel generatore.

### 6. `pnpm assets:validate`

Deve fallire con exit code diverso da zero se:

```txt
- esiste light con carpet/rug/runner/tapestry/banner nel path
- unknown > soglia configurabile
- mancano categorie fondamentali: floor, wall, furniture, light, decoration, terrain
- manifest vuoto
- asset senza id o path
- duplicati id
```

### 7. `pnpm assets:contact-sheets`

Generare contact sheet solo per anomalie:

```txt
unknown
needs-review
suspicious-light
multi-category
low-quality
missing-metadata
```

Non generare contact sheet per tutti i 34k asset salvo flag esplicito.

Esempio:

```bash
pnpm assets:contact-sheets -- --only needs-review,unknown,suspicious-light
```

Output:

```txt
data/assets/contact-sheets/unknown/page-001.png
data/assets/contact-sheets/suspicious-light/page-001.png
```

Ogni thumbnail deve mostrare:

```txt
id
macroCategory
assetGroups
sourceTags principali
```

---

## Override manuali

Creare:

```txt
data/assets/overrides/asset-overrides.json
```

Schema:

```json
{
  "assets": {
    "textures/objects/red_carpet_01.png": {
      "macroCategory": "decoration",
      "assetGroups": ["carpet", "runner"],
      "themeTags": ["tavern", "noble"],
      "placementTags": ["floor", "corridor"],
      "usageRules": {
        "canBeLightEmitter": false,
        "canBeFloorOverlay": true
      },
      "status": "approved"
    }
  },
  "groups": {
    ".Table": {
      "macroCategory": "furniture",
      "themeTags": ["tavern", "interior", "wood"],
      "placementTags": ["room_center", "near_chairs"]
    }
  },
  "packs": {
    "VM": {
      "preserveAsSourcePack": true,
      "stripFromNormalizedGroups": true
    }
  }
}
```

Gli override devono essere applicati dopo il mapping automatico e prima della validazione.

---

## Integrazione nel generatore

Creare o aggiornare una funzione di query asset:

```ts
type FindAssetsQuery = {
  macroCategory?: string | string[];
  assetGroups?: string[];
  assetSubGroups?: string[];
  themeTags?: string[];
  placementTags?: string[];
  preferredMapType?: string;
  preferredRoom?: string;
  status?: "approved" | "needs-review" | "quarantine" | "rejected";
  sourcePacks?: string[];
  excludeSourcePacks?: string[];
  limit?: number;
};

function findAssets(query: FindAssetsQuery): AssetManifestItem[];
```

Scoring consigliato:

```txt
+10 macroCategory match
+7 assetGroups match
+4 themeTags match
+4 placementTags match
+3 preferredMapTypes/preferredRooms match
-10 avoidMapTypes/avoidRooms match
-100 status rejected/quarantine
-100 light suspicious
```

Il generatore deve usare solo:

```txt
status: approved
```

Opzionalmente può usare `needs-review` solo in modalità debug.

---

## Caso test: locanda su palafitte

Per il prompt:

```txt
Genera una locanda fantasy su palafitte sopra l'acqua, con due sale di legno collegate da pontili, tavoli, sedie, barili, tappeti, lanterne e dettagli da taverna.
```

Il generatore deve cercare asset con:

```txt
macroCategory: furniture
assetGroups: table, chair, bench, barrel, crate, dining, storage

themeTags: tavern, wood, dock, water, interior

macroCategory: decoration
assetGroups: carpet, rug, banner, art, clutter

macroCategory: light
assetGroups: lighting, fire, lantern, torch, candle

macroCategory: terrain/prop/water
assetGroups: bridge, wood, ship, boat, river, water, dock, path
```

Non deve usare:

```txt
carpet/rug/runner come light
VM come assetGroup normalizzato
unknown in modalità produzione
```

---

## Test da aggiungere

Creare test unitari per:

```txt
1. import parser con trailing comma
2. deduplica sourceTag+path
3. mapping .Table -> furniture/table
4. mapping .Lighting -> light/lighting
5. carpet/rug/runner anche con .Lighting -> decoration, non light
6. VM_Table -> sourcePacks VM + assetGroups table
7. unknown -> needs-review
8. validate fallisce se carpet è light
9. findAssets restituisce solo approved per default
10. locanda su palafitte sceglie preset/tags coerenti tavern/wood/dock/water
```

---

## Documentazione da creare

Aggiungere:

```txt
docs/ASSET_TAXONOMY.md
docs/ASSET_TAG_IMPORT.md
```

`docs/ASSET_TAXONOMY.md` deve spiegare:

```txt
- differenza tra sourceTags e assetGroups
- perché VM viene preservato come sourcePack
- perché macroCategory non sostituisce i gruppi specifici
- regole anti-light per carpet/rug/runner/banner
- schema manifest
- esempi query findAssets
```

`docs/ASSET_TAG_IMPORT.md` deve spiegare:

```txt
- come importare nuovi .dungeondraft_tags
- comandi da lanciare
- dove finiscono i file generati
- come leggere audit report
- come aggiungere override manuali
- come rigenerare il manifest finale
```

---

## Ordine operativo per Codex

Procedere in questo ordine:

```txt
1. Creare branch dedicato: feature/asset-taxonomy-pipeline
2. Aggiungere directory data/assets/* con .gitkeep dove necessario
3. Aggiungere schema TypeScript per AssetManifestItem
4. Implementare parser Dungeondraft permissivo
5. Implementare mapping taxonomy multilivello
6. Implementare regole VM
7. Implementare regole anti-carpet/rug/runner/banner light
8. Implementare override manuali
9. Implementare metadata enrichment
10. Implementare audit + validate
11. Implementare findAssets()
12. Collegare generatore a asset-manifest.json
13. Aggiungere test unitari
14. Aggiungere documentazione
15. Eseguire pnpm typecheck, pnpm test, pnpm build
```

---

## Comandi finali attesi

Dopo implementazione, il workflow deve essere:

```bash
pnpm assets:import-tags -- "assets/**/*.dungeondraft_tags"
pnpm assets:map-taxonomy
pnpm assets:metadata
pnpm assets:audit
pnpm assets:manifest
pnpm assets:validate
pnpm assets:contact-sheets -- --only unknown,needs-review,suspicious-light
```

Poi:

```bash
pnpm test
pnpm typecheck
pnpm build
```

---

## Criteri di accettazione finali

La feature è completa quando:

```txt
- i tag Dungeondraft sono importati senza perdere sourceTags
- VM è preservato come sourcePack ma rimosso dai gruppi normalizzati
- il manifest è multilivello, non piatto
- assetGroups specifici sono mantenuti
- carpet/rug/runner/banner non risultano mai light
- unknown restano needs-review
- il generatore usa asset-manifest.json
- findAssets supporta macroCategory, assetGroups, themeTags, placementTags, sourcePacks
- la locanda su palafitte pesca asset tavern/wood/dock/water coerenti
- pnpm test/typecheck/build passano
```

---

## Nota finale

Questa roadmap non chiede di rifare la classificazione degli asset da zero. La classificazione esiste già nei file Dungeondraft; il lavoro di Codex è trasformarla in un sistema robusto, validato e usabile dal generatore di mappe.

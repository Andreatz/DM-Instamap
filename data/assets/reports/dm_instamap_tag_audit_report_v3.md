# DM-Instamap — Audit tag Dungeondraft v3

## Sintesi

- File tag analizzati: **47**
- File precedenti considerati: **33**
- Nuovi file aggiunti: **14**
- Tag sorgente unici totali: **323**
- Nuovi tag sorgente rispetto alla v2: **190**
- Asset/path unici totali: **34026**
- Nuovi asset/path rispetto alla v2: **22079**
- Associazioni tag→asset deduplicate: **59159**
- Asset con più tag: **18889**
- Asset collegati a pack/tag VM: **22079**
- Light sospette rimaste dopo le regole anti carpet/rug/runner/banner: **0**

## Decisione sulla dicitura `VM`

Ho scelto di **non eliminarla dai dati originali**, ma di **non usarla come categoria semantica**.

Regola applicata:

```txt
sourceTags originali: mantenuti, es. "VM Tavern", "VM Buildings", "VM Lights"
path originale: mantenuto invariato
sourcePacks: ["VM"] quando il tag o il path contiene VM
assetGroups/themeTags normalizzati: senza prefisso VM
```

Motivo: `VM` sembra un prefisso di pack/vendor, non una categoria utile al generatore. Se lo lasci dentro `assetGroups`, il motore rischia di cercare gruppi tipo `vm-tavern`, `vm-buildings`, `vm-rocks` invece di `tavern`, `buildings`, `rock`. Però conviene conservarlo in `sourcePacks` per provenienza, filtri e debugging.

## Nuovi tag aggiunti rispetto alla v2

```txt
Debris, Destroyed Flooring, Floor Elements, Furniture, VM 45' Roofs, VM Academy, VM Adventure - Lost Mine of Phandelver, VM Adventure 1 - Curse of Strahd, VM Airship Accessories, VM Airship Assets, VM Airship Misc Parts, VM Airship Structure, VM Ancestral, VM Apothecary, VM Assets, VM Beds, VM Blacksmith, VM Bones, VM Building Clusters, VM Buildings, VM Buildings (Misc), VM Buildings (Normal), VM Buildings (Premade), VM Buildings of Interest, VM Bushes, VM Cacti, VM Campsite, VM Canyon, VM Cartography, VM Castle, VM Cave, VM Chase, VM Circular Roofs, VM City, VM City Walls, VM Cliffsides, VM Coin Piles, VM Combat, VM Combined Roofs, VM Community 5 Year, VM Community 6 Year, VM Community Pack, VM Coral, VM Corpses, VM Crops, VM Crystals, VM Cult, VM Decks, VM Desert, VM Desert Ground, VM Destroyed, VM Destroyed Assets, VM Dishes + Tables, VM Docks, VM Duergar Buildings, VM Dungeon, VM Dungeon Assets, VM Dungeon Entrances, VM Dungeon Tiles, VM Elemental Assets, VM Extension Roofs, VM Farm, VM Festival, VM Feywild, VM Flags, VM Flagstones, VM Floor Treatments, VM Flowers, VM Foliage, VM Food, VM Forest, VM Furniture, VM Garden, VM General Assets, VM General Items, VM Glowing Crystals, VM Graves, VM Graveyard, VM Grime, VM Ground Textures ...
```

## Macro categorie generate

| Macro categoria | Asset |
|---|---:|
| decoration | 2117 |
| door | 381 |
| floor | 2205 |
| furniture | 3529 |
| light | 763 |
| prop | 10261 |
| roof | 545 |
| terrain | 9972 |
| token | 708 |
| unknown | 701 |
| wall | 1231 |
| water | 1421 |
| window | 192 |

## Stato revisione automatico

| Stato | Asset |
|---|---:|
| approved | 33325 |
| needs-review | 701 |

## Esempi tag VM normalizzati

```txt
VM 45' Roofs, VM Academy, VM Adventure - Lost Mine of Phandelver, VM Adventure 1 - Curse of Strahd, VM Airship Accessories, VM Airship Assets, VM Airship Misc Parts, VM Airship Structure, VM Ancestral, VM Apothecary, VM Assets, VM Beds, VM Blacksmith, VM Bones, VM Building Clusters, VM Buildings, VM Buildings (Misc), VM Buildings (Normal), VM Buildings (Premade), VM Buildings of Interest, VM Bushes, VM Cacti, VM Campsite, VM Canyon, VM Cartography, VM Castle, VM Cave, VM Chase, VM Circular Roofs, VM City, VM City Walls, VM Cliffsides, VM Coin Piles, VM Combat, VM Combined Roofs, VM Community 5 Year, VM Community 6 Year, VM Community Pack, VM Coral, VM Corpses, VM Crops, VM Crystals, VM Cult, VM Decks, VM Desert, VM Desert Ground, VM Destroyed, VM Destroyed Assets, VM Dishes + Tables, VM Docks, VM Duergar Buildings, VM Dungeon, VM Dungeon Assets, VM Dungeon Entrances, VM Dungeon Tiles, VM Elemental Assets, VM Extension Roofs, VM Farm, VM Festival, VM Feywild ...
```

## Regole anti-errore confermate

- `carpet`, `rug`, `runner`, `tapestry`, `banner` vengono forzati a `decoration`.
- Anche se arrivano da tag collegati alla luce, non diventano `light`.
- Il tag `Colorable` viene mantenuto come `themeTags: ["colorable"]`, non come macro categoria.
- `VM` viene mantenuto come `sourcePacks: ["VM"]` e rimosso dai gruppi semantici.

## Output prodotti

- `dm_instamap_merged_dungeondraft_tags_v3.json`
- `dm_instamap_taxonomy_merged_v3.json`
- `dm_instamap_asset_manifest_from_tags_v3.json`
- `dm_instamap_tag_audit_report_v3.md`
- `dm_instamap_tags_taxonomy_bundle_v3.zip`

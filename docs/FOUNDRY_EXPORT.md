# Foundry VTT Export

`packages/exporters` can generate a Foundry VTT module zip from a `MapDocument`.

Entry point:

```ts
import { exportFoundryModule } from "@dm-instamap/exporters";
```

The generated zip includes:

- `module.json`
- `scenes/<scene>.json`
- `packs/scenes.db`
- `maps/<scene>.webp` by default

The scene data includes:

- rendered map image path
- square grid size, distance, and units
- walls from `MapDocument.plan.walls`
- doors from `MapDocument.plan.doors`
- ambient lights from `MapDocument.plan.lights`

Example:

```ts
const moduleZip = await exportFoundryModule(mapDocument, {
  moduleId: "my-dungeon",
  moduleTitle: "My Dungeon"
});
```

The first implementation writes a simple module and scene pack that can be
inspected locally. Foundry packaging formats can vary by Foundry version, so
future passes may add version-specific pack generation.

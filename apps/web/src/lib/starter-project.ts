import { createSimpleDungeon } from "@dm-instamap/generator";

export function createStarterProject() {
  return {
    name: "Workspace dungeon locale",
    modules: [
      "Scanner asset",
      "Browser asset",
      "Correzione manuale",
      "Generatore dungeon semplice",
      "Editor mappa",
      "Export PNG"
    ],
    map: createSimpleDungeon({ height: 8, width: 12 })
  };
}

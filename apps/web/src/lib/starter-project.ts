import { createSimpleDungeon } from "@dm-instamap/generator";

export function createStarterProject() {
  return {
    name: "Local Dungeon Workspace",
    modules: [
      "Asset scanner",
      "Asset browser",
      "Manual correction",
      "Simple dungeon generator",
      "Map editor",
      "PNG export"
    ],
    map: createSimpleDungeon({ height: 8, width: 12 })
  };
}

import type { MapDocument, Point } from "@dm-instamap/core/browser";
import { exportMapDocumentDd2Vtt } from "./dd2vtt";
import { buildFoundryModuleData, type FoundryExportOptions } from "./foundry";

export type VttManifestOptions = {
  foundry?: FoundryExportOptions;
  scale?: number;
};

export type VttExportManifest = {
  consistency: {
    dd2vttGridMatchesImage: boolean;
    doorsMatch: boolean;
    lightsMatch: boolean;
    wallsPresent: boolean;
  };
  dd2vtt: {
    format: number;
    imageSize: { x: number; y: number };
    lights: Array<{ color: string; intensity: number; position: Point; range: number }>;
    mapSize: { x: number; y: number };
    pixelsPerGrid: number;
    portals: Array<{ closed: boolean; position: Point; rotation: number; width: number }>;
    wallSegments: number;
  };
  foundry: {
    compatibility: { minimum: string; verified: string };
    doorCount: number;
    grid: { distance: number; size: number; units: string };
    height: number;
    lightCount: number;
    noteCount: number;
    wallCount: number;
    width: number;
  };
};

/**
 * Produces a structural, image-free comparison manifest for both VTT targets.
 * Use it to diff exports across runs (regression snapshots) and to assert that
 * doors, walls and lights survive consistently into dd2vtt and Foundry.
 */
export async function buildVttExportManifest(
  document: MapDocument,
  options: VttManifestOptions = {}
): Promise<VttExportManifest> {
  const dd2vtt = await exportMapDocumentDd2Vtt(document, { embedImage: false, scale: options.scale });
  const foundry = buildFoundryModuleData(document, options.foundry);

  const doorCount = document.plan?.doors.length ?? 0;
  const lightCount = document.plan?.lights.length ?? 0;
  const foundryDoorCount = foundry.sceneJson.walls.filter((wall) => wall.door === 1).length;
  const foundryWallCount = foundry.sceneJson.walls.filter((wall) => wall.door === 0).length;
  const resolution = dd2vtt.object.resolution;

  return {
    consistency: {
      dd2vttGridMatchesImage:
        resolution.image_size.x === resolution.map_size.x * resolution.pixels_per_grid &&
        resolution.image_size.y === resolution.map_size.y * resolution.pixels_per_grid,
      doorsMatch: dd2vtt.object.portals.length === doorCount && foundryDoorCount === doorCount,
      lightsMatch: dd2vtt.object.lights.length === lightCount && foundry.sceneJson.lights.length === lightCount,
      wallsPresent: dd2vtt.object.line_of_sight.length > 0 && foundryWallCount > 0
    },
    dd2vtt: {
      format: dd2vtt.object.format,
      imageSize: resolution.image_size,
      lights: dd2vtt.object.lights,
      mapSize: resolution.map_size,
      pixelsPerGrid: resolution.pixels_per_grid,
      portals: dd2vtt.object.portals.map((portal) => ({
        closed: portal.closed,
        position: portal.position,
        rotation: portal.rotation,
        width: portal.width
      })),
      wallSegments: dd2vtt.object.line_of_sight.length
    },
    foundry: {
      compatibility: foundry.moduleJson.compatibility,
      doorCount: foundryDoorCount,
      grid: {
        distance: foundry.sceneJson.grid.distance,
        size: foundry.sceneJson.grid.size,
        units: foundry.sceneJson.grid.units
      },
      height: foundry.sceneJson.height,
      lightCount: foundry.sceneJson.lights.length,
      noteCount: foundry.sceneJson.notes.length,
      wallCount: foundryWallCount,
      width: foundry.sceneJson.width
    }
  };
}

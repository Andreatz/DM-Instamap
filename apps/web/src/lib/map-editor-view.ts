import type { DragEvent } from "react";
import type { MapDocument, MapLayerKind } from "@dm-instamap/core/browser";
import type { MatchableAssetGroup } from "@dm-instamap/assets/matcher";
import type { FurnishingAsset } from "@dm-instamap/generator";
import type { AssetSearchApiResult } from "./asset-search";
import type { EditorPaletteAsset, EditorSelection, EditorTool } from "./map-editor";
import { isEditorLayerLocked, isEditorLayerVisible } from "./map-editor";

export type ExportFormat = "png" | "webp";

export type DragPayload =
  | {
      assetId: string;
      type: "palette";
    }
  | {
      placedAssetId: string;
      type: "placed";
    };

export const CANVAS_CELL_SIZE = 24;
export const CLIPBOARD_STORAGE_KEY = "dm-instamap-editor-asset-clipboard";
export const RECENT_GENERATED_STORAGE_KEY = "dm-instamap-editor-recent-generated";
export const DOCUMENT_STORAGE_KEY = "dm-instamap-editor-document";
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3;
export const HISTORY_LIMIT = 40;
export const DEFAULT_NOTE_TEXT = "Nota GM";

export function writeDragPayload(event: DragEvent, payload: DragPayload): void {
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

export function readDragPayload(event: DragEvent): DragPayload | null {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData("application/json")) as DragPayload;
    return parsed.type === "palette" || parsed.type === "placed" ? parsed : null;
  } catch {
    return null;
  }
}

export function createFurnishingAssets(
  assetGroups: MatchableAssetGroup[],
  palette: EditorPaletteAsset[],
  searchResults: AssetSearchApiResult[] = []
): FurnishingAsset[] {
  const searchedAssets = searchResults.map((result) => ({
    assetId: result.assetId,
    kind: result.classification,
    qualityScore: Math.round(result.score * 100),
    tags: result.tags
  }));
  const groupAssets = assetGroups
    .filter((group) => group.assetIds?.[0])
    .map((group) => ({
      assetId: group.assetIds?.[0] as string,
      kind: group.kind ?? "prop",
      qualityScore: group.qualityScore ?? undefined,
      tags: group.tags ?? [],
      usableFor: group.usableFor ?? []
    }));

  if (searchedAssets.length > 0 || groupAssets.length > 0) {
    return [...searchedAssets, ...groupAssets];
  }

  return palette.map((asset) => ({
    assetId: asset.id,
    kind: asset.kind,
    tags: tokenizeText(asset.name)
  }));
}

export function createFurnishingAssetGroups(assetGroups: MatchableAssetGroup[]) {
  return assetGroups
    .filter((group) => group.assetIds?.[0])
    .map((group) => ({
      assetIds: group.assetIds ?? [],
      kind: group.kind ?? undefined,
      qualityScore: group.qualityScore ?? undefined,
      tags: group.tags ?? [],
      theme: group.theme ?? undefined,
      themes: group.themes ?? [],
      usableFor: group.usableFor ?? []
    }));
}

export function createPaletteAsset(
  assetId: string,
  palette: EditorPaletteAsset[],
  searchResults: AssetSearchApiResult[]
): EditorPaletteAsset | null {
  const paletteAsset = palette.find((asset) => asset.id === assetId);

  if (paletteAsset) {
    return paletteAsset;
  }

  const searchResult = searchResults.find((result) => result.assetId === assetId);

  if (!searchResult) {
    return null;
  }

  return {
    id: searchResult.assetId,
    kind: searchResult.classification,
    name: getFileName(searchResult.relativePath),
    thumbnailUrl: searchResult.thumbnailUrl
  };
}

export function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

export function createExportFilename(name: string, format: ExportFormat): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "map";
  return `${slug}.${format}`;
}

export function createToolStatus(tool: EditorTool, cell: { x: number; y: number }): string {
  return `${formatToolName(tool)} a ${cell.x}, ${cell.y}`;
}

export function isSelectionVisible(document: MapDocument, selection: NonNullable<EditorSelection>): boolean {
  if (selection.type === "asset") {
    const asset = document.assets.find((candidate) => candidate.id === selection.id);
    return asset ? isEditorLayerVisible(document, assetToLayerKind(asset.layer)) : false;
  }

  if (selection.type === "door") {
    return isEditorLayerVisible(document, "walls");
  }

  if (selection.type === "light") {
    return isEditorLayerVisible(document, "lighting");
  }

  if (selection.type === "note") {
    return isEditorLayerVisible(document, "notes");
  }

  return isEditorLayerVisible(document, "notes");
}

export function createSelectionBounds(
  start: { x: number; y: number },
  current: { x: number; y: number }
): { maxX: number; maxY: number; minX: number; minY: number } {
  return {
    maxX: Math.max(start.x, current.x),
    maxY: Math.max(start.y, current.y),
    minX: Math.min(start.x, current.x),
    minY: Math.min(start.y, current.y)
  };
}

export function toggleSelection(selectedIds: string[], id: string): string[] {
  return selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id];
}

export function hasLockedSelectedAsset(
  document: MapDocument,
  selectedAssets: MapDocument["assets"],
  selectedAssetIds: string[]
): boolean {
  const selectedAssetSet = new Set(selectedAssetIds);
  const assets = selectedAssets.length > 0 ? selectedAssets : document.assets.filter((asset) => selectedAssetSet.has(asset.id));
  return assets.some((asset) => isEditorLayerLocked(document, assetToLayerKind(asset.layer)));
}

export function isTextInputTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function toolToLayerKind(tool: EditorTool): MapLayerKind {
  switch (tool) {
    case "paint-floor":
    case "paint-empty":
      return "terrain";
    case "paint-wall":
    case "door":
      return "walls";
    case "light":
      return "lighting";
    case "note":
      return "notes";
    case "select":
      return "props";
  }
}

export function assetToLayerKind(layer: MapDocument["assets"][number]["layer"]): MapLayerKind {
  switch (layer) {
    case "floor":
      return "terrain";
    case "wall":
      return "walls";
    case "lighting":
      return "lighting";
    case "annotation":
      return "gm-only";
    case "object":
    default:
      return "props";
  }
}

export function layerLabel(kind: MapLayerKind): string {
  switch (kind) {
    case "background":
      return "Sfondo";
    case "terrain":
      return "Terreno";
    case "walls":
      return "Muri";
    case "props":
      return "Oggetti";
    case "lighting":
      return "Luci";
    case "gm-only":
      return "Solo GM";
    case "notes":
      return "Note";
  }
}

export function formatToolName(tool: EditorTool): string {
  switch (tool) {
    case "select":
      return "Seleziona";
    case "paint-floor":
      return "Pavimento";
    case "paint-wall":
      return "Muro";
    case "paint-empty":
      return "Cancella";
    case "door":
      return "Porta";
    case "light":
      return "Luce";
    case "note":
      return "Nota";
    default:
      return tool;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseOptionalInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}

export function loadRecentGeneratedFromStorage(): EditorPaletteAsset[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_GENERATED_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is EditorPaletteAsset =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as EditorPaletteAsset).id === "string" &&
        typeof (entry as EditorPaletteAsset).name === "string"
    );
  } catch {
    return [];
  }
}

export function saveRecentGeneratedToStorage(assets: EditorPaletteAsset[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_GENERATED_STORAGE_KEY, JSON.stringify(assets));
  } catch {
    /* ignore quota errors */
  }
}

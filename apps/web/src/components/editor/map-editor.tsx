"use client";

import { useMemo, useState } from "react";
import type { MapDocument, MapTile, RoomNode } from "@dm-instamap/core";
import { matchAssetGroupsForRoom, type MatchableAssetGroup } from "@dm-instamap/assets/matcher";
import { autoFurnishMap, type FurnishingAsset, type FurnishingDensity } from "@dm-instamap/generator";
import {
  addPlacedAsset,
  deletePlacedAsset,
  findRoomAtCell,
  movePlacedAsset,
  parseMapDocumentJson,
  serializeMapDocument,
  type EditorPaletteAsset
} from "@/lib/map-editor";

type MapEditorProps = {
  assetGroups: MatchableAssetGroup[];
  initialDocument: MapDocument;
  mapTheme: string;
  palette: EditorPaletteAsset[];
};

type DragPayload =
  | {
      assetId: string;
      type: "palette";
    }
  | {
      placedAssetId: string;
      type: "placed";
    };

type ExportFormat = "png" | "webp";

export function MapEditor({ assetGroups, initialDocument, mapTheme, palette }: MapEditorProps) {
  const [document, setDocument] = useState(initialDocument);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>("room-entrance");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [furnishingDensity, setFurnishingDensity] = useState<FurnishingDensity>("normal");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportIncludeGrid, setExportIncludeGrid] = useState(true);
  const [exportScale, setExportScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [jsonText, setJsonText] = useState(() => serializeMapDocument(initialDocument));
  const [status, setStatus] = useState("Ready");
  const tilesByCell = useMemo(() => createTileLookup(document.tiles), [document.tiles]);
  const assetsByCell = useMemo(() => createAssetLookup(document.assets), [document.assets]);
  const rooms = document.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedAsset = document.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const roomMatches = useMemo(
    () =>
      selectedRoom
        ? matchAssetGroupsForRoom({
            groups: assetGroups,
            limit: 5,
            room: selectedRoom,
            theme: mapTheme
          })
        : [],
    [assetGroups, mapTheme, selectedRoom]
  );

  function handleCellClick(x: number, y: number) {
    const room = findRoomAtCell(document, { x, y });
    setSelectedRoomId(room?.id ?? null);
  }

  function handleDrop(event: React.DragEvent, x: number, y: number) {
    event.preventDefault();
    const payload = readDragPayload(event);

    if (!payload) {
      return;
    }

    if (payload.type === "palette") {
      const paletteAsset = palette.find((asset) => asset.id === payload.assetId);

      if (!paletteAsset) {
        return;
      }

      setDocument((current) => addPlacedAsset(current, paletteAsset, { x, y }));
      setStatus(`Placed ${paletteAsset.name}`);
      return;
    }

    setDocument((current) => movePlacedAsset(current, payload.placedAssetId, { x, y }));
    setSelectedAssetId(payload.placedAssetId);
    setStatus("Moved asset");
  }

  function saveJson() {
    const serialized = serializeMapDocument(document);
    setJsonText(serialized);
    window.localStorage.setItem("dm-instamap-editor-document", serialized);
    setStatus("Saved JSON locally");
  }

  function loadJson() {
    try {
      const parsed = parseMapDocumentJson(jsonText);
      setDocument(parsed);
      setSelectedAssetId(null);
      setSelectedRoomId(parsed.plan?.rooms.find((room) => room.kind === "entrance")?.id ?? null);
      setStatus("Loaded MapDocument JSON");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load JSON");
    }
  }

  function loadLocal() {
    const saved = window.localStorage.getItem("dm-instamap-editor-document");

    if (!saved) {
      setStatus("No local saved document found");
      return;
    }

    setJsonText(saved);
    setDocument(parseMapDocumentJson(saved));
    setStatus("Loaded local saved document");
  }

  function deleteSelectedAsset() {
    if (!selectedAssetId) {
      return;
    }

    setDocument((current) => deletePlacedAsset(current, selectedAssetId));
    setSelectedAssetId(null);
    setStatus("Deleted asset");
  }

  function handleAutoFurnish() {
    const selectedAssets = createFurnishingAssets(assetGroups, palette);
    const result = autoFurnishMap(document, {
      assets: selectedAssets,
      density: furnishingDensity
    });

    setDocument(result.document);
    setSelectedAssetId(null);
    setStatus(`Auto-furnished ${result.placed.length} assets`);
  }

  async function handleExport() {
    setIsExporting(true);
    setStatus(`Exporting ${exportFormat.toUpperCase()}`);

    try {
      const response = await fetch("/api/export", {
        body: JSON.stringify({
          document,
          format: exportFormat,
          includeGrid: exportIncludeGrid,
          scale: exportScale
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = createExportFilename(document.name, exportFormat);
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${exportFormat.toUpperCase()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="editor-shell" aria-label="Map editor">
      <aside className="asset-filters editor-sidebar">
        <h2>Assets</h2>
        <div className="editor-palette">
          {palette.map((asset) => (
            <button
              draggable
              key={asset.id}
              onDragStart={(event) => writeDragPayload(event, { assetId: asset.id, type: "palette" })}
              type="button"
            >
              <span className="palette-thumb">
                {asset.thumbnailUrl ? <img alt="" src={asset.thumbnailUrl} /> : <b>{asset.name.charAt(0)}</b>}
              </span>
              <span>{asset.name}</span>
            </button>
          ))}
        </div>

        <section className="detail-block">
          <h3>Rooms</h3>
          <div className="editor-room-list">
            {rooms.map((room) => (
              <button
                className={selectedRoomId === room.id ? "active" : ""}
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                type="button"
              >
                {room.label}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="editor-map-panel">
        <div
          className="editor-map-grid"
          style={{
            gridTemplateColumns: `repeat(${document.width}, minmax(0, 1fr))`
          }}
        >
          {Array.from({ length: document.height }).flatMap((_, y) =>
            Array.from({ length: document.width }).map((__, x) => {
              const tile = tilesByCell.get(cellKey(x, y));
              const placedAsset = assetsByCell.get(cellKey(x, y));
              const room = findRoomAtCell(document, { x, y });
              const isSelectedRoom = Boolean(room && room.id === selectedRoomId);

              return (
                <button
                  className={`editor-cell editor-cell-${tile?.kind ?? "empty"}${isSelectedRoom ? " selected-room" : ""}`}
                  key={cellKey(x, y)}
                  onClick={() => handleCellClick(x, y)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, x, y)}
                  title={`${x},${y}`}
                  type="button"
                >
                  {placedAsset ? (
                    <span
                      className={`editor-placed-asset${selectedAssetId === placedAsset.id ? " selected" : ""}`}
                      draggable
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedAssetId(placedAsset.id);
                      }}
                      onDragStart={(event) =>
                        writeDragPayload(event, { placedAssetId: placedAsset.id, type: "placed" })
                      }
                    >
                      {getAssetLabel(placedAsset.assetId)}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </section>

      <aside className="asset-details editor-inspector">
        <h2>Inspector</h2>
        <dl>
          <div>
            <dt>Selected Room</dt>
            <dd>{selectedRoom?.label ?? "none"}</dd>
          </div>
          <div>
            <dt>Selected Asset</dt>
            <dd>{selectedAsset?.assetId ?? "none"}</dd>
          </div>
          <div>
            <dt>Doors</dt>
            <dd>{document.plan?.doors.length ?? 0}</dd>
          </div>
          <div>
            <dt>Walls</dt>
            <dd>{document.plan?.walls.length ?? 0}</dd>
          </div>
        </dl>

        <section className="detail-block asset-match-debug">
          <h3>Room Asset Matches</h3>
          {selectedRoom ? (
            <p>
              Matching {selectedRoom.label} against {assetGroups.length} local groups.
            </p>
          ) : (
            <p>Select a room to inspect local asset matches.</p>
          )}
          <div className="asset-match-list">
            {roomMatches.map((match) => (
              <article key={match.group.id}>
                <header>
                  <strong>{match.group.name}</strong>
                  <span>{Math.round(match.score * 100)}%</span>
                </header>
                <p>
                  {match.group.kind ?? "unknown"} - {match.group.assetIds?.length ?? 0} assets
                </p>
                <ul>
                  {match.reasons.map((reason) => (
                    <li key={`${match.group.id}-${reason.label}`}>
                      {reason.label}: {reason.value} (+{Math.round(reason.score * 100)})
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {selectedRoom && roomMatches.length === 0 ? <p>No matching groups found yet.</p> : null}
          </div>
        </section>

        <button
          className="save-correction"
          disabled={!selectedAssetId}
          onClick={deleteSelectedAsset}
          type="button"
        >
          Delete Selected Asset
        </button>

        <section className="detail-block editor-furnish-controls">
          <h3>Auto-Furnish</h3>
          <label>
            <span>Density</span>
            <select
              onChange={(event) => setFurnishingDensity(event.target.value as FurnishingDensity)}
              value={furnishingDensity}
            >
              <option value="sparse">Sparse</option>
              <option value="normal">Normal</option>
              <option value="rich">Rich</option>
            </select>
          </label>
          <button className="save-correction" onClick={handleAutoFurnish} type="button">
            Place Room Assets
          </button>
        </section>

        <section className="detail-block editor-export-controls">
          <h3>Export</h3>
          <label>
            <span>Format</span>
            <select onChange={(event) => setExportFormat(event.target.value as ExportFormat)} value={exportFormat}>
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </select>
          </label>
          <label>
            <span>Scale</span>
            <select onChange={(event) => setExportScale(Number(event.target.value))} value={exportScale}>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
            </select>
          </label>
          <label className="editor-checkbox">
            <input
              checked={exportIncludeGrid}
              onChange={(event) => setExportIncludeGrid(event.target.checked)}
              type="checkbox"
            />
            <span>Include grid</span>
          </label>
          <button className="save-correction" disabled={isExporting} onClick={handleExport} type="button">
            {isExporting ? "Exporting" : "Export Map"}
          </button>
        </section>

        <section className="detail-block">
          <h3>MapDocument JSON</h3>
          <div className="editor-json-actions">
            <button onClick={saveJson} type="button">
              Save JSON
            </button>
            <button onClick={loadJson} type="button">
              Load JSON
            </button>
            <button onClick={loadLocal} type="button">
              Load Local
            </button>
          </div>
          <textarea
            className="editor-json"
            onChange={(event) => setJsonText(event.target.value)}
            spellCheck={false}
            value={jsonText}
          />
          <p>{status}</p>
        </section>
      </aside>
    </section>
  );
}

function createTileLookup(tiles: MapTile[]): Map<string, MapTile> {
  return new Map(tiles.map((tile) => [cellKey(tile.x, tile.y), tile]));
}

function createAssetLookup(assets: MapDocument["assets"]): Map<string, MapDocument["assets"][number]> {
  return new Map(assets.map((asset) => [cellKey(asset.position.x, asset.position.y), asset]));
}

function writeDragPayload(event: React.DragEvent, payload: DragPayload) {
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

function readDragPayload(event: React.DragEvent): DragPayload | null {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData("application/json")) as DragPayload;
    return parsed.type === "palette" || parsed.type === "placed" ? parsed : null;
  } catch {
    return null;
  }
}

function getAssetLabel(assetId: string): string {
  return assetId.replace(/^asset[_-]?/u, "").charAt(0).toUpperCase() || "A";
}

function createFurnishingAssets(assetGroups: MatchableAssetGroup[], palette: EditorPaletteAsset[]): FurnishingAsset[] {
  const groupAssets = assetGroups
    .filter((group) => group.assetIds?.[0])
    .map((group) => ({
      assetId: group.assetIds?.[0] as string,
      kind: group.kind ?? "prop",
      qualityScore: group.qualityScore ?? undefined,
      tags: group.tags ?? [],
      usableFor: group.usableFor ?? []
    }));

  if (groupAssets.length > 0) {
    return groupAssets;
  }

  return palette.map((asset) => ({
    assetId: asset.id,
    kind: asset.kind,
    tags: tokenizeText(asset.name)
  }));
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function createExportFilename(name: string, format: ExportFormat): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "map";
  return `${slug}.${format}`;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

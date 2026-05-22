"use client";

import { writeDragPayload } from "@/lib/map-editor-view";
import type { MapEditorController } from "@/hooks/use-map-editor-state";

export function EditorAssetSidebar({
  editor
}: {
  editor: MapEditorController;
}) {
  const { palette, recentGenerated, rooms, selectedRoomId, setSelectedRoomId } =
    editor;

  return (
    <aside className="asset-filters editor-sidebar">
      <h2>Asset</h2>
      <div className="editor-palette">
        {palette.map((asset) => (
          <button
            draggable
            key={asset.id}
            onDragStart={(event) =>
              writeDragPayload(event, { assetId: asset.id, type: "palette" })
            }
            type="button"
          >
            <span className="palette-thumb">
              {asset.thumbnailUrl ? (
                <img alt="" src={asset.thumbnailUrl} />
              ) : (
                <b>{asset.name.charAt(0)}</b>
              )}
            </span>
            <span>{asset.name}</span>
          </button>
        ))}
      </div>

      {recentGenerated.length > 0 ? (
        <section className="detail-block">
          <h3>Generati di recente</h3>
          <div className="editor-palette">
            {recentGenerated.map((asset) => (
              <button
                draggable
                key={asset.id}
                onDragStart={(event) =>
                  writeDragPayload(event, {
                    assetId: asset.id,
                    type: "palette"
                  })
                }
                type="button"
              >
                <span className="palette-thumb">
                  {asset.thumbnailUrl ? (
                    <img alt="" src={asset.thumbnailUrl} />
                  ) : (
                    <b>{asset.name.charAt(0)}</b>
                  )}
                </span>
                <span>{asset.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="detail-block">
        <h3>Stanze</h3>
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
  );
}

"use client";

import { useMemo, useState } from "react";
import { generateDungeon } from "@dm-instamap/generator";
import { parseRequiredRooms } from "./generator-form";

type GeneratorForm = {
  heightCells: number;
  requiredRooms: string;
  roomCount: number;
  theme: string;
  widthCells: number;
};

const INITIAL_FORM: GeneratorForm = {
  heightCells: 36,
  requiredRooms: "boss, library",
  roomCount: 8,
  theme: "crypt",
  widthCells: 52
};

export function DungeonGeneratorPreview() {
  const [form, setForm] = useState<GeneratorForm>(INITIAL_FORM);
  const map = useMemo(
    () =>
      generateDungeon({
        heightCells: form.heightCells,
        requiredRooms: parseRequiredRooms(form.requiredRooms),
        roomCount: form.roomCount,
        theme: form.theme,
        widthCells: form.widthCells
      }),
    [form]
  );
  const rooms = map.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];

  function setField<Key extends keyof GeneratorForm>(key: Key, value: GeneratorForm[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <section className="generate-shell" aria-label="Dungeon generator">
      <aside className="asset-filters">
        <h2>Request</h2>

        <label className="field">
          <span>Width Cells</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setField("widthCells", Number(event.target.value))}
            type="number"
            value={form.widthCells}
          />
        </label>

        <label className="field">
          <span>Height Cells</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setField("heightCells", Number(event.target.value))}
            type="number"
            value={form.heightCells}
          />
        </label>

        <label className="field">
          <span>Room Count</span>
          <input
            max="24"
            min="1"
            onChange={(event) => setField("roomCount", Number(event.target.value))}
            type="number"
            value={form.roomCount}
          />
        </label>

        <label className="field">
          <span>Theme</span>
          <input onChange={(event) => setField("theme", event.target.value)} value={form.theme} />
        </label>

        <label className="field">
          <span>Required Rooms</span>
          <textarea
            onChange={(event) => setField("requiredRooms", event.target.value)}
            rows={3}
            value={form.requiredRooms}
          />
        </label>

        <div className="manifest-note">
          <span>{rooms.length} rooms</span>
          <span>{map.plan?.doors.length ?? 0} doors</span>
          <span>{map.plan?.walls.length ?? 0} wall segments</span>
        </div>
      </aside>

      <section className="generate-preview-panel">
        <div
          className="generated-map"
          style={{
            gridTemplateColumns: `repeat(${map.width}, minmax(0, 1fr))`
          }}
        >
          {map.tiles.map((tile) => (
            <span className={`generated-tile generated-tile-${tile.kind}`} key={tile.id} />
          ))}
        </div>
      </section>

      <aside className="asset-details">
        <h2>Plan</h2>
        <dl>
          <div>
            <dt>Entrance</dt>
            <dd>{map.plan?.rooms.find((room) => room.id === "room-entrance")?.label ?? "missing"}</dd>
          </div>
          <div>
            <dt>Final</dt>
            <dd>{map.plan?.rooms.find((room) => room.id === "room-final")?.label ?? "not requested"}</dd>
          </div>
          <div>
            <dt>Grid</dt>
            <dd>
              {map.width} x {map.height}
            </dd>
          </div>
          <div>
            <dt>Editable</dt>
            <dd>{map.editable ? "yes" : "no"}</dd>
          </div>
        </dl>

        <section className="detail-block">
          <h3>Rooms</h3>
          <div className="tag-list">
            {rooms.map((room) => (
              <span key={room.id}>{room.label}</span>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNarrativeBlueprint,
  generateDungeon,
  generateMapFromBlueprint,
  type MapGenerationBlueprint
} from "@dm-instamap/generator";
import { parseRequiredRooms } from "./generator-form";

type GeneratorForm = {
  heightCells: number;
  mode: "simple" | "narrative";
  narrativeRequest: string;
  requiredRooms: string;
  roomCount: number;
  theme: string;
  widthCells: number;
};

const INITIAL_FORM: GeneratorForm = {
  heightCells: 36,
  mode: "simple",
  narrativeRequest: "Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri.",
  requiredRooms: "boss, library",
  roomCount: 8,
  theme: "crypt",
  widthCells: 52
};

export function DungeonGeneratorPreview() {
  const router = useRouter();
  const [form, setForm] = useState<GeneratorForm>(INITIAL_FORM);
  const [status, setStatus] = useState("Generator ready");
  const blueprint = useMemo(
    () =>
      form.mode === "narrative"
        ? createNarrativeBlueprint({
            heightCells: form.heightCells,
            request: form.narrativeRequest,
            roomCount: form.roomCount,
            theme: form.theme,
            widthCells: form.widthCells
          })
        : null,
    [form]
  );
  const map = useMemo(
    () =>
      blueprint
        ? generateMapFromBlueprint(blueprint, {
            heightCells: form.heightCells,
            widthCells: form.widthCells
          })
        : generateDungeon({
            heightCells: form.heightCells,
            requiredRooms: parseRequiredRooms(form.requiredRooms),
            roomCount: form.roomCount,
            theme: form.theme,
            widthCells: form.widthCells
          }),
    [blueprint, form.heightCells, form.requiredRooms, form.roomCount, form.theme, form.widthCells]
  );
  const rooms = map.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];

  function setField<Key extends keyof GeneratorForm>(key: Key, value: GeneratorForm[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function createProjectFromPreview() {
    setStatus("Creating local project");

    try {
      const response = await fetch("/api/projects", {
        body: JSON.stringify({
          document: map,
          name: blueprint?.name ?? `${form.theme.charAt(0).toUpperCase()}${form.theme.slice(1)} Dungeon`,
          requiredRooms: blueprint?.rooms.map((room) => room.label) ?? form.requiredRooms,
          sourceRequest:
            form.mode === "narrative"
              ? form.narrativeRequest
              : `Generated ${form.theme} dungeon with ${form.roomCount} rooms.`,
          theme: form.theme
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string; project?: { id: string } };

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Could not create project.");
      }

      router.push(`/projects/${payload.project.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create project.");
    }
  }

  return (
    <section className="generate-shell" aria-label="Dungeon generator">
      <aside className="asset-filters">
        <h2>Request</h2>

        <label className="field">
          <span>Mode</span>
          <select onChange={(event) => setField("mode", event.target.value as GeneratorForm["mode"])} value={form.mode}>
            <option value="simple">Simple</option>
            <option value="narrative">Narrative</option>
          </select>
        </label>

        {form.mode === "narrative" ? (
          <label className="field">
            <span>Narrative Request</span>
            <textarea
              onChange={(event) => setField("narrativeRequest", event.target.value)}
              rows={5}
              value={form.narrativeRequest}
            />
          </label>
        ) : null}

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

        {form.mode === "simple" ? (
          <label className="field">
            <span>Required Rooms</span>
            <textarea
              onChange={(event) => setField("requiredRooms", event.target.value)}
              rows={3}
              value={form.requiredRooms}
            />
          </label>
        ) : null}

        <div className="manifest-note">
          <span>{rooms.length} rooms</span>
          <span>{map.plan?.doors.length ?? 0} doors</span>
          <span>{map.plan?.walls.length ?? 0} wall segments</span>
        </div>
        <button className="save-correction" onClick={() => void createProjectFromPreview()} type="button">
          Save As Project
        </button>
        <p>{status}</p>
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

        {blueprint ? <BlueprintSummary blueprint={blueprint} /> : null}
      </aside>
    </section>
  );
}

function BlueprintSummary({ blueprint }: { blueprint: MapGenerationBlueprint }) {
  return (
    <section className="detail-block">
      <h3>Narrative Blueprint</h3>
      <p>{blueprint.name}</p>
      <div className="tag-list">
        {blueprint.globalTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="asset-match-list">
        {blueprint.rooms.map((room) => (
          <article key={room.id}>
            <header>
              <strong>{room.label}</strong>
              <span>{room.tacticalRole}</span>
            </header>
            <p>{room.purpose}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

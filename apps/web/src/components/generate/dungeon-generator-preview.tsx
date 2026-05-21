"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNarrativeBlueprint,
  generateCaveDungeon,
  generateDungeon,
  generateMapFromBlueprint,
  generateMultiFloorDungeon,
  generateOutdoorMap,
  generateVillageMap,
  type MapGenerationBlueprint
} from "@dm-instamap/generator";
import type { MapDocument } from "@dm-instamap/core";
import { parseRequiredRooms } from "./generator-form";

type GeneratorMode =
  | "simple"
  | "narrative"
  | "cave"
  | "village"
  | "outdoor"
  | "multi-floor";

type GeneratorForm = {
  blockCount: number;
  floorCount: number;
  heightCells: number;
  mode: GeneratorMode;
  narrativeRequest: string;
  outdoorRiver: boolean;
  outdoorTreeDensity: number;
  requiredRooms: string;
  roomCount: number;
  seed: string;
  theme: string;
  widthCells: number;
};

const INITIAL_FORM: GeneratorForm = {
  blockCount: 6,
  floorCount: 3,
  heightCells: 36,
  mode: "simple",
  narrativeRequest: "Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri.",
  outdoorRiver: true,
  outdoorTreeDensity: 0.15,
  requiredRooms: "boss, library",
  roomCount: 8,
  seed: "default",
  theme: "crypt",
  widthCells: 52
};

export function DungeonGeneratorPreview() {
  const router = useRouter();
  const [form, setForm] = useState<GeneratorForm>(INITIAL_FORM);
  const [status, setStatus] = useState("Generator ready");
  const [selectedFloor, setSelectedFloor] = useState(0);
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
  const generated = useMemo<{ map: MapDocument; floors?: MapDocument[] }>(() => {
    if (blueprint) {
      return {
        map: generateMapFromBlueprint(blueprint, {
          heightCells: form.heightCells,
          widthCells: form.widthCells
        })
      };
    }

    if (form.mode === "cave") {
      return {
        map: generateCaveDungeon({
          heightCells: form.heightCells,
          seed: form.seed || "default",
          theme: form.theme,
          widthCells: form.widthCells
        })
      };
    }

    if (form.mode === "village") {
      return {
        map: generateVillageMap({
          blockCount: form.blockCount,
          heightCells: form.heightCells,
          seed: form.seed || "default",
          theme: form.theme,
          widthCells: form.widthCells
        })
      };
    }

    if (form.mode === "outdoor") {
      return {
        map: generateOutdoorMap({
          heightCells: form.heightCells,
          river: form.outdoorRiver,
          seed: form.seed || "default",
          theme: form.theme,
          treeDensity: form.outdoorTreeDensity,
          widthCells: form.widthCells
        })
      };
    }

    if (form.mode === "multi-floor") {
      const result = generateMultiFloorDungeon({
        floorCount: form.floorCount,
        heightCells: form.heightCells,
        perFloorRoomCount: form.roomCount,
        seed: form.seed || "default",
        theme: form.theme,
        widthCells: form.widthCells
      });

      const index = Math.min(Math.max(0, selectedFloor), result.floors.length - 1);
      return {
        floors: result.floors,
        map: result.floors[index] as MapDocument
      };
    }

    return {
      map: generateDungeon({
        heightCells: form.heightCells,
        requiredRooms: parseRequiredRooms(form.requiredRooms),
        roomCount: form.roomCount,
        theme: form.theme,
        widthCells: form.widthCells
      })
    };
  }, [blueprint, form, selectedFloor]);
  const map = generated.map;
  const rooms = map.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];

  function setField<Key extends keyof GeneratorForm>(key: Key, value: GeneratorForm[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function createProjectFromPreview() {
    if (form.mode === "multi-floor" && generated.floors && generated.floors.length > 1) {
      await createMultiFloorProjectsFromPreview();
      return;
    }

    setStatus("Creating local project");

    try {
      const response = await fetch("/api/projects", {
        body: JSON.stringify({
          document: map,
          name: blueprint?.name ?? buildProjectName(form),
          requiredRooms: blueprint?.rooms.map((room) => room.label) ?? form.requiredRooms,
          sourceRequest: buildSourceRequest(form),
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

  async function createMultiFloorProjectsFromPreview() {
    if (!generated.floors || generated.floors.length === 0) {
      setStatus("No floors to save.");
      return;
    }

    setStatus(`Creating ${generated.floors.length} linked projects…`);

    try {
      const projectName = buildProjectName(form);
      const response = await fetch("/api/projects/multi-floor", {
        body: JSON.stringify({
          baseSlug: projectName,
          documents: generated.floors,
          name: projectName,
          sourceRequest: buildSourceRequest(form)
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        projects?: Array<{ id: string }>;
      };

      if (!response.ok || !payload.projects || payload.projects.length === 0) {
        throw new Error(payload.error ?? "Could not create multi-floor projects.");
      }

      const first = payload.projects[0];
      if (!first) {
        throw new Error("No projects returned by multi-floor route.");
      }
      setStatus(`Created ${payload.projects.length} linked projects. Opening floor 1…`);
      router.push(`/projects/${first.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create multi-floor projects.");
    }
  }

  return (
    <section className="generate-shell" aria-label="Dungeon generator">
      <aside className="asset-filters">
        <h2>Request</h2>

        <label className="field">
          <span>Mode</span>
          <select onChange={(event) => setField("mode", event.target.value as GeneratorMode)} value={form.mode}>
            <option value="simple">Simple (rectangular)</option>
            <option value="narrative">Narrative (blueprint)</option>
            <option value="cave">Cave (cellular automata)</option>
            <option value="village">Village (subdivision)</option>
            <option value="outdoor">Outdoor (forest / river)</option>
            <option value="multi-floor">Multi-floor dungeon</option>
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

        {form.mode === "simple" || form.mode === "narrative" || form.mode === "multi-floor" ? (
          <label className="field">
            <span>{form.mode === "multi-floor" ? "Rooms per floor" : "Room Count"}</span>
            <input
              max="24"
              min="1"
              onChange={(event) => setField("roomCount", Number(event.target.value))}
              type="number"
              value={form.roomCount}
            />
          </label>
        ) : null}

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

        {form.mode === "village" ? (
          <label className="field">
            <span>Building Count</span>
            <input
              max="24"
              min="3"
              onChange={(event) => setField("blockCount", Number(event.target.value))}
              type="number"
              value={form.blockCount}
            />
          </label>
        ) : null}

        {form.mode === "outdoor" ? (
          <>
            <label className="editor-checkbox">
              <input
                checked={form.outdoorRiver}
                onChange={(event) => setField("outdoorRiver", event.target.checked)}
                type="checkbox"
              />
              <span>Include river with bridges</span>
            </label>
            <label className="field">
              <span>Tree Density ({form.outdoorTreeDensity.toFixed(2)})</span>
              <input
                max="0.4"
                min="0"
                onChange={(event) => setField("outdoorTreeDensity", Number(event.target.value))}
                step="0.01"
                type="range"
                value={form.outdoorTreeDensity}
              />
            </label>
          </>
        ) : null}

        {form.mode === "multi-floor" ? (
          <>
            <label className="field">
              <span>Floor Count</span>
              <input
                max="6"
                min="2"
                onChange={(event) => {
                  setField("floorCount", Number(event.target.value));
                  setSelectedFloor(0);
                }}
                type="number"
                value={form.floorCount}
              />
            </label>
            {generated.floors && generated.floors.length > 1 ? (
              <div className="field-row" role="group" aria-label="Preview floor">
                {generated.floors.map((_, index) => (
                  <button
                    aria-pressed={selectedFloor === index}
                    className={selectedFloor === index ? "save-correction" : ""}
                    key={`floor-${index}`}
                    onClick={() => setSelectedFloor(index)}
                    type="button"
                  >
                    Floor {index + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {form.mode === "cave" ||
        form.mode === "village" ||
        form.mode === "outdoor" ||
        form.mode === "multi-floor" ? (
          <label className="field">
            <span>Seed</span>
            <input onChange={(event) => setField("seed", event.target.value)} value={form.seed} />
          </label>
        ) : null}

        <div className="manifest-note">
          <span>{rooms.length} rooms</span>
          <span>{map.plan?.doors.length ?? 0} doors</span>
          <span>{map.plan?.walls.length ?? 0} wall segments</span>
          {generated.floors ? <span>{generated.floors.length} floors</span> : null}
        </div>
        <button className="save-correction" onClick={() => void createProjectFromPreview()} type="button">
          Save As Project
        </button>
        {generated.floors ? (
          <p className="muted">
            Multi-floor save creates {generated.floors.length} linked projects (one per floor). Currently previewing
            floor {selectedFloor + 1}.
          </p>
        ) : null}
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
          <div>
            <dt>Algorithm</dt>
            <dd>{describeMode(form.mode)}</dd>
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
      <dl>
        <div>
          <dt>Structure</dt>
          <dd>{blueprint.structure}</dd>
        </div>
        <div>
          <dt>Scale</dt>
          <dd>{blueprint.scale}</dd>
        </div>
        <div>
          <dt>Mood</dt>
          <dd>{blueprint.mood}</dd>
        </div>
        <div>
          <dt>Water / Vegetation</dt>
          <dd>
            {blueprint.hasWater ? "water" : "—"} / {blueprint.hasVegetation ? "vegetation" : "—"}
          </dd>
        </div>
        <div>
          <dt>Ruin Level</dt>
          <dd>{blueprint.ruinLevel.toFixed(2)}</dd>
        </div>
      </dl>
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

function describeMode(mode: GeneratorMode): string {
  switch (mode) {
    case "simple":
      return "Rectangular rooms + corridors";
    case "narrative":
      return "Narrative blueprint";
    case "cave":
      return "Cellular automata cave";
    case "village":
      return "Subdivision village";
    case "outdoor":
      return "Outdoor / poisson trees";
    case "multi-floor":
      return "Multi-floor (linked via stairs)";
    default:
      return mode;
  }
}

function buildProjectName(form: GeneratorForm): string {
  const themeTitle = form.theme.charAt(0).toUpperCase() + form.theme.slice(1);

  switch (form.mode) {
    case "cave":
      return `${themeTitle} Cave`;
    case "village":
      return `${themeTitle} Village`;
    case "outdoor":
      return `${themeTitle} Wilderness`;
    case "multi-floor":
      return `${themeTitle} Multi-floor Dungeon`;
    default:
      return `${themeTitle} Dungeon`;
  }
}

function buildSourceRequest(form: GeneratorForm): string {
  if (form.mode === "narrative") {
    return form.narrativeRequest;
  }

  if (form.mode === "cave") {
    return `Generated ${form.theme} cave (seed: ${form.seed}).`;
  }

  if (form.mode === "village") {
    return `Generated ${form.theme} village (${form.blockCount} buildings, seed: ${form.seed}).`;
  }

  if (form.mode === "outdoor") {
    return `Generated ${form.theme} outdoor map (tree density ${form.outdoorTreeDensity.toFixed(
      2
    )}, river ${form.outdoorRiver}, seed: ${form.seed}).`;
  }

  if (form.mode === "multi-floor") {
    return `Generated ${form.theme} multi-floor dungeon (${form.floorCount} floors, seed: ${form.seed}). All floors saved as linked projects.`;
  }

  return `Generated ${form.theme} dungeon with ${form.roomCount} rooms.`;
}

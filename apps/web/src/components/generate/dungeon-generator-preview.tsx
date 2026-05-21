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
import type { MapDocument } from "@dm-instamap/core/browser";
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
  theme: "cripta",
  widthCells: 52
};

export function DungeonGeneratorPreview() {
  const router = useRouter();
  const [form, setForm] = useState<GeneratorForm>(INITIAL_FORM);
  const [status, setStatus] = useState("Generatore pronto");
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

    setStatus("Creazione progetto locale...");

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
        throw new Error(payload.error ?? "Impossibile creare il progetto.");
      }

      router.push(`/projects/${payload.project.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile creare il progetto.");
    }
  }

  async function createMultiFloorProjectsFromPreview() {
    if (!generated.floors || generated.floors.length === 0) {
      setStatus("Nessun piano da salvare.");
      return;
    }

    setStatus(`Creazione di ${generated.floors.length} progetti collegati...`);

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
        throw new Error(payload.error ?? "Impossibile creare i progetti multipiano.");
      }

      const first = payload.projects[0];
      if (!first) {
        throw new Error("La rotta multipiano non ha restituito alcun progetto.");
      }
      setStatus(`Creati ${payload.projects.length} progetti collegati. Apertura del piano 1...`);
      router.push(`/projects/${first.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile creare i progetti multipiano.");
    }
  }

  return (
    <section className="generate-shell" aria-label="Generatore dungeon">
      <aside className="asset-filters">
        <h2>Richiesta</h2>

        <label className="field">
          <span>Modalita</span>
          <select onChange={(event) => setField("mode", event.target.value as GeneratorMode)} value={form.mode}>
            <option value="simple">Semplice (rettangolare)</option>
            <option value="narrative">Narrativa (blueprint)</option>
            <option value="cave">Cave (automa cellulare)</option>
            <option value="village">Villaggio (subdivision)</option>
            <option value="outdoor">Outdoor (foresta / fiume)</option>
            <option value="multi-floor">Dungeon multipiano</option>
          </select>
        </label>

        {form.mode === "narrative" ? (
          <label className="field">
            <span>Richiesta narrativa</span>
            <textarea
              onChange={(event) => setField("narrativeRequest", event.target.value)}
              rows={5}
              value={form.narrativeRequest}
            />
          </label>
        ) : null}

        <label className="field">
          <span>Larghezza (celle)</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setField("widthCells", Number(event.target.value))}
            type="number"
            value={form.widthCells}
          />
        </label>

        <label className="field">
          <span>Altezza (celle)</span>
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
            <span>{form.mode === "multi-floor" ? "Stanze per piano" : "Numero stanze"}</span>
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
          <span>Tema</span>
          <input onChange={(event) => setField("theme", event.target.value)} value={form.theme} />
        </label>

        {form.mode === "simple" ? (
          <label className="field">
            <span>Stanze richieste</span>
            <textarea
              onChange={(event) => setField("requiredRooms", event.target.value)}
              rows={3}
              value={form.requiredRooms}
            />
          </label>
        ) : null}

        {form.mode === "village" ? (
          <label className="field">
            <span>Numero edifici</span>
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
              <span>Includi fiume con ponti</span>
            </label>
            <label className="field">
              <span>Densita alberi ({form.outdoorTreeDensity.toFixed(2)})</span>
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
              <span>Numero piani</span>
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
              <div className="field-row" role="group" aria-label="Piano in anteprima">
                {generated.floors.map((_, index) => (
                  <button
                    aria-pressed={selectedFloor === index}
                    className={selectedFloor === index ? "save-correction" : ""}
                    key={`floor-${index}`}
                    onClick={() => setSelectedFloor(index)}
                    type="button"
                  >
                    Piano {index + 1}
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
          <span>{rooms.length} stanze</span>
          <span>{map.plan?.doors.length ?? 0} porte</span>
          <span>{map.plan?.walls.length ?? 0} segmenti muro</span>
          {generated.floors ? <span>{generated.floors.length} piani</span> : null}
        </div>
        <button className="save-correction" onClick={() => void createProjectFromPreview()} type="button">
          Salva come progetto
        </button>
        {generated.floors ? (
          <p className="muted">
            Il salvataggio multipiano crea {generated.floors.length} progetti collegati (uno per piano). Anteprima
            attuale: piano {selectedFloor + 1}.
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
        <h2>Pianta</h2>
        <dl>
          <div>
            <dt>Ingresso</dt>
            <dd>{map.plan?.rooms.find((room) => room.id === "room-entrance")?.label ?? "mancante"}</dd>
          </div>
          <div>
            <dt>Finale</dt>
            <dd>{map.plan?.rooms.find((room) => room.id === "room-final")?.label ?? "non richiesto"}</dd>
          </div>
          <div>
            <dt>Griglia</dt>
            <dd>
              {map.width} x {map.height}
            </dd>
          </div>
          <div>
            <dt>Modificabile</dt>
            <dd>{map.editable ? "si" : "no"}</dd>
          </div>
          <div>
            <dt>Algoritmo</dt>
            <dd>{describeMode(form.mode)}</dd>
          </div>
        </dl>

        <section className="detail-block">
          <h3>Stanze</h3>
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
      <h3>Blueprint narrativo</h3>
      <p>{blueprint.name}</p>
      <dl>
        <div>
          <dt>Struttura</dt>
          <dd>{blueprint.structure}</dd>
        </div>
        <div>
          <dt>Scala</dt>
          <dd>{blueprint.scale}</dd>
        </div>
        <div>
          <dt>Mood</dt>
          <dd>{blueprint.mood}</dd>
        </div>
        <div>
          <dt>Acqua / Vegetazione</dt>
          <dd>
            {blueprint.hasWater ? "acqua" : "-"} / {blueprint.hasVegetation ? "vegetazione" : "-"}
          </dd>
        </div>
        <div>
          <dt>Livello di rovina</dt>
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
      return "Stanze rettangolari + corridoi";
    case "narrative":
      return "Blueprint narrativo";
    case "cave":
      return "Cave (automa cellulare)";
    case "village":
      return "Villaggio (subdivision)";
    case "outdoor":
      return "Outdoor / alberi poisson";
    case "multi-floor":
      return "Multipiano (collegati da scale)";
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
      return `${themeTitle} Villaggio`;
    case "outdoor":
      return `${themeTitle} Selva`;
    case "multi-floor":
      return `${themeTitle} Dungeon Multipiano`;
    default:
      return `${themeTitle} Dungeon`;
  }
}

function buildSourceRequest(form: GeneratorForm): string {
  if (form.mode === "narrative") {
    return form.narrativeRequest;
  }

  if (form.mode === "cave") {
    return `Cave ${form.theme} generata (seed: ${form.seed}).`;
  }

  if (form.mode === "village") {
    return `Villaggio ${form.theme} generato (${form.blockCount} edifici, seed: ${form.seed}).`;
  }

  if (form.mode === "outdoor") {
    return `Mappa outdoor ${form.theme} generata (densita alberi ${form.outdoorTreeDensity.toFixed(
      2
    )}, fiume ${form.outdoorRiver ? "si" : "no"}, seed: ${form.seed}).`;
  }

  if (form.mode === "multi-floor") {
    return `Dungeon multipiano ${form.theme} generato (${form.floorCount} piani, seed: ${form.seed}). Tutti i piani salvati come progetti collegati.`;
  }

  return `Dungeon ${form.theme} generato con ${form.roomCount} stanze.`;
}

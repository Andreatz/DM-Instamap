"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

type CreateProjectResponse = {
  error?: string;
  ok: boolean;
  project?: {
    id: string;
  };
};

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("Crypt Under The Cathedral");
  const [sourceRequest, setSourceRequest] = useState("A crypt below a cathedral with bound non-hostile undead.");
  const [theme, setTheme] = useState("crypt");
  const [requiredRooms, setRequiredRooms] = useState("chapel, prison, reliquary, boss");
  const [widthCells, setWidthCells] = useState(52);
  const [heightCells, setHeightCells] = useState(36);
  const [roomCount, setRoomCount] = useState(8);
  const [status, setStatus] = useState("Ready to create a local project");

  async function createLocalProject(event: FormEvent) {
    event.preventDefault();
    setStatus("Creating project");

    try {
      const response = await fetch("/api/projects", {
        body: JSON.stringify({
          heightCells,
          name,
          requiredRooms,
          roomCount,
          sourceRequest,
          theme,
          widthCells
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as CreateProjectResponse;

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Could not create project.");
      }

      setStatus("Project created");
      router.push(`/projects/${payload.project.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create project.");
    }
  }

  return (
    <form className="asset-browser" onSubmit={createLocalProject}>
      <aside className="asset-filters">
        <h2>New Map</h2>
        <label className="field">
          <span>Name</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label className="field">
          <span>Theme</span>
          <input onChange={(event) => setTheme(event.target.value)} value={theme} />
        </label>
        <label className="field">
          <span>Width Cells</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setWidthCells(Number(event.target.value))}
            type="number"
            value={widthCells}
          />
        </label>
        <label className="field">
          <span>Height Cells</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setHeightCells(Number(event.target.value))}
            type="number"
            value={heightCells}
          />
        </label>
        <label className="field">
          <span>Room Count</span>
          <input
            max="24"
            min="1"
            onChange={(event) => setRoomCount(Number(event.target.value))}
            type="number"
            value={roomCount}
          />
        </label>
      </aside>

      <section className="asset-results">
        <section className="asset-details">
          <h2>Request</h2>
          <label className="field">
            <span>Source Request</span>
            <textarea
              onChange={(event) => setSourceRequest(event.target.value)}
              rows={6}
              value={sourceRequest}
            />
          </label>
          <label className="field">
            <span>Required Rooms</span>
            <textarea
              onChange={(event) => setRequiredRooms(event.target.value)}
              rows={3}
              value={requiredRooms}
            />
          </label>
          <button className="save-correction" type="submit">
            Create Project
          </button>
          <p>{status}</p>
        </section>
      </section>
    </form>
  );
}

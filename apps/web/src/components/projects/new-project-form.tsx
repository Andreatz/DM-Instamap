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
  const [name, setName] = useState("Cripta sotto la cattedrale");
  const [sourceRequest, setSourceRequest] = useState(
    "Una cripta sotto una cattedrale con non-morti prigionieri ma non ostili."
  );
  const [theme, setTheme] = useState("cripta");
  const [requiredRooms, setRequiredRooms] = useState("chapel, prison, reliquary, boss");
  const [widthCells, setWidthCells] = useState(52);
  const [heightCells, setHeightCells] = useState(36);
  const [roomCount, setRoomCount] = useState(8);
  const [status, setStatus] = useState("Pronto a creare un progetto locale");

  async function createLocalProject(event: FormEvent) {
    event.preventDefault();
    setStatus("Creazione progetto...");

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
        throw new Error(payload.error ?? "Impossibile creare il progetto.");
      }

      setStatus("Progetto creato");
      router.push(`/projects/${payload.project.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile creare il progetto.");
    }
  }

  return (
    <form className="asset-browser" onSubmit={createLocalProject}>
      <aside className="asset-filters">
        <h2>Nuova mappa</h2>
        <label className="field">
          <span>Nome</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label className="field">
          <span>Tema</span>
          <input onChange={(event) => setTheme(event.target.value)} value={theme} />
        </label>
        <label className="field">
          <span>Larghezza (celle)</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setWidthCells(Number(event.target.value))}
            type="number"
            value={widthCells}
          />
        </label>
        <label className="field">
          <span>Altezza (celle)</span>
          <input
            max="96"
            min="12"
            onChange={(event) => setHeightCells(Number(event.target.value))}
            type="number"
            value={heightCells}
          />
        </label>
        <label className="field">
          <span>Numero stanze</span>
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
          <h2>Richiesta</h2>
          <label className="field">
            <span>Testo della richiesta</span>
            <textarea
              onChange={(event) => setSourceRequest(event.target.value)}
              rows={6}
              value={sourceRequest}
            />
          </label>
          <label className="field">
            <span>Stanze richieste</span>
            <textarea
              onChange={(event) => setRequiredRooms(event.target.value)}
              rows={3}
              value={requiredRooms}
            />
          </label>
          <button className="save-correction" type="submit">
            Crea progetto
          </button>
          <p>{status}</p>
        </section>
      </section>
    </form>
  );
}

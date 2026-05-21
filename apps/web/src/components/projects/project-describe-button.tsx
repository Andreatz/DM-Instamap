"use client";

import { useState } from "react";

type RoomSummary = {
  id: string;
  label: string;
  tags?: string[];
};

type ProjectDescribeButtonProps = {
  mapName: string;
  rooms: RoomSummary[];
  theme?: string;
};

export function ProjectDescribeButton({ mapName, rooms, theme }: ProjectDescribeButtonProps) {
  const [description, setDescription] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  async function describe() {
    setBusy(true);
    setStatus("Chiamata al provider AI…");
    setDescription("");

    try {
      const response = await fetch("/api/ai/describe", {
        body: JSON.stringify({ mapName, rooms, theme }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        description?: string;
        error?: string;
        errors?: string[];
        ok: boolean;
      };

      if (!response.ok || !payload.ok || !payload.description) {
        throw new Error(payload.error ?? payload.errors?.join("; ") ?? "Descrizione fallita.");
      }

      setDescription(payload.description);
      setStatus("Descrizione pronta.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Descrizione fallita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="asset-details">
      <h2>Descrizione AI (L4)</h2>
      <p className="muted">
        Chiede al provider AI configurato una descrizione narrativa di questa mappa. Richiede <code>AI_PROVIDER</code>{" "}
        e <code>AI_API_KEY</code>.
      </p>
      <button className="save-correction" disabled={busy} onClick={() => void describe()} type="button">
        {busy ? "In corso…" : "Descrivi la mappa con l'AI"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
      {description ? <p>{description}</p> : null}
    </section>
  );
}

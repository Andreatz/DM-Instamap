"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createCampaign() {
    setSubmitting(true);
    setStatus("Creazione campagna...");

    try {
      const response = await fetch("/api/campaigns", {
        body: JSON.stringify({
          description,
          name,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { campaign?: { id: string }; error?: string };

      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Impossibile creare la campagna.");
      }

      router.push(`/campaigns/${payload.campaign.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile creare la campagna.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="asset-details">
      <h2>Nuova campagna</h2>
      <label className="field">
        <span>Nome</span>
        <input onChange={(event) => setName(event.target.value)} placeholder="Boschi Sussurranti" value={name} />
      </label>
      <label className="field">
        <span>Descrizione (facoltativa)</span>
        <textarea onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
      </label>
      <label className="field">
        <span>Tag (separati da virgola)</span>
        <input onChange={(event) => setTags(event.target.value)} placeholder="hexcrawl, level-5" value={tags} />
      </label>
      <button
        className="save-correction"
        disabled={submitting || name.trim().length === 0}
        onClick={() => void createCampaign()}
        type="button"
      >
        {submitting ? "Creazione..." : "Crea campagna"}
      </button>
      {status ? <p>{status}</p> : null}
    </section>
  );
}

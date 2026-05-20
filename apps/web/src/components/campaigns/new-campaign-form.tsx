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
    setStatus("Creating campaign…");

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
        throw new Error(payload.error ?? "Could not create campaign.");
      }

      router.push(`/campaigns/${payload.campaign.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="asset-details">
      <h2>New Campaign</h2>
      <label className="field">
        <span>Name</span>
        <input onChange={(event) => setName(event.target.value)} placeholder="Whispering Woods" value={name} />
      </label>
      <label className="field">
        <span>Description (optional)</span>
        <textarea onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
      </label>
      <label className="field">
        <span>Tags (comma separated)</span>
        <input onChange={(event) => setTags(event.target.value)} placeholder="hexcrawl, level-5" value={tags} />
      </label>
      <button
        className="save-correction"
        disabled={submitting || name.trim().length === 0}
        onClick={() => void createCampaign()}
        type="button"
      >
        {submitting ? "Creating…" : "Create Campaign"}
      </button>
      {status ? <p>{status}</p> : null}
    </section>
  );
}

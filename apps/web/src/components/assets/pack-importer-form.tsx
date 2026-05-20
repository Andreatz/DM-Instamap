"use client";

import { useState } from "react";

const PRESETS = [
  { label: "Forgotten Adventures", value: "forgotten-adventures" },
  { label: "2-Minute Tabletop", value: "two-minute-tabletop" },
  { label: "Czepeku", value: "czepeku" },
  { label: "Generic", value: "generic" }
] as const;

type PresetValue = (typeof PRESETS)[number]["value"];

type ImportSummary = {
  assetCount: number;
  manifestErrors: number;
  preset: string;
  presetTagsApplied: number;
  reclassifiedCount: number;
  sourceRoot: string;
};

export function PackImporterForm() {
  const [assetRoot, setAssetRoot] = useState("");
  const [preset, setPreset] = useState<PresetValue>("forgotten-adventures");
  const [defaultTags, setDefaultTags] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function importPack() {
    setSubmitting(true);
    setStatus("Importing pack…");
    setSummary(null);

    try {
      const response = await fetch("/api/assets/import-pack", {
        body: JSON.stringify({
          assetRoot,
          defaultTags: defaultTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          preset
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string; summary?: ImportSummary };

      if (!response.ok || !payload.summary) {
        throw new Error(payload.error ?? "Import failed.");
      }

      setSummary(payload.summary);
      setStatus(`Imported ${payload.summary.assetCount} assets.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="asset-details">
      <h2>Import Asset Pack</h2>
      <p className="muted">
        Scan a local folder and apply preset-specific tagging rules. Existing classifications stay manual; only unknown
        assets get reclassified.
      </p>

      <label className="field">
        <span>Asset Root (absolute path or relative to workspace)</span>
        <input
          onChange={(event) => setAssetRoot(event.target.value)}
          placeholder="C:/Assets/ForgottenAdventures or data/imports/fa-1"
          value={assetRoot}
        />
      </label>

      <label className="field">
        <span>Preset</span>
        <select onChange={(event) => setPreset(event.target.value as PresetValue)} value={preset}>
          {PRESETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Extra Default Tags (comma separated)</span>
        <input
          onChange={(event) => setDefaultTags(event.target.value)}
          placeholder="imported, needs-review"
          value={defaultTags}
        />
      </label>

      <button
        className="save-correction"
        disabled={submitting || assetRoot.trim().length === 0}
        onClick={() => void importPack()}
        type="button"
      >
        {submitting ? "Importing…" : "Import Pack"}
      </button>

      {status ? <p>{status}</p> : null}

      {summary ? (
        <dl>
          <div>
            <dt>Source</dt>
            <dd>{summary.sourceRoot}</dd>
          </div>
          <div>
            <dt>Assets indexed</dt>
            <dd>{summary.assetCount}</dd>
          </div>
          <div>
            <dt>Preset tags applied</dt>
            <dd>{summary.presetTagsApplied}</dd>
          </div>
          <div>
            <dt>Reclassified</dt>
            <dd>{summary.reclassifiedCount}</dd>
          </div>
          <div>
            <dt>Scan errors</dt>
            <dd>{summary.manifestErrors}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

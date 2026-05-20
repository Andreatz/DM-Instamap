"use client";

import { useEffect, useState } from "react";

type ProviderStatus =
  | { configured: false; reason: string }
  | { configured: true; id: string; vendor: "replicate" | "automatic1111" | "custom" };

type GeneratedAsset = {
  classification: string;
  filename: string;
  prompt: string;
  provider: string;
  relativePath: string;
  seed?: number;
  styleTags: string[];
};

export function AssetGeneratorForm() {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [prompt, setPrompt] = useState("ornate wooden door with iron banding, top-down");
  const [negativePrompt, setNegativePrompt] = useState("text, watermark, low quality");
  const [classification, setClassification] = useState("door");
  const [styleTags, setStyleTags] = useState("wood, iron");
  const [seed, setSeed] = useState("");
  const [steps, setSteps] = useState("24");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastAsset, setLastAsset] = useState<GeneratedAsset | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/assets/generate");
        const payload = (await response.json()) as { provider?: ProviderStatus };
        setProviderStatus(payload.provider ?? null);
      } catch {
        setProviderStatus(null);
      }
    })();
  }, []);

  async function generateAsset() {
    setSubmitting(true);
    setStatus("Generating asset…");

    try {
      const response = await fetch("/api/assets/generate", {
        body: JSON.stringify({
          classification,
          negativePrompt,
          prompt,
          seed: seed.trim().length > 0 ? Number(seed) : undefined,
          steps: steps.trim().length > 0 ? Number(steps) : undefined,
          styleTags: styleTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { asset?: GeneratedAsset; error?: string };

      if (!response.ok || !payload.asset) {
        throw new Error(payload.error ?? "Generation failed.");
      }

      setLastAsset(payload.asset);
      setStatus(`Asset written to ${payload.asset.relativePath}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = providerStatus?.configured !== true;

  return (
    <section className="asset-details">
      <h2>Generate Asset (D3)</h2>
      <p className="muted">
        Send a prompt to the configured image-generation provider and save the result to the local library. Env:{" "}
        <code>IMAGE_GEN_PROVIDER=replicate|automatic1111</code>, <code>IMAGE_GEN_API_KEY</code>, <code>IMAGE_GEN_MODEL</code>.
      </p>

      <div className="manifest-note">
        {providerStatus === null ? <span>Loading provider status…</span> : null}
        {providerStatus?.configured ? (
          <>
            <span className="pill">vendor: {providerStatus.vendor}</span>
            <span className="pill">id: {providerStatus.id}</span>
          </>
        ) : null}
        {providerStatus && !providerStatus.configured ? (
          <span className="pill">disabled — {providerStatus.reason}</span>
        ) : null}
      </div>

      <label className="field">
        <span>Prompt</span>
        <textarea onChange={(event) => setPrompt(event.target.value)} rows={3} value={prompt} />
      </label>

      <label className="field">
        <span>Negative Prompt (optional)</span>
        <input onChange={(event) => setNegativePrompt(event.target.value)} value={negativePrompt} />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Classification</span>
          <select onChange={(event) => setClassification(event.target.value)} value={classification}>
            <option value="prop">prop</option>
            <option value="furniture">furniture</option>
            <option value="door">door</option>
            <option value="floor">floor</option>
            <option value="wall">wall</option>
            <option value="light">light</option>
            <option value="terrain">terrain</option>
            <option value="water">water</option>
            <option value="decoration">decoration</option>
          </select>
        </label>
        <label className="field">
          <span>Seed (optional)</span>
          <input onChange={(event) => setSeed(event.target.value)} placeholder="42" value={seed} />
        </label>
        <label className="field">
          <span>Steps</span>
          <input onChange={(event) => setSteps(event.target.value)} value={steps} />
        </label>
      </div>

      <label className="field">
        <span>Style Tags (comma separated)</span>
        <input onChange={(event) => setStyleTags(event.target.value)} value={styleTags} />
      </label>

      <button
        className="save-correction"
        disabled={disabled || submitting || prompt.trim().length === 0}
        onClick={() => void generateAsset()}
        type="button"
      >
        {submitting ? "Generating…" : "Generate Asset"}
      </button>

      {status ? <p>{status}</p> : null}

      {lastAsset ? (
        <dl>
          <div>
            <dt>File</dt>
            <dd>{lastAsset.relativePath}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{lastAsset.provider}</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd>{lastAsset.seed ?? "—"}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{lastAsset.styleTags.join(", ") || "—"}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

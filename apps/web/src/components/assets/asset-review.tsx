"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSET_REVIEW_KINDS,
  QUICK_REVIEW_KINDS,
  formatPercent,
  type AssetBrowserEntry,
  type ReviewAssetKind
} from "@/lib/asset-browser";
import {
  buildCorrectionFromDraft,
  createReviewDraft,
  filterReviewAssets,
  findOverrideForAsset,
  type AssetCorrection,
  type AssetOverridesFile,
  type AssetReviewDraft
} from "@/lib/asset-review";

type AssetReviewProps = {
  assets: AssetBrowserEntry[];
  initialOverrides: AssetOverridesFile;
};

export function AssetReview({ assets, initialOverrides }: AssetReviewProps) {
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [overrides, setOverrides] = useState(initialOverrides);
  const reviewAssets = useMemo(
    () => filterReviewAssets(assets, lowConfidenceOnly),
    [assets, lowConfidenceOnly]
  );
  const asset = reviewAssets[index] ?? reviewAssets[0] ?? null;
  const [draft, setDraft] = useState<AssetReviewDraft | null>(() =>
    asset ? createReviewDraft(asset, findOverrideForAsset(overrides, asset)) : null
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setIndex(0);
  }, [lowConfidenceOnly]);

  useEffect(() => {
    setDraft(asset ? createReviewDraft(asset, findOverrideForAsset(overrides, asset)) : null);
    setSaveState("idle");
  }, [asset, overrides]);

  function setDraftField<Key extends keyof AssetReviewDraft>(key: Key, value: AssetReviewDraft[Key]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaveState("idle");
  }

  function move(delta: number) {
    setIndex((current) => {
      if (reviewAssets.length === 0) {
        return 0;
      }

      return (current + delta + reviewAssets.length) % reviewAssets.length;
    });
  }

  async function saveCurrent() {
    if (!asset || !draft) {
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch("/api/assets/overrides", {
        body: JSON.stringify({
          assetId: asset.id,
          draft,
          relativePath: asset.relativePath
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Override save failed.");
      }

      const correction = buildCorrectionFromDraft(draft, asset);
      setOverrides((current) => ({
        overrides: {
          ...current.overrides,
          [asset.id]: correction
        }
      }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  if (!asset || !draft) {
    return (
      <section className="asset-empty">
        <h2>No Assets To Review</h2>
        <p>Disable the low-confidence filter or scan assets first.</p>
      </section>
    );
  }

  const correction = buildCorrectionFromDraft(draft, asset);
  const currentOverride = findOverrideForAsset(overrides, asset);

  return (
    <section className="review-shell" aria-label="Asset review">
      <aside className="asset-filters review-sidebar">
        <div className="filter-header">
          <h2>Review Queue</h2>
          <span>
            {index + 1} / {reviewAssets.length}
          </span>
        </div>

        <label className="check-field">
          <input
            checked={lowConfidenceOnly}
            onChange={(event) => setLowConfidenceOnly(event.target.checked)}
            type="checkbox"
          />
          <span>Low confidence only</span>
        </label>

        <div className="review-nav">
          <button type="button" onClick={() => move(-1)}>
            Previous
          </button>
          <button type="button" onClick={() => move(1)}>
            Next
          </button>
        </div>

        <div className="manifest-note">
          <span>{reviewAssets.length} in queue</span>
          <span>{Object.keys(overrides.overrides).length} saved corrections</span>
          {currentOverride ? <span>Current asset has an override</span> : <span>No override yet</span>}
        </div>
      </aside>

      <section className="review-stage">
        <div className="review-preview">
          <img alt="" src={asset.thumbnailUrl} />
        </div>
        <div className="review-asset-meta">
          <h2>{getFileName(asset.relativePath)}</h2>
          <dl>
            <div>
              <dt>Automatic Kind</dt>
              <dd>{asset.classification}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatPercent(asset.confidence)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {asset.width ?? "?"} x {asset.height ?? "?"}
              </dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>{asset.relativePath}</dd>
            </div>
          </dl>
        </div>
      </section>

      <aside className="asset-details review-form">
        <h2>Correction</h2>

        <div className="quick-kind-grid" aria-label="Quick kind buttons">
          {QUICK_REVIEW_KINDS.map((kind) => (
            <button
              className={draft.classification === kind ? "active" : ""}
              key={kind}
              onClick={() => setDraftField("classification", kind)}
              type="button"
            >
              {kind}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Kind</span>
          <select
            onChange={(event) => setDraftField("classification", event.target.value as ReviewAssetKind)}
            value={draft.classification}
          >
            {ASSET_REVIEW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tags</span>
          <textarea
            onChange={(event) => setDraftField("tagsText", event.target.value)}
            rows={3}
            value={draft.tagsText}
          />
        </label>

        <label className="field">
          <span>Theme</span>
          <input
            onChange={(event) => setDraftField("theme", event.target.value)}
            placeholder="dungeon, feywild, crypt..."
            value={draft.theme}
          />
        </label>

        <label className="field">
          <span>Usable For</span>
          <textarea
            onChange={(event) => setDraftField("usableForText", event.target.value)}
            placeholder="entrance, boss room, tavern..."
            rows={2}
            value={draft.usableForText}
          />
        </label>

        <label className="field">
          <span>Quality Score {draft.qualityScore}</span>
          <input
            max="100"
            min="0"
            onChange={(event) => setDraftField("qualityScore", Number(event.target.value))}
            step="1"
            type="range"
            value={draft.qualityScore}
          />
        </label>

        <button className="save-correction" disabled={saveState === "saving"} onClick={saveCurrent} type="button">
          {saveState === "saving" ? "Saving..." : "Save Correction"}
        </button>

        {saveState === "saved" ? <p className="save-note">Saved to asset-overrides.json.</p> : null}
        {saveState === "error" ? <p className="save-note error">Could not save correction.</p> : null}

        <CorrectionSummary correction={correction} />
      </aside>
    </section>
  );
}

function CorrectionSummary({ correction }: { correction: AssetCorrection }) {
  return (
    <section className="detail-block">
      <h3>Will Save</h3>
      <p>
        {correction.classification} - quality {correction.qualityScore} - {correction.tags.length} tags
      </p>
    </section>
  );
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}

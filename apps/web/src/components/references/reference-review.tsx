"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPercent } from "@/lib/asset-browser";
import {
  REFERENCE_REVIEW_MAP_TYPES,
  buildReferenceCorrectionFromDraft,
  createReferenceReviewDraft,
  filterReferenceReviewQueue,
  findReferenceOverride,
  type ReferenceCorrection,
  type ReferenceOverridesFile,
  type ReferenceReviewDraft,
  type ReferenceReviewMapType
} from "@/lib/reference-review";
import type { ReferenceMapView } from "@/lib/references";

type ReferenceReviewProps = {
  initialOverrides: ReferenceOverridesFile;
  references: ReferenceMapView[];
};

export function ReferenceReview({ initialOverrides, references }: ReferenceReviewProps) {
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [overrides, setOverrides] = useState(initialOverrides);
  const queue = useMemo(
    () => filterReferenceReviewQueue(references, { lowConfidenceOnly, unknownOnly }),
    [lowConfidenceOnly, references, unknownOnly]
  );
  const reference = queue[index] ?? queue[0] ?? null;
  const [draft, setDraft] = useState<ReferenceReviewDraft | null>(() =>
    reference ? createReferenceReviewDraft(reference, findReferenceOverride(overrides, reference)) : null
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setIndex(0);
  }, [lowConfidenceOnly, unknownOnly]);

  useEffect(() => {
    setDraft(reference ? createReferenceReviewDraft(reference, findReferenceOverride(overrides, reference)) : null);
    setSaveState("idle");
  }, [overrides, reference]);

  function setDraftField<Key extends keyof ReferenceReviewDraft>(
    key: Key,
    value: ReferenceReviewDraft[Key]
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaveState("idle");
  }

  function move(delta: number) {
    setIndex((current) => {
      if (queue.length === 0) {
        return 0;
      }

      return (current + delta + queue.length) % queue.length;
    });
  }

  async function saveCurrent() {
    if (!reference || !draft) {
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch("/api/references/overrides", {
        body: JSON.stringify({
          draft,
          referenceId: reference.id,
          referencePath: reference.path
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Reference override save failed.");
      }

      const correction = buildReferenceCorrectionFromDraft(draft);
      setOverrides((current) => ({
        overrides: {
          ...current.overrides,
          [reference.id]: correction
        }
      }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  if (!reference || !draft) {
    return (
      <section className="asset-empty">
        <h2>No References To Review</h2>
        <p>Disable filters or scan reference maps first.</p>
      </section>
    );
  }

  const correction = buildReferenceCorrectionFromDraft(draft);
  const currentOverride = findReferenceOverride(overrides, reference);

  return (
    <section className="review-shell" aria-label="Reference review">
      <aside className="asset-filters review-sidebar">
        <div className="filter-header">
          <h2>Review Queue</h2>
          <span>
            {index + 1} / {queue.length}
          </span>
        </div>

        <label className="check-field">
          <input
            checked={unknownOnly}
            onChange={(event) => setUnknownOnly(event.target.checked)}
            type="checkbox"
          />
          <span>Unknown type only</span>
        </label>

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
          <span>{queue.length} in queue</span>
          <span>{Object.keys(overrides.overrides).length} saved corrections</span>
          {currentOverride ? <span>Current reference has an override</span> : <span>No override yet</span>}
        </div>
      </aside>

      <section className="review-stage">
        <div className="reference-review-preview">
          <img alt="" src={reference.previewUrl} />
        </div>
        <div className="review-asset-meta">
          <h2>{getFileName(reference.path)}</h2>
          <dl>
            <div>
              <dt>Guessed Type</dt>
              <dd>{reference.mapType}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatPercent(reference.mapTypeConfidence)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {reference.width ?? "?"} x {reference.height ?? "?"}
              </dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>{reference.path}</dd>
            </div>
          </dl>
        </div>
      </section>

      <aside className="asset-details review-form">
        <h2>Correction</h2>

        <label className="field">
          <span>Map Type</span>
          <select
            onChange={(event) => setDraftField("mapType", event.target.value as ReferenceReviewMapType)}
            value={draft.mapType}
          >
            {REFERENCE_REVIEW_MAP_TYPES.map((mapType) => (
              <option key={mapType} value={mapType}>
                {mapType}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Theme Tags</span>
          <textarea
            onChange={(event) => setDraftField("themeTagsText", event.target.value)}
            rows={2}
            value={draft.themeTagsText}
          />
        </label>

        <label className="field">
          <span>Style Tags</span>
          <textarea
            onChange={(event) => setDraftField("styleTagsText", event.target.value)}
            placeholder="painted, parchment, realistic..."
            rows={2}
            value={draft.styleTagsText}
          />
        </label>

        <label className="field">
          <span>Layout Tags</span>
          <textarea
            onChange={(event) => setDraftField("layoutTagsText", event.target.value)}
            placeholder="linear, multi-level, open..."
            rows={2}
            value={draft.layoutTagsText}
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

        <label className="field">
          <span>Notes</span>
          <textarea
            onChange={(event) => setDraftField("notes", event.target.value)}
            placeholder="Grid visible, strong room layout, good cave branch..."
            rows={4}
            value={draft.notes}
          />
        </label>

        <button className="save-correction" disabled={saveState === "saving"} onClick={saveCurrent} type="button">
          {saveState === "saving" ? "Saving..." : "Save Correction"}
        </button>

        {saveState === "saved" ? <p className="save-note">Saved to reference-overrides.json.</p> : null}
        {saveState === "error" ? <p className="save-note error">Could not save correction.</p> : null}

        <CorrectionSummary correction={correction} />
      </aside>
    </section>
  );
}

function CorrectionSummary({ correction }: { correction: ReferenceCorrection }) {
  return (
    <section className="detail-block">
      <h3>Will Save</h3>
      <p>
        {correction.mapType} - quality {correction.qualityScore} - {correction.themeTags.length} theme tags
      </p>
    </section>
  );
}

function getFileName(referencePath: string): string {
  return referencePath.split(/[\\/]/u).at(-1) ?? referencePath;
}

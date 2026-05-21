"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPercent } from "@/lib/asset-browser";
import {
  REFERENCE_REVIEW_MAP_TYPES,
  buildReferenceCorrectionFromDraft,
  createReferenceReviewDraft,
  filterReferenceReviewQueue,
  formatReferenceMapType,
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
        throw new Error("Salvataggio override riferimento fallito.");
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
        <h2>Nessun riferimento da revisionare</h2>
        <p>Disattiva i filtri oppure indicizza prima le mappe di riferimento.</p>
      </section>
    );
  }

  const correction = buildReferenceCorrectionFromDraft(draft);
  const currentOverride = findReferenceOverride(overrides, reference);

  return (
    <section className="review-shell" aria-label="Revisione riferimenti">
      <aside className="asset-filters review-sidebar">
        <div className="filter-header">
          <h2>Coda revisione</h2>
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
          <span>Solo tipo sconosciuto</span>
        </label>

        <label className="check-field">
          <input
            checked={lowConfidenceOnly}
            onChange={(event) => setLowConfidenceOnly(event.target.checked)}
            type="checkbox"
          />
          <span>Solo bassa affidabilita</span>
        </label>

        <div className="review-nav">
          <button type="button" onClick={() => move(-1)}>
            Precedente
          </button>
          <button type="button" onClick={() => move(1)}>
            Successivo
          </button>
        </div>

        <div className="manifest-note">
          <span>{queue.length} in coda</span>
          <span>{Object.keys(overrides.overrides).length} correzioni salvate</span>
          {currentOverride ? <span>Questo riferimento ha gia un override</span> : <span>Nessun override</span>}
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
              <dt>Tipo rilevato</dt>
              <dd>{formatReferenceMapType(reference.mapType)}</dd>
            </div>
            <div>
              <dt>Affidabilita</dt>
              <dd>{formatPercent(reference.mapTypeConfidence)}</dd>
            </div>
            <div>
              <dt>Dimensioni</dt>
              <dd>
                {reference.width ?? "?"} x {reference.height ?? "?"}
              </dd>
            </div>
            <div>
              <dt>Percorso</dt>
              <dd>{reference.path}</dd>
            </div>
          </dl>
        </div>
      </section>

      <aside className="asset-details review-form">
        <h2>Correzione</h2>

        <label className="field">
          <span>Tipo mappa</span>
          <select
            onChange={(event) => setDraftField("mapType", event.target.value as ReferenceReviewMapType)}
            value={draft.mapType}
          >
            {REFERENCE_REVIEW_MAP_TYPES.map((mapType) => (
              <option key={mapType} value={mapType}>
                {formatReferenceMapType(mapType)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tag tema</span>
          <textarea
            onChange={(event) => setDraftField("themeTagsText", event.target.value)}
            rows={2}
            value={draft.themeTagsText}
          />
        </label>

        <label className="field">
          <span>Tag stile</span>
          <textarea
            onChange={(event) => setDraftField("styleTagsText", event.target.value)}
            placeholder="dipinta, pergamena, realistica..."
            rows={2}
            value={draft.styleTagsText}
          />
        </label>

        <label className="field">
          <span>Tag layout</span>
          <textarea
            onChange={(event) => setDraftField("layoutTagsText", event.target.value)}
            placeholder="lineare, multipiano, aperta..."
            rows={2}
            value={draft.layoutTagsText}
          />
        </label>

        <label className="field">
          <span>Punteggio qualita {draft.qualityScore}</span>
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
          <span>Note</span>
          <textarea
            onChange={(event) => setDraftField("notes", event.target.value)}
            placeholder="Griglia visibile, layout stanze chiaro, buon ramo grotta..."
            rows={4}
            value={draft.notes}
          />
        </label>

        <button className="save-correction" disabled={saveState === "saving"} onClick={saveCurrent} type="button">
          {saveState === "saving" ? "Salvataggio..." : "Salva correzione"}
        </button>

        {saveState === "saved" ? <p className="save-note">Salvato in reference-overrides.json.</p> : null}
        {saveState === "error" ? <p className="save-note error">Impossibile salvare la correzione.</p> : null}

        <CorrectionSummary correction={correction} />
      </aside>
    </section>
  );
}

function CorrectionSummary({ correction }: { correction: ReferenceCorrection }) {
  return (
    <section className="detail-block">
      <h3>Verra salvato</h3>
      <p>
        {formatReferenceMapType(correction.mapType)} - qualita {correction.qualityScore} -{" "}
        {correction.themeTags.length} tag tema
      </p>
    </section>
  );
}

function getFileName(referencePath: string): string {
  return referencePath.split(/[\\/]/u).at(-1) ?? referencePath;
}

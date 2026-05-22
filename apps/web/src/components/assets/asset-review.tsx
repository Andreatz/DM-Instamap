"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSET_REVIEW_KINDS,
  QUICK_REVIEW_KINDS,
  formatAssetKind,
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
    asset
      ? createReviewDraft(asset, findOverrideForAsset(overrides, asset))
      : null
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset dell'indice al cambio del filtro; la dipendenza e usata come trigger, non come valore letto
  useEffect(() => {
    setIndex(0);
  }, [lowConfidenceOnly]);

  useEffect(() => {
    setDraft(
      asset
        ? createReviewDraft(asset, findOverrideForAsset(overrides, asset))
        : null
    );
    setSaveState("idle");
  }, [asset, overrides]);

  function setDraftField<Key extends keyof AssetReviewDraft>(
    key: Key,
    value: AssetReviewDraft[Key]
  ) {
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
        throw new Error("Salvataggio override fallito.");
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
        <h2>Nessun asset da revisionare</h2>
        <p>
          Disattiva il filtro bassa affidabilita oppure indicizza prima gli
          asset.
        </p>
      </section>
    );
  }

  const correction = buildCorrectionFromDraft(draft, asset);
  const currentOverride = findOverrideForAsset(overrides, asset);

  return (
    <section className="review-shell" aria-label="Revisione asset">
      <aside className="asset-filters review-sidebar">
        <div className="filter-header">
          <h2>Coda revisione</h2>
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
          <span>{reviewAssets.length} in coda</span>
          <span>
            {Object.keys(overrides.overrides).length} correzioni salvate
          </span>
          {currentOverride ? (
            <span>Questo asset ha gia un override</span>
          ) : (
            <span>Nessun override</span>
          )}
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
              <dt>Tipo automatico</dt>
              <dd>{formatAssetKind(asset.classification)}</dd>
            </div>
            <div>
              <dt>Affidabilita</dt>
              <dd>{formatPercent(asset.confidence)}</dd>
            </div>
            <div>
              <dt>Dimensioni</dt>
              <dd>
                {asset.width ?? "?"} x {asset.height ?? "?"}
              </dd>
            </div>
            <div>
              <dt>Percorso</dt>
              <dd>{asset.relativePath}</dd>
            </div>
          </dl>
        </div>
      </section>

      <aside className="asset-details review-form">
        <h2>Correzione</h2>

        <div
          className="quick-kind-grid"
          role="group"
          aria-label="Pulsanti rapidi tipo asset"
        >
          {QUICK_REVIEW_KINDS.map((kind) => (
            <button
              className={draft.classification === kind ? "active" : ""}
              key={kind}
              onClick={() => setDraftField("classification", kind)}
              type="button"
            >
              {formatAssetKind(kind)}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Tipo</span>
          <select
            onChange={(event) =>
              setDraftField(
                "classification",
                event.target.value as ReviewAssetKind
              )
            }
            value={draft.classification}
          >
            {ASSET_REVIEW_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {formatAssetKind(kind)}
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
          <span>Tema</span>
          <input
            onChange={(event) => setDraftField("theme", event.target.value)}
            placeholder="dungeon, feywild, crypt..."
            value={draft.theme}
          />
        </label>

        <label className="field">
          <span>Usabile per</span>
          <textarea
            onChange={(event) =>
              setDraftField("usableForText", event.target.value)
            }
            placeholder="entrance, boss room, tavern..."
            rows={2}
            value={draft.usableForText}
          />
        </label>

        <label className="field">
          <span>Punteggio qualita {draft.qualityScore}</span>
          <input
            max="100"
            min="0"
            onChange={(event) =>
              setDraftField("qualityScore", Number(event.target.value))
            }
            step="1"
            type="range"
            value={draft.qualityScore}
          />
        </label>

        <button
          className="save-correction"
          disabled={saveState === "saving"}
          onClick={saveCurrent}
          type="button"
        >
          {saveState === "saving" ? "Salvataggio..." : "Salva correzione"}
        </button>

        {saveState === "saved" ? (
          <p className="save-note">Salvato in asset-overrides.json.</p>
        ) : null}
        {saveState === "error" ? (
          <p className="save-note error">Impossibile salvare la correzione.</p>
        ) : null}

        <CorrectionSummary correction={correction} />
      </aside>
    </section>
  );
}

function CorrectionSummary({ correction }: { correction: AssetCorrection }) {
  return (
    <section className="detail-block">
      <h3>Verra salvato</h3>
      <p>
        {formatAssetKind(correction.classification)} - qualita{" "}
        {correction.qualityScore} - {correction.tags.length} tag
      </p>
    </section>
  );
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}

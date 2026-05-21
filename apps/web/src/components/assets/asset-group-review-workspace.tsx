"use client";

import { useMemo, useState } from "react";
import { ASSET_REVIEW_KINDS, formatAssetKind, type ReviewAssetKind } from "@/lib/asset-browser";
import type {
  AssetGroupReviewDraft,
  AssetGroupReviewItem,
  AssetGroupReviewStats,
  AssetGroupReviewsFile,
  GroupReviewQueue
} from "@/lib/asset-group-review";

type AssetGroupReviewWorkspaceProps = {
  initialItems: AssetGroupReviewItem[];
  initialReviews: AssetGroupReviewsFile;
  initialStats: AssetGroupReviewStats;
};

const QUEUES: Array<{ id: GroupReviewQueue; label: string }> = [
  { id: "largest-unreviewed", label: "Non revisionati piu grandi" },
  { id: "low-confidence", label: "Bassa affidabilita" },
  { id: "unknown", label: "Asset sconosciuti" },
  { id: "most-used", label: "Piu usati" },
  { id: "random-sample", label: "Campione casuale" }
];

export function AssetGroupReviewWorkspace({
  initialItems,
  initialReviews,
  initialStats
}: AssetGroupReviewWorkspaceProps) {
  const [items, setItems] = useState(initialItems);
  const [reviews, setReviews] = useState(initialReviews);
  const [stats, setStats] = useState(initialStats);
  const [queue, setQueue] = useState<GroupReviewQueue>("largest-unreviewed");
  const [selectedGroupId, setSelectedGroupId] = useState(initialItems[0]?.group.id ?? "");
  const [thumbLimit, setThumbLimit] = useState<12 | 24>(12);
  const selectedItem = items.find((item) => item.group.id === selectedGroupId) ?? items[0] ?? null;
  const [draft, setDraft] = useState<AssetGroupReviewDraft>(() => createDraft(selectedItem));
  const [tagBatchText, setTagBatchText] = useState("");
  const [removeAssetId, setRemoveAssetId] = useState("");
  const [splitAssetIdsText, setSplitAssetIdsText] = useState("");
  const [splitName, setSplitName] = useState("");
  const [mergeGroupIdsText, setMergeGroupIdsText] = useState("");
  const [mergeName, setMergeName] = useState("");
  const [status, setStatus] = useState("Pronto");
  const queueItems = useMemo(() => selectQueue(items, queue), [items, queue]);

  function selectGroup(groupId: string) {
    const item = items.find((candidate) => candidate.group.id === groupId) ?? null;
    setSelectedGroupId(groupId);
    setDraft(createDraft(item));
    setRemoveAssetId(item?.visibleAssetIds[0] ?? "");
    setSplitAssetIdsText("");
    setStatus("Pronto");
  }

  async function submit(action: Record<string, unknown>, label: string) {
    setStatus("Salvataggio...");

    try {
      const response = await fetch("/api/asset-groups/review", {
        body: JSON.stringify(action),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Impossibile salvare l'azione di revisione gruppo.");
      }

      const payload = (await response.json()) as { reviews: AssetGroupReviewsFile };
      setReviews(payload.reviews);
      setItems((current) => applyLocalAction(current, action));
      setStats(calculateStats(applyLocalAction(items, action)));
      setStatus(label);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile salvare l'azione di revisione gruppo.");
    }
  }

  if (!selectedItem) {
    return (
      <section className="asset-empty">
        <h2>Nessun gruppo da revisionare</h2>
        <p>Genera prima i gruppi di asset.</p>
      </section>
    );
  }

  return (
    <section className="group-review-shell" aria-label="Revisione gruppi asset">
      <aside className="asset-filters group-review-sidebar">
        <div className="filter-header">
          <h2>Code</h2>
          <span>{queueItems.length}</span>
        </div>
        <div className="group-review-queues">
          {QUEUES.map((option) => (
            <button
              className={queue === option.id ? "active" : ""}
              key={option.id}
              onClick={() => setQueue(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <section className="detail-block group-review-stats">
          <h3>Avanzamento</h3>
          <dl>
            <div>
              <dt>Asset totali</dt>
              <dd>{stats.totalAssets}</dd>
            </div>
            <div>
              <dt>Asset revisionati</dt>
              <dd>{stats.reviewedAssets}</dd>
            </div>
            <div>
              <dt>Gruppi revisionati</dt>
              <dd>{stats.reviewedGroups}</dd>
            </div>
            <div>
              <dt>Sconosciuti rimanenti</dt>
              <dd>{stats.unknownRemaining}</dd>
            </div>
            <div>
              <dt>Bassa affidabilita</dt>
              <dd>{stats.lowConfidenceRemaining}</dd>
            </div>
          </dl>
        </section>
      </aside>

      <section className="group-review-list">
        {queueItems.map((item) => (
          <button
            className={selectedItem.group.id === item.group.id ? "group-review-row active" : "group-review-row"}
            key={item.group.id}
            onClick={() => selectGroup(item.group.id)}
            type="button"
          >
            <span className="group-review-row-thumb">
              {item.group.previewUrl ? <img alt="" src={item.group.previewUrl} /> : null}
            </span>
            <span>
              <strong>{item.group.name}</strong>
              <small>
                {formatAssetKind(item.group.kind)} - {item.assetCount} asset - affidabilita{" "}
                {item.confidenceAverage === null ? "n/d" : `${Math.round(item.confidenceAverage * 100)}%`}
              </small>
            </span>
            {item.reviewed ? <em>revisionato</em> : null}
          </button>
        ))}
      </section>

      <aside className="asset-details group-review-detail">
        <h2>{selectedItem.group.name}</h2>
        <dl>
          <div>
            <dt>Tipo</dt>
            <dd>{formatAssetKind(selectedItem.group.kind)}</dd>
          </div>
          <div>
            <dt>Asset</dt>
            <dd>{selectedItem.assetCount}</dd>
          </div>
          <div>
            <dt>Affidabilita media</dt>
            <dd>
              {selectedItem.confidenceAverage === null
                ? "n/d"
                : `${Math.round(selectedItem.confidenceAverage * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>Sconosciuti</dt>
            <dd>{selectedItem.unknownCount}</dd>
          </div>
        </dl>

        <div className="tag-list">
          {selectedItem.group.tags.slice(0, 16).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <div className="group-review-thumb-toolbar">
          <span>{thumbLimit} anteprime rappresentative</span>
          <button onClick={() => setThumbLimit(thumbLimit === 12 ? 24 : 12)} type="button">
            Mostra {thumbLimit === 12 ? 24 : 12}
          </button>
        </div>

        <div className="group-review-thumbs">
          {selectedItem.previewAssets.slice(0, thumbLimit).map((asset) => (
            <figure key={asset.id}>
              <img alt="" src={asset.thumbnailUrl} />
              <figcaption>{formatAssetKind(asset.classification)}</figcaption>
            </figure>
          ))}
        </div>

        <div className="group-review-actions">
          <button
            className="save-correction"
            onClick={() => submit({ action: "confirm", groupId: selectedItem.group.id }, "Gruppo confermato")}
            type="button"
          >
            Conferma gruppo
          </button>

          <label className="field">
            <span>Tipo</span>
            <select onChange={(event) => setDraft({ ...draft, kind: event.target.value as ReviewAssetKind })} value={draft.kind}>
              {ASSET_REVIEW_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {formatAssetKind(kind)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tags</span>
            <textarea onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} rows={2} value={draft.tagsText} />
          </label>

          <label className="field">
            <span>Tema</span>
            <input onChange={(event) => setDraft({ ...draft, theme: event.target.value })} value={draft.theme} />
          </label>

          <label className="field">
            <span>Usabile per</span>
            <textarea
              onChange={(event) => setDraft({ ...draft, usableForText: event.target.value })}
              rows={2}
              value={draft.usableForText}
            />
          </label>

          <label className="field">
            <span>Punteggio qualita {draft.qualityScore}</span>
            <input
              max="100"
              min="0"
              onChange={(event) => setDraft({ ...draft, qualityScore: Number(event.target.value) })}
              type="range"
              value={draft.qualityScore}
            />
          </label>

          <button
            className="save-correction"
            onClick={() =>
              submit({ action: "correct", draft, groupId: selectedItem.group.id }, "Correzione gruppo salvata")
            }
            type="button"
          >
            Salva correzione gruppo
          </button>
        </div>

        <section className="detail-block group-review-batch">
          <h3>Operazioni a lotto</h3>

          <label className="field">
            <span>Aggiungi tag</span>
            <input onChange={(event) => setTagBatchText(event.target.value)} value={tagBatchText} />
          </label>
          <button
            onClick={() =>
              submit(
                { action: "add-tags", groupId: selectedItem.group.id, tagsText: tagBatchText },
                "Tag aggiunti al gruppo"
              )
            }
            type="button"
          >
            Aggiungi tag al gruppo
          </button>

          <label className="field">
            <span>Rimuovi asset errato</span>
            <select onChange={(event) => setRemoveAssetId(event.target.value)} value={removeAssetId}>
              {selectedItem.assets.slice(0, 100).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.relativePath}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              submit(
                { action: "remove-asset", assetId: removeAssetId, groupId: selectedItem.group.id },
                "Asset rimosso dalla revisione gruppo"
              )
            }
            type="button"
          >
            Rimuovi dal gruppo
          </button>

          <label className="field">
            <span>ID asset da separare</span>
            <textarea
              onChange={(event) => setSplitAssetIdsText(event.target.value)}
              placeholder="asset-a, asset-b"
              rows={2}
              value={splitAssetIdsText}
            />
          </label>
          <label className="field">
            <span>Nome separazione</span>
            <input onChange={(event) => setSplitName(event.target.value)} value={splitName} />
          </label>
          <button
            onClick={() =>
              submit(
                {
                  action: "split",
                  assetIds: parseList(splitAssetIdsText),
                  groupId: selectedItem.group.id,
                  name: splitName
                },
                "Separazione salvata"
              )
            }
            type="button"
          >
            Salva separazione
          </button>

          <label className="field">
            <span>ID gruppi da unire</span>
            <textarea
              onChange={(event) => setMergeGroupIdsText(event.target.value)}
              placeholder={`${selectedItem.group.id}, group-other`}
              rows={2}
              value={mergeGroupIdsText}
            />
          </label>
          <label className="field">
            <span>Nome unione</span>
            <input onChange={(event) => setMergeName(event.target.value)} value={mergeName} />
          </label>
          <button
            onClick={() =>
              submit({ action: "merge", groupIds: parseList(mergeGroupIdsText), name: mergeName }, "Unione salvata")
            }
            type="button"
          >
            Salva unione
          </button>
        </section>

        <p className="save-note">{status}</p>
        <p className="manifest-note">
          Metadati salvati: {Object.keys(reviews.reviewedGroups).length} revisioni gruppo, {reviews.splits.length} separazioni,{" "}
          {reviews.merges.length} unioni.
        </p>
      </aside>
    </section>
  );
}

function createDraft(item: AssetGroupReviewItem | null): AssetGroupReviewDraft {
  if (!item) {
    return {
      kind: "unknown",
      qualityScore: 50,
      tagsText: "",
      theme: "",
      usableForText: ""
    };
  }

  const correction = item.review?.correction;

  return {
    kind: normalizeKind(correction?.kind ?? item.group.kind),
    qualityScore: correction?.qualityScore ?? item.group.qualityScore ?? Math.round((item.confidenceAverage ?? 0.5) * 100),
    tagsText: (correction?.tags ?? item.group.tags).join(", "),
    theme: correction?.theme ?? item.group.theme ?? "",
    usableForText: (correction?.usableFor ?? item.group.usableFor).join(", ")
  };
}

function selectQueue(items: AssetGroupReviewItem[], queue: GroupReviewQueue): AssetGroupReviewItem[] {
  const unreviewed = items.filter((item) => !item.reviewed);

  if (queue === "low-confidence") {
    return unreviewed.filter((item) => item.lowConfidenceCount > 0).sort((a, b) => (a.confidenceAverage ?? 1) - (b.confidenceAverage ?? 1));
  }

  if (queue === "unknown") {
    return unreviewed.filter((item) => item.unknownCount > 0).sort((a, b) => b.unknownCount - a.unknownCount);
  }

  if (queue === "most-used") {
    return unreviewed.sort((a, b) => b.usageCount - a.usageCount || b.assetCount - a.assetCount);
  }

  if (queue === "random-sample") {
    return [...unreviewed].sort((a, b) => stableScore(a.group.id) - stableScore(b.group.id));
  }

  return unreviewed.sort((a, b) => b.assetCount - a.assetCount);
}

function applyLocalAction(items: AssetGroupReviewItem[], action: Record<string, unknown>): AssetGroupReviewItem[] {
  if (typeof action.groupId !== "string") {
    return items;
  }

  return items.map((item) => {
    if (item.group.id !== action.groupId) {
      return item;
    }

    if (action.action === "remove-asset" && typeof action.assetId === "string") {
      const assets = item.assets.filter((asset) => asset.id !== action.assetId);
      return {
        ...item,
        assetCount: assets.length,
        assets,
        previewAssets: assets.slice(0, 24),
        visibleAssetIds: assets.map((asset) => asset.id)
      };
    }

    if (action.action === "confirm" || action.action === "correct" || action.action === "add-tags") {
      return {
        ...item,
        reviewed: true,
        review: {
          ...item.review,
          reviewedAt: new Date().toISOString()
        }
      };
    }

    return item;
  });
}

function calculateStats(items: AssetGroupReviewItem[]): AssetGroupReviewStats {
  const reviewedAssets = new Set<string>();

  for (const item of items) {
    if (item.reviewed) {
      item.visibleAssetIds.forEach((assetId) => reviewedAssets.add(assetId));
    }
  }

  return {
    lowConfidenceRemaining: items.reduce((sum, item) => sum + (item.reviewed ? 0 : item.lowConfidenceCount), 0),
    reviewedAssets: reviewedAssets.size,
    reviewedGroups: items.filter((item) => item.reviewed).length,
    totalAssets: new Set(items.flatMap((item) => item.visibleAssetIds)).size,
    unknownRemaining: items.reduce((sum, item) => sum + (item.reviewed ? 0 : item.unknownCount), 0)
  };
}

function parseList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function normalizeKind(value: string): ReviewAssetKind {
  return ASSET_REVIEW_KINDS.includes(value as ReviewAssetKind) ? (value as ReviewAssetKind) : "unknown";
}

function stableScore(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0xffffffff;
}

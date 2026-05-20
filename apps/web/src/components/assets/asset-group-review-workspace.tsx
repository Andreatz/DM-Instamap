"use client";

import { useMemo, useState } from "react";
import { ASSET_REVIEW_KINDS, type ReviewAssetKind } from "@/lib/asset-browser";
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
  { id: "largest-unreviewed", label: "Largest unreviewed" },
  { id: "low-confidence", label: "Low confidence" },
  { id: "unknown", label: "Unknown assets" },
  { id: "most-used", label: "Most used" },
  { id: "random-sample", label: "Random sample" }
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
  const [status, setStatus] = useState("Ready");
  const queueItems = useMemo(() => selectQueue(items, queue), [items, queue]);

  function selectGroup(groupId: string) {
    const item = items.find((candidate) => candidate.group.id === groupId) ?? null;
    setSelectedGroupId(groupId);
    setDraft(createDraft(item));
    setRemoveAssetId(item?.visibleAssetIds[0] ?? "");
    setSplitAssetIdsText("");
    setStatus("Ready");
  }

  async function submit(action: Record<string, unknown>, label: string) {
    setStatus("Saving...");

    try {
      const response = await fetch("/api/asset-groups/review", {
        body: JSON.stringify(action),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Could not save group review action.");
      }

      const payload = (await response.json()) as { reviews: AssetGroupReviewsFile };
      setReviews(payload.reviews);
      setItems((current) => applyLocalAction(current, action));
      setStats(calculateStats(applyLocalAction(items, action)));
      setStatus(label);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save group review action.");
    }
  }

  if (!selectedItem) {
    return (
      <section className="asset-empty">
        <h2>No Groups To Review</h2>
        <p>Generate asset groups first.</p>
      </section>
    );
  }

  return (
    <section className="group-review-shell" aria-label="Group asset review">
      <aside className="asset-filters group-review-sidebar">
        <div className="filter-header">
          <h2>Queues</h2>
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
          <h3>Progress</h3>
          <dl>
            <div>
              <dt>Total assets</dt>
              <dd>{stats.totalAssets}</dd>
            </div>
            <div>
              <dt>Reviewed assets</dt>
              <dd>{stats.reviewedAssets}</dd>
            </div>
            <div>
              <dt>Reviewed groups</dt>
              <dd>{stats.reviewedGroups}</dd>
            </div>
            <div>
              <dt>Unknown remaining</dt>
              <dd>{stats.unknownRemaining}</dd>
            </div>
            <div>
              <dt>Low confidence</dt>
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
                {item.group.kind} - {item.assetCount} assets - confidence{" "}
                {item.confidenceAverage === null ? "n/a" : `${Math.round(item.confidenceAverage * 100)}%`}
              </small>
            </span>
            {item.reviewed ? <em>reviewed</em> : null}
          </button>
        ))}
      </section>

      <aside className="asset-details group-review-detail">
        <h2>{selectedItem.group.name}</h2>
        <dl>
          <div>
            <dt>Kind</dt>
            <dd>{selectedItem.group.kind}</dd>
          </div>
          <div>
            <dt>Assets</dt>
            <dd>{selectedItem.assetCount}</dd>
          </div>
          <div>
            <dt>Confidence Average</dt>
            <dd>
              {selectedItem.confidenceAverage === null
                ? "n/a"
                : `${Math.round(selectedItem.confidenceAverage * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>Unknown</dt>
            <dd>{selectedItem.unknownCount}</dd>
          </div>
        </dl>

        <div className="tag-list">
          {selectedItem.group.tags.slice(0, 16).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <div className="group-review-thumb-toolbar">
          <span>{thumbLimit} representative thumbnails</span>
          <button onClick={() => setThumbLimit(thumbLimit === 12 ? 24 : 12)} type="button">
            Show {thumbLimit === 12 ? 24 : 12}
          </button>
        </div>

        <div className="group-review-thumbs">
          {selectedItem.previewAssets.slice(0, thumbLimit).map((asset) => (
            <figure key={asset.id}>
              <img alt="" src={asset.thumbnailUrl} />
              <figcaption>{asset.classification}</figcaption>
            </figure>
          ))}
        </div>

        <div className="group-review-actions">
          <button
            className="save-correction"
            onClick={() => submit({ action: "confirm", groupId: selectedItem.group.id }, "Group confirmed")}
            type="button"
          >
            Confirm Group
          </button>

          <label className="field">
            <span>Kind</span>
            <select onChange={(event) => setDraft({ ...draft, kind: event.target.value as ReviewAssetKind })} value={draft.kind}>
              {ASSET_REVIEW_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tags</span>
            <textarea onChange={(event) => setDraft({ ...draft, tagsText: event.target.value })} rows={2} value={draft.tagsText} />
          </label>

          <label className="field">
            <span>Theme</span>
            <input onChange={(event) => setDraft({ ...draft, theme: event.target.value })} value={draft.theme} />
          </label>

          <label className="field">
            <span>Usable For</span>
            <textarea
              onChange={(event) => setDraft({ ...draft, usableForText: event.target.value })}
              rows={2}
              value={draft.usableForText}
            />
          </label>

          <label className="field">
            <span>Quality Score {draft.qualityScore}</span>
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
              submit({ action: "correct", draft, groupId: selectedItem.group.id }, "Group correction saved")
            }
            type="button"
          >
            Save Group Correction
          </button>
        </div>

        <section className="detail-block group-review-batch">
          <h3>Batch Operations</h3>

          <label className="field">
            <span>Add Tags</span>
            <input onChange={(event) => setTagBatchText(event.target.value)} value={tagBatchText} />
          </label>
          <button
            onClick={() =>
              submit(
                { action: "add-tags", groupId: selectedItem.group.id, tagsText: tagBatchText },
                "Tags added to group"
              )
            }
            type="button"
          >
            Add Tags To Group
          </button>

          <label className="field">
            <span>Remove Wrong Asset</span>
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
                "Asset removed from group review"
              )
            }
            type="button"
          >
            Remove From Group
          </button>

          <label className="field">
            <span>Split Asset IDs</span>
            <textarea
              onChange={(event) => setSplitAssetIdsText(event.target.value)}
              placeholder="asset-a, asset-b"
              rows={2}
              value={splitAssetIdsText}
            />
          </label>
          <label className="field">
            <span>Split Name</span>
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
                "Split saved"
              )
            }
            type="button"
          >
            Save Split
          </button>

          <label className="field">
            <span>Merge Group IDs</span>
            <textarea
              onChange={(event) => setMergeGroupIdsText(event.target.value)}
              placeholder={`${selectedItem.group.id}, group-other`}
              rows={2}
              value={mergeGroupIdsText}
            />
          </label>
          <label className="field">
            <span>Merge Name</span>
            <input onChange={(event) => setMergeName(event.target.value)} value={mergeName} />
          </label>
          <button
            onClick={() =>
              submit({ action: "merge", groupIds: parseList(mergeGroupIdsText), name: mergeName }, "Merge saved")
            }
            type="button"
          >
            Save Merge
          </button>
        </section>

        <p className="save-note">{status}</p>
        <p className="manifest-note">
          Saved metadata: {Object.keys(reviews.reviewedGroups).length} group reviews, {reviews.splits.length} splits,{" "}
          {reviews.merges.length} merges.
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

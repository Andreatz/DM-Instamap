"use client";

import { useMemo, useState } from "react";
import type {
  TaxonomyGroupsSummary,
  TaxonomyGroupView
} from "@/lib/asset-taxonomy-groups";
import {
  REVIEW_STATUSES,
  type ReviewStatus
} from "@/lib/asset-taxonomy-review";

const MACRO_CATEGORIES = [
  "floor",
  "wall",
  "door",
  "window",
  "furniture",
  "prop",
  "decoration",
  "light",
  "terrain",
  "water",
  "roof",
  "token",
  "unknown"
] as const;

type ReviewWorkspaceProps = {
  generatedAt: string | null;
  groups: TaxonomyGroupView[];
  initialOverrideCount: number;
  summary: TaxonomyGroupsSummary;
};

type GroupOutcome = {
  changed: number;
  memberCount: number;
  status: "ok" | "error";
  message: string;
};

type CorrectionDraft = {
  macroCategory: string;
  assetGroups: string;
  themeTags: string;
  status: "" | ReviewStatus;
};

export function AssetTaxonomyReviewWorkspace({
  generatedAt,
  groups,
  initialOverrideCount,
  summary
}: ReviewWorkspaceProps) {
  const [macroFilter, setMacroFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("attention");
  const [query, setQuery] = useState("");
  const [overrideCount, setOverrideCount] = useState(initialOverrideCount);
  const [outcomes, setOutcomes] = useState<Record<string, GroupOutcome>>({});
  const [drafts, setDrafts] = useState<Record<string, CorrectionDraft>>({});
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  const visibleGroups = useMemo(
    () => filterAndSort(groups, { macroFilter, query, statusFilter }),
    [groups, macroFilter, statusFilter, query]
  );

  async function runAction(
    groupId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    setBusyGroupId(groupId);
    try {
      const response = await fetch("/api/asset-groups/review", {
        body: JSON.stringify({ ...payload, groupId }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = (await response.json()) as {
        changed?: number;
        memberCount?: number;
        overrideCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Azione fallita");
      }
      setOverrideCount(data.overrideCount ?? overrideCount);
      setOutcomes((current) => ({
        ...current,
        [groupId]: {
          changed: data.changed ?? 0,
          memberCount: data.memberCount ?? 0,
          message: `${data.changed ?? 0}/${data.memberCount ?? 0} asset aggiornati`,
          status: "ok"
        }
      }));
    } catch (error) {
      setOutcomes((current) => ({
        ...current,
        [groupId]: {
          changed: 0,
          memberCount: 0,
          message: error instanceof Error ? error.message : "Azione fallita",
          status: "error"
        }
      }));
    } finally {
      setBusyGroupId(null);
    }
  }

  function draftFor(group: TaxonomyGroupView): CorrectionDraft {
    return drafts[group.id] ?? createDraftForGroup(group);
  }

  function updateDraft(
    group: TaxonomyGroupView,
    patch: Partial<CorrectionDraft>
  ) {
    setDrafts((current) => {
      const base = current[group.id] ?? createDraftForGroup(group);
      return {
        ...current,
        [group.id]: { ...base, ...patch }
      };
    });
  }

  return (
    <section className="asset-browser" aria-label="Revisione gruppi semantici">
      <aside className="asset-filters">
        <div className="filter-header">
          <h2>Filtri</h2>
        </div>

        <div className="manifest-note">
          <span>{overrideCount} override registrati</span>
          <span>
            Applica con <code>pnpm assets:manifest</code>
          </span>
          {generatedAt ? (
            <span>Manifest {new Date(generatedAt).toLocaleString()}</span>
          ) : null}
        </div>

        <label className="field">
          <span>Cerca</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Categoria, gruppo, tema..."
            type="search"
            value={query}
          />
        </label>

        <label className="field">
          <span>Stato</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="attention">Da revisionare (default)</option>
            <option value="all">Tutti</option>
            {summary.statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Macro categoria</span>
          <select
            onChange={(event) => setMacroFilter(event.target.value)}
            value={macroFilter}
          >
            <option value="all">Tutte</option>
            {summary.macroCategories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <div className="manifest-note">
          <span>{visibleGroups.length} gruppi mostrati</span>
        </div>
      </aside>

      <div className="asset-results">
        <section className="group-grid" aria-label="Gruppi da revisionare">
          {visibleGroups.map((group) => {
            const draft = draftFor(group);
            const outcome = outcomes[group.id];
            const busy = busyGroupId === group.id;

            return (
              <article className="group-card" key={group.id}>
                <div className="group-preview">
                  {group.previewUrl ? (
                    <img alt="" loading="lazy" src={group.previewUrl} />
                  ) : null}
                </div>
                <div className="group-card-body">
                  <div className="group-title-row">
                    <h2>{group.name}</h2>
                    <span>{group.assetCount}</span>
                  </div>
                  <div className="status-counts">
                    {REVIEW_STATUSES.map((status) =>
                      group.statusCounts[status] > 0 ? (
                        <span key={status}>
                          {status} {group.statusCounts[status]}
                        </span>
                      ) : null
                    )}
                  </div>

                  <div className="review-actions">
                    <button
                      disabled={busy}
                      onClick={() => runAction(group.id, { type: "confirm" })}
                      type="button"
                    >
                      Approva gruppo
                    </button>
                  </div>

                  <details className="detail-block">
                    <summary>Correggi classificazione</summary>
                    <label className="field">
                      <span>Macro categoria</span>
                      <select
                        onChange={(event) =>
                          updateDraft(group, {
                            macroCategory: event.target.value
                          })
                        }
                        value={draft.macroCategory}
                      >
                        {MACRO_CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Asset groups (csv)</span>
                      <input
                        onChange={(event) =>
                          updateDraft(group, {
                            assetGroups: event.target.value
                          })
                        }
                        type="text"
                        value={draft.assetGroups}
                      />
                    </label>
                    <label className="field">
                      <span>Theme tags (csv)</span>
                      <input
                        onChange={(event) =>
                          updateDraft(group, {
                            themeTags: event.target.value
                          })
                        }
                        type="text"
                        value={draft.themeTags}
                      />
                    </label>
                    <label className="field">
                      <span>Stato</span>
                      <select
                        onChange={(event) =>
                          updateDraft(group, {
                            status: event.target
                              .value as CorrectionDraft["status"]
                          })
                        }
                        value={draft.status}
                      >
                        <option value="">(invariato)</option>
                        {REVIEW_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy}
                      onClick={() =>
                        runAction(group.id, {
                          assetGroups: csv(draft.assetGroups),
                          macroCategory: draft.macroCategory,
                          status: draft.status || undefined,
                          themeTags: csv(draft.themeTags),
                          type: "correct"
                        })
                      }
                      type="button"
                    >
                      Salva correzione
                    </button>
                  </details>

                  {outcome ? (
                    <p
                      className={
                        outcome.status === "ok"
                          ? "review-outcome-ok"
                          : "review-outcome-error"
                      }
                    >
                      {outcome.message}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        {visibleGroups.length === 0 ? (
          <div className="asset-empty">
            <h2>Nessun gruppo da revisionare</h2>
            <p>Cambia i filtri per vedere altri gruppi.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function createDraftForGroup(group: TaxonomyGroupView): CorrectionDraft {
  return {
    assetGroups: group.assetGroup ?? "",
    macroCategory: group.macroCategory || "unknown",
    status: "",
    themeTags: (group.themeTags ?? []).join(", ")
  };
}

function csv(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function attentionScore(group: TaxonomyGroupView): number {
  return (
    group.statusCounts["needs-review"] +
    group.statusCounts.quarantine +
    group.statusCounts.rejected
  );
}

function filterAndSort(
  groups: TaxonomyGroupView[],
  filters: { macroFilter: string; statusFilter: string; query: string }
): TaxonomyGroupView[] {
  const query = filters.query.trim().toLowerCase();

  return groups
    .filter((group) => {
      if (
        filters.macroFilter !== "all" &&
        group.macroCategory !== filters.macroFilter
      ) {
        return false;
      }
      if (filters.statusFilter === "attention" && attentionScore(group) === 0) {
        return false;
      }
      if (
        filters.statusFilter !== "attention" &&
        filters.statusFilter !== "all" &&
        (group.statusCounts[
          filters.statusFilter as keyof typeof group.statusCounts
        ] ?? 0) === 0
      ) {
        return false;
      }
      if (query) {
        const haystack = [group.name, ...group.themeTags]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (left, right) =>
        attentionScore(right) - attentionScore(left) ||
        right.assetCount - left.assetCount ||
        left.id.localeCompare(right.id)
    );
}

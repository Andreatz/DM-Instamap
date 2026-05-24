"use client";

import { useMemo, useState } from "react";
import type {
  TaxonomyGroupsSummary,
  TaxonomyGroupView
} from "@/lib/asset-taxonomy-groups";

type AssetTaxonomyGroupsProps = {
  generatedAt: string | null;
  groups: TaxonomyGroupView[];
  summary: TaxonomyGroupsSummary;
};

type Filters = {
  assetGroup: string;
  macroCategory: string;
  query: string;
  sourcePack: string;
  status: string;
  themeTag: string;
};

const DEFAULT_FILTERS: Filters = {
  assetGroup: "all",
  macroCategory: "all",
  query: "",
  sourcePack: "all",
  status: "all",
  themeTag: "all"
};

const MAX_RENDERED_GROUPS = 600;

export function AssetTaxonomyGroups({
  generatedAt,
  groups,
  summary
}: AssetTaxonomyGroupsProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const visibleGroups = useMemo(
    () => filterGroups(groups, filters),
    [groups, filters]
  );
  const renderedGroups = visibleGroups.slice(0, MAX_RENDERED_GROUPS);

  function updateFilter<Key extends keyof Filters>(
    key: Key,
    value: Filters[Key]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="asset-browser" aria-label="Gruppi semantici di asset">
      <aside className="asset-filters">
        <div className="filter-header">
          <h2>Filtri</h2>
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reimposta
          </button>
        </div>

        <label className="field">
          <span>Cerca</span>
          <input
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Categoria, gruppo, tema..."
            type="search"
            value={filters.query}
          />
        </label>

        <label className="field">
          <span>Macro categoria</span>
          <select
            onChange={(event) =>
              updateFilter("macroCategory", event.target.value)
            }
            value={filters.macroCategory}
          >
            <option value="all">Tutte le categorie</option>
            {summary.macroCategories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Gruppo</span>
          <select
            onChange={(event) => updateFilter("assetGroup", event.target.value)}
            value={filters.assetGroup}
          >
            <option value="all">Tutti i gruppi</option>
            {summary.assetGroups.slice(0, 800).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tema</span>
          <select
            onChange={(event) => updateFilter("themeTag", event.target.value)}
            value={filters.themeTag}
          >
            <option value="all">Tutti i temi</option>
            {summary.themeTags.slice(0, 800).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Source pack</span>
          <select
            onChange={(event) => updateFilter("sourcePack", event.target.value)}
            value={filters.sourcePack}
          >
            <option value="all">Tutti i pack</option>
            {summary.sourcePacks.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Stato</span>
          <select
            onChange={(event) => updateFilter("status", event.target.value)}
            value={filters.status}
          >
            <option value="all">Tutti gli stati</option>
            {summary.statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <div className="manifest-note">
          <span>{visibleGroups.length} gruppi mostrati</span>
          {generatedAt ? (
            <span>Generato {new Date(generatedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </aside>

      <div className="asset-results">
        {renderedGroups.length < visibleGroups.length ? (
          <p className="manifest-note">
            Mostrati i primi {renderedGroups.length} gruppi su{" "}
            {visibleGroups.length}. Restringi i filtri per vederne altri.
          </p>
        ) : null}

        <section className="group-grid" aria-label="Gruppi semantici">
          {renderedGroups.map((group) => (
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
                <dl>
                  <div>
                    <dt>Macro</dt>
                    <dd>{group.macroCategory}</dd>
                  </div>
                  <div>
                    <dt>Gruppo</dt>
                    <dd>{group.assetGroup}</dd>
                  </div>
                  <div>
                    <dt>Rappresentativo</dt>
                    <dd>{group.representativeAssetId ?? "nessuno"}</dd>
                  </div>
                </dl>
                <div className="status-counts">
                  {group.statusCounts.approved > 0 ? (
                    <span>approved {group.statusCounts.approved}</span>
                  ) : null}
                  {group.statusCounts["needs-review"] > 0 ? (
                    <span>
                      needs-review {group.statusCounts["needs-review"]}
                    </span>
                  ) : null}
                  {group.statusCounts.quarantine > 0 ? (
                    <span>quarantine {group.statusCounts.quarantine}</span>
                  ) : null}
                  {group.statusCounts.rejected > 0 ? (
                    <span>rejected {group.statusCounts.rejected}</span>
                  ) : null}
                </div>
                {group.themeTags.length > 0 ? (
                  <div className="tag-list">
                    {group.themeTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                {group.sourcePacks.length > 0 ? (
                  <p>Pack: {group.sourcePacks.join(", ")}</p>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        {visibleGroups.length === 0 ? (
          <div className="asset-empty">
            <h2>Nessun gruppo corrisponde</h2>
            <p>Modifica i filtri o la ricerca per ampliare la vista.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function filterGroups(
  groups: TaxonomyGroupView[],
  filters: Filters
): TaxonomyGroupView[] {
  const query = filters.query.trim().toLowerCase();

  return groups.filter((group) => {
    if (
      filters.macroCategory !== "all" &&
      group.macroCategory !== filters.macroCategory
    ) {
      return false;
    }
    if (
      filters.assetGroup !== "all" &&
      group.assetGroup !== filters.assetGroup
    ) {
      return false;
    }
    if (
      filters.themeTag !== "all" &&
      !group.themeTags.includes(filters.themeTag)
    ) {
      return false;
    }
    if (
      filters.sourcePack !== "all" &&
      !group.sourcePacks.includes(filters.sourcePack)
    ) {
      return false;
    }
    if (
      filters.status !== "all" &&
      (group.statusCounts[filters.status as keyof typeof group.statusCounts] ??
        0) === 0
    ) {
      return false;
    }
    if (query) {
      const haystack = [
        group.name,
        group.macroCategory,
        group.assetGroup,
        ...group.themeTags,
        ...group.sourcePacks
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

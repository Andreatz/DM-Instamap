"use client";

import { useMemo, useState } from "react";
import {
  filterAssets,
  formatPercent,
  type AssetBrowserEntry,
  type AssetBrowserOptions,
  type AssetFilterState
} from "@/lib/asset-browser";

type AssetBrowserProps = {
  assets: AssetBrowserEntry[];
  generatedAt: string | null;
  options: AssetBrowserOptions;
  sourceRoot: string | null;
};

const DEFAULT_FILTERS: AssetFilterState = {
  confidence: 0,
  kind: "all",
  query: "",
  sourceFolder: "all",
  tag: "all"
};

export function AssetBrowser({ assets, generatedAt, options, sourceRoot }: AssetBrowserProps) {
  const [filters, setFilters] = useState<AssetFilterState>(DEFAULT_FILTERS);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets[0]?.id ?? null);
  const visibleAssets = useMemo(() => filterAssets(assets, filters), [assets, filters]);
  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? visibleAssets[0] ?? assets[0] ?? null;

  function updateFilter<Key extends keyof AssetFilterState>(key: Key, value: AssetFilterState[Key]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <section className="asset-browser" aria-label="Asset browser">
      <aside className="asset-filters">
        <div className="filter-header">
          <h2>Filters</h2>
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset
          </button>
        </div>

        <label className="field">
          <span>Search</span>
          <input
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Name, path, tag..."
            type="search"
            value={filters.query}
          />
        </label>

        <label className="field">
          <span>Kind</span>
          <select onChange={(event) => updateFilter("kind", event.target.value)} value={filters.kind}>
            <option value="all">All kinds</option>
            {options.kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tag</span>
          <select onChange={(event) => updateFilter("tag", event.target.value)} value={filters.tag}>
            <option value="all">All tags</option>
            {options.tags.slice(0, 500).map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Source Folder</span>
          <select
            onChange={(event) => updateFilter("sourceFolder", event.target.value)}
            value={filters.sourceFolder}
          >
            <option value="all">All folders</option>
            {options.sourceFolders.slice(0, 500).map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Confidence {formatPercent(filters.confidence)}</span>
          <input
            max="1"
            min="0"
            onChange={(event) => updateFilter("confidence", Number(event.target.value))}
            step="0.05"
            type="range"
            value={filters.confidence}
          />
        </label>

        <div className="manifest-note">
          <span>{visibleAssets.length} shown</span>
          {generatedAt ? <span>Indexed {new Date(generatedAt).toLocaleString()}</span> : null}
          {sourceRoot ? <span title={sourceRoot}>Local source loaded</span> : null}
        </div>
      </aside>

      <div className="asset-results">
        <div className="asset-grid" aria-label="Asset thumbnails">
          {visibleAssets.map((asset) => (
            <button
              aria-pressed={selectedAsset?.id === asset.id}
              className="asset-card"
              key={asset.id}
              onClick={() => setSelectedAssetId(asset.id)}
              type="button"
            >
              <span className="asset-thumb">
                <img alt="" loading="lazy" src={asset.thumbnailUrl} />
              </span>
              <span className="asset-card-name">{getFileName(asset.relativePath)}</span>
              <span className="asset-card-meta">
                {asset.classification} - {formatPercent(asset.confidence)}
              </span>
            </button>
          ))}
        </div>

        {visibleAssets.length === 0 ? (
          <div className="asset-empty">
            <h2>No Assets Match</h2>
            <p>Adjust the filters or search text to widen the current view.</p>
          </div>
        ) : null}
      </div>

      <AssetDetails asset={selectedAsset} />
    </section>
  );
}

function AssetDetails({ asset }: { asset: AssetBrowserEntry | null }) {
  if (!asset) {
    return (
      <aside className="asset-details">
        <h2>Asset Details</h2>
        <p>No asset selected.</p>
      </aside>
    );
  }

  return (
    <aside className="asset-details">
      <div className="detail-preview">
        <img alt="" src={asset.thumbnailUrl} />
      </div>
      <h2>{getFileName(asset.relativePath)}</h2>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{asset.classification}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{formatPercent(asset.confidence)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{asset.classificationSource}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>
            {asset.width ?? "?"} x {asset.height ?? "?"}
          </dd>
        </div>
        <div>
          <dt>Transparency</dt>
          <dd>{asset.hasTransparency === null ? "unknown" : asset.hasTransparency ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Extension</dt>
          <dd>{asset.extension}</dd>
        </div>
      </dl>

      <section className="detail-block">
        <h3>Path</h3>
        <p>{asset.relativePath}</p>
      </section>

      <section className="detail-block">
        <h3>Tags</h3>
        <div className="tag-list">
          {asset.tags.slice(0, 24).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>

      <section className="detail-block">
        <h3>Dominant Colors</h3>
        <div className="color-list">
          {asset.dominantColors.map((color) => (
            <span key={color.hex} title={`${color.hex} (${color.population})`}>
              <i style={{ backgroundColor: color.hex }} />
              {color.hex}
            </span>
          ))}
        </div>
      </section>

      <section className="detail-block">
        <h3>Hash</h3>
        <p>{asset.fileHash}</p>
      </section>
    </aside>
  );
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}

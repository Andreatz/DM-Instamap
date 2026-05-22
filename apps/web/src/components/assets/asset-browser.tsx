"use client";

import { useMemo, useState } from "react";
import {
  filterAssets,
  formatAssetKind,
  formatClassificationSource,
  formatPercent,
  type AssetBrowserEntry,
  type AssetBrowserOptions,
  type AssetFilterState
} from "@/lib/asset-browser";
import type { AssetSearchApiResult } from "@/lib/asset-search";

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

export function AssetBrowser({
  assets,
  generatedAt,
  options,
  sourceRoot
}: AssetBrowserProps) {
  const [filters, setFilters] = useState<AssetFilterState>(DEFAULT_FILTERS);
  const [visualSearchQuery, setVisualSearchQuery] = useState("");
  const [imageSearchPath, setImageSearchPath] = useState("");
  const [searchResults, setSearchResults] = useState<AssetSearchApiResult[]>(
    []
  );
  const [searchStatus, setSearchStatus] = useState("Ricerca locale pronta");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    assets[0]?.id ?? null
  );
  const visibleAssets = useMemo(
    () => filterAssets(assets, filters),
    [assets, filters]
  );
  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ??
    visibleAssets[0] ??
    assets[0] ??
    null;

  function updateFilter<Key extends keyof AssetFilterState>(
    key: Key,
    value: AssetFilterState[Key]
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function runTextSearch() {
    const query = visualSearchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchStatus("Inserisci una ricerca locale");
      return;
    }

    setSearchStatus("Ricerca negli asset locali");

    try {
      const response = await fetch(
        `/api/assets/search?q=${encodeURIComponent(query)}&limit=24`
      );
      const payload = (await response.json()) as {
        results?: AssetSearchApiResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ricerca fallita");
      }

      setSearchResults(payload.results ?? []);
      setSearchStatus(`${payload.results?.length ?? 0} risultati locali`);
    } catch (error) {
      setSearchResults([]);
      setSearchStatus(
        error instanceof Error ? error.message : "Ricerca fallita"
      );
    }
  }

  async function runImageSearch() {
    const imagePath = imageSearchPath.trim();

    if (!imagePath) {
      setSearchResults([]);
      setSearchStatus(
        "Inserisci un percorso immagine locale dentro il workspace"
      );
      return;
    }

    setSearchStatus("Ricerca di immagini locali simili");

    try {
      const response = await fetch("/api/assets/search-by-image", {
        body: JSON.stringify({ imagePath, limit: 24 }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const payload = (await response.json()) as {
        results?: AssetSearchApiResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ricerca per immagine fallita");
      }

      setSearchResults(payload.results ?? []);
      setSearchStatus(`${payload.results?.length ?? 0} asset locali simili`);
    } catch (error) {
      setSearchResults([]);
      setSearchStatus(
        error instanceof Error ? error.message : "Ricerca per immagine fallita"
      );
    }
  }

  return (
    <section className="asset-browser" aria-label="Browser asset">
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
            placeholder="Nome, percorso, tag..."
            type="search"
            value={filters.query}
          />
        </label>

        <section className="detail-block">
          <h3>Ricerca visuale/testuale</h3>
          <label className="field">
            <span>Ricerca testuale</span>
            <input
              onChange={(event) => setVisualSearchQuery(event.target.value)}
              placeholder="cripta, sarcofago, acqua blu..."
              type="search"
              value={visualSearchQuery}
            />
          </label>
          <button onClick={runTextSearch} type="button">
            Cerca asset
          </button>
          <label className="field">
            <span>Percorso immagine</span>
            <input
              onChange={(event) => setImageSearchPath(event.target.value)}
              placeholder="data/previews/references/example.webp"
              type="text"
              value={imageSearchPath}
            />
          </label>
          <button onClick={runImageSearch} type="button">
            Cerca per immagine
          </button>
          <p>{searchStatus}</p>
        </section>

        <label className="field">
          <span>Tipo</span>
          <select
            onChange={(event) => updateFilter("kind", event.target.value)}
            value={filters.kind}
          >
            <option value="all">Tutti i tipi</option>
            {options.kinds.map((kind) => (
              <option key={kind} value={kind}>
                {formatAssetKind(kind)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tag</span>
          <select
            onChange={(event) => updateFilter("tag", event.target.value)}
            value={filters.tag}
          >
            <option value="all">Tutti i tag</option>
            {options.tags.slice(0, 500).map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Cartella sorgente</span>
          <select
            onChange={(event) =>
              updateFilter("sourceFolder", event.target.value)
            }
            value={filters.sourceFolder}
          >
            <option value="all">Tutte le cartelle</option>
            {options.sourceFolders.slice(0, 500).map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Affidabilita {formatPercent(filters.confidence)}</span>
          <input
            max="1"
            min="0"
            onChange={(event) =>
              updateFilter("confidence", Number(event.target.value))
            }
            step="0.05"
            type="range"
            value={filters.confidence}
          />
        </label>

        <div className="manifest-note">
          <span>{visibleAssets.length} mostrati</span>
          {generatedAt ? (
            <span>Indicizzati {new Date(generatedAt).toLocaleString()}</span>
          ) : null}
          {sourceRoot ? (
            <span title={sourceRoot}>Sorgente locale caricata</span>
          ) : null}
        </div>
      </aside>

      <div className="asset-results">
        {searchResults.length > 0 ? (
          <section className="detail-block">
            <h2>Risultati ricerca locale</h2>
            <div
              className="asset-grid"
              role="group"
              aria-label="Risultati della ricerca visuale locale"
            >
              {searchResults.map((result) => (
                <button
                  className="asset-card"
                  key={result.assetId}
                  onClick={() => setSelectedAssetId(result.assetId)}
                  type="button"
                >
                  <span className="asset-thumb">
                    <img alt="" loading="lazy" src={result.thumbnailUrl} />
                  </span>
                  <span className="asset-card-name">
                    {getFileName(result.relativePath)}
                  </span>
                  <span className="asset-card-meta">
                    {formatAssetKind(result.classification)} -{" "}
                    {Math.round(result.score * 100)}%
                  </span>
                  <span className="asset-card-meta">{result.reason}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="asset-grid" role="group" aria-label="Anteprime asset">
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
              <span className="asset-card-name">
                {getFileName(asset.relativePath)}
              </span>
              <span className="asset-card-meta">
                {formatAssetKind(asset.classification)} -{" "}
                {formatPercent(asset.confidence)}
              </span>
            </button>
          ))}
        </div>

        {visibleAssets.length === 0 ? (
          <div className="asset-empty">
            <h2>Nessun asset corrisponde</h2>
            <p>
              Modifica i filtri o il testo di ricerca per ampliare la vista.
            </p>
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
        <h2>Dettagli asset</h2>
        <p>Nessun asset selezionato.</p>
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
          <dt>Tipo</dt>
          <dd>{formatAssetKind(asset.classification)}</dd>
        </div>
        <div>
          <dt>Affidabilita</dt>
          <dd>{formatPercent(asset.confidence)}</dd>
        </div>
        <div>
          <dt>Sorgente</dt>
          <dd>{formatClassificationSource(asset.classificationSource)}</dd>
        </div>
        <div>
          <dt>Dimensioni</dt>
          <dd>
            {asset.width ?? "?"} x {asset.height ?? "?"}
          </dd>
        </div>
        <div>
          <dt>Trasparenza</dt>
          <dd>
            {asset.hasTransparency === null
              ? "sconosciuta"
              : asset.hasTransparency
                ? "si"
                : "no"}
          </dd>
        </div>
        <div>
          <dt>Estensione</dt>
          <dd>{asset.extension}</dd>
        </div>
      </dl>

      <section className="detail-block">
        <h3>Percorso</h3>
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
        <h3>Colori dominanti</h3>
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

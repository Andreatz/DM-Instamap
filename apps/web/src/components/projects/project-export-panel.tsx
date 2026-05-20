"use client";

import { useState } from "react";
import type { MapDocument } from "@dm-instamap/core";

type ExportFormat = "png" | "webp" | "dd2vtt" | "foundry" | "dmimap" | "session-pack";
type ExportMode = "player" | "gm" | "clean";

const FORMAT_OPTIONS: Array<{ description: string; extension: string; label: string; value: ExportFormat }> = [
  { description: "Raster image suitable for screens and print.", extension: "png", label: "PNG", value: "png" },
  { description: "Compressed image for the web.", extension: "webp", label: "WEBP", value: "webp" },
  { description: "Universal VTT (Foundry, Roll20 import).", extension: "dd2vtt", label: "dd2vtt", value: "dd2vtt" },
  { description: "Installable Foundry module ZIP.", extension: "zip", label: "Foundry Module", value: "foundry" },
  { description: "Proprietary editable JSON.", extension: "dmimap.json", label: "dmimap", value: "dmimap" },
  {
    description: "All-in-one ZIP: full / GM / player maps, GM notes, initiative, manifest.",
    extension: "zip",
    label: "Session Pack",
    value: "session-pack"
  }
];

const MODE_OPTIONS: Array<{ description: string; label: string; value: ExportMode }> = [
  { description: "Hides secret rooms, traps, GM notes and annotations.", label: "Player Safe", value: "player" },
  { description: "Everything visible (use for your own reference).", label: "Game Master", value: "gm" },
  { description: "Like player safe but also strips notes and lighting.", label: "Clean", value: "clean" }
];

type ProjectExportPanelProps = {
  document: MapDocument;
  projectId?: string;
};

export function ProjectExportPanel({ document, projectId }: ProjectExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [mode, setMode] = useState<ExportMode>("gm");
  const [includeGrid, setIncludeGrid] = useState(true);
  const [scale, setScale] = useState(1);
  const [splitLayers, setSplitLayers] = useState(false);
  const [webpQuality, setWebpQuality] = useState(92);
  const [includeJournals, setIncludeJournals] = useState(true);
  const [includeInitiative, setIncludeInitiative] = useState(true);
  const [sessionDescription, setSessionDescription] = useState("");
  const [status, setStatus] = useState("Ready to export");
  const supportsRasterOptions =
    format === "png" || format === "webp" || format === "dd2vtt" || format === "foundry" || format === "session-pack";
  const supportsSplitLayers = format === "png" || format === "webp";

  async function exportProject() {
    setStatus(`Exporting ${format.toUpperCase()} (${mode} mode)`);

    try {
      const endpoint = projectId ? `/api/projects/${projectId}/export` : "/api/export";
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          description: format === "session-pack" ? sessionDescription : undefined,
          document: projectId ? undefined : document,
          format,
          includeGrid,
          includeInitiative: format === "session-pack" ? includeInitiative : undefined,
          includeJournals: format === "foundry" ? includeJournals : undefined,
          mode,
          scale,
          splitLayers: supportsSplitLayers ? splitLayers : false,
          webpQuality
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Export failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      const extension = supportsSplitLayers && splitLayers ? "zip" : formatExtension(format);
      link.href = url;
      link.download = buildDownloadName(document.name, extension, mode, format);
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Export complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    }
  }

  return (
    <section className="asset-details">
      <h2>Export Project</h2>
      <p className="muted">Choose what to share and how.</p>

      <label className="field">
        <span>Format</span>
        <select onChange={(event) => setFormat(event.target.value as ExportFormat)} value={format}>
          {FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small className="muted">{FORMAT_OPTIONS.find((option) => option.value === format)?.description}</small>
      </label>

      <label className="field">
        <span>Mode</span>
        <select onChange={(event) => setMode(event.target.value as ExportMode)} value={mode}>
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small className="muted">{MODE_OPTIONS.find((option) => option.value === mode)?.description}</small>
      </label>

      {supportsRasterOptions ? (
        <>
          <label className="field">
            <span>Scale</span>
            <select onChange={(event) => setScale(Number(event.target.value))} value={scale}>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
            </select>
          </label>
          <label className="editor-checkbox">
            <input checked={includeGrid} onChange={(event) => setIncludeGrid(event.target.checked)} type="checkbox" />
            <span>Include grid</span>
          </label>
          {format === "webp" ? (
            <label className="field">
              <span>WEBP quality</span>
              <select onChange={(event) => setWebpQuality(Number(event.target.value))} value={webpQuality}>
                <option value={70}>70</option>
                <option value={82}>82</option>
                <option value={92}>92</option>
                <option value={100}>100</option>
              </select>
            </label>
          ) : null}
          {supportsSplitLayers ? (
            <label className="editor-checkbox">
              <input checked={splitLayers} onChange={(event) => setSplitLayers(event.target.checked)} type="checkbox" />
              <span>Export layer ZIP</span>
            </label>
          ) : null}
        </>
      ) : null}

      {format === "foundry" ? (
        <label className="editor-checkbox">
          <input
            checked={includeJournals}
            onChange={(event) => setIncludeJournals(event.target.checked)}
            type="checkbox"
          />
          <span>Include journal entries (rooms, GM notes, plan notes)</span>
        </label>
      ) : null}

      {format === "session-pack" ? (
        <>
          <label className="editor-checkbox">
            <input
              checked={includeInitiative}
              onChange={(event) => setIncludeInitiative(event.target.checked)}
              type="checkbox"
            />
            <span>Include initiative.json</span>
          </label>
          <label className="field">
            <span>Description for the DM</span>
            <textarea
              onChange={(event) => setSessionDescription(event.target.value)}
              placeholder="Optional narrative description to ship inside the pack."
              rows={3}
              value={sessionDescription}
            />
          </label>
        </>
      ) : null}

      <button className="save-correction" onClick={exportProject} type="button">
        Export
      </button>
      <p>{status}</p>
    </section>
  );
}

function formatExtension(format: ExportFormat): string {
  switch (format) {
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "dd2vtt":
      return "dd2vtt";
    case "foundry":
      return "zip";
    case "session-pack":
      return "zip";
    case "dmimap":
    default:
      return "dmimap.json";
  }
}

function buildDownloadName(name: string, extension: string, mode: ExportMode, format: ExportFormat): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "dm-instamap-map";
  const suffix = format === "session-pack" ? "-session-pack" : "";
  const base = `${slug}${suffix}`;
  return mode === "gm" ? `${base}.${extension}` : `${base}-${mode}.${extension}`;
}

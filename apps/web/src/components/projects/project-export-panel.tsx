"use client";

import { useState } from "react";
import type { MapDocument } from "@dm-instamap/core";

type ExportFormat = "png" | "webp";

export function ProjectExportPanel({ document }: { document: MapDocument }) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [includeGrid, setIncludeGrid] = useState(true);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState("Ready to export");

  async function exportProject() {
    setStatus(`Exporting ${format.toUpperCase()}`);

    try {
      const response = await fetch("/api/export", {
        body: JSON.stringify({
          document,
          format,
          includeGrid,
          scale
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
      link.href = url;
      link.download = `${document.name.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}.${format}`;
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
      <label className="field">
        <span>Format</span>
        <select onChange={(event) => setFormat(event.target.value as ExportFormat)} value={format}>
          <option value="png">PNG</option>
          <option value="webp">WEBP</option>
        </select>
      </label>
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
      <button className="save-correction" onClick={exportProject} type="button">
        Export
      </button>
      <p>{status}</p>
    </section>
  );
}

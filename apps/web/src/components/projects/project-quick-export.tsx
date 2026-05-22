"use client";

import { useState } from "react";
import { RECOMMENDED_EXPORTS, type RecommendedExport } from "@/lib/project-readiness";
import type { ProjectExportFormat, ProjectExportMode } from "@/lib/project-export-history";

type ProjectQuickExportProps = {
  projectId: string;
  projectName: string;
};

/**
 * One-click "ready for the table" exports. From the project page this turns a
 * finished map into a download in a single click (well under the 3-click goal).
 */
export function ProjectQuickExport({ projectId, projectName }: ProjectQuickExportProps) {
  const [status, setStatus] = useState("Pronto");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function runExport(preset: RecommendedExport) {
    setBusyId(preset.id);
    setStatus(`Esportazione ${preset.label} (${preset.mode})...`);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`, {
        body: JSON.stringify({
          format: preset.format,
          includeGrid: true,
          includeInitiative: preset.format === "session-pack",
          mode: preset.mode,
          scale: 1
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Esportazione fallita.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = buildDownloadName(projectName, preset.format, preset.mode);
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`${preset.label} scaricato.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Esportazione fallita.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="asset-details project-quick-export">
      <h2>Esporta per la sessione</h2>
      <p className="muted">Export consigliati pronti all'uso, un clic e li scarichi.</p>
      <div className="quick-export-actions">
        {RECOMMENDED_EXPORTS.map((preset) => (
          <button
            className="save-correction"
            disabled={busyId !== null}
            key={preset.id}
            onClick={() => void runExport(preset)}
            title={preset.description}
            type="button"
          >
            {busyId === preset.id ? "Esportazione..." : preset.label}
          </button>
        ))}
      </div>
      <p>{status}</p>
    </section>
  );
}

function buildDownloadName(name: string, format: ProjectExportFormat, mode: ProjectExportMode): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "dm-instamap-map";
  const extension = format === "session-pack" || format === "foundry" ? "zip" : format === "dmimap" ? "dmimap.json" : format;
  const suffix = format === "session-pack" ? "-session-pack" : "";
  const base = `${slug}${suffix}`;
  return mode === "gm" ? `${base}.${extension}` : `${base}-${mode}.${extension}`;
}

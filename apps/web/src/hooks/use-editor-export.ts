"use client";

import { useCallback } from "react";
import type { MapDocument } from "@dm-instamap/core/browser";
import { createExportFilename, type ExportFormat } from "@/lib/map-editor-view";

type EditorExportDeps = {
  document: MapDocument;
  exportFormat: ExportFormat;
  exportIncludeGrid: boolean;
  exportScale: number;
  projectId?: string;
  renderMode: "debug" | "artistic";
  setIsExporting: (exporting: boolean) => void;
  setStatus: (message: string) => void;
};

/**
 * Export e snapshot dell'editor: snapshot del progetto, Session Pack rapido e
 * export raster/vtt via API.
 */
export function useEditorExport(deps: EditorExportDeps) {
  const {
    document,
    exportFormat,
    exportIncludeGrid,
    exportScale,
    projectId,
    renderMode,
    setIsExporting,
    setStatus
  } = deps;

  const createSnapshot = useCallback(async () => {
    if (!projectId) {
      setStatus("Gli snapshot richiedono un progetto salvato.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const label = `editor-${stamp.slice(0, 19)}`;

    setStatus(`Creazione snapshot ${label}...`);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/snapshots`,
        {
          body: JSON.stringify({ label }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );
      const payload = (await response.json()) as {
        error?: string;
        snapshot?: { written: boolean };
      };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error ?? "Snapshot fallito.");
      }

      setStatus(
        payload.snapshot.written
          ? `Snapshot ${label} creato.`
          : "Snapshot identico: non scritto."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Snapshot fallito.");
    }
  }, [projectId, setStatus]);

  const exportSessionPackQuick = useCallback(async () => {
    if (!projectId) {
      setStatus("L'export Session Pack richiede un progetto salvato.");
      return;
    }

    setStatus("Esportazione Session Pack...");

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/export`,
        {
          body: JSON.stringify({
            description: document.name,
            format: "session-pack",
            includeInitiative: true,
            scale: 1
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Esportazione Session Pack fallita.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${projectId}-session-pack.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Session Pack scaricato.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Esportazione Session Pack fallita."
      );
    }
  }, [document.name, projectId, setStatus]);

  async function handleExport() {
    setIsExporting(true);
    setStatus(`Esportazione ${exportFormat.toUpperCase()}`);

    try {
      const response = await fetch("/api/export", {
        body: JSON.stringify({
          document,
          format: exportFormat,
          includeGrid: exportIncludeGrid,
          renderMode,
          scale: exportScale
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Esportazione fallita");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = createExportFilename(document.name, exportFormat);
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`${exportFormat.toUpperCase()} esportato`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Esportazione fallita"
      );
    } finally {
      setIsExporting(false);
    }
  }

  return { createSnapshot, exportSessionPackQuick, handleExport };
}

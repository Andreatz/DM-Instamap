// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditorExport } from "./use-editor-export";

const doc = { name: "Test" } as unknown as MapDocument;

function setup(projectId?: string) {
  const setStatus = vi.fn();
  const setIsExporting = vi.fn();
  const view = renderHook(() =>
    useEditorExport({
      document: doc,
      exportFormat: "png",
      exportIncludeGrid: true,
      exportScale: 1,
      projectId,
      setIsExporting,
      setStatus
    })
  );

  return { setStatus, view };
}

describe("useEditorExport", () => {
  it("createSnapshot requires a saved project", async () => {
    const { setStatus, view } = setup(undefined);

    await act(async () => {
      await view.result.current.createSnapshot();
    });

    expect(setStatus).toHaveBeenCalledWith(
      expect.stringMatching(/progetto salvato/iu)
    );
  });

  it("exportSessionPackQuick requires a saved project", async () => {
    const { setStatus, view } = setup(undefined);

    await act(async () => {
      await view.result.current.exportSessionPackQuick();
    });

    expect(setStatus).toHaveBeenCalledWith(
      expect.stringMatching(/progetto salvato/iu)
    );
  });
});

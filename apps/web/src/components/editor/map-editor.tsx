"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import type { MatchableAssetGroup } from "@dm-instamap/assets/matcher";
import type { EditorPaletteAsset } from "@/lib/map-editor";
import { useMapEditorState } from "@/hooks/use-map-editor-state";
import { EditorAiPanel } from "./editor-ai-panel";
import { EditorAssetSidebar } from "./editor-asset-sidebar";
import { EditorCanvasToolbar } from "./editor-canvas-toolbar";
import { EditorInspector } from "./editor-inspector";
import { MapCanvas } from "./map-canvas";

type MapEditorProps = {
  assetGroups: MatchableAssetGroup[];
  initialDocument: MapDocument;
  mapTheme: string;
  palette: EditorPaletteAsset[];
  projectId?: string;
};

export function MapEditor(props: MapEditorProps) {
  const editor = useMapEditorState(props);

  return (
    <section
      className="editor-shell"
      aria-label="Editor mappa"
      data-hydrated={editor.isHydrated ? "true" : "false"}
    >
      <EditorAssetSidebar editor={editor} />

      <section className="editor-map-panel">
        <EditorCanvasToolbar editor={editor} />
        <MapCanvas editor={editor} />
      </section>

      {editor.aiPanelOpen ? <EditorAiPanel editor={editor} /> : null}

      <EditorInspector editor={editor} />
    </section>
  );
}

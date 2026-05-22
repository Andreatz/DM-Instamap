"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import type { AssetSearchApiResult } from "@/lib/asset-search";
import type { EditorPaletteAsset } from "@/lib/map-editor";
import { saveRecentGeneratedToStorage } from "@/lib/map-editor-view";

type SelectedRoom = NonNullable<MapDocument["plan"]>["rooms"][number];

type EditorAiDeps = {
  aiBusy: boolean;
  aiRequest: string;
  assetSearchQuery: string;
  document: MapDocument;
  mapTheme: string;
  recentGenerated: EditorPaletteAsset[];
  selectedRoom: SelectedRoom | null;
  setAiBusy: (busy: boolean) => void;
  setAiDescription: (description: string) => void;
  setAiSuggestions: (suggestions: string[]) => void;
  setAssetSearchResults: (results: AssetSearchApiResult[]) => void;
  setRecentGenerated: (assets: EditorPaletteAsset[]) => void;
  setStatus: (message: string) => void;
};

/**
 * Funzioni AI dell'editor (bridge opzionale): descrizione mappa, suggerimenti
 * asset per stanza, generazione asset da prompt e ricerca asset locali.
 */
export function useEditorAi(deps: EditorAiDeps) {
  const {
    aiBusy,
    aiRequest,
    assetSearchQuery,
    document,
    mapTheme,
    recentGenerated,
    selectedRoom,
    setAiBusy,
    setAiDescription,
    setAiSuggestions,
    setAssetSearchResults,
    setRecentGenerated,
    setStatus
  } = deps;

  async function runAiDescribeMap() {
    if (aiBusy) {
      return;
    }

    setAiBusy(true);
    setStatus("Richiesta descrizione mappa all'AI...");

    try {
      const response = await fetch("/api/ai/blueprint", {
        body: JSON.stringify({
          request: aiRequest.trim() || `Describe ${document.name} for the GM.`
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        blueprint?: { name?: string; mood?: string; structure?: string };
        error?: string;
        errors?: string[];
        ok: boolean;
      };

      if (!response.ok || !payload.ok || !payload.blueprint) {
        throw new Error(
          payload.error ?? payload.errors?.join("; ") ?? "Richiesta AI fallita."
        );
      }

      const blueprint = payload.blueprint;
      const description = `${blueprint.name ?? document.name} - struttura ${blueprint.structure ?? "sconosciuta"}, mood ${blueprint.mood ?? "sconosciuto"}.`;
      setAiDescription(description);
      setStatus("Descrizione AI pronta.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Richiesta AI fallita."
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function runAiSuggestForSelectedRoom() {
    if (!selectedRoom) {
      setStatus("Seleziona una stanza prima di chiedere suggerimenti.");
      return;
    }

    setAiBusy(true);
    setAiSuggestions([]);
    setStatus(`Richiesta asset AI per ${selectedRoom.label}...`);

    try {
      const query =
        aiRequest.trim() ||
        `${selectedRoom.label} ${selectedRoom.tags.join(" ")} ${mapTheme}`.trim();
      const response = await fetch(
        `/api/assets/search?q=${encodeURIComponent(query)}&limit=8`
      );
      const payload = (await response.json()) as {
        error?: string;
        results?: AssetSearchApiResult[];
      };

      if (!response.ok || !payload.results) {
        throw new Error(payload.error ?? "Suggerimento fallito.");
      }

      setAiSuggestions(
        payload.results.map(
          (result) => `${result.relativePath} (${result.classification})`
        )
      );
      setStatus(
        `${payload.results.length} suggerimenti per ${selectedRoom.label}.`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Suggerimento fallito."
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function generateAssetFromPrompt() {
    const prompt = aiRequest.trim();

    if (!prompt) {
      setStatus("Scrivi un prompt prima di generare.");
      return;
    }

    setAiBusy(true);
    setStatus("Generazione asset da prompt...");

    try {
      const response = await fetch("/api/assets/generate", {
        body: JSON.stringify({
          classification: "prop",
          prompt
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        asset?: { filename: string; relativePath: string };
        error?: string;
        manifestEntry?: {
          id: string;
          relativePath: string;
          thumbnailPath: string | null;
        } | null;
      };

      if (!response.ok || !payload.asset) {
        throw new Error(payload.error ?? "Generazione fallita.");
      }

      const entry = payload.manifestEntry;
      if (entry) {
        const generatedAsset: EditorPaletteAsset = {
          id: entry.id,
          kind: "prop",
          name: payload.asset.filename,
          thumbnailUrl: entry.thumbnailPath ? `/${entry.thumbnailPath}` : ""
        };
        const next = [
          generatedAsset,
          ...recentGenerated.filter((item) => item.id !== entry.id)
        ].slice(0, 12);
        setRecentGenerated(next);
        saveRecentGeneratedToStorage(next);
      }

      setStatus(`Generato ${payload.asset.filename}.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Generazione fallita."
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function handleFindMatchingAssets() {
    const query = (
      assetSearchQuery.trim() ||
      [mapTheme, selectedRoom?.label ?? "", ...(selectedRoom?.tags ?? [])].join(
        " "
      )
    ).trim();

    if (!query) {
      setAssetSearchResults([]);
      setStatus("Seleziona una stanza o inserisci una ricerca asset");
      return;
    }

    setStatus("Ricerca asset locali");

    try {
      const response = await fetch(
        `/api/assets/search?q=${encodeURIComponent(query)}&limit=12`
      );
      const payload = (await response.json()) as {
        results?: AssetSearchApiResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ricerca asset locale fallita");
      }

      setAssetSearchResults(payload.results ?? []);
      setStatus(`${payload.results?.length ?? 0} suggerimenti asset locali`);
    } catch (error) {
      setAssetSearchResults([]);
      setStatus(
        error instanceof Error ? error.message : "Ricerca asset locale fallita"
      );
    }
  }

  return {
    generateAssetFromPrompt,
    handleFindMatchingAssets,
    runAiDescribeMap,
    runAiSuggestForSelectedRoom
  };
}

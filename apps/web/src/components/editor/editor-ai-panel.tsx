"use client";

import type { MapEditorController } from "@/hooks/use-map-editor-state";

export function EditorAiPanel({ editor }: { editor: MapEditorController }) {
  const {
    aiBusy,
    aiDescription,
    aiRequest,
    aiSuggestions,
    generateAssetFromPrompt,
    runAiDescribeMap,
    runAiSuggestForSelectedRoom,
    selectedRoom,
    setAiRequest
  } = editor;

  return (
    <aside className="asset-details editor-ai-drawer" aria-label="Pannello assistente AI">
      <h2>Assistente AI</h2>
      <p className="muted">
        Accesso rapido al provider AI configurato. Configura <code>AI_PROVIDER</code>, <code>AI_API_KEY</code>.
      </p>
      <label className="field">
        <span>Richiesta</span>
        <textarea
          onChange={(event) => setAiRequest(event.target.value)}
          placeholder="es. Aggiungi interesse tattico alla sala del trono..."
          rows={3}
          value={aiRequest}
        />
      </label>
      <div className="field-row">
        <button disabled={aiBusy} onClick={() => void runAiDescribeMap()} type="button">
          {aiBusy ? "Elaborazione..." : "Descrivi mappa"}
        </button>
        <button disabled={aiBusy || !selectedRoom} onClick={() => void runAiSuggestForSelectedRoom()} type="button">
          {aiBusy ? "Elaborazione..." : "Suggerisci asset per la stanza"}
        </button>
        <button disabled={aiBusy || aiRequest.trim().length === 0} onClick={() => void generateAssetFromPrompt()} type="button">
          {aiBusy ? "Elaborazione..." : "Genera asset da prompt"}
        </button>
      </div>
      {aiDescription ? (
        <section className="detail-block">
          <h3>Descrizione</h3>
          <p>{aiDescription}</p>
        </section>
      ) : null}
      {aiSuggestions.length > 0 ? (
        <section className="detail-block">
          <h3>Suggerimenti</h3>
          <ul>
            {aiSuggestions.map((suggestion, index) => (
              <li key={`${suggestion}-${index}`}>{suggestion}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

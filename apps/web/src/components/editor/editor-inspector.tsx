"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import { formatAssetKind } from "@/lib/asset-browser";
import {
  assetToLayerKind,
  getFileName,
  layerLabel,
  writeDragPayload,
  type ExportFormat
} from "@/lib/map-editor-view";
import type { MapEditorController } from "@/hooks/use-map-editor-state";

export function EditorInspector({ editor }: { editor: MapEditorController }) {
  const {
    addInitiativeDraft,
    addNoteAtHoverCell,
    assetGroups,
    assetSearchQuery,
    assetSearchResults,
    clearAssetSelection,
    copySelectedAssets,
    damageInitiativeEntry,
    deleteSelectedAsset,
    deleteSelectedNote,
    document,
    duplicateSelectedAsset,
    editorLayers,
    exportFormat,
    exportIncludeGrid,
    exportScale,
    fogPreviewEnabled,
    furnishingDensity,
    groupSelectedAssets,
    handleAutoFurnish,
    handleExport,
    handleFindMatchingAssets,
    initiativeDraft,
    isExporting,
    jsonText,
    loadJson,
    loadLocal,
    noteDraft,
    pasteAssetClipboard,
    projectId,
    removeInitiativeEntry,
    roomMatches,
    saveJson,
    selectAllVisibleAssets,
    selectedAsset,
    selectedAssetId,
    selectedAssetIds,
    selectedDoor,
    selectedLight,
    selectedNote,
    selectedRoom,
    setAssetSearchQuery,
    setExportFormat,
    setExportIncludeGrid,
    setExportScale,
    setFogPreviewEnabled,
    setFurnishingDensity,
    setInitiativeDraft,
    setJsonText,
    setNoteDraft,
    setSelectedElement,
    status,
    ungroupSelectedAssets,
    updateLayer,
    updateSelectedAssetLayer,
    updateSelectedAssetTransform,
    updateSelectedLight,
    updateSelectedNote
  } = editor;

  return (
    <aside className="asset-details editor-inspector">
      <h2>Inspector</h2>
      <dl>
        <div>
          <dt>Stanza selezionata</dt>
          <dd>{selectedRoom?.label ?? "nessuna"}</dd>
        </div>
        <div>
          <dt>Asset selezionato</dt>
          <dd>{selectedAsset?.assetId ?? "nessuno"}</dd>
        </div>
        <div>
          <dt>Asset selezionati</dt>
          <dd>{selectedAssetIds.length}</dd>
        </div>
        <div>
          <dt>Livello asset</dt>
          <dd>
            {selectedAsset
              ? layerLabel(assetToLayerKind(selectedAsset.layer))
              : "nessuno"}
          </dd>
        </div>
        <div>
          <dt>Porta selezionata</dt>
          <dd>{selectedDoor?.id ?? "nessuna"}</dd>
        </div>
        <div>
          <dt>Luce selezionata</dt>
          <dd>{selectedLight?.id ?? "nessuna"}</dd>
        </div>
        <div>
          <dt>Nota selezionata</dt>
          <dd>{selectedNote?.title ?? "nessuna"}</dd>
        </div>
        <div>
          <dt>Porte</dt>
          <dd>{document.plan?.doors.length ?? 0}</dd>
        </div>
        <div>
          <dt>Muri</dt>
          <dd>{document.plan?.walls.length ?? 0}</dd>
        </div>
      </dl>

      <section className="detail-block editor-layer-controls">
        <h3>Livelli</h3>
        <div className="editor-layer-list">
          {editorLayers.map((layer) => (
            <article key={layer.id}>
              <header>
                <strong>{layer.name}</strong>
                <span>{Math.round(layer.opacity * 100)}%</span>
              </header>
              <div className="editor-layer-row">
                <label className="editor-checkbox">
                  <input
                    checked={layer.visible}
                    onChange={(event) =>
                      updateLayer(layer.kind, { visible: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>Visibile</span>
                </label>
                <label className="editor-checkbox">
                  <input
                    checked={layer.locked}
                    onChange={(event) =>
                      updateLayer(layer.kind, { locked: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>Blocca</span>
                </label>
              </div>
              <input
                aria-label={`${layer.name} opacity`}
                max={1}
                min={0}
                onChange={(event) =>
                  updateLayer(layer.kind, {
                    opacity: Number(event.target.value)
                  })
                }
                step={0.05}
                type="range"
                value={layer.opacity}
              />
            </article>
          ))}
        </div>
      </section>

      {selectedAsset ? (
        <section className="detail-block editor-transform-controls">
          <h3>Trasformazione asset</h3>
          <label>
            <span>Livello</span>
            <select
              onChange={(event) =>
                updateSelectedAssetLayer(
                  event.target.value as MapDocument["assets"][number]["layer"]
                )
              }
              value={selectedAsset.layer}
            >
              <option value="floor">Pavimento</option>
              <option value="wall">Muro</option>
              <option value="object">Oggetti</option>
              <option value="lighting">Luci</option>
              <option value="annotation">Solo GM</option>
            </select>
          </label>
          <label>
            <span>Rotazione</span>
            <input
              max={359}
              min={0}
              onChange={(event) =>
                updateSelectedAssetTransform({
                  rotation: Number(event.target.value)
                })
              }
              step={1}
              type="number"
              value={Math.round(selectedAsset.rotation)}
            />
          </label>
          <div className="editor-action-row">
            <button
              onClick={() =>
                updateSelectedAssetTransform({
                  rotation: selectedAsset.rotation - 15
                })
              }
              type="button"
            >
              Ruota -15
            </button>
            <button
              onClick={() =>
                updateSelectedAssetTransform({
                  rotation: selectedAsset.rotation + 15
                })
              }
              type="button"
            >
              Ruota +15
            </button>
          </div>
          <label>
            <span>Scala</span>
            <input
              max={4}
              min={0.25}
              onChange={(event) =>
                updateSelectedAssetTransform({
                  scale: Number(event.target.value)
                })
              }
              step={0.05}
              type="number"
              value={selectedAsset.scale}
            />
          </label>
          <div className="editor-action-row">
            <button
              onClick={() =>
                updateSelectedAssetTransform({ flipX: !selectedAsset.flipX })
              }
              type="button"
            >
              Rifletti O
            </button>
            <button
              onClick={() =>
                updateSelectedAssetTransform({ flipY: !selectedAsset.flipY })
              }
              type="button"
            >
              Rifletti V
            </button>
            <button onClick={duplicateSelectedAsset} type="button">
              Duplica
            </button>
          </div>
        </section>
      ) : null}

      <section className="detail-block editor-selection-controls">
        <h3>Selezione asset</h3>
        <div className="editor-action-row">
          <button onClick={selectAllVisibleAssets} type="button">
            Seleziona visibili
          </button>
          <button
            disabled={selectedAssetIds.length === 0}
            onClick={clearAssetSelection}
            type="button"
          >
            Pulisci
          </button>
        </div>
        <div className="editor-action-row">
          <button
            disabled={selectedAssetIds.length === 0 && !selectedAssetId}
            onClick={copySelectedAssets}
            type="button"
          >
            Copia
          </button>
          <button onClick={pasteAssetClipboard} type="button">
            Incolla
          </button>
        </div>
        <div className="editor-action-row">
          <button
            disabled={selectedAssetIds.length < 2}
            onClick={groupSelectedAssets}
            type="button"
          >
            Raggruppa
          </button>
          <button
            disabled={selectedAssetIds.length === 0 && !selectedAssetId}
            onClick={ungroupSelectedAssets}
            type="button"
          >
            Separa
          </button>
        </div>
      </section>

      <section className="detail-block editor-light-controls">
        <h3>Anteprima luci</h3>
        <label className="editor-checkbox">
          <input
            checked={fogPreviewEnabled}
            onChange={(event) => setFogPreviewEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>Anteprima nebbia</span>
        </label>
        {selectedLight ? (
          <>
            <label>
              <span>Raggio</span>
              <input
                max={20}
                min={1}
                onChange={(event) =>
                  updateSelectedLight({ radius: Number(event.target.value) })
                }
                step={0.5}
                type="number"
                value={selectedLight.radius}
              />
            </label>
            <label>
              <span>Intensita</span>
              <input
                max={1}
                min={0}
                onChange={(event) =>
                  updateSelectedLight({ intensity: Number(event.target.value) })
                }
                step={0.05}
                type="number"
                value={selectedLight.intensity}
              />
            </label>
            <label>
              <span>Colore</span>
              <input
                onChange={(event) =>
                  updateSelectedLight({ color: event.target.value })
                }
                type="color"
                value={selectedLight.color}
              />
            </label>
            <label className="editor-checkbox">
              <input
                checked={selectedLight.flicker}
                onChange={(event) =>
                  updateSelectedLight({ flicker: event.target.checked })
                }
                type="checkbox"
              />
              <span>Sfarfallio</span>
            </label>
          </>
        ) : (
          <p>{document.plan?.lights.length ?? 0} luci su questa mappa.</p>
        )}
      </section>

      <section className="detail-block editor-note-controls">
        <h3>Note GM</h3>
        <label>
          <span>Bozza</span>
          <textarea
            onChange={(event) => setNoteDraft(event.target.value)}
            value={noteDraft}
          />
        </label>
        <button onClick={addNoteAtHoverCell} type="button">
          Aggiungi nota
        </button>
        {selectedNote ? (
          <article className="editor-note-card">
            <input
              aria-label="Titolo nota"
              onChange={(event) =>
                updateSelectedNote({ title: event.target.value })
              }
              value={selectedNote.title}
            />
            <textarea
              onChange={(event) =>
                updateSelectedNote({ text: event.target.value })
              }
              value={selectedNote.text}
            />
            <button onClick={deleteSelectedNote} type="button">
              Elimina nota
            </button>
          </article>
        ) : null}
        <div className="editor-note-list">
          {(document.plan?.gmNotes ?? []).map((note) => (
            <button
              className={selectedNote?.id === note.id ? "active" : ""}
              key={note.id}
              onClick={() => setSelectedElement({ id: note.id, type: "note" })}
              type="button"
            >
              {note.title}
            </button>
          ))}
        </div>
      </section>

      <section className="detail-block editor-initiative-controls">
        <h3>Iniziativa</h3>
        <div className="editor-initiative-form">
          <input
            aria-label="Nome iniziativa"
            onChange={(event) =>
              setInitiativeDraft((current) => ({
                ...current,
                name: event.target.value
              }))
            }
            placeholder="Nome"
            value={initiativeDraft.name}
          />
          <input
            aria-label="Valore iniziativa"
            onChange={(event) =>
              setInitiativeDraft((current) => ({
                ...current,
                initiative: event.target.value
              }))
            }
            type="number"
            value={initiativeDraft.initiative}
          />
          <input
            aria-label="Punti ferita"
            onChange={(event) =>
              setInitiativeDraft((current) => ({
                ...current,
                hitPoints: event.target.value
              }))
            }
            placeholder="HP"
            type="number"
            value={initiativeDraft.hitPoints}
          />
          <select
            aria-label="Schieramento"
            onChange={(event) =>
              setInitiativeDraft((current) => ({
                ...current,
                side: event.target.value as typeof current.side
              }))
            }
            value={initiativeDraft.side}
          >
            <option value="enemy">Nemico</option>
            <option value="player">Giocatore</option>
            <option value="neutral">Neutrale</option>
          </select>
        </div>
        <button onClick={addInitiativeDraft} type="button">
          Aggiungi turno
        </button>
        <div className="editor-initiative-list">
          {(document.plan?.initiative ?? []).map((entry) => (
            <article key={entry.id}>
              <strong>
                {entry.initiative} - {entry.name}
              </strong>
              <span>
                {entry.side}
                {entry.hitPoints === undefined
                  ? ""
                  : ` / ${entry.hitPoints} HP`}
              </span>
              <div className="editor-action-row">
                <button
                  onClick={() => damageInitiativeEntry(entry, 1)}
                  type="button"
                >
                  -1 HP
                </button>
                <button
                  onClick={() => damageInitiativeEntry(entry, 5)}
                  type="button"
                >
                  -5 HP
                </button>
                <button
                  onClick={() => removeInitiativeEntry(entry)}
                  type="button"
                >
                  Rimuovi
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="detail-block asset-match-debug">
        <h3>Corrispondenze asset stanza</h3>
        {selectedRoom ? (
          <p>
            Confronto di {selectedRoom.label} con {assetGroups.length} gruppi
            locali.
          </p>
        ) : (
          <p>
            Seleziona una stanza per ispezionare le corrispondenze con gli asset
            locali.
          </p>
        )}
        <div className="asset-match-list">
          {roomMatches.map((match) => (
            <article key={match.group.id}>
              <header>
                <strong>{match.group.name}</strong>
                <span>{Math.round(match.score * 100)}%</span>
              </header>
              <p>
                {formatAssetKind(match.group.kind ?? "unknown")} -{" "}
                {match.group.assetIds?.length ?? 0} asset
              </p>
              <ul>
                {match.reasons.map((reason) => (
                  <li key={`${match.group.id}-${reason.label}`}>
                    {reason.label}: {reason.value} (+
                    {Math.round(reason.score * 100)})
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {selectedRoom && roomMatches.length === 0 ? (
            <p>Nessun gruppo corrispondente trovato.</p>
          ) : null}
        </div>
      </section>

      <section className="detail-block asset-match-debug">
        <h3>Trova asset compatibili</h3>
        <label>
          <span>Cerca</span>
          <input
            onChange={(event) => setAssetSearchQuery(event.target.value)}
            placeholder={
              selectedRoom
                ? `${selectedRoom.label} ${selectedRoom.tags.join(" ")}`
                : "cripta sarcofago"
            }
            type="search"
            value={assetSearchQuery}
          />
        </label>
        <button
          className="save-correction"
          onClick={handleFindMatchingAssets}
          type="button"
        >
          Cerca asset locali
        </button>
        <div className="asset-match-list">
          {assetSearchResults.map((result) => (
            <article key={result.assetId}>
              <header>
                <strong>{getFileName(result.relativePath)}</strong>
                <span>{Math.round(result.score * 100)}%</span>
              </header>
              <p>{result.reason}</p>
              <button
                draggable
                onDragStart={(event) =>
                  writeDragPayload(event, {
                    assetId: result.assetId,
                    type: "palette"
                  })
                }
                type="button"
              >
                Trascina sulla mappa
              </button>
            </article>
          ))}
        </div>
      </section>

      <button
        className="save-correction"
        disabled={selectedAssetIds.length === 0 && !selectedAssetId}
        onClick={deleteSelectedAsset}
        type="button"
      >
        Elimina asset selezionat{selectedAssetIds.length > 1 ? "i" : "o"}
      </button>

      <section className="detail-block editor-furnish-controls">
        <h3>Arredamento automatico</h3>
        <label>
          <span>Densita</span>
          <select
            onChange={(event) =>
              setFurnishingDensity(
                event.target.value as typeof furnishingDensity
              )
            }
            value={furnishingDensity}
          >
            <option value="sparse">Sparsa</option>
            <option value="normal">Normale</option>
            <option value="rich">Ricca</option>
            <option value="packed">Totale</option>
          </select>
        </label>
        <button
          className="save-correction"
          onClick={handleAutoFurnish}
          type="button"
        >
          Piazza asset stanza
        </button>
      </section>

      <section className="detail-block editor-export-controls">
        <h3>Esportazione</h3>
        <label>
          <span>Formato</span>
          <select
            onChange={(event) =>
              setExportFormat(event.target.value as ExportFormat)
            }
            value={exportFormat}
          >
            <option value="png">PNG</option>
            <option value="webp">WEBP</option>
          </select>
        </label>
        <label>
          <span>Scala</span>
          <select
            onChange={(event) => setExportScale(Number(event.target.value))}
            value={exportScale}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <label className="editor-checkbox">
          <input
            checked={exportIncludeGrid}
            onChange={(event) => setExportIncludeGrid(event.target.checked)}
            type="checkbox"
          />
          <span>Includi griglia</span>
        </label>
        <button
          className="save-correction"
          disabled={isExporting}
          onClick={handleExport}
          type="button"
        >
          {isExporting ? "Esportazione..." : "Esporta mappa"}
        </button>
      </section>

      <section className="detail-block">
        <h3>MapDocument JSON</h3>
        <div className="editor-json-actions">
          <button onClick={() => void saveJson()} type="button">
            {projectId ? "Salva progetto" : "Salva JSON"}
          </button>
          <button onClick={loadJson} type="button">
            Carica JSON
          </button>
          <button onClick={loadLocal} type="button">
            Carica locale
          </button>
        </div>
        <textarea
          aria-label="Documento mappa (JSON)"
          className="editor-json"
          onChange={(event) => setJsonText(event.target.value)}
          spellCheck={false}
          value={jsonText}
        />
        <p>{status}</p>
      </section>
    </aside>
  );
}

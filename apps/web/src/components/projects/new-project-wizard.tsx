"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AssetGroupView } from "@/lib/asset-groups";
import type { ReferenceMapView } from "@/lib/references";

type WizardStep = "describe" | "kind" | "style" | "assets" | "review";

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "describe", label: "1. Descrivi" },
  { id: "kind", label: "2. Tipo di mappa" },
  { id: "style", label: "3. Stile" },
  { id: "assets", label: "4. Asset" },
  { id: "review", label: "5. Genera" }
];

type MapKind = "dungeon" | "building" | "city";

type CreateProjectResponse = {
  error?: string;
  ok: boolean;
  project?: { id: string };
};

type NewProjectWizardProps = {
  assetGroups: AssetGroupView[];
  references: ReferenceMapView[];
};

export function NewProjectWizard({ assetGroups, references }: NewProjectWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("describe");
  const [name, setName] = useState("Cripta sotto la cattedrale");
  const [sourceRequest, setSourceRequest] = useState(
    "Una cripta sotto una cattedrale con non-morti prigionieri ma non ostili."
  );
  const [theme, setTheme] = useState("cripta");
  const [requiredRooms, setRequiredRooms] = useState("chapel, prison, reliquary, boss");
  const [mapKind, setMapKind] = useState<MapKind>("dungeon");
  const [widthCells, setWidthCells] = useState(52);
  const [heightCells, setHeightCells] = useState(36);
  const [roomCount, setRoomCount] = useState(8);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [selectedAssetGroupIds, setSelectedAssetGroupIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Step 1: descrivi la mappa che vuoi creare.");
  const [busy, setBusy] = useState(false);
  const stepIndex = STEPS.findIndex((entry) => entry.id === step);
  const selectedReferences = useMemo(
    () => references.filter((reference) => selectedReferenceIds.includes(reference.id)),
    [references, selectedReferenceIds]
  );
  const selectedGroups = useMemo(
    () => assetGroups.filter((group) => selectedAssetGroupIds.includes(group.id)),
    [assetGroups, selectedAssetGroupIds]
  );

  function goNext() {
    const next = STEPS[stepIndex + 1];

    if (next) {
      setStep(next.id);
      setStatus(`Step ${stepIndex + 2}: ${next.label.replace(/^\d+\.\s*/u, "")}.`);
    }
  }

  function goBack() {
    const previous = STEPS[stepIndex - 1];

    if (previous) {
      setStep(previous.id);
      setStatus(`Step ${stepIndex}: ${previous.label.replace(/^\d+\.\s*/u, "")}.`);
    }
  }

  function toggleReference(id: string) {
    setSelectedReferenceIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function toggleAssetGroup(id: string) {
    setSelectedAssetGroupIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  async function generate() {
    setBusy(true);
    setStatus("Generazione del progetto dal blueprint…");

    try {
      const response = await fetch("/api/projects", {
        body: JSON.stringify({
          heightCells,
          name,
          requiredRooms,
          roomCount,
          selectedAssetGroupIds,
          selectedReferenceIds,
          sourceRequest,
          theme,
          widthCells
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as CreateProjectResponse;

      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Impossibile creare il progetto.");
      }

      setStatus("Progetto creato. Apertura dell'editor…");
      router.push(`/projects/${payload.project.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile creare il progetto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wizard-shell" aria-label="Wizard nuovo progetto">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>Wizard nuova mappa</h1>
          <p>{status}</p>
        </div>
      </header>

      <ul className="wizard-steps">
        {STEPS.map((entry, index) => {
          const className =
            entry.id === step ? "active" : index < stepIndex ? "completed" : "";
          return (
            <li className={className} key={entry.id}>
              {entry.label}
            </li>
          );
        })}
      </ul>

      <section className="wizard-step">
        {step === "describe" ? (
          <>
            <h2>Descrivi la mappa</h2>
            <label className="field">
              <span>Nome del progetto</span>
              <input onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label className="field">
              <span>Testo della richiesta</span>
              <textarea
                onChange={(event) => setSourceRequest(event.target.value)}
                rows={5}
                value={sourceRequest}
              />
            </label>
            <label className="field">
              <span>Stanze richieste (separate da virgola)</span>
              <input onChange={(event) => setRequiredRooms(event.target.value)} value={requiredRooms} />
            </label>
          </>
        ) : null}

        {step === "kind" ? (
          <>
            <h2>Tipo di mappa</h2>
            <label className="field">
              <span>Tipo</span>
              <select onChange={(event) => setMapKind(event.target.value as MapKind)} value={mapKind}>
                <option value="dungeon">Dungeon</option>
                <option value="building">Edificio</option>
                <option value="city">Città</option>
              </select>
            </label>
            <label className="field">
              <span>Tema</span>
              <input onChange={(event) => setTheme(event.target.value)} value={theme} />
            </label>
            <label className="field">
              <span>Larghezza (celle)</span>
              <input
                max="96"
                min="12"
                onChange={(event) => setWidthCells(Number(event.target.value))}
                type="number"
                value={widthCells}
              />
            </label>
            <label className="field">
              <span>Altezza (celle)</span>
              <input
                max="96"
                min="12"
                onChange={(event) => setHeightCells(Number(event.target.value))}
                type="number"
                value={heightCells}
              />
            </label>
            <label className="field">
              <span>Numero stanze</span>
              <input
                max="24"
                min="1"
                onChange={(event) => setRoomCount(Number(event.target.value))}
                type="number"
                value={roomCount}
              />
            </label>
          </>
        ) : null}

        {step === "style" ? (
          <>
            <h2>Stile di riferimento</h2>
            <p className="muted">
              Opzionale. Seleziona una o più mappe di riferimento il cui Style DNA dovrebbe guidare il prompt.
            </p>
            {references.length === 0 ? (
              <p>Nessuna mappa di riferimento indicizzata. Esegui prima `pnpm references:scan`.</p>
            ) : (
              <ul style={{ display: "grid", gap: "6px", listStyle: "none", padding: 0 }}>
                {references.map((reference) => (
                  <li key={reference.id}>
                    <label className="editor-checkbox">
                      <input
                        checked={selectedReferenceIds.includes(reference.id)}
                        onChange={() => toggleReference(reference.id)}
                        type="checkbox"
                      />
                      <span>
                        {reference.path} - <span className="muted">{reference.mapType}</span>
                        {reference.styleDna ? <span className="muted"> - {reference.styleDna.promptSummary}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === "assets" ? (
          <>
            <h2>Gruppi di asset</h2>
            <p className="muted">
              Opzionale. Restringi quali gruppi di asset il generatore dovrebbe considerare.
            </p>
            {assetGroups.length === 0 ? (
              <p>Nessun gruppo di asset disponibile. Esegui prima `pnpm assets:group`.</p>
            ) : (
              <ul style={{ display: "grid", gap: "6px", listStyle: "none", padding: 0 }}>
                {assetGroups.slice(0, 60).map((group) => (
                  <li key={group.id}>
                    <label className="editor-checkbox">
                      <input
                        checked={selectedAssetGroupIds.includes(group.id)}
                        onChange={() => toggleAssetGroup(group.id)}
                        type="checkbox"
                      />
                      <span>
                        {group.name} <span className="muted">- {group.kind}, {group.assetCount} asset</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {step === "review" ? (
          <>
            <h2>Riepilogo e generazione</h2>
            <dl style={{ display: "grid", gap: "6px" }}>
              <div>
                <dt>Nome</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>
                  {mapKind} - {theme}
                </dd>
              </div>
              <div>
                <dt>Dimensioni</dt>
                <dd>
                  {widthCells} x {heightCells} celle, {roomCount} stanze
                </dd>
              </div>
              <div>
                <dt>Stanze richieste</dt>
                <dd>{requiredRooms || "(nessuna)"}</dd>
              </div>
              <div>
                <dt>Riferimenti selezionati</dt>
                <dd>{selectedReferences.length || "(nessuno)"}</dd>
              </div>
              <div>
                <dt>Gruppi di asset selezionati</dt>
                <dd>{selectedGroups.length || "(nessuno)"}</dd>
              </div>
              <div>
                <dt>Testo della richiesta</dt>
                <dd>{sourceRequest}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </section>

      <section className="wizard-actions">
        <button className="secondary" disabled={stepIndex === 0 || busy} onClick={goBack} type="button">
          Indietro
        </button>
        {step === "review" ? (
          <button disabled={busy} onClick={generate} type="button">
            {busy ? "Generazione…" : "Genera progetto"}
          </button>
        ) : (
          <button disabled={busy} onClick={goNext} type="button">
            Avanti
          </button>
        )}
      </section>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AssetGroupView } from "@/lib/asset-groups";
import type { ReferenceMapView } from "@/lib/references";

type WizardStep = "describe" | "kind" | "style" | "assets" | "review";

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "describe", label: "1. Describe" },
  { id: "kind", label: "2. Map Kind" },
  { id: "style", label: "3. Style" },
  { id: "assets", label: "4. Assets" },
  { id: "review", label: "5. Generate" }
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
  const [name, setName] = useState("Crypt Under The Cathedral");
  const [sourceRequest, setSourceRequest] = useState(
    "A crypt below a cathedral with bound non-hostile undead."
  );
  const [theme, setTheme] = useState("crypt");
  const [requiredRooms, setRequiredRooms] = useState("chapel, prison, reliquary, boss");
  const [mapKind, setMapKind] = useState<MapKind>("dungeon");
  const [widthCells, setWidthCells] = useState(52);
  const [heightCells, setHeightCells] = useState(36);
  const [roomCount, setRoomCount] = useState(8);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [selectedAssetGroupIds, setSelectedAssetGroupIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Step 1: describe the map you want.");
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
    setStatus("Generating project from blueprint");

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
        throw new Error(payload.error ?? "Could not create project.");
      }

      setStatus("Project created. Opening editor.");
      router.push(`/projects/${payload.project.id}/editor`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wizard-shell" aria-label="New project wizard">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>New Map Wizard</h1>
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
            <h2>Describe the Map</h2>
            <label className="field">
              <span>Project Name</span>
              <input onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <label className="field">
              <span>Source Request</span>
              <textarea
                onChange={(event) => setSourceRequest(event.target.value)}
                rows={5}
                value={sourceRequest}
              />
            </label>
            <label className="field">
              <span>Required Rooms (comma separated)</span>
              <input onChange={(event) => setRequiredRooms(event.target.value)} value={requiredRooms} />
            </label>
          </>
        ) : null}

        {step === "kind" ? (
          <>
            <h2>Map Kind</h2>
            <label className="field">
              <span>Type</span>
              <select onChange={(event) => setMapKind(event.target.value as MapKind)} value={mapKind}>
                <option value="dungeon">Dungeon</option>
                <option value="building">Building</option>
                <option value="city">City</option>
              </select>
            </label>
            <label className="field">
              <span>Theme</span>
              <input onChange={(event) => setTheme(event.target.value)} value={theme} />
            </label>
            <label className="field">
              <span>Width Cells</span>
              <input
                max="96"
                min="12"
                onChange={(event) => setWidthCells(Number(event.target.value))}
                type="number"
                value={widthCells}
              />
            </label>
            <label className="field">
              <span>Height Cells</span>
              <input
                max="96"
                min="12"
                onChange={(event) => setHeightCells(Number(event.target.value))}
                type="number"
                value={heightCells}
              />
            </label>
            <label className="field">
              <span>Room Count</span>
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
            <h2>Reference Style</h2>
            <p className="muted">Optional. Pick one or more reference maps whose style DNA should guide the prompt.</p>
            {references.length === 0 ? (
              <p>No reference maps indexed yet. Run `pnpm references:scan` first.</p>
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
            <h2>Asset Groups</h2>
            <p className="muted">Optional. Restrict which asset groups should be considered by the generator.</p>
            {assetGroups.length === 0 ? (
              <p>No asset groups available. Run `pnpm assets:group` first.</p>
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
                        {group.name} <span className="muted">- {group.kind}, {group.assetCount} assets</span>
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
            <h2>Review & Generate</h2>
            <dl style={{ display: "grid", gap: "6px" }}>
              <div>
                <dt>Name</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>
                  {mapKind} - {theme}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {widthCells} x {heightCells} cells, {roomCount} rooms
                </dd>
              </div>
              <div>
                <dt>Required rooms</dt>
                <dd>{requiredRooms || "(none)"}</dd>
              </div>
              <div>
                <dt>References selected</dt>
                <dd>{selectedReferences.length || "(none)"}</dd>
              </div>
              <div>
                <dt>Asset groups selected</dt>
                <dd>{selectedGroups.length || "(none)"}</dd>
              </div>
              <div>
                <dt>Source request</dt>
                <dd>{sourceRequest}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </section>

      <section className="wizard-actions">
        <button className="secondary" disabled={stepIndex === 0 || busy} onClick={goBack} type="button">
          Back
        </button>
        {step === "review" ? (
          <button disabled={busy} onClick={generate} type="button">
            {busy ? "Generating..." : "Generate Project"}
          </button>
        ) : (
          <button disabled={busy} onClick={goNext} type="button">
            Next
          </button>
        )}
      </section>
    </section>
  );
}

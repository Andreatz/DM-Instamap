"use client";

import { useEffect, useState } from "react";

type SnapshotSummary = {
  contentHash: string;
  createdAt: string;
  fileName?: string;
  label: string;
};

type SnapshotDiffResult = {
  changedFields: string[];
  fromHash: string;
  identical: boolean;
  toHash: string;
};

type ProjectSnapshotsPanelProps = {
  projectId: string;
};

export function ProjectSnapshotsPanel({ projectId }: ProjectSnapshotsPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [status, setStatus] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyHash, setBusyHash] = useState<string | null>(null);
  const [diffBusyHash, setDiffBusyHash] = useState<string | null>(null);
  const [diffResults, setDiffResults] = useState<Record<string, SnapshotDiffResult | null>>({});

  async function refresh() {
    setLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots`);
      const payload = (await response.json()) as { error?: string; snapshots?: SnapshotSummary[] };

      if (!response.ok || !payload.snapshots) {
        throw new Error(payload.error ?? "Impossibile caricare gli snapshot.");
      }

      setSnapshots(payload.snapshots);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile caricare gli snapshot.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createSnapshot() {
    setStatus("Creazione snapshot...");

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots`, {
        body: JSON.stringify({ label }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string; snapshot?: { written: boolean } };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error ?? "Creazione snapshot fallita.");
      }

      setLabel("");
      setStatus(payload.snapshot.written ? "Snapshot creato." : "Identico a uno snapshot esistente.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Creazione snapshot fallita.");
    }
  }

  async function diffSnapshotAgainstCurrent(contentHash: string) {
    setDiffBusyHash(contentHash);
    setStatus("Calcolo del diff rispetto allo stato corrente...");

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots/${contentHash}/diff?against=current`);
      const payload = (await response.json()) as { diff?: SnapshotDiffResult; error?: string };

      if (!response.ok || !payload.diff) {
        throw new Error(payload.error ?? "Diff fallito.");
      }

      setDiffResults((current) => ({ ...current, [contentHash]: payload.diff ?? null }));
      setStatus(
        payload.diff.identical
          ? "Lo snapshot e identico allo stato corrente."
          : `Diff vs corrente: ${payload.diff.changedFields.join(", ") || "nessun cambiamento di campo"}.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Diff fallito.");
    } finally {
      setDiffBusyHash(null);
    }
  }

  async function restoreSnapshot(contentHash: string) {
    const confirmed = window.confirm("Sostituire il progetto corrente con questo snapshot?");

    if (!confirmed) {
      return;
    }

    setBusyHash(contentHash);
    setStatus("Ripristino dello snapshot...");

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots/${contentHash}`, {
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ripristino fallito.");
      }

      setStatus("Snapshot ripristinato. Ricarica l'editor per vedere le modifiche.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ripristino fallito.");
    } finally {
      setBusyHash(null);
    }
  }

  return (
    <section className="asset-details">
      <h2>Snapshot</h2>
      <p className="muted">
        Ogni salvataggio puo essere archiviato localmente in data/projects/{projectId}/snapshots. Il contenuto identico
        e deduplicato tramite hash.
      </p>

      <div className="field-row">
        <label className="field">
          <span>Etichetta</span>
          <input
            onChange={(event) => setLabel(event.target.value)}
            placeholder="prima-modifica, prep-pass-2..."
            value={label}
          />
        </label>
        <button className="save-correction" onClick={() => void createSnapshot()} type="button">
          Snapshot dello stato corrente
        </button>
      </div>

      {loading ? <p className="muted">Caricamento snapshot...</p> : null}

      {!loading && snapshots.length === 0 ? <p className="muted">Nessuno snapshot.</p> : null}

      {snapshots.length > 0 ? (
        <ul className="snapshot-list">
          {snapshots.map((snapshot) => (
            <li key={snapshot.contentHash}>
              <header>
                <strong>{snapshot.label}</strong>
                <span className="muted">{new Date(snapshot.createdAt).toLocaleString()}</span>
              </header>
              <code className="muted">{snapshot.contentHash}</code>
              <div className="field-row">
                <button
                  disabled={diffBusyHash === snapshot.contentHash}
                  onClick={() => void diffSnapshotAgainstCurrent(snapshot.contentHash)}
                  type="button"
                >
                  {diffBusyHash === snapshot.contentHash ? "Diff..." : "Diff vs corrente"}
                </button>
                <button
                  className="save-correction"
                  disabled={busyHash === snapshot.contentHash}
                  onClick={() => void restoreSnapshot(snapshot.contentHash)}
                  type="button"
                >
                  {busyHash === snapshot.contentHash ? "Ripristino..." : "Ripristina"}
                </button>
              </div>
              {diffResults[snapshot.contentHash] ? (
                <p className="muted">
                  {diffResults[snapshot.contentHash]?.identical
                    ? "Identico allo stato corrente."
                    : `Modificati: ${diffResults[snapshot.contentHash]?.changedFields.join(", ") || "(nessuno)"}`}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {status ? <p>{status}</p> : null}
    </section>
  );
}

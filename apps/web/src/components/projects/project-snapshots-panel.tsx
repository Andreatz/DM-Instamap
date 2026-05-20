"use client";

import { useEffect, useState } from "react";

type SnapshotSummary = {
  contentHash: string;
  createdAt: string;
  fileName?: string;
  label: string;
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

  async function refresh() {
    setLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots`);
      const payload = (await response.json()) as { error?: string; snapshots?: SnapshotSummary[] };

      if (!response.ok || !payload.snapshots) {
        throw new Error(payload.error ?? "Could not load snapshots.");
      }

      setSnapshots(payload.snapshots);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load snapshots.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createSnapshot() {
    setStatus("Creating snapshot");

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots`, {
        body: JSON.stringify({ label }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string; snapshot?: { written: boolean } };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error ?? "Snapshot failed.");
      }

      setLabel("");
      setStatus(payload.snapshot.written ? "Snapshot created." : "Identical to an existing snapshot.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Snapshot failed.");
    }
  }

  async function restoreSnapshot(contentHash: string) {
    const confirmed = window.confirm("Replace the current project with this snapshot?");

    if (!confirmed) {
      return;
    }

    setBusyHash(contentHash);
    setStatus("Restoring snapshot");

    try {
      const response = await fetch(`/api/projects/${projectId}/snapshots/${contentHash}`, {
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Restore failed.");
      }

      setStatus("Snapshot restored. Reload the editor to see changes.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setBusyHash(null);
    }
  }

  return (
    <section className="asset-details">
      <h2>Snapshots</h2>
      <p className="muted">
        Each save can be archived locally under data/projects/{projectId}/snapshots. Identical content is deduped by hash.
      </p>

      <div className="field-row">
        <label className="field">
          <span>Label</span>
          <input
            onChange={(event) => setLabel(event.target.value)}
            placeholder="before-edit, prep-pass-2…"
            value={label}
          />
        </label>
        <button className="save-correction" onClick={() => void createSnapshot()} type="button">
          Snapshot Current State
        </button>
      </div>

      {loading ? <p className="muted">Loading snapshots…</p> : null}

      {!loading && snapshots.length === 0 ? <p className="muted">No snapshots yet.</p> : null}

      {snapshots.length > 0 ? (
        <ul className="snapshot-list">
          {snapshots.map((snapshot) => (
            <li key={snapshot.contentHash}>
              <header>
                <strong>{snapshot.label}</strong>
                <span className="muted">{new Date(snapshot.createdAt).toLocaleString()}</span>
              </header>
              <code className="muted">{snapshot.contentHash}</code>
              <button
                className="save-correction"
                disabled={busyHash === snapshot.contentHash}
                onClick={() => void restoreSnapshot(snapshot.contentHash)}
                type="button"
              >
                {busyHash === snapshot.contentHash ? "Restoring…" : "Restore"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {status ? <p>{status}</p> : null}
    </section>
  );
}

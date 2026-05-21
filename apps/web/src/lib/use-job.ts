"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkerJobRecord } from "./worker-client";

export type UseJobState = {
  error: string | null;
  job: WorkerJobRecord | null;
  loading: boolean;
};

export type UseJobOptions = {
  pollIntervalMs?: number;
};

const TERMINAL_STATUSES = new Set<WorkerJobRecord["status"]>(["completed", "failed", "cancelled"]);

export function useJob(jobId: string | null, options: UseJobOptions = {}): UseJobState {
  const [job, setJob] = useState<WorkerJobRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(jobId !== null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalMs = Math.max(500, options.pollIntervalMs ?? 1500);

  useEffect(() => {
    setJob(null);
    setError(null);

    if (!jobId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    async function pollOnce() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; job?: WorkerJobRecord };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.job) {
          setError(payload.error ?? "Job fetch failed.");
          return;
        }

        setError(null);
        setJob(payload.job);

        if (TERMINAL_STATUSES.has(payload.job.status) && intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (fetchError) {
        if (cancelled) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Job fetch failed.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void pollOnce();
    intervalRef.current = setInterval(() => {
      void pollOnce();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, pollIntervalMs]);

  return { error, job, loading };
}

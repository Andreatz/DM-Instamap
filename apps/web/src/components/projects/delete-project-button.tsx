"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
};

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");

  async function deleteProject() {
    const confirmed = window.confirm(
      `Eliminare il progetto "${projectName}"? L'operazione rimuove la cartella locale del progetto.`
    );

    if (!confirmed) {
      return;
    }

    setStatus("deleting");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Eliminazione del progetto fallita.");
      }

      router.push("/projects");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="project-danger-zone">
      <button disabled={status === "deleting"} onClick={deleteProject} type="button">
        {status === "deleting" ? "Eliminazione..." : "Elimina progetto"}
      </button>
      {status === "error" ? (
        <p>Impossibile eliminare il progetto. Verifica che i file locali siano scrivibili.</p>
      ) : null}
    </div>
  );
}

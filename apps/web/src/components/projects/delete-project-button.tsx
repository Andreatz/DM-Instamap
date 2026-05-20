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
    const confirmed = window.confirm(`Delete project "${projectName}"? This removes its local project folder.`);

    if (!confirmed) {
      return;
    }

    setStatus("deleting");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Project delete failed.");
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
        {status === "deleting" ? "Deleting..." : "Delete Project"}
      </button>
      {status === "error" ? <p>Could not delete this project. Check that the local files are writable.</p> : null}
    </div>
  );
}

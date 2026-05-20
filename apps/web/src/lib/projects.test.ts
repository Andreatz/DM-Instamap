import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeProjectId,
  createProject,
  createProjectSlug,
  deleteProject,
  InvalidProjectIdError,
  listProjects,
  readProject,
  updateProject
} from "./projects";

describe("project storage", () => {
  it("creates safe slugs and rejects unsafe ids", () => {
    expect(createProjectSlug("Cripta Sotto La Cattedrale!")).toBe("cripta-sotto-la-cattedrale");
    expect(assertSafeProjectId("safe-project-1")).toBe("safe-project-1");
    expect(() => assertSafeProjectId("../secret")).toThrow(InvalidProjectIdError);
  });

  it("creates, reads, lists, updates, and deletes local projects", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-projects-"));
    const project = await createProject(
      {
        heightCells: 24,
        name: "Crypt Project",
        requiredRooms: "boss, chapel",
        roomCount: 5,
        sourceRequest: "A small crypt.",
        theme: "crypt",
        widthCells: 32
      },
      { outputRoot }
    );

    expect(project.id).toBe("crypt-project");
    expect(project.document.editable).toBe(true);
    expect(project.document.plan?.rooms.some((room) => room.id === "room-entrance")).toBe(true);

    const metadata = JSON.parse(
      await readFile(path.join(outputRoot, "data", "projects", project.id, "project.json"), "utf8")
    ) as { document?: unknown; id: string };
    expect(metadata.id).toBe(project.id);
    expect(metadata.document).toBeUndefined();

    const loaded = await readProject(project.id, { outputRoot });
    expect(loaded.name).toBe("Crypt Project");

    const summaries = await listProjects({ outputRoot });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: "crypt-project",
      name: "Crypt Project"
    });

    const updatedDocument = {
      ...project.document,
      name: "Updated Crypt"
    };
    const updated = await updateProject(
      project.id,
      {
        document: updatedDocument,
        name: "Renamed Crypt"
      },
      { outputRoot }
    );
    expect(updated.name).toBe("Renamed Crypt");
    expect(updated.document.name).toBe("Updated Crypt");

    await deleteProject(project.id, { outputRoot });
    await expect(listProjects({ outputRoot })).resolves.toEqual([]);
  });

  it("keeps duplicate project ids unique", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-projects-"));
    const first = await createProject({ name: "Same Name" }, { outputRoot });
    const second = await createProject({ name: "Same Name" }, { outputRoot });

    expect(first.id).toBe("same-name");
    expect(second.id).toBe("same-name-2");
  });
});

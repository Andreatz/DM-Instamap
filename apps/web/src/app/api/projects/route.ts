import { createProject, listProjects } from "@/lib/projects";

export async function GET() {
  const projects = await listProjects();

  return Response.json({
    ok: true,
    projects
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const project = await createProject(body && typeof body === "object" ? body : {});

    return Response.json(
      {
        ok: true,
        project
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not create project.",
        ok: false
      },
      { status: 400 }
    );
  }
}

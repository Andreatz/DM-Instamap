import {
  deleteProject,
  InvalidProjectIdError,
  ProjectNotFoundError,
  readProject,
  updateProject
} from "@/lib/projects";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await readProject(projectId);

    return Response.json({
      ok: true,
      project
    });
  } catch (error) {
    return projectErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as unknown;
    const project = await updateProject(
      projectId,
      body && typeof body === "object" ? body : {}
    );

    return Response.json({
      ok: true,
      project
    });
  } catch (error) {
    return projectErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    await deleteProject(projectId);

    return Response.json({
      ok: true
    });
  } catch (error) {
    return projectErrorResponse(error);
  }
}

function projectErrorResponse(error: unknown): Response {
  if (error instanceof ProjectNotFoundError) {
    return Response.json({ error: error.message, ok: false }, { status: 404 });
  }

  if (error instanceof InvalidProjectIdError) {
    return Response.json({ error: error.message, ok: false }, { status: 400 });
  }

  return Response.json(
    {
      error: error instanceof Error ? error.message : "Project request failed.",
      ok: false
    },
    { status: 400 }
  );
}

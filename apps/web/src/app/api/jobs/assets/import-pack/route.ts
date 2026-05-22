import { findWorkspaceRoot } from "../../../../../lib/assets-manifest";
import {
  LocalPathValidationError,
  validateLocalPath
} from "../../../../../lib/local-paths";
import { postWorkerJob } from "../../../../../lib/worker-client";

type Body = {
  defaultTags?: unknown;
  preset?: unknown;
  root?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const root = typeof body.root === "string" ? body.root.trim() : "";

    if (!root) {
      return Response.json(
        { error: "root is required.", ok: false },
        { status: 400 }
      );
    }

    const preset =
      typeof body.preset === "string" && body.preset.trim()
        ? body.preset.trim()
        : "generic";
    const defaultTags = Array.isArray(body.defaultTags)
      ? body.defaultTags.filter(
          (tag): tag is string =>
            typeof tag === "string" && tag.trim().length > 0
        )
      : [];
    const workspaceRoot = await findWorkspaceRoot(process.cwd());
    const safeRoot = validateLocalPath({
      allowAbsoluteOutsideWorkspace: true,
      inputPath: root,
      label: "root",
      mustExist: true,
      workspaceRoot
    });

    const job = await postWorkerJob("/jobs/assets/import-pack", {
      defaultTags,
      preset,
      root: safeRoot
    });
    return Response.json({ job, ok: true }, { status: 202 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Worker unreachable.",
        ok: false
      },
      { status: error instanceof LocalPathValidationError ? 400 : 502 }
    );
  }
}

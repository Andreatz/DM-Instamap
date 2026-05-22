import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type ImageGenerationRequest = {
  height?: number;
  negativePrompt?: string;
  prompt: string;
  seed?: number;
  steps?: number;
  styleTags?: string[];
  width?: number;
};

export type ImageGenerationOutput = {
  contentType: string;
  data: Buffer;
  seed?: number;
};

export type ImageGenerationProvider = {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationOutput>;
  id: string;
  vendor: "replicate" | "automatic1111" | "custom";
};

export type ReplicateProviderConfig = {
  apiToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  model: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  version?: string;
};

export type Automatic1111ProviderConfig = {
  baseUrl?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export type CustomImageGenerationProviderConfig = {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationOutput>;
  id?: string;
};

export type GeneratedAssetMetadata = {
  classification: string;
  contentType: string;
  filename: string;
  path: string;
  prompt: string;
  provider: string;
  relativePath: string;
  seed?: number;
  styleTags: string[];
};

export type ImportGeneratedAssetOptions = {
  classification?: string;
  fileNameHint?: string;
  outputDirectory?: string;
  outputRoot?: string;
  request: ImageGenerationRequest;
  result: ImageGenerationOutput;
  writeFileImpl?: typeof writeFile;
};

const DEFAULT_DATA_DIRECTORY = "data";
const DEFAULT_GENERATED_ASSET_DIRECTORY = path.join("assets", "generated");
const DEFAULT_WORKSPACE_GENERATED_ASSET_DIRECTORY = path.join(
  "data",
  "assets",
  "generated"
);

export function createReplicateImageGenerationProvider(
  config: ReplicateProviderConfig
): ImageGenerationProvider {
  if (!config.apiToken) {
    throw new Error(
      "createReplicateImageGenerationProvider: apiToken is required."
    );
  }

  if (!config.model) {
    throw new Error(
      "createReplicateImageGenerationProvider: model is required."
    );
  }

  const baseUrl = (config.baseUrl ?? "https://api.replicate.com").replace(
    /\/$/u,
    ""
  );
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error(
      "createReplicateImageGenerationProvider: fetch is not available."
    );
  }

  const pollInterval = Math.max(250, Math.floor(config.pollIntervalMs ?? 1000));
  const pollTimeout = Math.max(
    5000,
    Math.floor(config.pollTimeoutMs ?? 120000)
  );

  return {
    id: `replicate:${config.model}`,
    vendor: "replicate",
    async generate(request) {
      const createResponse = await fetchImpl(`${baseUrl}/v1/predictions`, {
        body: JSON.stringify({
          input: {
            height: request.height,
            negative_prompt: request.negativePrompt,
            prompt: request.prompt,
            seed: request.seed,
            steps: request.steps,
            width: request.width
          },
          model: config.model,
          version: config.version
        }),
        headers: {
          authorization: `Token ${config.apiToken}`,
          "content-type": "application/json"
        },
        method: "POST"
      });

      if (!createResponse.ok) {
        const errorText = await createResponse
          .text()
          .catch(() => "(unable to read)");
        throw new Error(
          `Replicate create failed (${createResponse.status}): ${errorText}`
        );
      }

      const initial = (await createResponse.json()) as ReplicatePrediction;
      const finalPrediction = await pollReplicatePrediction({
        baseUrl,
        fetchImpl,
        initial,
        intervalMs: pollInterval,
        timeoutMs: pollTimeout,
        token: config.apiToken
      });
      const url = pickReplicateImageUrl(finalPrediction);

      if (!url) {
        throw new Error("Replicate prediction completed without an image URL.");
      }

      return downloadImage(
        fetchImpl,
        url,
        finalPrediction.input?.seed ?? request.seed
      );
    }
  };
}

export function createAutomatic1111Provider(
  config: Automatic1111ProviderConfig = {}
): ImageGenerationProvider {
  const baseUrl = (config.baseUrl ?? "http://127.0.0.1:7860").replace(
    /\/$/u,
    ""
  );
  const endpoint = config.endpoint ?? "/sdapi/v1/txt2img";
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("createAutomatic1111Provider: fetch is not available.");
  }

  return {
    id: "automatic1111:local",
    vendor: "automatic1111",
    async generate(request) {
      const response = await fetchImpl(`${baseUrl}${endpoint}`, {
        body: JSON.stringify({
          height: request.height ?? 512,
          negative_prompt: request.negativePrompt,
          prompt: request.prompt,
          seed: request.seed,
          steps: request.steps ?? 24,
          width: request.width ?? 512
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "(unable to read)");
        throw new Error(
          `Automatic1111 request failed (${response.status}): ${errorText}`
        );
      }

      const payload = (await response.json()) as { images?: unknown };
      const images = Array.isArray(payload.images) ? payload.images : [];
      const base64 = typeof images[0] === "string" ? (images[0] as string) : "";

      if (!base64) {
        throw new Error("Automatic1111 returned no image data.");
      }

      return {
        contentType: "image/png",
        data: Buffer.from(base64, "base64"),
        seed: request.seed
      };
    }
  };
}

export function createCustomImageGenerationProvider(
  config: CustomImageGenerationProviderConfig
): ImageGenerationProvider {
  return {
    id: config.id ?? "custom",
    vendor: "custom",
    generate: config.generate
  };
}

export type ResolvedImageGenerationConfig = {
  apiToken?: string;
  baseUrl?: string;
  model?: string;
  provider: "replicate" | "automatic1111";
  version?: string;
};

export function resolveImageGenerationConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ResolvedImageGenerationConfig | null {
  const provider = (env.IMAGE_GEN_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "replicate") {
    const apiToken = (
      env.IMAGE_GEN_API_KEY ??
      env.REPLICATE_API_TOKEN ??
      ""
    ).trim();
    const model = (env.IMAGE_GEN_MODEL ?? "").trim();

    if (!apiToken || !model) {
      return null;
    }

    return {
      apiToken,
      baseUrl: (env.IMAGE_GEN_BASE_URL ?? "").trim() || undefined,
      model,
      provider: "replicate",
      version: (env.IMAGE_GEN_VERSION ?? "").trim() || undefined
    };
  }

  if (provider === "automatic1111") {
    return {
      baseUrl: (env.IMAGE_GEN_BASE_URL ?? "").trim() || undefined,
      provider: "automatic1111"
    };
  }

  return null;
}

export function createImageGenerationProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ImageGenerationProvider | null {
  const config = resolveImageGenerationConfigFromEnv(env);

  if (!config) {
    return null;
  }

  if (config.provider === "replicate") {
    return createReplicateImageGenerationProvider({
      apiToken: config.apiToken ?? "",
      baseUrl: config.baseUrl,
      model: config.model ?? "",
      version: config.version
    });
  }

  return createAutomatic1111Provider({
    baseUrl: config.baseUrl
  });
}

export async function importGeneratedAssetToLibrary(
  provider: ImageGenerationProvider,
  options: ImportGeneratedAssetOptions
): Promise<GeneratedAssetMetadata> {
  const writer = options.writeFileImpl ?? writeFile;
  const outputRoot = resolveOutputRoot(options.outputRoot);
  const relativeRoot = resolveRelativeRoot(options.outputRoot, outputRoot);
  const outputDir = options.outputDirectory
    ? path.resolve(
        /*turbopackIgnore: true*/ outputRoot,
        options.outputDirectory
      )
    : path.resolve(
        outputRoot,
        options.outputRoot
          ? DEFAULT_WORKSPACE_GENERATED_ASSET_DIRECTORY
          : DEFAULT_GENERATED_ASSET_DIRECTORY
      );
  const filename = buildAssetFilename({
    extension: extensionForContentType(options.result.contentType),
    hint: options.fileNameHint,
    prompt: options.request.prompt,
    seed: options.result.seed ?? options.request.seed
  });
  const targetPath = path.join(/*turbopackIgnore: true*/ outputDir, filename);

  await mkdir(/*turbopackIgnore: true*/ outputDir, { recursive: true });
  await writer(targetPath, options.result.data);

  return {
    classification: options.classification ?? "prop",
    contentType: options.result.contentType,
    filename,
    path: targetPath,
    prompt: options.request.prompt,
    provider: provider.id,
    relativePath: path
      .relative(relativeRoot, targetPath)
      .split(path.sep)
      .join("/"),
    seed: options.result.seed ?? options.request.seed,
    styleTags: options.request.styleTags ?? []
  };
}

function resolveOutputRoot(outputRoot?: string): string {
  return outputRoot
    ? path.resolve(outputRoot)
    : path.join(process.cwd(), DEFAULT_DATA_DIRECTORY);
}

function resolveRelativeRoot(
  outputRoot: string | undefined,
  resolvedOutputRoot: string
): string {
  return outputRoot ? resolvedOutputRoot : resolvedOutputRoot;
}

type ReplicatePrediction = {
  error?: string | null;
  id: string;
  input?: {
    seed?: number;
  };
  output?: unknown;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  urls?: {
    get?: string;
  };
};

async function pollReplicatePrediction(input: {
  baseUrl: string;
  fetchImpl: typeof fetch;
  initial: ReplicatePrediction;
  intervalMs: number;
  timeoutMs: number;
  token: string;
}): Promise<ReplicatePrediction> {
  if (input.initial.status === "succeeded") {
    return input.initial;
  }

  const start = Date.now();
  let current = input.initial;

  while (current.status !== "succeeded") {
    if (current.status === "failed" || current.status === "canceled") {
      throw new Error(
        `Replicate prediction ${current.status}: ${current.error ?? "unknown error"}`
      );
    }

    if (Date.now() - start > input.timeoutMs) {
      throw new Error("Replicate polling timed out.");
    }

    await delay(input.intervalMs);
    const url =
      current.urls?.get ?? `${input.baseUrl}/v1/predictions/${current.id}`;
    const response = await input.fetchImpl(url, {
      headers: {
        authorization: `Token ${input.token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "(unable to read)");
      throw new Error(
        `Replicate poll failed (${response.status}): ${errorText}`
      );
    }

    current = (await response.json()) as ReplicatePrediction;
  }

  return current;
}

function pickReplicateImageUrl(prediction: ReplicatePrediction): string | null {
  if (Array.isArray(prediction.output)) {
    const first = prediction.output[0];
    return typeof first === "string" ? first : null;
  }

  if (typeof prediction.output === "string") {
    return prediction.output;
  }

  return null;
}

async function downloadImage(
  fetchImpl: typeof fetch,
  url: string,
  seed: number | undefined
): Promise<ImageGenerationOutput> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unable to read)");
    throw new Error(
      `Failed to download generated image (${response.status}): ${errorText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "image/png";

  return {
    contentType,
    data: buffer,
    seed
  };
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  return "bin";
}

function buildAssetFilename(input: {
  extension: string;
  hint?: string;
  prompt: string;
  seed?: number;
}): string {
  const slug =
    (input.hint ?? input.prompt)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 48) || "generated";
  const seedSuffix =
    typeof input.seed === "number" ? `-${input.seed}` : `-${Date.now()}`;

  return `${slug}${seedSuffix}.${input.extension}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

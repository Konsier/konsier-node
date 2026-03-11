import { DEFAULT_ALLOWED_CLOCK_SKEW_MS, ENV_CLOUD_BASE_URL } from "./constants";
import { linkUser as linkCloudUser } from "./cloud/link-user";
import { CloudApiClient, resolveCloudBaseUrl } from "./cloud/http";
import { sendMessage } from "./cloud/send";
import { KonsierError, toErrorMessage } from "./errors";
import { createHandler } from "./handler";
import { createVerifyPageMiddleware } from "./page/verify";
import { createTool, type Tool } from "./tool";
import type {
  Account,
  AgentConfig,
  AgentEntry,
  AgentManifestEntry,
  HandlerOptions,
  InternalDefinition,
  InternalEntry,
  JsonObject,
  KonsierOptions,
  LinkUserInput,
  ManifestContext,
  MountableApp,
  PageDefinition,
  SendInput,
} from "./types";

const REGISTRATION_RETRY_DELAYS_MS = [5_000, 15_000, 60_000] as const;

function shouldDebugLog(debug: boolean): boolean {
  return debug && process.env.NODE_ENV === "development";
}

function maskSecret(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "<empty>";
  }
  if (normalized.length <= 8) {
    return "***";
  }
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function normalizeEndpointUrl(raw: string | undefined): string | null {
  if (typeof raw === "undefined") {
    return null;
  }

  const normalized = raw.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new KonsierError({
      code: "INVALID_ENDPOINT_URL",
      message: "Konsier endpointUrl must be a valid http(s) URL.",
      statusCode: 400,
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new KonsierError({
      code: "INVALID_ENDPOINT_URL",
      message: "Konsier endpointUrl must be a valid http(s) URL.",
      statusCode: 400,
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new KonsierError({
      code: "INVALID_ENDPOINT_URL",
      message: "Konsier endpointUrl must use http or https.",
      statusCode: 400,
    });
  }

  if (parsed.search || parsed.hash) {
    throw new KonsierError({
      code: "INVALID_ENDPOINT_URL",
      message: "Konsier endpointUrl must not include query or hash segments.",
      statusCode: 400,
    });
  }

  return parsed.toString().replace(/\/+$/, "");
}

function endpointPath(endpointUrl: string): string {
  const pathname = new URL(endpointUrl).pathname.replace(/\/+$/, "");
  return pathname || "/";
}

function createJsonBodyMiddleware(rawBodyProperty: string) {
  return function jsonBodyMiddleware(
    req: {
      body?: unknown;
      method?: string;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      headers?: Record<string, string | string[] | undefined>;
      [key: string]: unknown;
    },
    _res: unknown,
    next?: (error?: unknown) => void,
  ): void {
    if (typeof next !== "function") {
      return;
    }

    if (typeof req.body !== "undefined") {
      if (typeof req[rawBodyProperty] === "undefined") {
        if (Buffer.isBuffer(req.body)) {
          req[rawBodyProperty] = req.body;
        } else if (typeof req.body === "string") {
          req[rawBodyProperty] = Buffer.from(req.body, "utf8");
        } else if (req.body && typeof req.body === "object") {
          req[rawBodyProperty] = Buffer.from(JSON.stringify(req.body), "utf8");
        }
      }
      next();
      return;
    }

    const method = (req.method ?? "POST").toUpperCase();
    if (method !== "POST") {
      next();
      return;
    }

    if (typeof req.on !== "function") {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let finished = false;

    const finalize = (error?: unknown): void => {
      if (finished) {
        return;
      }
      finished = true;
      next(error);
    };

    req.on("data", (chunk: unknown) => {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(typeof chunk === "string" ? chunk : ""),
      );
    });
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks);
      req[rawBodyProperty] = rawBody;

      if (rawBody.length === 0) {
        req.body = {};
        finalize();
        return;
      }

      try {
        req.body = JSON.parse(rawBody.toString("utf8"));
      } catch {
        req.body = rawBody.toString("utf8");
      }

      finalize();
    });
    req.on("error", (error: unknown) => {
      finalize(error);
    });
  };
}

export class Konsier {
  static tool = createTool;

  private readonly apiKey: string;
  private readonly agents: Record<string, AgentEntry>;
  private readonly internal: InternalEntry | null;
  private readonly cloudClient: CloudApiClient;
  private readonly allowedClockSkewMs: number;
  private readonly endpointUrl: string | null;
  private readonly debug: boolean;
  private mountedPath: string | null = null;
  private registrationTimer: ReturnType<typeof setTimeout> | null = null;
  private registrationComplete = false;

  constructor(options: KonsierOptions) {
    if (!options.apiKey?.trim()) {
      throw new KonsierError({
        code: "INVALID_API_KEY",
        message: "Konsier requires a non-empty apiKey.",
        statusCode: 400,
      });
    }

    if (
      (!options.agents || Object.keys(options.agents).length === 0) &&
      !options.internal
    ) {
      throw new KonsierError({
        code: "INVALID_SURFACES",
        message: "Konsier requires at least one agent or internal definition.",
        statusCode: 400,
      });
    }

    this.apiKey = options.apiKey;
    this.agents = options.agents ?? {};
    this.internal = options.internal ?? null;
    this.allowedClockSkewMs = DEFAULT_ALLOWED_CLOCK_SKEW_MS;
    this.endpointUrl = normalizeEndpointUrl(options.endpointUrl);
    this.debug = Boolean(options.debug);
    const cloudBaseUrl = resolveCloudBaseUrl({ debug: this.debug });

    const cloudClientOptions: ConstructorParameters<typeof CloudApiClient>[0] = {
      apiKey: this.apiKey,
      baseUrl: cloudBaseUrl,
      debug: this.debug,
    };

    this.cloudClient = new CloudApiClient(cloudClientOptions);

    this.validateAgentRegistry();
    this.validateInternalRegistry();

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] initialized", {
        endpointUrl: this.endpointUrl,
        cloudBaseUrl,
        cloudBaseUrlEnv: process.env[ENV_CLOUD_BASE_URL] ?? null,
        apiKey: maskSecret(this.apiKey),
        agentRefs: Object.keys(this.agents),
        internalPages: this.internal && typeof this.internal !== "function"
          ? (this.internal.pages ?? []).length
          : null,
        internalTools: this.internal && typeof this.internal !== "function"
          ? (this.internal.tools ?? []).length
          : null,
      });
    }
  }

  handler(options?: HandlerOptions) {
    const handlerDependencies: Parameters<typeof createHandler>[0] = {
      apiKey: this.apiKey,
      allowedClockSkewMs: this.allowedClockSkewMs,
      debug: this.debug,
      handleToolCall: {
        resolveAgentConfig: (agent, account) =>
          this.resolveAgentConfig(agent, account),
        resolveInternalDefinition: (account) =>
          this.resolveInternalEntry({ account }),
        sendMessage: (input) => this.sendMessage(input),
      },
      handleResolveAgent: {
        resolveAgentConfig: (agent, account) =>
          this.resolveAgentConfig(agent, account),
      },
      handleManifest: {
        listManifest: (account) => this.listManifest({ account }),
      },
    };

    if (options?.rawBodyProperty !== undefined) {
      handlerDependencies.rawBodyProperty = options.rawBodyProperty;
    }

    return createHandler(handlerDependencies);
  }

  verifyPage() {
    return createVerifyPageMiddleware({
      apiKey: this.apiKey,
      allowedClockSkewMs: this.allowedClockSkewMs,
      debug: this.debug,
    });
  }

  mount(app: MountableApp): void {
    if (!this.endpointUrl) {
      throw new KonsierError({
        code: "ENDPOINT_URL_REQUIRED",
        message: "Konsier mount() requires endpointUrl to be configured.",
        statusCode: 400,
      });
    }

    if (this.mountedPath) {
      if (shouldDebugLog(this.debug)) {
        console.log("[konsier] mount skipped", { path: this.mountedPath });
      }
      return;
    }

    const path = endpointPath(this.endpointUrl);
    app.use(path, createJsonBodyMiddleware("rawBody"));
    app.use(path, this.handler());
    this.mountedPath = path;

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] mounted", {
        path,
        endpointUrl: this.endpointUrl,
      });
    }

    void this.startRegistration();
  }

  async sendMessage(input: SendInput): Promise<void> {
    await sendMessage(this.cloudClient, input);
  }

  async linkUser(input: LinkUserInput): Promise<void> {
    await linkCloudUser(this.cloudClient, input);
  }

  async refresh(): Promise<void> {
    const payload =
      this.endpointUrl === null ? {} : { endpoint_url: this.endpointUrl };

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] refresh requested", payload);
    }

    await this.cloudClient.post("/agents/refresh", payload);
    this.registrationComplete = true;
    if (this.registrationTimer) {
      clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] refresh succeeded", payload);
    }
  }

  private async resolveAgentConfig(
    agentKey: string,
    account: Account | null,
  ): Promise<AgentConfig> {
    const resolved = await this.resolveAgentEntry(agentKey, account);
    this.assertValidAgentConfig(resolved, agentKey, 500);
    return resolved;
  }

  private async listManifest(
    context: ManifestContext,
  ): Promise<{
    agents: AgentManifestEntry[];
    internal: {
      tools: Array<{
        name: string;
        description: string;
        input: Record<string, unknown>;
      }>;
      pages: Array<{ name: string; path: string }>;
    };
  }> {
    const agents = await Promise.all(
      Object.keys(this.agents).map(async (ref) => {
        const resolved = await this.resolveAgentEntry(ref, context.account);
        this.assertValidAgentConfig(resolved, ref, 500);
        return {
          ref,
          name:
            typeof resolved.name === "string" && resolved.name.trim()
              ? resolved.name.trim()
              : ref,
          description:
            typeof resolved.description === "string" && resolved.description.trim()
              ? resolved.description.trim()
              : null,
        };
      }),
    );

    const internal = await this.resolveInternalEntry(context);
    return {
      agents,
      internal: {
        tools: this.manifestTools(internal.tools ?? [], "internal", 500),
        pages: this.pageDefinitions(internal.pages ?? [], "internal", 500),
      },
    };
  }

  private async resolveAgentEntry(
    agentKey: string,
    account: Account | null,
  ): Promise<AgentConfig> {
    const entry = this.agents[agentKey];
    if (!entry) {
      throw new KonsierError({
        code: "AGENT_NOT_FOUND",
        message: `Agent "${agentKey}" is not registered in this SDK instance.`,
        statusCode: 404,
      });
    }

    return typeof entry === "function" ? await entry({ account }) : entry;
  }

  private async resolveInternalEntry(
    context: ManifestContext,
  ): Promise<InternalDefinition> {
    if (!this.internal) {
      return {};
    }

    const resolved =
      typeof this.internal === "function"
        ? await this.internal(context)
        : this.internal;

    if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
      throw new KonsierError({
        code: "INVALID_INTERNAL_CONFIG",
        message: "internal must resolve to an object.",
        statusCode: 500,
      });
    }

    return resolved;
  }

  private validateAgentRegistry(): void {
    for (const [agentKey, entry] of Object.entries(this.agents)) {
      const key = agentKey.trim();
      if (!key) {
        throw new KonsierError({
          code: "INVALID_AGENT_KEY",
          message: "Agent keys must be non-empty strings.",
          statusCode: 400,
        });
      }

      if (typeof entry === "function") {
        continue;
      }

      this.assertValidAgentConfig(entry, agentKey, 400);
    }
  }

  private validateInternalRegistry(): void {
    if (!this.internal || typeof this.internal === "function") {
      return;
    }

    this.manifestTools(this.internal.tools ?? [], "internal", 400);
    this.pageDefinitions(this.internal.pages ?? [], "internal", 400);
  }

  private assertValidAgentConfig(
    config: AgentConfig,
    agentKey: string,
    statusCode: number,
  ): void {
    if (!config?.systemPrompt?.trim()) {
      throw new KonsierError({
        code: "INVALID_AGENT_CONFIG",
        message: `Agent "${agentKey}" must include systemPrompt.`,
        statusCode,
      });
    }

    this.manifestTools(config.tools, `agent "${agentKey}"`, statusCode);
  }

  private manifestTools(
    tools: Array<Tool<any, JsonObject>>,
    owner: string,
    statusCode: number,
  ): Array<{
    name: string;
    description: string;
    input: Record<string, unknown>;
  }> {
    if (!Array.isArray(tools)) {
      throw new KonsierError({
        code: "INVALID_TOOL",
        message: `${owner} tools must be an array.`,
        statusCode,
      });
    }

    const names = new Set<string>();
    return tools.map((tool) => {
      this.validateTool(tool, owner, statusCode);
      if (names.has(tool.name)) {
        throw new KonsierError({
          code: "DUPLICATE_TOOL_NAME",
          message: `${owner} contains duplicate tool "${tool.name}".`,
          statusCode,
        });
      }
      names.add(tool.name);
      return {
        name: tool.name,
        description: tool.description,
        input: tool.inputSchema,
      };
    });
  }

  private pageDefinitions(
    pages: PageDefinition[],
    owner: string,
    statusCode: number,
  ): Array<{ name: string; path: string }> {
    if (!Array.isArray(pages)) {
      throw new KonsierError({
        code: "INVALID_PAGE",
        message: `${owner} pages must be an array.`,
        statusCode,
      });
    }

    const names = new Set<string>();
    return pages.map((page) => {
      const name =
        typeof page?.name === "string" && page.name.trim() ? page.name.trim() : "";
      const path =
        typeof page?.path === "string" && page.path.trim() ? page.path.trim() : "";

      if (!name || !path) {
        throw new KonsierError({
          code: "INVALID_PAGE",
          message: `${owner} pages must include non-empty name and path values.`,
          statusCode,
        });
      }

      if (names.has(name)) {
        throw new KonsierError({
          code: "DUPLICATE_PAGE_NAME",
          message: `${owner} contains duplicate page "${name}".`,
          statusCode,
        });
      }

      names.add(name);
      return { name, path };
    });
  }

  private validateTool(
    tool: Tool<any, JsonObject>,
    owner: string,
    statusCode: number,
  ): void {
    if (!tool || typeof tool !== "object") {
      throw new KonsierError({
        code: "INVALID_TOOL",
        message: `${owner} contains an invalid tool entry.`,
        statusCode,
      });
    }

    if (!tool.name || typeof tool.name !== "string") {
      throw new KonsierError({
        code: "INVALID_TOOL",
        message: `${owner} includes a tool with no name.`,
        statusCode,
      });
    }

    if (
      typeof tool.handler !== "function" ||
      typeof tool.parseInput !== "function"
    ) {
      throw new KonsierError({
        code: "INVALID_TOOL",
        message: `Tool "${tool.name}" is not a valid Konsier tool. Use Konsier.tool({...}).`,
        statusCode,
      });
    }
  }

  private async startRegistration(attempt = 0): Promise<void> {
    if (this.registrationComplete) {
      return;
    }

    try {
      await this.refresh();
    } catch (error) {
      const shouldRetry = this.shouldRetryRegistration(error);
      const delay =
        REGISTRATION_RETRY_DELAYS_MS[
          Math.min(attempt, REGISTRATION_RETRY_DELAYS_MS.length - 1)
        ];

      if (shouldDebugLog(this.debug)) {
        console.warn("[konsier] refresh failed", {
          attempt: attempt + 1,
          endpointUrl: this.endpointUrl,
          error: toErrorMessage(error),
          retrying: shouldRetry,
          retryInMs: shouldRetry ? delay : null,
        });
      }

      if (!shouldRetry) {
        return;
      }

      this.registrationTimer = setTimeout(() => {
        void this.startRegistration(attempt + 1);
      }, delay);
    }
  }

  private shouldRetryRegistration(error: unknown): boolean {
    if (error instanceof KonsierError) {
      return error.statusCode >= 500;
    }

    if (error instanceof TypeError) {
      return true;
    }

    return error instanceof Error && error.name === "AbortError";
  }
}

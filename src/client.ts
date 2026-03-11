import {
  DEFAULT_ALLOWED_CLOCK_SKEW_MS,
  DEFAULT_CLOUD_BASE_URL,
} from "./constants";
import { linkUser as linkCloudUser } from "./cloud/link-user";
import { CloudApiClient } from "./cloud/http";
import { sendMessage } from "./cloud/send";
import { KonsierError } from "./errors";
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
  KonsierOptions,
  LinkUserInput,
  ManifestContext,
  PageDefinition,
  SendInput,
} from "./types";

export class Konsier {
  static tool = createTool;

  private readonly apiKey: string;
  private readonly agents: Record<string, AgentEntry>;
  private readonly internal: InternalEntry | null;
  private readonly cloudClient: CloudApiClient;
  private readonly allowedClockSkewMs: number;

  constructor(options: KonsierOptions) {
    if (!options.apiKey?.trim()) {
      throw new KonsierError({
        code: "INVALID_API_KEY",
        message: "Konsier requires a non-empty apiKey.",
        statusCode: 400,
      });
    }

    if (!options.agents || Object.keys(options.agents).length === 0) {
      throw new KonsierError({
        code: "INVALID_AGENTS",
        message: "Konsier requires at least one agent.",
        statusCode: 400,
      });
    }

    this.apiKey = options.apiKey;
    this.agents = options.agents;
    this.internal = options.internal ?? null;
    this.allowedClockSkewMs =
      options.allowedClockSkewMs ?? DEFAULT_ALLOWED_CLOCK_SKEW_MS;

    const cloudClientOptions: ConstructorParameters<typeof CloudApiClient>[0] = {
      apiKey: this.apiKey,
      baseUrl: DEFAULT_CLOUD_BASE_URL,
    };

    if (options.maxRetries !== undefined) {
      cloudClientOptions.maxRetries = options.maxRetries;
    }
    if (options.fetchImpl !== undefined) {
      cloudClientOptions.fetchImpl = options.fetchImpl;
    }

    this.cloudClient = new CloudApiClient(cloudClientOptions);

    this.validateAgentRegistry();
    this.validateInternalRegistry();
  }

  handler(options?: HandlerOptions) {
    const handlerDependencies: Parameters<typeof createHandler>[0] = {
      apiKey: this.apiKey,
      allowedClockSkewMs: this.allowedClockSkewMs,
      handleToolCall: {
        resolveAgentConfig: (agent, account) =>
          this.resolveAgentConfig(agent, account),
        sendMessage: (input) => this.send(input),
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
    });
  }

  async send(input: SendInput): Promise<void> {
    await sendMessage(this.cloudClient, input);
  }

  async linkUser(input: LinkUserInput): Promise<void> {
    await linkCloudUser(this.cloudClient, input);
  }

  async refresh(): Promise<void> {
    await this.cloudClient.post("/api/agents/refresh", {});
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
      tools: Array<{ name: string }>;
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
        tools: this.toolDefinitions(internal.tools ?? [], "internal", 500),
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

    this.toolDefinitions(this.internal.tools ?? [], "internal", 400);
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

    this.toolDefinitions(config.tools, `agent "${agentKey}"`, statusCode);
  }

  private toolDefinitions(
    tools: Array<Tool<any, Record<string, unknown>>>,
    owner: string,
    statusCode: number,
  ): Array<{ name: string }> {
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
      return { name: tool.name };
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

  private validateTool(tool: Tool, owner: string, statusCode: number): void {
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
}

import { DEFAULT_ALLOWED_CLOCK_SKEW_MS, ENV_CLOUD_BASE_URL } from "./constants";
import { ERROR_CODES, createPublicApiError } from "./contracts";
import {
  completeConnection,
  getAccount,
  getUser,
  linkAccount as linkCloudAccount,
  linkUser as linkCloudUser,
  listAccounts,
  startConnection,
} from "./cloud/link-user";
import { CloudApiClient, resolveCloudBaseUrl } from "./cloud/http";
import {
  clearConversation,
  deleteConversation,
  getConversation,
  listConversationMessages,
  listConversations,
  resumeConversation,
  sendConversationMessage,
  takeOverConversation,
} from "./cloud/conversations";
import { KonsierError } from "./errors";
import { createHandler } from "./handler";
import { resolvePageRequest } from "./page/verify";
import { notify } from "./notify";
import { attachment, createOperation, type Operation } from "./tool";
import type {
  Account,
  AccountGetInput,
  AgentConfig,
  AgentEntry,
  AgentManifestEntry,
  AccountLinkInput,
  AgentEventHandlers,
  AgentTelegramConfig,
  ConnectionCompleteInput,
  ConnectionCompleteResult,
  ConnectionStartInput,
  ConnectionStartResult,
  InternalDefinition,
  InternalEntry,
  JsonObject,
  KonsierOptions,
  ConversationHandle,
  ConversationListInput,
  ManifestContext,
  NotificationInput,
  PageDefinition,
  ProjectEventHandlers,
  SdkAccount,
  SdkUser,
  TelegramSlashCommandDefinition,
  UserGetInput,
  UserLinkInput,
  PageRequestInput,
  PageRequestResult,
} from "./types";

const RESERVED_OPERATION_ROOTS = new Set([
  "whoami",
  "conversation",
  "message",
  "user",
  "account",
  "notify",
  "attachment",
  "status",
  "quick-reply",
]);

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

function normalizeHttpUrl(
  raw: string | undefined,
  optionName: "endpointUrl" | "publicUrl",
): string | null {
  if (typeof raw === "undefined") {
    return null;
  }

  const normalized = raw.trim().replace(/\/+$/, "");
  if (!normalized) {
    const publicError = createPublicApiError({
      code: ERROR_CODES.client.configuration.endpoint_invalid,
      message: `Konsier ${optionName} must be a valid http(s) URL.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    const publicError = createPublicApiError({
      code: ERROR_CODES.client.configuration.endpoint_invalid,
      message: `Konsier ${optionName} must be a valid http(s) URL.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const publicError = createPublicApiError({
      code: ERROR_CODES.client.configuration.endpoint_invalid,
      message: `Konsier ${optionName} must use http or https.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  if (parsed.search || parsed.hash) {
    const publicError = createPublicApiError({
      code: ERROR_CODES.client.configuration.endpoint_invalid,
      message: `Konsier ${optionName} must not include query or hash segments.`,
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  if (optionName === "publicUrl" && parsed.pathname !== "/") {
    const publicError = createPublicApiError({
      code: ERROR_CODES.client.configuration.endpoint_invalid,
      message: "Konsier publicUrl must be an origin without a path.",
    });
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }

  return parsed.toString().replace(/\/+$/, "");
}

function endpointPath(endpointUrl: string): string {
  const pathname = new URL(endpointUrl).pathname.replace(/\/+$/, "");
  return pathname || "/";
}

export function createJsonBodyMiddleware(rawBodyProperty: string) {
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
  static operation = createOperation;
  static attachment = attachment;
  static telegram = {
    slashCommand: createTelegramSlashCommand,
  };
  readonly users: {
    get: (input: UserGetInput) => Promise<SdkUser>;
    link: (input: UserLinkInput) => Promise<SdkUser>;
  };
  readonly accounts: {
    list: () => Promise<SdkAccount[]>;
    get: (input: AccountGetInput) => Promise<SdkAccount>;
    link: (input: AccountLinkInput) => Promise<SdkAccount>;
  };
  readonly connections: {
    start: (input: ConnectionStartInput) => Promise<ConnectionStartResult>;
    complete: (
      input: ConnectionCompleteInput,
    ) => Promise<ConnectionCompleteResult>;
  };
  readonly conversations: {
    list: (input?: ConversationListInput) => Promise<ConversationHandle[]>;
  };
  readonly notify: (input: NotificationInput) => Promise<Record<string, unknown>>;

  private readonly apiKey: string;
  private readonly agents: Record<string, AgentEntry>;
  private readonly internal: InternalEntry | null;
  private readonly projectEvents: ProjectEventHandlers;
  private readonly cloudClient: CloudApiClient;
  private readonly allowedClockSkewMs: number;
  private readonly endpointUrl: string | null;
  private readonly publicUrl: string | null;
  private readonly debug: boolean;

  constructor(options: KonsierOptions) {
    if (!options.apiKey?.trim()) {
      const publicError = createPublicApiError({
        code: ERROR_CODES.client.configuration.api_key_missing,
      });
      throw new KonsierError({
        code: publicError.code,
        message: publicError.message,
        action: publicError.action,
        statusCode: 400,
      });
    }

    if (
      (!options.agents || Object.keys(options.agents).length === 0) &&
      !options.internal &&
      !hasProjectEvents(options.events ?? {})
    ) {
      const publicError = createPublicApiError({
        code: ERROR_CODES.client.configuration.surface_missing,
      });
      throw new KonsierError({
        code: publicError.code,
        message: publicError.message,
        action: publicError.action,
        statusCode: 400,
      });
    }

    this.apiKey = options.apiKey;
    this.agents = options.agents ?? {};
    this.internal = options.internal ?? null;
    this.projectEvents = options.events ?? {};
    this.allowedClockSkewMs = DEFAULT_ALLOWED_CLOCK_SKEW_MS;
    this.endpointUrl = normalizeHttpUrl(options.endpointUrl, "endpointUrl");
    this.publicUrl = normalizeHttpUrl(options.publicUrl, "publicUrl");
    this.debug = Boolean(options.debug);
    const cloudBaseUrl = resolveCloudBaseUrl({ debug: this.debug });

    const cloudClientOptions: ConstructorParameters<typeof CloudApiClient>[0] = {
      apiKey: this.apiKey,
      baseUrl: cloudBaseUrl,
      debug: this.debug,
    };

    this.cloudClient = new CloudApiClient(cloudClientOptions);
    this.users = {
      get: async (input) => {
        return getUser(this.cloudClient, input);
      },
      link: async (input) => {
        return linkCloudUser(this.cloudClient, input);
      },
    };
    this.accounts = {
      list: async () => {
        return listAccounts(this.cloudClient);
      },
      get: async (input) => {
        return getAccount(this.cloudClient, input);
      },
      link: async (input) => {
        return linkCloudAccount(this.cloudClient, input);
      },
    };
    this.connections = {
      start: async (input) => {
        return startConnection(this.cloudClient, input);
      },
      complete: async (input) => {
        return completeConnection(this.cloudClient, input);
      },
    };
    this.conversations = {
      list: async (input = {}) => {
        const result = await listConversations(this.cloudClient, input);
        return result.conversations.map((conversation) =>
          this.createConversationHandle(conversation.id),
        );
      },
    };
    this.notify = async (input) => {
      return notify(this.cloudClient, input);
    };

    this.validateAgentRegistry();
    this.validateInternalRegistry();
    this.validateTelegramRegistry();
    this.validateProjectEvents();
    this.validateAgentEvents();

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
        internalOperations: this.internal && typeof this.internal !== "function"
          ? (this.internal.operations ?? []).length
          : null,
        telegramSlashCommands: Object.values(this.agents).reduce((count, entry) => {
          if (typeof entry === "function") return count;
          return count + (entry.telegram?.slashCommands?.length ?? 0);
        }, 0),
        events: countProjectEvents(this.projectEvents),
      });
    }
  }

  pageRequest(input: PageRequestInput): PageRequestResult {
    return resolvePageRequest(
      {
        apiKey: this.apiKey,
        debug: this.debug,
      },
      input,
    );
  }
  webhookPath(): string {
    if (!this.endpointUrl) {
      const publicError = createPublicApiError({
        code: ERROR_CODES.client.configuration.endpoint_invalid,
        message: "Konsier endpointUrl is required for webhook adapters.",
      });
      throw new KonsierError({
        code: publicError.code,
        message: publicError.message,
        action: publicError.action,
        statusCode: 400,
      });
    }

    return endpointPath(this.endpointUrl);
  }

  webhookHandler() {
    return createHandler({
      apiKey: this.apiKey,
      allowedClockSkewMs: this.allowedClockSkewMs,
      debug: this.debug,
      handleOperationInvoke: {
        debug: this.debug,
        resolveAgentConfig: (agent, account) =>
          this.resolveAgentConfig(agent, account),
        resolveInternalDefinition: (account) =>
          this.resolveInternalEntry({ account }),
      },
      handleResolveAgent: {
        resolveAgentConfig: (agent, account) =>
          this.resolveAgentConfig(agent, account),
      },
      handleSlashCommand: {
        resolveSlashCommand: (agent, command) =>
          this.resolveTelegramSlashCommand(agent, command),
      },
      handleEventDispatch: {
        resolveEventHandler: (target, name, phase) =>
          this.resolveEventHandler(target, name, phase),
      },
      handleManifest: {
        listManifest: (account) => this.listManifest({ account }),
      },
    });
  }

  private createConversationHandle(
    conversationId: string | number,
  ): ConversationHandle {
    return {
      get: async () => getConversation(this.cloudClient, conversationId),
      messages: {
        list: async (input = {}) =>
          listConversationMessages(this.cloudClient, conversationId, input),
      },
      sendMessage: async (input) =>
        sendConversationMessage(this.cloudClient, conversationId, input),
      clear: async () => clearConversation(this.cloudClient, conversationId),
      delete: async () => deleteConversation(this.cloudClient, conversationId),
      takeover: async () =>
        takeOverConversation(this.cloudClient, conversationId),
      resume: async () => resumeConversation(this.cloudClient, conversationId),
    };
  }

  async sync(): Promise<void> {
    const payload = {
      ...(this.endpointUrl === null ? {} : { endpoint_url: this.endpointUrl }),
      ...(this.publicUrl === null ? {} : { public_url: this.publicUrl }),
    };

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] sync requested", payload);
    }

    await this.cloudClient.post("/agents/refresh", payload);

    if (shouldDebugLog(this.debug)) {
      console.log("[konsier] sync succeeded", payload);
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
    project: {
      events: string[];
    };
    agents: Record<string, {
      name: string;
      description: string | null;
      systemPrompt: string;
      operations: ReturnType<Konsier["manifestOperations"]>;
      events: string[];
      telegram?: {
        slashCommands: Array<{
          command: string;
          description: string;
        }>;
        events: string[];
      };
    }>;
    internal: {
      operations: ReturnType<Konsier["manifestOperations"]>;
      pages: Array<{ name: string; path: string }>;
    };
  }> {
    const agentsList = await Promise.all(
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
          systemPrompt: resolved.systemPrompt.trim(),
          operations: this.manifestOperations(
            resolved.operations,
            `agent "${ref}"`,
            500,
          ),
          events: listRegisteredKeys(resolved.events ?? {}),
          telegram:
            resolved.telegram && (resolved.telegram.slashCommands?.length ?? 0) > 0
              ? {
                  slashCommands: (resolved.telegram.slashCommands ?? []).map(
                    (entry) => ({
                      command: entry.command,
                      description: entry.description,
                    }),
                  ),
                  events: listRegisteredKeys(resolved.telegram.events ?? {}),
                }
              : listRegisteredKeys(resolved.telegram?.events ?? {}).length > 0
                ? {
                    slashCommands: [],
                    events: listRegisteredKeys(resolved.telegram?.events ?? {}),
                  }
                : undefined,
        };
      }),
    );
    const agents = Object.fromEntries(
      agentsList.map((agent) => [
        agent.ref,
        {
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          operations: agent.operations,
          events: agent.events,
          ...(agent.telegram ? { telegram: agent.telegram } : {}),
        },
      ]),
    );

    const internal = await this.resolveInternalEntry(context);
    return {
      agents,
      project: {
        events: listRegisteredKeys(this.projectEvents),
      },
      internal: {
        operations: this.manifestOperations(
          internal.operations ?? [],
          "internal",
          500,
        ),
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
        ...createPublicApiError({
          code: ERROR_CODES.agent.resource.not_found,
          message: `Agent "${agentKey}" is not registered in this SDK instance.`,
        }),
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
        ...createPublicApiError({
          code: ERROR_CODES.client.configuration.invalid,
          message: "internal must resolve to an object.",
        }),
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
          ...createPublicApiError({
            code: ERROR_CODES.client.configuration.invalid,
            message: "Agent keys must be non-empty strings.",
          }),
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

    this.manifestOperations(this.internal.operations ?? [], "internal", 400);
    this.pageDefinitions(this.internal.pages ?? [], "internal", 400);
  }

  private validateTelegramRegistry(): void {
    const seen = new Set<string>();
    for (const [agentKey, entry] of Object.entries(this.agents)) {
      if (typeof entry === "function") {
        continue;
      }
      const commands = entry.telegram?.slashCommands ?? [];
      for (const commandEntry of commands) {
        const command = commandEntry?.command?.trim().toLowerCase() ?? "";
        const description = commandEntry?.description?.trim() ?? "";
        if (!command || !description || typeof commandEntry?.handler !== "function") {
          throw new KonsierError({
            ...createPublicApiError({
              code: ERROR_CODES.client.configuration.invalid,
              message:
                `agents.${agentKey}.telegram.slashCommands entries must include command, description, and handler.`,
            }),
            statusCode: 400,
          });
        }
        if (seen.has(command)) {
          throw new KonsierError({
            ...createPublicApiError({
              code: ERROR_CODES.client.configuration.invalid,
              message: `telegram slash command "${command}" is registered more than once.`,
            }),
            statusCode: 400,
          });
        }
        seen.add(command);
      }
    }
  }

  private validateProjectEvents(): void {
    validateHandlerObject(this.projectEvents, "events");
  }

  private validateAgentEvents(): void {
    for (const [agentKey, entry] of Object.entries(this.agents)) {
      if (typeof entry === "function") {
        continue;
      }
      validateHandlerObject(entry.events ?? {}, `agents.${agentKey}.events`);
      validateHandlerObject(
        entry.telegram?.events ?? {},
        `agents.${agentKey}.telegram.events`,
      );
    }
  }

  private assertValidAgentConfig(
    config: AgentConfig,
    agentKey: string,
    statusCode: number,
  ): void {
    if (!config?.systemPrompt?.trim()) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.agent.configuration.invalid,
          message: `Agent "${agentKey}" must include systemPrompt.`,
        }),
        statusCode,
      });
    }

    this.manifestOperations(config.operations, `agent "${agentKey}"`, statusCode);
  }

  private manifestOperations(
    operations: Array<Operation<any, JsonObject>>,
    owner: string,
    statusCode: number,
  ): Array<{
    service: string;
    resource: string;
    action: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    approval: { required: boolean; bypassable: boolean };
  }> {
    if (!Array.isArray(operations)) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.operation.configuration.invalid,
          message: `${owner} operations must be an array.`,
        }),
        statusCode,
      });
    }

    const refs = new Set<string>();
    return operations.map((operation) => {
      this.validateOperation(operation, owner, statusCode);
      const ref = `${operation.service}.${operation.resource}.${operation.action}`;
      if (refs.has(ref)) {
        throw new KonsierError({
          ...createPublicApiError({
            code: ERROR_CODES.operation.configuration.invalid,
            message: `${owner} contains duplicate operation "${ref}".`,
          }),
          statusCode,
        });
      }
      refs.add(ref);
      return {
        service: operation.service,
        resource: operation.resource,
        action: operation.action,
        title: operation.title,
        description: operation.description,
        inputSchema: operation.inputSchema,
        outputSchema: operation.outputSchema,
        approval: operation.approval,
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
        ...createPublicApiError({
          code: ERROR_CODES.client.configuration.invalid,
          message: `${owner} pages must be an array.`,
        }),
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
          ...createPublicApiError({
            code: ERROR_CODES.client.configuration.invalid,
            message: `${owner} pages must include non-empty name and path values.`,
          }),
          statusCode,
        });
      }

      if (names.has(name)) {
        throw new KonsierError({
          ...createPublicApiError({
            code: ERROR_CODES.client.configuration.invalid,
            message: `${owner} contains duplicate page "${name}".`,
          }),
          statusCode,
        });
      }

      names.add(name);
      return { name, path };
    });
  }

  private validateOperation(
    operation: Operation<any, JsonObject>,
    owner: string,
    statusCode: number,
  ): void {
    if (!operation || typeof operation !== "object") {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.operation.configuration.invalid,
        message: `${owner} contains an invalid operation entry.`,
        }),
        statusCode,
      });
    }

    if (
      !operation.service ||
      !operation.resource ||
      !operation.action ||
      !operation.title
    ) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.operation.configuration.invalid,
          message: `${owner} includes an operation with incomplete identity.`,
        }),
        statusCode,
      });
    }

    if (RESERVED_OPERATION_ROOTS.has(operation.service)) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.operation.configuration.invalid,
          message: `Operation root "${operation.service}" is reserved by the Konsier runtime.`,
        }),
        statusCode,
      });
    }

    if (
      typeof operation.handler !== "function" ||
      typeof operation.parseInput !== "function" ||
      typeof operation.parseOutput !== "function"
    ) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.operation.configuration.invalid,
          message: `Operation "${operation.service}.${operation.resource}.${operation.action}" is invalid. Use Konsier.operation({...}).`,
        }),
        statusCode,
      });
    }
  }

  private async resolveTelegramSlashCommand(
    agent: string,
    command: string,
  ): Promise<TelegramSlashCommandDefinition> {
    const resolvedAgent = await this.resolveAgentEntry(agent, null);
    const normalized = command.trim().toLowerCase();
    const resolved = (resolvedAgent.telegram?.slashCommands ?? []).find(
      (entry) => entry.command.trim().toLowerCase() === normalized,
    );

    if (!resolved) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.validation.request.invalid,
          message: `Telegram slash command "${command}" is not registered for agent "${agent}".`,
        }),
        statusCode: 404,
      });
    }

    return resolved;
  }

  private async resolveEventHandler(
    target:
      | { scope: "project" }
      | { scope: "agent"; agent: string }
      | { scope: "channel"; agent: string; channel: "telegram" },
    name: string,
    phase: "before" | "on",
  ): Promise<{ handler: (...args: any[]) => any }> {
    const normalized = name.trim();
    const method = eventHandlerMethodName(normalized, phase);
    if (!method) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.validation.request.invalid,
          message: `SDK event "${phase}:${name}" is not registered.`,
        }),
        statusCode: 404,
      });
    }

    if (target.scope === "project") {
      const handler = (this.projectEvents as Record<string, unknown>)[method];
      if (typeof handler === "function") {
        return { handler: handler as (...args: any[]) => any };
      }
    } else {
      const agent = await this.resolveAgentEntry(target.agent, null);
      if (target.scope === "agent") {
        const handler = (agent.events as Record<string, unknown> | undefined)?.[method];
        if (typeof handler === "function") {
          return { handler: handler as (...args: any[]) => any };
        }
      } else if (target.channel === "telegram") {
        const handler = (agent.telegram?.events as Record<string, unknown> | undefined)?.[
          method
        ];
        if (typeof handler === "function") {
          return { handler: handler as (...args: any[]) => any };
        }
      }
    }

    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.validation.request.invalid,
        message: `SDK event "${phase}:${name}" is not registered.`,
      }),
      statusCode: 404,
    });
  }
}

function createTelegramSlashCommand(
  definition: TelegramSlashCommandDefinition,
): TelegramSlashCommandDefinition {
  return {
    command: definition.command.trim().toLowerCase(),
    description: definition.description.trim(),
    handler: definition.handler,
  };
}

function hasProjectEvents(events: ProjectEventHandlers): boolean {
  return listRegisteredKeys(events).length > 0;
}

function validateHandlerObject(
  value: Record<string, unknown>,
  label: string,
): void {
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "undefined") {
      continue;
    }
    if (typeof entry !== "function") {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.client.configuration.invalid,
          message: `${label}.${key} must be a function.`,
        }),
        statusCode: 400,
      });
    }
  }
}

function listRegisteredKeys(value: Record<string, unknown>): string[] {
  return Object.entries(value)
    .filter((entry) => typeof entry[1] === "function")
    .map((entry) => entry[0]);
}

function countProjectEvents(events: ProjectEventHandlers): number {
  return listRegisteredKeys(events).length;
}

function eventHandlerMethodName(
  eventName: string,
  phase: "before" | "on",
): string | null {
  switch (`${phase}:${eventName}`) {
    case "before:account.connect":
      return "beforeAccountConnect";
    case "on:account.connected":
      return "onAccountConnected";
    case "on:account.disconnected":
      return "onAccountDisconnected";
    case "before:conversation.created":
      return "beforeConversationCreated";
    case "on:conversation.created":
      return "onConversationCreated";
    case "before:message.received":
      return "beforeMessageReceived";
    case "on:message.received":
      return "onMessageReceived";
    case "on:conversation.cleared":
      return "onConversationCleared";
    case "on:conversation.deleted":
      return "onConversationDeleted";
    case "on:conversation.takeover":
      return "onConversationTakeover";
    case "on:conversation.resume":
      return "onConversationResume";
    case "on:human.requested":
      return "onHumanRequested";
    default:
      return null;
  }
}

import { inspect } from "node:util";
import {
  DEFAULT_ALLOWED_CLOCK_SKEW_MS,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
} from "../constants";
import { ERROR_CODES, createApiErrorBody } from "../contracts";
import { asKonsierError } from "../errors";
import { getHeaderValue, verifyKonsierSignature } from "../protocol/signatures";
import type { HttpRequestLike, HttpResponseLike, NextFunction } from "../types";
import type { ManifestResponse } from "../protocol/inbound";
import { asResolveAgentRequest, resolveAgentRequest } from "./resolve-agent";
import { asToolCallRequest, executeToolCallRequest } from "./tool-call";
import type { Account, EndSignal, EndUser, JsonObject, SendMessage } from "../types";
import type {
  EventDispatchRequest,
  EventDispatchResponse,
  InboundAccount,
  InboundUser,
  SlashCommandRequest,
} from "../protocol/inbound";

export interface HandlerDependencies {
  apiKey: string;
  allowedClockSkewMs?: number;
  rawBodyProperty?: string;
  debug?: boolean;
  handleToolCall: Parameters<typeof executeToolCallRequest>[1];
  handleResolveAgent: Parameters<typeof resolveAgentRequest>[1];
  handleSlashCommand: {
    resolveSlashCommand: (agent: string, command: string) => Promise<{
      command: string;
      description: string;
      handler: (context: {
        channel: "telegram";
        command: {
          name: string;
          args: string;
          text: string;
        };
        user: EndUser;
        conversation: {
          id: string;
          startedAt: string;
          messageCount: number;
        };
        messages: SlashCommandRequest["messages"];
        account: Account | null;
        end: (message?: SendMessage) => EndSignal;
      }) => Promise<SendMessage | EndSignal | void> | SendMessage | EndSignal | void;
    }>;
  };
  handleEventDispatch: {
    resolveEventHandler: (
      target:
        | { scope: "project" }
        | { scope: "agent"; agent: string }
        | { scope: "channel"; agent: string; channel: "telegram" },
      name: string,
      phase: "before" | "on",
    ) => Promise<{
      handler: (context: {
        name: string;
        phase: "before" | "on";
        payload: Record<string, unknown>;
        account: Account | null;
        end: (message?: SendMessage) => EndSignal;
      }) => Promise<JsonObject | EndSignal | void> | JsonObject | EndSignal | void;
    }>;
  };
  handleManifest: {
    listManifest: (account: Account | null) => Promise<ManifestResponse>;
  };
}

export function createHandler(dependencies: HandlerDependencies) {
  const rawBodyProperty = dependencies.rawBodyProperty ?? "rawBody";
  const allowedClockSkewMs =
    dependencies.allowedClockSkewMs ?? DEFAULT_ALLOWED_CLOCK_SKEW_MS;
  const debug = Boolean(dependencies.debug);

  return async function konsierHandler(
    req: HttpRequestLike,
    res: HttpResponseLike,
    next?: NextFunction,
  ): Promise<void> {
    try {
      if ((req.method ?? "POST").toUpperCase() !== "POST") {
        debugLog(debug, "method rejected", { method: req.method ?? "POST" });
        sendJson(
          res,
          405,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Method not allowed.",
          }),
        );
        return;
      }

      const signature = getHeaderValue(req.headers, HEADER_SIGNATURE);
      const timestamp = getHeaderValue(req.headers, HEADER_TIMESTAMP);

      if (!signature || !timestamp) {
        debugLog(debug, "missing signature headers");
        sendJson(
          res,
          401,
          createApiErrorBody({
            code: ERROR_CODES.auth.request.unauthorized,
            message: "Missing signature headers.",
          }),
        );
        return;
      }

      const rawBody = extractRawBody(req, rawBodyProperty);
      const verified = verifyKonsierSignature({
        apiKey: dependencies.apiKey,
        timestamp,
        payload: rawBody,
        providedSignature: signature,
        allowedClockSkewMs,
      });

      if (!verified.ok) {
        debugLog(debug, "signature verification failed", {
          reason: verified.reason,
        });
        sendJson(
          res,
          401,
          createApiErrorBody({
            code: ERROR_CODES.auth.request.unauthorized,
            message: verified.reason,
          }),
        );
        return;
      }

      const payload = parseBody(req.body, rawBody);
      if (!payload) {
        debugLog(debug, "invalid JSON body");
        sendJson(
          res,
          400,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Invalid JSON request body.",
          }),
        );
        return;
      }

      debugLog(debug, "request received", {
        type: payload.type,
      });

      const toolCall = asToolCallRequest(payload);
      if (toolCall) {
        const response = await executeToolCallRequest(
          toolCall,
          dependencies.handleToolCall,
        );
        debugLog(debug, "tool_call handled", {
          agent: toolCall.target.type === "agent" ? toolCall.target.agent : null,
          tool: toolCall.tool,
          output: response,
        });
        sendJson(res, 200, response);
        return;
      }
      if (payload.type === "tool_call") {
        debugLog(debug, "invalid tool_call payload");
        sendJson(
          res,
          400,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Invalid tool_call request.",
          }),
        );
        return;
      }

      const resolveAgent = asResolveAgentRequest(payload);
      if (resolveAgent) {
        const response = await resolveAgentRequest(
          resolveAgent,
          dependencies.handleResolveAgent,
        );
        debugLog(debug, "resolve_agent handled", {
          agent: resolveAgent.agent,
        });
        sendJson(res, 200, response);
        return;
      }
      if (payload.type === "resolve_agent") {
        debugLog(debug, "invalid resolve_agent payload");
        sendJson(
          res,
          400,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Invalid resolve_agent request.",
          }),
        );
        return;
      }

      const slashCommand = asSlashCommandRequest(payload);
      if (slashCommand) {
        const response = await executeSlashCommandRequest(
          slashCommand,
          dependencies.handleSlashCommand,
        );
        debugLog(debug, "slash_command handled", {
          command: slashCommand.command.name,
        });
        sendJson(res, 200, response);
        return;
      }
      if (payload.type === "slash_command") {
        debugLog(debug, "invalid slash_command payload");
        sendJson(
          res,
          400,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Invalid slash_command request.",
          }),
        );
        return;
      }

      const eventDispatch = asEventDispatchRequest(payload);
      if (eventDispatch) {
        const response = await executeEventDispatchRequest(
          eventDispatch,
          dependencies.handleEventDispatch,
        );
        debugLog(debug, "event_dispatch handled", {
          name: eventDispatch.event.name,
        });
        sendJson(res, 200, response);
        return;
      }
      if (payload.type === "event_dispatch") {
        debugLog(debug, "invalid event_dispatch payload");
        sendJson(
          res,
          400,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Invalid event_dispatch request.",
          }),
        );
        return;
      }

      const manifest = asManifestRequest(payload);
      if (manifest) {
        const response = await dependencies.handleManifest.listManifest(
          normalizeManifestAccount(manifest.account),
        );
        debugLog(debug, "manifest handled", {
          accountId: manifest.account?.id ?? null,
          agentCount: Object.keys(response.agents).length,
          pageCount: response.internal?.pages.length ?? 0,
          toolCount: response.internal?.tools.length ?? 0,
        });
        sendJson(res, 200, response);
        return;
      }
      if (payload.type === "manifest") {
        debugLog(debug, "invalid manifest payload");
        sendJson(
          res,
          400,
          createApiErrorBody({
            code: ERROR_CODES.validation.request.invalid,
            message: "Invalid manifest request.",
          }),
        );
        return;
      }

      debugLog(debug, "unknown request type", { type: payload.type });
      sendJson(
        res,
        400,
        createApiErrorBody({
          code: ERROR_CODES.validation.request.invalid,
          message: "Unknown request type.",
        }),
      );
    } catch (error) {
      debugLog(debug, "handler error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const parsed = asKonsierError(error);
      const errorBodyInput =
        typeof parsed.action === "undefined"
          ? {
              code: parsed.code,
              message: parsed.message,
            }
          : {
              code: parsed.code,
              message: parsed.message,
              action: parsed.action,
            };
      sendJson(
        res,
        parsed.statusCode,
        createApiErrorBody(errorBodyInput),
      );
      if (next) {
        next(parsed);
      }
    }
  };
}

function asSlashCommandRequest(payload: unknown): SlashCommandRequest | null {
  const obj = asObject(payload);
  if (!obj || obj.type !== "slash_command") {
    return null;
  }

  const conversation = parseConversation(obj.conversation);
  const account = parseInboundAccount(obj.account);
  const user = parseInboundUser(obj.user);
  const messages = parseMessages(obj.messages);
  const command = parseSlashCommand(obj.command);
  const agent = typeof obj.agent === "string" ? obj.agent.trim() : "";

  if (
    !conversation ||
    !messages ||
    !command ||
    !agent ||
    obj.channel !== "telegram"
  ) {
    return null;
  }

  if (obj.account !== null && obj.account !== undefined && account === null) {
    return null;
  }

  if (obj.user !== null && obj.user !== undefined && user === null) {
    return null;
  }

  return {
    type: "slash_command",
    conversation,
    messages,
    channel: "telegram",
    agent,
    command,
    account,
    user,
  };
}

function asEventDispatchRequest(payload: unknown): EventDispatchRequest | null {
  const obj = asObject(payload);
  if (!obj || obj.type !== "event_dispatch") {
    return null;
  }

  const event = parseEvent(obj.event);
  const target = parseEventTarget(obj.target);
  const account = parseInboundAccount(obj.account);
  if (!event || !target) {
    return null;
  }

  if (obj.account !== null && obj.account !== undefined && account === null) {
    return null;
  }

  return {
    type: "event_dispatch",
    target,
    event,
    account,
  };
}

async function executeSlashCommandRequest(
  request: SlashCommandRequest,
  dependencies: HandlerDependencies["handleSlashCommand"],
): Promise<Record<string, unknown>> {
  const slashCommand = await dependencies.resolveSlashCommand(
    request.agent,
    request.command.name,
  );
  const result = await slashCommand.handler({
    channel: "telegram",
    command: request.command,
    user: normalizeUser(request.user),
    conversation: {
      id: String(request.conversation.id),
      startedAt: request.conversation.started_at,
      messageCount: request.conversation.message_count,
    },
    messages: request.messages,
    account: normalizeAccount(request.account),
    end: (message) => createEndSignal(message),
  });

  if (!result) {
    return {};
  }

  const end = asEndSignal(result);
  const message = end?.message ?? result;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return {};
  }

  return {
    message: {
      ...((message as SendMessage).text ? { text: (message as SendMessage).text } : {}),
      ...((message as SendMessage).attachments?.length
        ? { attachments: (message as SendMessage).attachments }
        : {}),
      ...((message as SendMessage).quickReplies?.length
        ? { quickReplies: (message as SendMessage).quickReplies }
        : {}),
    },
  };
}

async function executeEventDispatchRequest(
  request: EventDispatchRequest,
  dependencies: HandlerDependencies["handleEventDispatch"],
): Promise<EventDispatchResponse> {
  const eventHandler = await dependencies.resolveEventHandler(
    request.target,
    request.event.name,
    request.event.phase,
  );
  const result =
    (await eventHandler.handler({
      name: request.event.name,
      phase: request.event.phase,
      payload: request.event.payload,
      account: normalizeAccount(request.account),
      end: (message) => createEndSignal(message),
    })) ?? {};

  const end = asEndSignal(result);
  if (end) {
    return {
      end: true,
      data: serializeEndMessage(end.message),
    };
  }

  return {
    data:
      result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : {},
  };
}

function debugLog(
  debug: boolean,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!debug || process.env.NODE_ENV !== "development") {
    return;
  }
  const payload = meta ? { message, ...meta } : { message };
  console.log("[konsier] handler", serializeForLog(payload));
}

function serializeForLog(value: unknown): string {
  return inspect(value, {
    depth: null,
    colors: false,
    compact: false,
    breakLength: 120,
  });
}

function asManifestRequest(payload: unknown): {
  type: "manifest";
  account: {
    id: string | number;
    name: string;
    metadata: Record<string, unknown>;
  } | null;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const obj = payload as Record<string, unknown>;
  if (obj.type !== "manifest") {
    return null;
  }

  const account = parseManifestAccount(obj.account);
  if (obj.account !== null && obj.account !== undefined && account === null) {
    return null;
  }

  return {
    type: "manifest",
    account,
  };
}

function normalizeAccount(account: InboundAccount | null): Account | null {
  if (!account) {
    return null;
  }

  return {
    id: account.id === null || typeof account.id === "undefined" ? null : String(account.id),
    name: account.name,
    metadata: account.metadata ?? {},
  };
}

function createEndSignal(message?: SendMessage): EndSignal {
  return {
    __konsierEnd: true,
    ...(message ? { message } : {}),
  };
}

function asEndSignal(value: unknown): EndSignal | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("__konsierEnd" in value) ||
    (value as { __konsierEnd?: unknown }).__konsierEnd !== true
  ) {
    return null;
  }

  return value as EndSignal;
}

function serializeEndMessage(message: SendMessage | undefined): Record<string, unknown> {
  if (!message) {
    return {};
  }

  const result: Record<string, unknown> = {};
  if (typeof message.text === "string" && message.text.trim().length > 0) {
    result.text = message.text;
  }
  if (Array.isArray(message.quickReplies) && message.quickReplies.length > 0) {
    result.quickReplies = message.quickReplies.map((reply) => ({
      label: reply.label,
      value: reply.value,
    }));
  }
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    result.attachments = message.attachments;
  }
  return result;
}

function normalizeUser(user: InboundUser | null): EndUser {
  if (!user) {
    return {
      id: "",
    };
  }

  return {
    id: String(user.id),
    ...(typeof user.external_id === "string"
      ? { externalId: user.external_id }
      : {}),
    ...(user.metadata ? { metadata: user.metadata } : {}),
    ...(typeof user.name === "string" ? { displayName: user.name } : {}),
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseEventTarget(
  value: unknown,
):
  | { scope: "project" }
  | { scope: "agent"; agent: string }
  | { scope: "channel"; agent: string; channel: "telegram" }
  | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }
  if (obj.scope === "project") {
    return { scope: "project" };
  }
  if (obj.scope === "agent" && typeof obj.agent === "string" && obj.agent.trim()) {
    return { scope: "agent", agent: obj.agent.trim() };
  }
  if (
    obj.scope === "channel" &&
    typeof obj.agent === "string" &&
    obj.agent.trim() &&
    obj.channel === "telegram"
  ) {
    return {
      scope: "channel",
      agent: obj.agent.trim(),
      channel: "telegram",
    };
  }
  return null;
}

function parseConversation(value: unknown): SlashCommandRequest["conversation"] | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const id = typeof obj.id === "number" ? obj.id : Number(obj.id);
  const projectId =
    typeof obj.project_id === "number"
      ? obj.project_id
      : Number(obj.project_id);
  const executionProjectId =
    typeof obj.execution_project_id === "number"
      ? obj.execution_project_id
      : Number(obj.execution_project_id);
  const startedAt =
    typeof obj.started_at === "string" ? obj.started_at.trim() : "";
  const messageCount =
    typeof obj.message_count === "number"
      ? obj.message_count
      : Number(obj.message_count);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(projectId) ||
    projectId <= 0 ||
    !Number.isInteger(executionProjectId) ||
    executionProjectId <= 0 ||
    !startedAt ||
    !Number.isInteger(messageCount) ||
    messageCount < 0
  ) {
    return null;
  }

  return {
    id,
    project_id: projectId,
    execution_project_id: executionProjectId,
    started_at: startedAt,
    message_count: messageCount,
  };
}

function parseMessages(value: unknown): SlashCommandRequest["messages"] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const messages = value.filter(
    (entry) => entry && typeof entry === "object" && !Array.isArray(entry),
  ) as SlashCommandRequest["messages"];

  return messages;
}

function parseSlashCommand(
  value: unknown,
): SlashCommandRequest["command"] | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const args = typeof obj.args === "string" ? obj.args : "";
  const text = typeof obj.text === "string" ? obj.text : "";
  if (!name) {
    return null;
  }

  return {
    name,
    args,
    text,
  };
}

function parseEvent(
  value: unknown,
): EventDispatchRequest["event"] | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const payload =
    obj.payload && typeof obj.payload === "object" && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : null;
  const phase = obj.phase === "before" || obj.phase === "on" ? obj.phase : null;
  if (!name || !payload || !phase) {
    return null;
  }

  return {
    name,
    phase,
    payload,
  };
}

function parseInboundAccount(value: unknown): InboundAccount | null {
  if (value === null || value === undefined) {
    return null;
  }

  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const id = obj.id;
  const name = obj.name;
  const metadata = obj.metadata;

  if (!(typeof id === "string" || typeof id === "number")) {
    return null;
  }

  if (typeof name !== "string") {
    return null;
  }

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return {
    id,
    name,
    metadata: metadata as Record<string, unknown>,
  };
}

function parseInboundUser(value: unknown): InboundUser | null {
  if (value === null || value === undefined) {
    return null;
  }

  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const id = obj.id;
  const externalId = obj.external_id;
  const name = obj.name;
  const metadata = obj.metadata;

  if (!(typeof id === "string" || typeof id === "number")) {
    return null;
  }

  if (!(externalId === null || typeof externalId === "string")) {
    return null;
  }

  if (!(name === null || typeof name === "string")) {
    return null;
  }

  if (
    !(
      metadata === null ||
      (typeof metadata === "object" && !Array.isArray(metadata))
    )
  ) {
    return null;
  }

  return {
    id,
    external_id: externalId,
    name,
    metadata: (metadata ?? null) as Record<string, unknown> | null,
  };
}

function parseManifestAccount(value: unknown): {
  id: string | number;
  name: string;
  metadata: Record<string, unknown>;
} | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  if (
    !(typeof obj.id === "string" || typeof obj.id === "number") ||
    typeof obj.name !== "string" ||
    !obj.metadata ||
    typeof obj.metadata !== "object" ||
    Array.isArray(obj.metadata)
  ) {
    return null;
  }

  return {
    id: obj.id,
    name: obj.name,
    metadata: obj.metadata as Record<string, unknown>,
  };
}

function normalizeManifestAccount(
  account: {
    id: string | number;
    name: string;
    metadata: Record<string, unknown>;
  } | null,
): Account | null {
  if (!account) {
    return null;
  }

  return {
    id: String(account.id),
    name: account.name,
    metadata: account.metadata,
  };
}

function extractRawBody(req: HttpRequestLike, rawBodyProperty: string): string {
  const raw =
    (req as unknown as Record<string, unknown>)[rawBodyProperty] ?? req.body;

  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }

  if (typeof raw === "string") {
    return raw;
  }

  if (raw && typeof raw === "object") {
    return JSON.stringify(raw);
  }

  return "";
}

function parseBody(
  body: unknown,
  rawBody: string,
): Record<string, unknown> | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (!rawBody) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function sendJson(
  res: HttpResponseLike,
  statusCode: number,
  body: unknown,
): void {
  if (typeof res.status === "function") {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }

  if (typeof res.json === "function") {
    res.json(body);
    return;
  }

  if (typeof res.setHeader === "function") {
    res.setHeader("content-type", "application/json");
  }

  const payload = JSON.stringify(body);
  if (typeof res.send === "function") {
    res.send(payload);
    return;
  }

  if (typeof res.end === "function") {
    res.end(payload);
  }
}

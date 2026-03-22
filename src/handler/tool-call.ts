import { KonsierError } from "../errors";
import type {
  InboundAccount,
  InboundUser,
  ToolCallRequest,
  ToolCallResponse,
} from "../protocol/inbound";
import type {
  Account,
  AttachInput,
  AgentConfig,
  Attachment,
  EndUser,
  InternalDefinition,
  JsonObject,
  ToolMessage,
  ToolContext,
} from "../types";

const CHANNELS = new Set<ToolCallRequest["channel"]>([
  "telegram",
  "slack",
  "discord",
  "whatsapp",
  "email",
  "sms",
  "konsier",
]);

export interface ToolCallDependencies {
  debug?: boolean;
  resolveAgentConfig: (
    agent: string,
    account: Account | null,
  ) => Promise<AgentConfig>;
  resolveInternalDefinition: (account: Account | null) => Promise<InternalDefinition>;
}

const TOOL_CONTROL_FIELD = "__konsier";

type SerializedAttachInput =
  | {
      type: "image" | "video" | "audio" | "file";
      url: string;
      name?: string;
      mimeType?: string;
      caption?: string;
    }
  | {
      type: "image" | "video" | "audio" | "file";
      bufferBase64: string;
      name?: string;
      mimeType?: string;
      caption?: string;
    }
  | {
      fileId: string;
    }
  | {
      type: "location";
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };

export function asToolCallRequest(payload: unknown): ToolCallRequest | null {
  const obj = asObject(payload);
  if (!obj || obj.type !== "tool_call") {
    return null;
  }

  const target = parseTarget(obj.target);
  const channel = parseChannel(obj.channel);
  const conversation = parseConversation(obj.conversation);
  const messages = parseMessages(obj.messages, obj.message);
  const tool = parseTool(obj.tool);
  const account = parseInboundAccount(obj.account);
  const user = parseInboundUser(obj.user);

  if (!target || !channel || !conversation || !messages || !tool) {
    return null;
  }

  if (obj.account !== null && obj.account !== undefined && account === null) {
    return null;
  }

  if (obj.user !== null && obj.user !== undefined && user === null) {
    return null;
  }

  return {
    type: "tool_call",
    conversation,
    messages,
    channel,
    target,
    tool,
    account,
    user,
  };
}

export async function executeToolCallRequest(
  request: ToolCallRequest,
  dependencies: ToolCallDependencies,
): Promise<ToolCallResponse> {
  const debug = Boolean(dependencies.debug);
  const account = normalizeAccount(request.account);
  const resolvedTool = await resolveTool(request, dependencies, account);
  const parsedInput = resolvedTool.parseInput(request.tool.input);
  const user = normalizeUser(request.user);
  const queuedAttachments: AttachInput[] = [];

  debugLog(debug, "tool execution started", {
    target: request.target,
    tool: request.tool.name,
    input: parsedInput,
    conversationId: request.conversation.id,
    channel: request.channel,
    account,
    user,
  });

  const context: ToolContext = {
    channel: request.channel,
    agent: request.target.type === "agent" ? request.target.agent : "internal",
    user,
    conversation: {
      id: String(request.conversation.id),
      startedAt: request.conversation.started_at,
      messageCount: request.conversation.message_count,
    },
    messages: request.messages,
    account,
    attach: (input) => {
      const items = Array.isArray(input) ? input : [input];
      queuedAttachments.push(...items);
    },
  };

  try {
    const result = await resolvedTool.handler(parsedInput, context);
    const output = buildToolCallResponse(result, queuedAttachments);
    debugLog(debug, "tool execution succeeded", {
      target: request.target,
      tool: request.tool.name,
      input: parsedInput,
      output,
      conversationId: request.conversation.id,
      channel: request.channel,
    });
    return output;
  } catch (error) {
    debugLog(debug, "tool execution failed", {
      target: request.target,
      tool: request.tool.name,
      input: parsedInput,
      conversationId: request.conversation.id,
      channel: request.channel,
      error: error instanceof Error ? error.message : "Unknown error",
      errorDetails: error,
    });
    throw error;
  }
}

async function resolveTool(
  request: ToolCallRequest,
  dependencies: ToolCallDependencies,
  account: Account | null,
) {
  if (request.target.type === "agent") {
    const agent = await dependencies.resolveAgentConfig(request.target.agent, account);
    const tool = agent.tools.find((entry) => entry.name === request.tool.name);
    if (!tool) {
      throw new KonsierError({
        code: "TOOL_NOT_FOUND",
        message: `Tool "${request.tool.name}" is not registered for agent "${request.target.agent}".`,
        statusCode: 404,
      });
    }
    return tool;
  }

  const internal = await dependencies.resolveInternalDefinition(account);
  const tool = (internal.tools ?? []).find((entry) => entry.name === request.tool.name);
  if (!tool) {
    throw new KonsierError({
      code: "TOOL_NOT_FOUND",
      message: `Internal tool "${request.tool.name}" is not registered.`,
      statusCode: 404,
    });
  }

  return tool;
}

function buildToolCallResponse(
  output: unknown,
  queuedAttachments: AttachInput[],
): JsonObject {
  const end = isEndSignal(output);
  if (!end && (!output || typeof output !== "object" || Array.isArray(output))) {
    throw new KonsierError({
      code: "INVALID_TOOL_OUTPUT",
      message: "Tool handlers must return a JSON object or Konsier.end().",
      statusCode: 500,
    });
  }

  const result = end ? {} : { ...(output as JsonObject) };
  if (queuedAttachments.length === 0 && !end) {
    return result;
  }

  return {
    ...result,
    [TOOL_CONTROL_FIELD]: {
      end,
      attachments: serializeAttachments(queuedAttachments),
    },
  };
}

function isEndSignal(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "__konsierEnd" in value &&
      (value as { __konsierEnd?: unknown }).__konsierEnd === true,
  );
}

function serializeAttachments(attachments: AttachInput[]): SerializedAttachInput[] {
  return attachments.map((attachment) => {
    if ("fileId" in attachment) {
      return { fileId: attachment.fileId };
    }

    if (attachment.type === "location") {
      return {
        type: "location",
        latitude: attachment.latitude,
        longitude: attachment.longitude,
        ...(attachment.name ? { name: attachment.name } : {}),
        ...(attachment.address ? { address: attachment.address } : {}),
      };
    }

    if ("buffer" in attachment) {
      return {
        type: attachment.type,
        bufferBase64: attachment.buffer.toString("base64"),
        ...(attachment.name ? { name: attachment.name } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.caption ? { caption: attachment.caption } : {}),
      };
    }

    return {
      type: attachment.type,
      url: attachment.url,
      ...(attachment.name ? { name: attachment.name } : {}),
      ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
      ...(attachment.caption ? { caption: attachment.caption } : {}),
    };
  });
}

function normalizeAccount(account: InboundAccount | null): Account | null {
  if (!account) {
    return null;
  }

  return {
    id: String(account.id),
    name: account.name,
    metadata: account.metadata ?? {},
  };
}

function normalizeUser(user: InboundUser | null): EndUser {
  if (!user) {
    return {
      id: "unknown",
    };
  }

  const normalized: EndUser = {
    id: String(user.id),
  };

  if (user.external_id !== null) {
    normalized.externalId = user.external_id;
  }
  if (user.metadata !== null) {
    normalized.metadata = user.metadata;
  }
  if (user.name !== null) {
    normalized.displayName = user.name;
  }

  return normalized;
}

function debugLog(
  debug: boolean,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (!debug || process.env.NODE_ENV !== "development") {
    return;
  }
  console.log("[konsier] tool_call", meta ? { message, ...meta } : { message });
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseTarget(value: unknown): ToolCallRequest["target"] | null {
  const obj = asObject(value);
  if (!obj || typeof obj.type !== "string") {
    return null;
  }

  if (obj.type === "internal") {
    return { type: "internal" };
  }

  if (obj.type === "agent" && typeof obj.agent === "string" && obj.agent.trim()) {
    return {
      type: "agent",
      agent: obj.agent.trim(),
    };
  }

  return null;
}

function parseChannel(value: unknown): ToolCallRequest["channel"] | null {
  if (typeof value !== "string" || !CHANNELS.has(value as ToolCallRequest["channel"])) {
    return null;
  }
  return value as ToolCallRequest["channel"];
}

function parseConversation(
  value: unknown,
): ToolCallRequest["conversation"] | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const id = obj.id;
  const projectId = obj.project_id;
  const executionProjectId = obj.execution_project_id;
  const startedAt = obj.started_at;
  const messageCount = obj.message_count;

  if (
    typeof id !== "number" ||
    typeof projectId !== "number" ||
    typeof executionProjectId !== "number" ||
    typeof startedAt !== "string" ||
    typeof messageCount !== "number"
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

function parseMessages(
  value: unknown,
  legacyValue: unknown,
): ToolCallRequest["messages"] | null {
  if (Array.isArray(value)) {
    const messages: ToolMessage[] = [];
    for (const item of value) {
      const parsed = parseMessage(item);
      if (!parsed) {
        return null;
      }
      messages.push(parsed);
    }
    return messages;
  }

  if (value !== undefined) {
    return null;
  }

  if (legacyValue === undefined || legacyValue === null) {
    return [];
  }

  const legacyMessage = parseMessage(legacyValue);
  return legacyMessage ? [legacyMessage] : null;
}

function parseMessage(value: unknown): ToolMessage | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const text = obj.text;
  const attachments = obj.attachments;
  const replyTo = obj.replyTo;
  const sentAt = obj.sentAt;

  if (!(typeof text === "undefined" || typeof text === "string")) {
    return null;
  }

  const normalized: ToolMessage = {
    sentAt:
      typeof sentAt === "string" && sentAt.trim()
        ? sentAt
        : new Date(0).toISOString(),
  };
  if (typeof text === "string") {
    normalized.text = text;
  }
  if (typeof attachments !== "undefined") {
    const parsedAttachments = parseAttachments(attachments);
    if (!parsedAttachments) {
      return null;
    }
    normalized.attachments = parsedAttachments;
  }
  if (typeof replyTo !== "undefined") {
    const parsedReplyTo = parseReplyContext(replyTo);
    if (!parsedReplyTo) {
      return null;
    }
    normalized.replyTo = parsedReplyTo;
  }

  return normalized;
}

function parseAttachments(value: unknown): Attachment[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const attachments: Attachment[] = [];
  for (const item of value) {
    const record = asObject(item);
    if (!record) {
      return null;
    }

    if (
      typeof record.id !== "string" ||
      !["image", "file", "video", "audio", "location"].includes(
        String(record.type),
      )
    ) {
      return null;
    }

    if (record.type === "location") {
      if (
        typeof record.latitude !== "number" ||
        typeof record.longitude !== "number"
      ) {
        return null;
      }
      attachments.push({
        id: record.id,
        type: "location",
        latitude: record.latitude,
        longitude: record.longitude,
        ...(typeof record.name === "string" ? { name: record.name } : {}),
        ...(typeof record.address === "string"
          ? { address: record.address }
          : {}),
      });
      continue;
    }

    if (typeof record.url !== "string") {
      return null;
    }

    attachments.push({
      id: record.id,
      url: record.url,
      type: record.type as Attachment["type"],
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      ...(typeof record.caption === "string" ? { caption: record.caption } : {}),
      ...(typeof record.mimeType === "string"
        ? { mimeType: record.mimeType }
        : {}),
      ...(typeof record.filename === "string"
        ? { filename: record.filename }
        : {}),
      ...(typeof record.originalName === "string"
        ? { originalName: record.originalName }
        : {}),
    });
  }

  return attachments;
}

function parseReplyContext(value: unknown): ToolMessage["replyTo"] | null {
  if (value === null) {
    return null;
  }

  const obj = asObject(value);
  if (!obj || typeof obj.messageId !== "string") {
    return null;
  }

  if (typeof obj.message === "undefined") {
    return { messageId: obj.messageId };
  }

  const message = parseQuotedMessage(obj.message);
  if (!message) {
    return null;
  }

  return {
    messageId: obj.messageId,
    message,
  };
}

function parseQuotedMessage(value: unknown): ToolMessage["replyTo"] extends {
  message?: infer T;
}
  ? T
  : never | null {
  const obj = asObject(value);
  if (!obj || typeof obj.messageId !== "string" || typeof obj.role !== "string") {
    return null;
  }

  if (!["user", "assistant", "system"].includes(obj.role)) {
    return null;
  }

  const attachments =
    typeof obj.attachments === "undefined"
      ? undefined
      : parseAttachments(obj.attachments);
  if (typeof obj.attachments !== "undefined" && !attachments) {
    return null;
  }

  if (typeof obj.replyTo === "undefined") {
    return {
      messageId: obj.messageId,
      role: obj.role as "user" | "assistant" | "system",
      ...(typeof obj.text === "string" ? { text: obj.text } : {}),
      ...(attachments ? { attachments } : {}),
    };
  }

  const replyTo = asObject(obj.replyTo);
  if (!replyTo || typeof replyTo.messageId !== "string") {
    return null;
  }

  return {
    messageId: obj.messageId,
    role: obj.role as "user" | "assistant" | "system",
    ...(typeof obj.text === "string" ? { text: obj.text } : {}),
    ...(attachments ? { attachments } : {}),
    replyTo: { messageId: replyTo.messageId },
  };
}

function parseTool(value: unknown): ToolCallRequest["tool"] | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  const name = obj.name;
  const input = obj.input;

  if (typeof name !== "string") {
    return null;
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  return {
    name,
    input: input as Record<string, unknown>,
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
    metadata: metadata as Record<string, unknown> | null,
  };
}

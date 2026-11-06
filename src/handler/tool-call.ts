import { inspect } from "node:util";
import { ERROR_CODES, createPublicApiError } from "../contracts";
import { KonsierError } from "../errors";
import type {
  InboundAccount,
  InboundUser,
  OperationInvokeRequest,
  OperationInvokeResponse,
} from "../protocol/inbound";
import type {
  Account,
  AttachInput,
  AgentConfig,
  Attachment,
  AttachmentType,
  EndUser,
  InternalDefinition,
  JsonObject,
  QuotedMessage,
  OperationMessage,
  OperationContext,
} from "../types";

const CHANNELS = new Set<OperationInvokeRequest["channel"]>([
  "telegram",
  "slack",
  "discord",
  "whatsapp",
  "email",
  "sms",
  "konsier",
]);

export interface OperationInvokeDependencies {
  debug?: boolean;
  resolveAgentConfig: (
    agent: string,
    account: Account | null,
  ) => Promise<AgentConfig>;
  resolveInternalDefinition: (
    account: Account | null,
  ) => Promise<InternalDefinition>;
}

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
      attachmentId: string;
    }
  | {
      type: "location";
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };

export function asOperationInvokeRequest(
  payload: unknown,
): OperationInvokeRequest | null {
  const obj = asObject(payload);
  if (!obj || obj.type !== "operation_invoke") {
    return null;
  }

  const target = parseTarget(obj.target);
  const channel = parseChannel(obj.channel);
  const conversation = parseConversation(obj.conversation);
  const messages = parseMessages(obj.messages);
  const operation = parseOperation(obj.operation);
  const input = asObject(obj.input);
  const idempotencyKey = parseIdentifier(obj.idempotency_key);
  const attemptId = parseIdentifier(obj.attempt_id);
  const account = parseInboundAccount(obj.account);
  const user = parseInboundUser(obj.user);

  if (
    !target ||
    !channel ||
    !conversation ||
    !messages ||
    !operation ||
    !input ||
    !idempotencyKey ||
    !attemptId
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
    type: "operation_invoke",
    conversation,
    messages,
    channel,
    target,
    operation,
    idempotency_key: idempotencyKey,
    attempt_id: attemptId,
    ...(typeof obj.bypass_approval_reason === "string" &&
    obj.bypass_approval_reason.trim()
      ? { bypass_approval_reason: obj.bypass_approval_reason.trim() }
      : {}),
    input,
    account,
    user,
  };
}

export async function executeOperationInvokeRequest(
  request: OperationInvokeRequest,
  dependencies: OperationInvokeDependencies,
): Promise<OperationInvokeResponse> {
  const debug = Boolean(dependencies.debug);
  const account = normalizeAccount(request.account);
  const resolvedOperation = await resolveOperation(
    request,
    dependencies,
    account,
  );
  const parsedInput = resolvedOperation.parseInput(request.input);
  const user = normalizeUser(request.user);
  const queuedAttachments: AttachInput[] = [];

  debugLog(debug, "operation execution started", {
    target: request.target,
    operation: request.operation,
    input: parsedInput,
    conversationId: request.conversation.id,
    channel: request.channel,
    account,
    user,
  });

  const context: OperationContext = {
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
    idempotencyKey: request.idempotency_key,
    attemptId: request.attempt_id,
    attach: (input) => {
      const items = Array.isArray(input) ? input : [input];
      queuedAttachments.push(...items);
    },
  };

  try {
    const result = await resolvedOperation.handler(parsedInput, context);
    const validatedOutput = resolvedOperation.parseOutput(result);
    const output = buildOperationInvokeResponse(
      validatedOutput,
      queuedAttachments,
    );
    debugLog(debug, "operation execution succeeded", {
      target: request.target,
      operation: request.operation,
      input: parsedInput,
      output,
      conversationId: request.conversation.id,
      channel: request.channel,
    });
    return output;
  } catch (error) {
    debugLog(debug, "operation execution failed", {
      target: request.target,
      operation: request.operation,
      input: parsedInput,
      conversationId: request.conversation.id,
      channel: request.channel,
      error: error instanceof Error ? error.message : "Unknown error",
      errorDetails: error,
    });
    throw error;
  }
}

async function resolveOperation(
  request: OperationInvokeRequest,
  dependencies: OperationInvokeDependencies,
  account: Account | null,
) {
  if (request.target.type === "agent") {
    const agent = await dependencies.resolveAgentConfig(
      request.target.agent,
      account,
    );
    const operation = agent.operations.find(
      (entry) =>
        entry.service === request.operation.service &&
        entry.resource === request.operation.resource &&
        entry.action === request.operation.action,
    );
    if (!operation) {
      throw new KonsierError({
        ...createPublicApiError({
          code: ERROR_CODES.operation.resource.not_found,
          message: `Operation "${operationRef(request)}" is not registered for agent "${request.target.agent}".`,
        }),
        statusCode: 404,
      });
    }
    return operation;
  }

  const internal = await dependencies.resolveInternalDefinition(account);
  const operation = (internal.operations ?? []).find(
    (entry) =>
      entry.service === request.operation.service &&
      entry.resource === request.operation.resource &&
      entry.action === request.operation.action,
  );
  if (!operation) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.operation.resource.not_found,
        message: `Internal operation "${operationRef(request)}" is not registered.`,
      }),
      statusCode: 404,
    });
  }

  return operation;
}

function buildOperationInvokeResponse(
  output: JsonObject,
  queuedAttachments: AttachInput[],
): OperationInvokeResponse {
  return {
    ok: true,
    output,
    ...(queuedAttachments.length > 0
      ? { attachments: serializeAttachments(queuedAttachments) }
      : {}),
  };
}

function operationRef(request: OperationInvokeRequest): string {
  return `${request.operation.service}.${request.operation.resource}.${request.operation.action}`;
}

function serializeAttachments(
  attachments: AttachInput[],
): SerializedAttachInput[] {
  return attachments.map((attachment) => {
    if ("attachmentId" in attachment) {
      return { attachmentId: attachment.attachmentId };
    }

    if ("latitude" in attachment) {
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
        type: attachment.type as Exclude<AttachmentType, "location">,
        bufferBase64: attachment.buffer.toString("base64"),
        ...(attachment.name ? { name: attachment.name } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.caption ? { caption: attachment.caption } : {}),
      };
    }

    return {
      type: attachment.type as Exclude<AttachmentType, "location">,
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
  const payload = meta ? { message, ...meta } : { message };
  console.log("[konsier] operation_invoke", serializeForLog(payload));
}

function serializeForLog(value: unknown): string {
  return inspect(value, {
    depth: null,
    colors: false,
    compact: false,
    breakLength: 120,
  });
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseTarget(value: unknown): OperationInvokeRequest["target"] | null {
  const obj = asObject(value);
  if (!obj || typeof obj.type !== "string") {
    return null;
  }

  if (obj.type === "internal") {
    return { type: "internal" };
  }

  if (
    obj.type === "agent" &&
    typeof obj.agent === "string" &&
    obj.agent.trim()
  ) {
    return {
      type: "agent",
      agent: obj.agent.trim(),
    };
  }

  return null;
}

function parseChannel(
  value: unknown,
): OperationInvokeRequest["channel"] | null {
  if (
    typeof value !== "string" ||
    !CHANNELS.has(value as OperationInvokeRequest["channel"])
  ) {
    return null;
  }
  return value as OperationInvokeRequest["channel"];
}

function parseConversation(
  value: unknown,
): OperationInvokeRequest["conversation"] | null {
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

function parseMessages(value: unknown): OperationInvokeRequest["messages"] | null {
  if (Array.isArray(value)) {
    const messages: OperationMessage[] = [];
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

  return [];
}

function parseMessage(value: unknown): OperationMessage | null {
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

  const normalized: OperationMessage = {
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
      type: record.type as Exclude<AttachmentType, "location">,
      ...(typeof record.name === "string" ? { name: record.name } : {}),
      ...(typeof record.caption === "string"
        ? { caption: record.caption }
        : {}),
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

function parseReplyContext(value: unknown): OperationMessage["replyTo"] | null {
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

function parseQuotedMessage(value: unknown): QuotedMessage | null {
  const obj = asObject(value);
  if (
    !obj ||
    typeof obj.messageId !== "string" ||
    typeof obj.role !== "string"
  ) {
    return null;
  }

  if (!["user", "assistant"].includes(obj.role)) {
    return null;
  }
  const role = obj.role as QuotedMessage["role"];

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
      role,
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
    role,
    ...(typeof obj.text === "string" ? { text: obj.text } : {}),
    ...(attachments ? { attachments } : {}),
    replyTo: { messageId: replyTo.messageId },
  };
}

function parseOperation(
  value: unknown,
): OperationInvokeRequest["operation"] | null {
  const obj = asObject(value);
  if (!obj) {
    return null;
  }

  if (
    typeof obj.service !== "string" ||
    typeof obj.resource !== "string" ||
    typeof obj.action !== "string" ||
    !obj.service.trim() ||
    !obj.resource.trim() ||
    !obj.action.trim()
  ) {
    return null;
  }

  return {
    service: obj.service.trim(),
    resource: obj.resource.trim(),
    action: obj.action.trim(),
  };
}

function parseIdentifier(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

  if (!(
    metadata === null ||
    (typeof metadata === "object" && !Array.isArray(metadata))
  )) {
    return null;
  }

  return {
    id,
    external_id: externalId,
    name,
    metadata: metadata as Record<string, unknown> | null,
  };
}

import { asKonsierError } from "../errors";
import type {
  InboundAccount,
  InboundUser,
  ToolCallRequest,
  ToolCallResponse,
} from "../protocol/inbound";
import type {
  Account,
  AgentConfig,
  EndUser,
  SendInput,
  ToolContext,
} from "../types";

export interface ToolCallDependencies {
  resolveAgentConfig: (
    agent: string,
    account: Account | null,
  ) => Promise<AgentConfig>;
  sendMessage: (input: SendInput) => Promise<void>;
}

export function asToolCallRequest(payload: unknown): ToolCallRequest | null {
  const obj = asObject(payload);
  if (!obj || obj.type !== "tool_call") {
    return null;
  }

  if (
    typeof obj.agent !== "string" ||
    obj.agent.trim().length === 0 ||
    typeof obj.channel !== "string"
  ) {
    return null;
  }

  const conversation = parseConversation(obj.conversation);
  const tool = parseTool(obj.tool);
  const account = parseInboundAccount(obj.account);
  const user = parseInboundUser(obj.user);

  if (!conversation || !tool) {
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
    channel: obj.channel as ToolCallRequest["channel"],
    agent: obj.agent,
    tool,
    account,
    user,
  };
}

export async function executeToolCallRequest(
  request: ToolCallRequest,
  dependencies: ToolCallDependencies,
): Promise<ToolCallResponse> {
  try {
    const account = normalizeAccount(request.account);
    const agent = await dependencies.resolveAgentConfig(request.agent, account);
    const tool = agent.tools.find((entry) => entry.name === request.tool.name);

    if (!tool) {
      return {
        ok: false,
        error: `Tool \"${request.tool.name}\" is not registered for agent \"${request.agent}\".`,
      };
    }

    const parsedInput = tool.parseInput(request.tool.input);

    const user = normalizeUser(request.user);
    const context: ToolContext = {
      channel: request.channel,
      agent: request.agent,
      user,
      conversation: {
        id: String(request.conversation.id),
        startedAt: new Date().toISOString(),
        messageCount: 0,
      },
      message: {},
      account,
      send: async (message) => {
        await dependencies.sendMessage({
          conversationId: request.conversation.id,
          userId: user.id,
          ...message,
        });
      },
    };

    const result = await tool.handler(parsedInput, context);

    return {
      ok: true,
      result: normalizeToolOutput(result),
    };
  } catch (error) {
    const konsierError = asKonsierError(error);
    return {
      ok: false,
      error: konsierError.message,
    };
  }
}

function normalizeToolOutput(
  output: unknown,
): Record<string, unknown> {
  if (!output) {
    return {};
  }

  if (typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }

  return { value: output };
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

  if (
    typeof id !== "number" ||
    typeof projectId !== "number" ||
    typeof executionProjectId !== "number"
  ) {
    return null;
  }

  return {
    id,
    project_id: projectId,
    execution_project_id: executionProjectId,
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

  if (!(metadata === null || (typeof metadata === "object" && !Array.isArray(metadata)))) {
    return null;
  }

  return {
    id,
    external_id: externalId,
    name,
    metadata: metadata as Record<string, unknown> | null,
  };
}

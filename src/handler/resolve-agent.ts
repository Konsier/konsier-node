import { ERROR_CODES, createPublicApiError } from "../contracts";
import { KonsierError } from "../errors";
import type {
  InboundAccount,
  ResolveAgentRequest,
  ResolveAgentResponse,
} from "../protocol/inbound";
import type { Account, AgentConfig } from "../types";

export interface ResolveAgentDependencies {
  resolveAgentConfig: (
    agent: string,
    account: Account | null,
  ) => Promise<AgentConfig>;
}

export function asResolveAgentRequest(
  payload: unknown,
): ResolveAgentRequest | null {
  const obj = asObject(payload);
  if (!obj || obj.type !== "resolve_agent") {
    return null;
  }

  if (typeof obj.agent !== "string" || obj.agent.trim().length === 0) {
    return null;
  }

  const account = parseInboundAccount(obj.account);
  if (obj.account !== null && obj.account !== undefined && account === null) {
    return null;
  }

  return {
    type: "resolve_agent",
    agent: obj.agent,
    account,
  };
}

export async function resolveAgentRequest(
  request: ResolveAgentRequest,
  dependencies: ResolveAgentDependencies,
): Promise<ResolveAgentResponse> {
  const resolved = await dependencies.resolveAgentConfig(
    request.agent,
    normalizeAccount(request.account),
  );

  if (!resolved.systemPrompt?.trim()) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.agent.configuration.invalid,
        message: `Agent "${request.agent}" has an empty systemPrompt.`,
      }),
      statusCode: 500,
    });
  }

  return {
    systemPrompt: resolved.systemPrompt,
    tools: resolved.tools.map((tool) => ({
      name: tool.key,
      description: tool.description,
      input: tool.inputSchema,
    })),
  };
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

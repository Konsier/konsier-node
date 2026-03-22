import type { Channel, ToolMessage } from "../types";

export interface InboundAccount {
  id: number | string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface InboundUser {
  id: number | string;
  external_id: string | null;
  name: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ToolCallRequest {
  type: "tool_call";
  conversation: {
    id: number;
    project_id: number;
    execution_project_id: number;
    started_at: string;
    message_count: number;
  };
  messages: ToolMessage[];
  channel: Channel;
  target:
    | {
        type: "agent";
        agent: string;
      }
    | {
        type: "internal";
      };
  tool: {
    name: string;
    input: Record<string, unknown>;
  };
  account: InboundAccount | null;
  user: InboundUser | null;
}

export interface ResolveAgentRequest {
  type: "resolve_agent";
  agent: string;
  account: InboundAccount | null;
}

export interface ManifestRequest {
  type: "manifest";
  account: InboundAccount | null;
}

export type SdkHandlerRequest =
  | ToolCallRequest
  | ResolveAgentRequest
  | ManifestRequest;

export type ToolCallResponse = Record<string, unknown>;

export interface ResolveAgentResponse {
  systemPrompt: string;
  tools: Array<{
    name: string;
    description: string;
    input: Record<string, unknown>;
  }>;
}

export interface ManifestResponse {
  agents: Array<{
    ref: string;
    name: string;
    description: string | null;
  }>;
  internal: {
    tools: Array<{
      name: string;
      description: string;
      input: Record<string, unknown>;
    }>;
    pages: Array<{
      name: string;
      path: string;
    }>;
  };
}

import type { Channel, OperationMessage } from "../types";

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

export interface OperationInvokeRequest {
  type: "operation_invoke";
  conversation: {
    id: number;
    project_id: number;
    execution_project_id: number;
    started_at: string;
    message_count: number;
  };
  messages: OperationMessage[];
  channel: Channel;
  target:
    | {
        type: "agent";
        agent: string;
      }
    | {
        type: "internal";
      };
  operation: {
    service: string;
    resource: string;
    action: string;
  };
  idempotency_key: string;
  attempt_id: string;
  bypass_approval_reason?: string;
  input: Record<string, unknown>;
  account: InboundAccount | null;
  user: InboundUser | null;
}

export interface ResolveAgentRequest {
  type: "resolve_agent";
  agent: string;
  account: InboundAccount | null;
}

export interface SlashCommandRequest {
  type: "slash_command";
  agent: string;
  conversation: {
    id: number;
    project_id: number;
    execution_project_id: number;
    started_at: string;
    message_count: number;
  };
  messages: OperationMessage[];
  channel: "telegram";
  command: {
    name: string;
    args: string;
    text: string;
  };
  account: InboundAccount | null;
  user: InboundUser | null;
}

export interface EventDispatchRequest {
  type: "event_dispatch";
  target:
    | { scope: "project" }
    | { scope: "agent"; agent: string }
    | { scope: "channel"; agent: string; channel: "telegram" };
  event: {
    name: string;
    phase: "before" | "on";
    payload: Record<string, unknown>;
  };
  account: InboundAccount | null;
}

export interface ManifestRequest {
  type: "manifest";
  account: InboundAccount | null;
}

export type SdkHandlerRequest =
  | OperationInvokeRequest
  | ResolveAgentRequest
  | SlashCommandRequest
  | EventDispatchRequest
  | ManifestRequest;

export interface OperationInvokeResponse {
  ok: true;
  output: Record<string, unknown>;
  attachments?: Array<Record<string, unknown>>;
}

export interface ResolveAgentResponse {
  systemPrompt: string;
  operations: Array<{
    service: string;
    resource: string;
    action: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    approval: { required: boolean; bypassable: boolean };
  }>;
}

export interface SlashCommandResponse {
  message?: {
    text?: string;
    attachments?: OperationMessage["attachments"];
    quickReplies?: Array<{
      label: string;
      value: string;
    }>;
  };
}

export interface EventDispatchResponse {
  data?: Record<string, unknown>;
}

export interface ManifestResponse {
  project?: {
    events: string[];
  };
  agents: Record<
    string,
    {
      name: string;
      description: string | null;
      systemPrompt: string;
      operations: Array<{
        service: string;
        resource: string;
        action: string;
        title: string;
        description: string;
        inputSchema: Record<string, unknown>;
        outputSchema: Record<string, unknown>;
        approval: { required: boolean; bypassable: boolean };
      }>;
      events?: string[];
      telegram?: {
        slashCommands: Array<{
          command: string;
          description: string;
        }>;
        events?: string[];
      };
    }
  >;
  internal?: {
    operations: Array<{
      service: string;
      resource: string;
      action: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      outputSchema: Record<string, unknown>;
      approval: { required: boolean; bypassable: boolean };
    }>;
    pages: Array<{
      name: string;
      path: string;
    }>;
  };
}

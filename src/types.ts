import type { Tool } from "./tool";

export type MaybePromise<T> = T | Promise<T>;

export type Channel =
  | "telegram"
  | "slack"
  | "discord"
  | "whatsapp"
  | "email"
  | "sms"
  | "konsier";

export interface Attachment {
  url: string;
  type: "image" | "file" | "video" | "audio";
  name?: string;
  mimeType?: string;
}

export interface SendMessage {
  text?: string;
  html?: string;
  attachments?: Attachment[];
}

export interface SendInput extends SendMessage {
  userId?: string;
  conversationId?: string | number;
}

export interface LinkUserInput {
  userId: string;
  externalId: string;
  metadata?: Record<string, unknown>;
}

export interface Account {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface EndUser {
  id: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  firstName?: string;
  lastName?: string;
  username?: string;
  displayName?: string;
  phoneNumber?: string;
  email?: string;
  languageCode?: string;
  teamId?: string;
  guildId?: string;
}

export interface Conversation {
  id: string;
  startedAt: string;
  messageCount: number;
}

export interface ToolMessage {
  text?: string;
  html?: string;
  attachments?: Attachment[];
}

export interface ToolContext {
  channel: Channel;
  agent: string;
  user: EndUser;
  conversation: Conversation;
  message: ToolMessage;
  account: Account | null;
  send: (message: SendMessage) => Promise<void>;
}

export interface AgentContext {
  account: Account | null;
}

export interface AgentEvents {
  onConversationStart?: (...args: unknown[]) => unknown;
  onConversationEnd?: (...args: unknown[]) => unknown;
}

export interface AgentConfig {
  name?: string;
  description?: string | null;
  systemPrompt: string;
  tools: Array<Tool<any, Record<string, unknown>>>;
  events?: AgentEvents;
}

export interface AgentManifestEntry {
  ref: string;
  name: string;
  description: string | null;
}

export type AgentResolver = (ctx: AgentContext) => MaybePromise<AgentConfig>;
export type AgentEntry = AgentConfig | AgentResolver;

export interface PageDefinition {
  name: string;
  path: string;
}

export interface InternalDefinition {
  tools?: Array<Tool<any, Record<string, unknown>>>;
  pages?: PageDefinition[];
}

export type InternalContext = ManifestContext;
export type InternalResolver = (
  ctx: InternalContext,
) => MaybePromise<InternalDefinition>;
export type InternalEntry = InternalDefinition | InternalResolver;

export interface KonsierOptions {
  apiKey: string;
  agents: Record<string, AgentEntry>;
  internal?: InternalEntry;
  maxRetries?: number;
  allowedClockSkewMs?: number;
  fetchImpl?: typeof fetch;
}

export interface HandlerOptions {
  rawBodyProperty?: string;
}

export interface ManifestContext {
  account: Account | null;
}

export interface HeadersLike {
  [key: string]: string | string[] | undefined;
}

export interface HttpRequestLike {
  method?: string;
  headers: HeadersLike;
  body?: unknown;
  [key: string]: unknown;
}

export interface HttpResponseLike {
  status?: (statusCode: number) => HttpResponseLike;
  json?: (body: unknown) => unknown;
  send?: (body: unknown) => unknown;
  end?: (body?: unknown) => unknown;
  setHeader?: (name: string, value: string) => unknown;
  statusCode?: number;
}

export type NextFunction = (error?: unknown) => void;

export interface PageAuthContext {
  pagePath: string;
  projectId: string | null;
  account: Account | null;
  user: {
    id?: string;
    email?: string;
    name?: string;
  };
}

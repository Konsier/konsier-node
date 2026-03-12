import type { Tool } from "./tool";

export type MaybePromise<T> = T | Promise<T>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

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

export interface UserLinkInput {
  userId: string;
  externalId: string;
  metadata?: Record<string, unknown>;
}

export interface UserGetInput {
  userId: string;
}

export interface AccountLinkInput {
  accountId: string;
  externalId: string;
  metadata?: Record<string, unknown>;
}

export interface AccountGetInput {
  accountId: string;
}

export interface ConnectionStartInput {
  redirect: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectionStartResult {
  url: string;
  expiresAt: string;
}

export interface SdkUser {
  id: string;
  externalId: string | null;
  metadata: Record<string, unknown>;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
}

export interface SdkAccount {
  id: string;
  name: string;
  logoUrl: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
  connectedAt: string;
  linkedAgents: Array<{
    ref: string;
    agentId: string;
    agentName: string;
  }>;
  internal: {
    pages: string[];
    tools: string[];
  };
}

export interface ConnectionCompleteInput {
  token: string;
}

export interface ConnectionCompleteResult {
  account: SdkAccount;
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

export interface PageUser {
  id?: string;
  email?: string;
  name?: string;
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
  tools: Array<Tool<any, JsonObject>>;
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
  tools?: Array<Tool<any, JsonObject>>;
  pages?: PageDefinition[];
}

export type InternalContext = ManifestContext;
export type InternalResolver = (
  ctx: InternalContext,
) => MaybePromise<InternalDefinition>;
export type InternalEntry = InternalDefinition | InternalResolver;

export interface KonsierOptions {
  apiKey: string;
  agents?: Record<string, AgentEntry>;
  internal?: InternalEntry;
  endpointUrl?: string;
  debug?: boolean;
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
export type PageTheme = "light" | "dark";

export interface PageAuthContext {
  pagePath: string;
  projectId: string | null;
  account: Account | null;
  theme: PageTheme;
  user: PageUser;
}

export interface PageAuthRequestInput {
  url: string;
  headers: HeadersLike;
}

export type PageAuthResult =
  | {
      type: "authorized";
      context: PageAuthContext;
    }
  | {
      type: "response";
      status: number;
      headers: Record<string, string>;
      body?: string;
    };

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare module "node:http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare global {
  namespace Express {
    interface Request {
      konsier?: PageAuthContext;
    }
  }
}

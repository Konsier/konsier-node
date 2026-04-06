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

export type AttachmentType = "image" | "video" | "audio" | "file" | "location";

export interface ImageAttachment {
  id: string;
  type: "image";
  name?: string;
  caption?: string;
  mimeType?: string;
  url: string;
  filename?: string;
  originalName?: string;
}

export interface VideoAttachment {
  id: string;
  type: "video";
  name?: string;
  caption?: string;
  mimeType?: string;
  url: string;
  filename?: string;
  originalName?: string;
}

export interface AudioAttachment {
  id: string;
  type: "audio";
  name?: string;
  caption?: string;
  mimeType?: string;
  url: string;
  filename?: string;
  originalName?: string;
}

export interface FileAttachment {
  id: string;
  type: "file";
  name?: string;
  caption?: string;
  mimeType?: string;
  url: string;
  filename?: string;
  originalName?: string;
}

export interface LocationAttachment {
  id: string;
  type: "location";
  name?: string;
  caption?: string;
  mimeType?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export type Attachment =
  | ImageAttachment
  | VideoAttachment
  | AudioAttachment
  | FileAttachment
  | LocationAttachment;

export interface QuickReply {
  label: string;
  value: string;
}

export interface ReplyPointer {
  messageId: string;
}

export interface QuotedMessage {
  messageId: string;
  role: "user" | "assistant";
  text?: string;
  attachments?: Attachment[];
  replyTo?: ReplyPointer | null;
}

export interface ReplyContext extends ReplyPointer {
  message?: QuotedMessage;
}

export interface ToolMessage {
  text?: string;
  attachments?: Attachment[];
  replyTo?: ReplyContext | null;
  sentAt: string;
}

export interface MessageEnvelope {
  text?: string;
  attachments?: Attachment[];
  quickReplies?: QuickReply[];
  replyTo?: ReplyContext | null;
  editedAt?: string | null;
}

export interface AttachmentInputBase {
  type: AttachmentType;
  name?: string;
  mimeType?: string;
  caption?: string;
}

export interface UrlAttachmentInput extends AttachmentInputBase {
  url: string;
  buffer?: never;
  attachmentId?: never;
}

export interface BufferAttachmentInput extends AttachmentInputBase {
  buffer: Buffer;
  url?: never;
  attachmentId?: never;
}

export interface AttachmentIdAttachmentInput {
  attachmentId: string;
  type?: never;
  name?: never;
  mimeType?: never;
  caption?: never;
  url?: never;
  buffer?: never;
}

export interface LocationAttachmentInput extends AttachmentInputBase {
  type: "location";
  latitude: number;
  longitude: number;
  address?: string;
  url?: never;
  buffer?: never;
  attachmentId?: never;
}

export type AttachInput =
  | UrlAttachmentInput
  | BufferAttachmentInput
  | AttachmentIdAttachmentInput
  | LocationAttachmentInput;

export interface SendMessage {
  text?: string;
  attachments?: AttachInput[];
  quickReplies?: QuickReply[];
}

export interface EndSignal {
  readonly __konsierEnd: true;
  readonly message?: SendMessage;
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
  id: string | null;
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

export type ConversationMode = "automated" | "manual";

export type NotificationNavigation =
  | {
      type: "conversation";
      projectId: number;
      conversationId: number;
    }
  | {
      type: "page";
      projectId: number;
      path: string;
    }
  | {
      type: "none";
    };

export interface NotificationInput {
  kind?: string;
  title: string;
  body: string;
  navigation: NotificationNavigation;
}

export type TelegramSlashCommandResult = SendMessage | EndSignal;

export interface TelegramSlashCommandContext {
  channel: "telegram";
  command: {
    name: string;
    args: string;
    text: string;
  };
  user: EndUser;
  conversation: Conversation;
  messages: ToolMessage[];
  account: Account | null;
  end: (message?: SendMessage) => EndSignal;
}

export interface TelegramSlashCommandDefinition {
  command: string;
  description: string;
  handler: (
    context: TelegramSlashCommandContext,
  ) => MaybePromise<TelegramSlashCommandResult | void>;
}

export interface ConversationCreatedEventPayload {
  project_id: number;
  conversation_id: number;
  group: string;
  title: string | null;
  timestamp: string;
}

export interface ConversationMessageReceivedEventPayload {
  project_id: number;
  conversation_id: number;
  group: string;
  mode: ConversationMode;
  channel: string;
  transcript: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  latest_message: {
    role: "user" | "assistant" | null;
    content: string | null;
  };
  execution_mode: "simulate" | "live";
  agent_channel_id: number | null;
  platform_conversation_id: string | null;
  channel_user_id: string | null;
  timestamp: string;
}

export interface ConversationClearedEventPayload {
  project_id: number;
  conversation_id: number;
  group: string;
  deleted_count: number;
  timestamp: string;
}

export interface ConversationDeletedEventPayload {
  project_id: number;
  conversation_id: number;
  group: string;
  timestamp: string;
}

export interface ConversationTakeoverEventPayload {
  project_id: number;
  conversation_id: number;
  group: string;
  timestamp: string;
}

export interface ConversationResumeEventPayload {
  project_id: number;
  conversation_id: number;
  group: string;
  timestamp: string;
}

export interface HumanSupportRequestedEventPayload {
  project_id: number;
  conversation_id: number;
  timestamp: string;
}

export interface ConnectedAppConnectEventPayload {
  project_id: number;
  token: string;
  agent_mappings: Array<{
    platform_ref: string;
    client_agent_id?: number | null;
    create_new_name?: string | null;
  }>;
  user_id: string;
}

export interface ConnectedAppConnectedEventPayload {
  project_id: number;
  timestamp: string;
}

export interface ConnectedAppDisconnectedEventPayload {
  project_id: number;
  connection_id: number;
  timestamp: string;
}

export interface AgentResourceEventPayload {
  project_id: number;
  timestamp: string;
  agent_id?: number;
  name?: string | null;
  linked_ref?: string | null;
  linked_connection_id?: number | null;
  refresh_id?: string;
}

export interface BeforeAccountConnectContext {
  account: Account | null;
  payload: ConnectedAppConnectEventPayload;
  end: (message?: SendMessage) => EndSignal;
}

export interface AccountConnectedContext {
  account: Account | null;
  payload: ConnectedAppConnectedEventPayload;
}

export interface AccountDisconnectedContext {
  account: Account | null;
  payload: ConnectedAppDisconnectedEventPayload;
}

export interface BeforeConversationCreatedContext {
  account: Account | null;
  payload: ConversationCreatedEventPayload;
  end: (message?: SendMessage) => EndSignal;
}

export interface ConversationCreatedContext {
  account: Account | null;
  payload: ConversationCreatedEventPayload;
}

export interface BeforeMessageReceivedContext {
  account: Account | null;
  payload: ConversationMessageReceivedEventPayload;
  end: (message?: SendMessage) => EndSignal;
}

export interface MessageReceivedContext {
  account: Account | null;
  payload: ConversationMessageReceivedEventPayload;
}

export interface ConversationClearedContext {
  account: Account | null;
  payload: ConversationClearedEventPayload;
}

export interface ConversationDeletedContext {
  account: Account | null;
  payload: ConversationDeletedEventPayload;
}

export interface ConversationTakeoverContext {
  account: Account | null;
  payload: ConversationTakeoverEventPayload;
}

export interface ConversationResumeContext {
  account: Account | null;
  payload: ConversationResumeEventPayload;
}

export interface HumanRequestedContext {
  account: Account | null;
  payload: HumanSupportRequestedEventPayload;
}

export type ProjectEventHandlers = {
  beforeAccountConnect?: (
    ctx: BeforeAccountConnectContext,
  ) => MaybePromise<void | EndSignal>;
  onAccountConnected?: (ctx: AccountConnectedContext) => MaybePromise<void>;
  onAccountDisconnected?: (
    ctx: AccountDisconnectedContext,
  ) => MaybePromise<void>;
};

export type AgentEventHandlers = {
  beforeConversationCreated?: (
    ctx: BeforeConversationCreatedContext,
  ) => MaybePromise<void | EndSignal>;
  onConversationCreated?: (
    ctx: ConversationCreatedContext,
  ) => MaybePromise<void>;
  beforeMessageReceived?: (
    ctx: BeforeMessageReceivedContext,
  ) => MaybePromise<void | EndSignal>;
  onMessageReceived?: (ctx: MessageReceivedContext) => MaybePromise<void>;
  onConversationCleared?: (
    ctx: ConversationClearedContext,
  ) => MaybePromise<void>;
  onConversationDeleted?: (
    ctx: ConversationDeletedContext,
  ) => MaybePromise<void>;
  onConversationTakeover?: (
    ctx: ConversationTakeoverContext,
  ) => MaybePromise<void>;
  onConversationResume?: (
    ctx: ConversationResumeContext,
  ) => MaybePromise<void>;
  onHumanRequested?: (ctx: HumanRequestedContext) => MaybePromise<void>;
};

export type TelegramEventHandlers = {};

export interface AgentTelegramConfig {
  slashCommands?: TelegramSlashCommandDefinition[];
  events?: TelegramEventHandlers;
}

export interface ConversationSummary {
  id: number;
  project_id: number;
  group: string;
  agent_channel_id: number | null;
  platform_conversation_id: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  mode: ConversationMode;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationEntryRecord {
  entry_type: "message" | "tool_call";
  index: number;
  role?: string;
  message?: MessageEnvelope | null;
  content?: string;
}

export interface ConversationListInput {
  userId?: string | number;
  agentRef?: string;
  channel?: string;
  limit?: number;
  cursor?: string;
}

export interface ConversationMessagesListInput {
  before?: number;
  limit?: number;
}

export interface ConversationListResult {
  conversations: ConversationSummary[];
}

export interface ConversationDetailResult {
  conversation: ConversationSummary;
  entries: ConversationEntryRecord[];
}

export interface ConversationMessagesListResult {
  conversation: ConversationSummary;
  messages: ConversationEntryRecord[];
}

export interface ConversationHandle {
  get: () => Promise<ConversationDetailResult>;
  messages: {
    list: (input?: ConversationMessagesListInput) => Promise<ConversationMessagesListResult>;
  };
  sendMessage: (input: SendMessage) => Promise<Record<string, unknown>>;
  clear: () => Promise<Record<string, unknown>>;
  delete: () => Promise<Record<string, unknown>>;
  takeover: () => Promise<Record<string, unknown>>;
  resume: () => Promise<Record<string, unknown>>;
}

export interface ToolContext {
  channel: Channel;
  agent: string;
  user: EndUser;
  conversation: Conversation;
  messages: ToolMessage[];
  account: Account | null;
  attach: (input: AttachInput | AttachInput[]) => void;
  end: (message?: SendMessage) => EndSignal;
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
  telegram?: AgentTelegramConfig;
  events?: AgentEventHandlers;
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
  events?: ProjectEventHandlers;
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

export interface PageContext {
  pagePath: string;
  projectId: string | null;
  account: Account | null;
  theme: PageTheme;
  user: PageUser;
}

export interface PageRequestInput {
  url: string;
  headers: HeadersLike;
}

export type PageRequestResult =
  | {
      type: "authorized";
      context: PageContext;
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
      konsier?: PageContext;
    }
  }
}

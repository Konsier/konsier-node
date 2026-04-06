import type { CloudApiClient } from "./http";
import { serializeAttachments } from "./send";
import type {
  ConversationDetailResult,
  ConversationListInput,
  ConversationListResult,
  ConversationMessagesListInput,
  ConversationMessagesListResult,
  SendMessage,
} from "../types";

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => typeof entry !== "undefined"),
  ) as T;
}

export async function listConversations(
  client: CloudApiClient,
  input: ConversationListInput,
): Promise<ConversationListResult> {
  return client.post("/sdk/conversations/list", stripUndefined({
    userId: input.userId,
    agentRef: input.agentRef,
    channel: input.channel,
    limit: input.limit,
    cursor: input.cursor,
  })) as unknown as Promise<ConversationListResult>;
}

export async function getConversation(
  client: CloudApiClient,
  conversationId: string | number,
): Promise<ConversationDetailResult> {
  return client.post(
    `/sdk/conversations/${conversationId}/get`,
    {},
  ) as unknown as Promise<ConversationDetailResult>;
}

export async function listConversationMessages(
  client: CloudApiClient,
  conversationId: string | number,
  input: ConversationMessagesListInput,
): Promise<ConversationMessagesListResult> {
  return client.post(
    `/sdk/conversations/${conversationId}/messages/list`,
    stripUndefined({
      before: input.before,
      limit: input.limit,
    }),
  ) as unknown as Promise<ConversationMessagesListResult>;
}

export async function sendConversationMessage(
  client: CloudApiClient,
  conversationId: string | number,
  input: SendMessage,
): Promise<Record<string, unknown>> {
  return client.post(
    `/sdk/conversations/${conversationId}/send`,
    stripUndefined({
      text: input.text,
      attachments: serializeAttachments(input.attachments),
      quickReplies: input.quickReplies,
    }),
  );
}

export async function clearConversation(
  client: CloudApiClient,
  conversationId: string | number,
): Promise<Record<string, unknown>> {
  return client.post(`/sdk/conversations/${conversationId}/clear`, {});
}

export async function deleteConversation(
  client: CloudApiClient,
  conversationId: string | number,
): Promise<Record<string, unknown>> {
  return client.delete(`/sdk/conversations/${conversationId}`);
}

export async function takeOverConversation(
  client: CloudApiClient,
  conversationId: string | number,
): Promise<Record<string, unknown>> {
  return client.post(`/sdk/conversations/${conversationId}/takeover`, {});
}

export async function resumeConversation(
  client: CloudApiClient,
  conversationId: string | number,
): Promise<Record<string, unknown>> {
  return client.post(`/sdk/conversations/${conversationId}/resume`, {});
}

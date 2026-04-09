# Conversations

The conversations API lets your backend inspect live chat threads, send messages into them, and control automation state.

## Listing Conversations

```ts
const conversations = await konsier.conversations.list({
  userId: "user_123",
  agentRef: "customer_support",
  channel: "telegram",
  limit: 20,
  cursor: "opaque_cursor",
});
```

Supported filters:

- `userId`
- `agentRef`
- `channel`
- `limit`
- `cursor`

`konsier.conversations.list(...)` returns `ConversationHandle[]`.

## Conversation Handle

```ts
type ConversationHandle = {
  get: () => Promise<ConversationDetailResult>;
  messages: {
    list: (input?: { before?: number; limit?: number }) =>
      Promise<ConversationMessagesListResult>;
  };
  sendMessage: (input: SendMessage) => Promise<Record<string, unknown>>;
  clear: () => Promise<Record<string, unknown>>;
  delete: () => Promise<Record<string, unknown>>;
  takeover: () => Promise<Record<string, unknown>>;
  resume: () => Promise<Record<string, unknown>>;
};
```

## Inspecting A Conversation

```ts
const [conversation] = await konsier.conversations.list({ limit: 1 });

if (conversation) {
  const detail = await conversation.get();

  detail.conversation.id;
  detail.conversation.mode;
  detail.conversation.title;
  detail.entries;
}
```

Key returned shapes:

```ts
type ConversationSummary = {
  id: number;
  project_id: number;
  group: string;
  agent_channel_id: number | null;
  platform_conversation_id: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  mode: "automated" | "manual";
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ConversationEntryRecord = {
  entry_type: "message" | "tool_call";
  index: number;
  role?: string;
  message?: MessageEnvelope | null;
  content?: string;
};

type ConversationDetailResult = {
  conversation: ConversationSummary;
  entries: ConversationEntryRecord[];
};

type ConversationMessagesListResult = {
  conversation: ConversationSummary;
  messages: ConversationEntryRecord[];
};
```

## Paginating Messages

```ts
const page1 = await conversation.messages.list({
  limit: 50,
});

const oldestIndex = page1.messages.at(-1)?.index;

const page2 = oldestIndex
  ? await conversation.messages.list({
      before: oldestIndex,
      limit: 50,
    })
  : null;
```

Use `before` to fetch older entries than the current page.

## Sending Messages

`conversation.sendMessage(...)` accepts the same `SendMessage` payload used by `ctx.end(...)`.

```ts
await conversation.sendMessage({
  text: "A human agent is joining the conversation.",
  quickReplies: [
    { label: "Track order", value: "track order" },
  ],
});
```

For the full message payload and attachment input surface, see [Messages](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/messages.md) and [Attachments](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/attachments.md).

## Conversation Control

```ts
await conversation.takeover();
await conversation.resume();
await conversation.clear();
await conversation.delete();
```

Behavior:

- `takeover()` switches the conversation into manual mode
- `resume()` switches it back to automated mode
- `clear()` removes current history but keeps the conversation record
- `delete()` removes the conversation record

## Typical Admin Flow

```ts
const [conversation] = await konsier.conversations.list({
  userId: "user_123",
  limit: 1,
});

if (conversation) {
  await conversation.takeover();
  await conversation.sendMessage({
    text: "A support rep is reviewing your request now.",
  });
}
```

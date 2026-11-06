# Messages

Konsier message payloads are used by `conversation.sendMessage(...)`. Agent turns
finish with the agent's normal final text; operation handlers return structured data.

## SendMessage

```ts
type SendMessage = {
  text?: string;
  attachments?: AttachInput[];
  quickReplies?: Array<{
    label: string;
    value: string;
  }>;
};
```

## Sending Messages Into Conversations

```ts
await conversation.sendMessage({
  text: "Your order is packed.",
  quickReplies: [{ label: "Track order", value: "track order" }],
});
```

For attachment inputs and attachment-aware operation schemas, see [Attachments](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/attachments.md).

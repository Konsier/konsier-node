# Messages

Konsier message payloads are used by:

- `ctx.end(...)`
- `conversation.sendMessage(...)`

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

## Basic Message

```ts
return ctx.end({
  text: "Your quote is ready.",
});
```

## Quick Replies

```ts
return ctx.end({
  text: "What would you like to do next?",
  quickReplies: [
    { label: "View cart", value: "view cart" },
    { label: "Start over", value: "start over" },
  ],
});
```

## Sending Messages Into Conversations

```ts
await conversation.sendMessage({
  text: "Your order is packed.",
  quickReplies: [
    { label: "Track order", value: "track order" },
  ],
});
```

## Tool-Owned Terminal Responses

Use `ctx.end(...)` when the tool should own the final user-facing response and stop the normal assistant continuation.

```ts
handler: async (_input, ctx) => {
  return ctx.end({
    text: "Done.",
  });
};
```

For attachment inputs and attachment-aware tool schemas, see [Attachments](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/attachments.md).

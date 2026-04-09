# Attachments

Konsier supports attachments in two main places:

- tool inputs via `Konsier.attachment.*()`
- outbound messages via `AttachInput`

## Attachment-Aware Tool Inputs

Use attachment schema helpers in your tool input definitions.

```ts
const addReceipt = Konsier.tool({
  name: "Add Receipt",
  description: "Store an uploaded receipt.",
  input: z.object({
    title: z.string().min(1),
    receipt: Konsier.attachment.image().optional(),
  }),
  handler: async (input) => {
    return {
      title: input.title,
      hasReceipt: Boolean(input.receipt),
    };
  },
});
```

Available helpers:

- `Konsier.attachment.image()`
- `Konsier.attachment.video()`
- `Konsier.attachment.audio()`
- `Konsier.attachment.file()`
- `Konsier.attachment.location()`

## Sending Attachments

Use `ctx.attach(...)` to queue attachments for the assistant response:

```ts
ctx.attach({
  type: "image",
  url: "https://example.com/catalog/lantern.jpg",
  caption: "Oak Lantern",
});
```

You can also send attachments with `ctx.end(...)` or `conversation.sendMessage(...)`.

## AttachInput

```ts
type AttachInput =
  | {
      type: "image" | "video" | "audio" | "file";
      url: string;
      name?: string;
      mimeType?: string;
      caption?: string;
    }
  | {
      type: "image" | "video" | "audio" | "file";
      buffer: Buffer;
      name?: string;
      mimeType?: string;
      caption?: string;
    }
  | {
      attachmentId: string;
    }
  | {
      type: "location";
      latitude: number;
      longitude: number;
      name?: string;
      mimeType?: string;
      caption?: string;
      address?: string;
    };
```

## Supported Patterns

### Send By URL

```ts
ctx.attach({
  type: "file",
  url: "https://example.com/invoice.pdf",
  name: "invoice.pdf",
  mimeType: "application/pdf",
});
```

### Send By Buffer

```ts
await conversation.sendMessage({
  attachments: [
    {
      type: "file",
      buffer: pdfBuffer,
      name: "invoice.pdf",
      mimeType: "application/pdf",
    },
  ],
});
```

### Re-Send Existing Uploads

```ts
ctx.attach({ attachmentId: "att_existing_upload" });
```

### Send A Location

```ts
await conversation.sendMessage({
  attachments: [
    {
      type: "location",
      latitude: 40.6892,
      longitude: -74.0445,
      address: "Liberty Island, New York, NY",
    },
  ],
});
```

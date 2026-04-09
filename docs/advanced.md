# Advanced

These APIs are useful when you are building a custom adapter or handling requests without the packaged framework helpers.

## Webhook Handler

```ts
const handler = konsier.webhookHandler();
const path = konsier.webhookPath();

app.post(path, async (req, res) => {
  await handler(req, res);
});
```

## Page Verification

```ts
const result = konsier.pageRequest({
  url: requestUrl,
  headers: requestHeaders,
});

if (result.type === "authorized") {
  renderPage(result.context);
} else {
  // result.status, result.headers, result.body
}
```

## Low-Level Request And Response Types

```ts
type HttpRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type HttpResponseLike = {
  status?: (statusCode: number) => HttpResponseLike;
  json?: (body: unknown) => unknown;
  send?: (body: unknown) => unknown;
  end?: (body?: unknown) => unknown;
  setHeader?: (name: string, value: string) => unknown;
  statusCode?: number;
};
```

## Inbound Protocol Types

The root package exports protocol request and response types used by the webhook surface:

- `ManifestRequest`
- `ManifestResponse`
- `EventDispatchRequest`
- `EventDispatchResponse`
- `ResolveAgentRequest`
- `ResolveAgentResponse`
- `SdkHandlerRequest`
- `SlashCommandRequest`
- `SlashCommandResponse`
- `ToolCallRequest`
- `ToolCallResponse`

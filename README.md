# Konsier

The Node.js/TypeScript SDK for [Konsier](https://konsier.com) — the platform that connects your AI agents to Telegram, Slack, WhatsApp, Discord, Email, and SMS with a single integration.

Define your agents and tools in code. Konsier handles the channels, conversations, and infrastructure.

```
Your backend (tools, logic, data)
        ↕  Konsier SDK
Konsier Cloud
        ↕
Telegram · Slack · WhatsApp · Discord · Email · SMS
```

## Prerequisites

- **Node.js 20.17+ or 22.9+**
- A **Konsier account** and project API key from the [dashboard](https://konsier.com)
- A **publicly reachable endpoint** — Konsier Cloud sends requests to your server, so `localhost` alone won't work. Use a tunnel (ngrok, Cloudflare Tunnel, etc.) during development or deploy to a hosting provider.

## Install

```bash
npm install konsier
```

Install your framework separately when needed, for example `express`.

The SDK includes [Zod 4](https://zod.dev) as a dependency. Import it from `"zod"` in your tool definitions:

```ts
import { z } from "zod";
```

## Quick start

```ts
import express from "express";
import { Konsier } from "konsier";
import { serveKonsier } from "konsier/express";
import { z } from "zod";

// 1. Define tools
const getMenu = Konsier.tool({
  name: "get_menu",
  description: "Returns the restaurant menu",
  input: z.object({
    category: z.string().optional(),
  }),
  handler: async (input, ctx) => {
    const items = await fetchMenuItems(input.category);
    return { items };
  },
});

// 2. Configure the SDK
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: "https://your-public-url.com/konsier",
  agents: {
    customer_support: {
      name: "Customer Support",
      description: "Helps customers with menu questions and orders.",
      systemPrompt: "You help customers browse the menu and place food orders.",
      tools: [getMenu],
    },
  },
});

// 3. Serve and sync
const app = express();

serveKonsier(app, konsier);

app.listen(3000, async () => {
  await konsier.sync();
  console.log("Ready on :3000");
});
```

`serveKonsier()` derives the webhook path from `endpointUrl` and wires the signed webhook route for you. `sync()` pushes the current local configuration for that `Konsier` instance to Konsier Cloud.

Then in the [Konsier dashboard](https://konsier.com):
1. Create a project and grab your API key
2. Set the endpoint URL to your server's public `/konsier` path
3. Link the `customer_support` agent
4. Connect a channel (Telegram, Slack, etc.)
5. Send a message — your tools execute automatically

## Concepts

| Concept | What it is |
|---------|-----------|
| **Agent** | An AI persona with a system prompt and a set of tools. You register agents by ref (e.g. `customer_support`) and Konsier routes conversations to them. |
| **Tool** | A function your agent can call. Defined with a Zod schema for input validation and a handler that returns a JSON object. |
| **Channel** | A messaging platform (Telegram, Slack, WhatsApp, Discord, Email, SMS) connected through the Konsier dashboard. |
| **Internal tool** | A tool available only to project owners in the Konsier dashboard — not exposed to end users. |
| **Internal page** | A protected page served by your backend. Konsier opens it directly on your app origin with a short-lived launch token, and the SDK bootstraps a cookie-backed page session. |
| **Account** | A connected business/customer account. Agents and tools receive account context for multi-tenant logic. |

## Defining tools

Use `Konsier.tool()` with a Zod schema for validated, fully-typed tool inputs:

```ts
import { Konsier } from "konsier";
import { z } from "zod";

const createOrder = Konsier.tool({
  name: "create_order",
  description: "Places a new order",
  input: z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().min(1),
    })),
    note: z.string().optional(),
  }),
  handler: async (input, ctx) => {
    const order = await db.orders.create({
      accountId: ctx.account?.id,
      userId: ctx.user.id,
      items: input.items,
      note: input.note,
    });

    return { orderId: order.id, status: order.status };
  },
});
```

Tool handlers must return a JSON-serializable object. The Zod schema is automatically converted to JSON Schema for the LLM.

### Tool context

The second argument to every handler is a `ToolContext` with runtime information:

```ts
handler: async (input, ctx) => {
  ctx.user        // { id, externalId?, metadata?, displayName? }
  ctx.account     // { id, name, metadata } or null
  ctx.channel     // "telegram" | "slack" | "whatsapp" | ...
  ctx.conversation // { id, startedAt, messageCount }
  ctx.message     // { text?, html?, attachments? } — the triggering message
  ctx.send(msg)   // send a follow-up message to the conversation
}
```

`ctx.user` always has an `id`. The remaining fields (`externalId`, `metadata`, `displayName`) are populated when available — for example, after you link a user (see [User and account linking](#user-and-account-linking)).

## Configuring agents

Agents are registered as a map of ref strings to config objects:

```ts
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  agents: {
    // Static configuration
    customer_support: {
      name: "Customer Support",
      description: "Handles customer inquiries.",
      systemPrompt: "You are a helpful customer support agent.",
      tools: [getMenu, createOrder, trackOrder],
    },

    // Dynamic configuration — resolved per-request
    store_manager: async (ctx) => {
      const storeTools = await loadToolsForAccount(ctx.account?.id);
      return {
        systemPrompt: `You manage store ${ctx.account?.name ?? "unknown"}.`,
        tools: storeTools,
      };
    },
  },
});
```

Dynamic agent resolvers receive an `AgentContext` with `account` info, letting you customize the system prompt and tool set per connected account.

## Internal tools and pages

Internal tools are available only in the Konsier dashboard (not to end users via channels). Protected pages are routes on your server that Konsier launches directly on your app origin.

```ts
const salesSnapshot = Konsier.tool({
  name: "sales_snapshot",
  description: "Returns today's sales summary",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const sales = await db.sales.today(ctx.account?.id);
    return { revenue: sales.revenue, orderCount: sales.count };
  },
});

const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  agents: { /* ... */ },
  internal: {
    tools: [salesSnapshot],
    pages: [
      { name: "Dashboard", path: "/pages/dashboard" },
      { name: "Orders", path: "/pages/orders" },
    ],
  },
});
```

Internal config can also be dynamic — resolved per-request with account context:

```ts
internal: async (ctx) => ({
  tools: ctx.account ? [salesSnapshot] : [],
  pages: [{ name: "Dashboard", path: "/pages/dashboard" }],
}),
```

### Serving pages

Protected pages are opened from Konsier with a short-lived launch token in the URL. The SDK validates that token, sets an HTTP-only cookie, redirects to the clean page URL, and then exposes page context to your handler.

Use the framework adapter to protect those page routes:

```ts
import { verifyKonsierPage } from "konsier/express";

app.get("/pages/*", verifyKonsierPage(konsier), (req, res) => {
  const { user, account, projectId } = req.konsier!;
  res.send(renderDashboard({ user, account }));
});
```

For Express, the middleware still handles the full bootstrap automatically. The first browser request may redirect before your route handler runs.

### Page lifecycle

When a user opens a protected page from Konsier, the browser flow is:

1. Konsier opens your real page URL on your app origin with a short-lived launch token in the query string.
2. The SDK validates that token.
3. The SDK sets a short-lived HTTP-only cookie for your app origin.
4. The SDK redirects the browser to the clean page URL without the token.
5. Your handler receives `PageContext`.

This is why pages render with their own CSS, JS, and relative navigation intact: they run on your app's real origin, not inside a proxy renderer.

### PageContext

Protected page handlers receive `PageContext`:

```ts
type PageUser = {
  id?: string;
  email?: string;
  name?: string;
};

type PageContext = {
  pagePath: string;
  projectId: string | null;
  account: { id: string; name: string; metadata: Record<string, unknown> } | null;
  theme: "light" | "dark";
  user: PageUser;
};
```

Field meanings:

- `pagePath`: the current protected page path, for example `/pages/orders`
- `projectId`: the Konsier project ID when available
- `account`: connected account context for multi-tenant apps, or `null`
- `theme`: the current Konsier light/dark theme captured at launch time
- `user`: the Konsier user opening the page when available

### Using page theme

Pages can render against the current Konsier theme directly from `context.theme`:

```ts
app.get("/pages/dashboard", verifyKonsierPage(konsier), (req, res) => {
  const themeClass = req.konsier?.theme === "dark" ? "theme-dark" : "theme-light";
  res.send(renderDashboard({ themeClass, context: req.konsier! }));
});
```

The theme is captured when the page is launched. If the user changes theme later in Konsier, reopening the page picks up the new theme.

## User and account linking

Link your own user/account identifiers to Konsier's, so tool handlers can look up your internal records:

```ts
// Link a Konsier user to your system
const linkedUser = await konsier.users.link({
  userId: "konsier_user_id",
  externalId: "your_internal_user_id",
  metadata: { plan: "pro" },
});

// Retrieve a linked user
const fetchedUser = await konsier.users.get({ userId: "konsier_user_id" });

// Link an account
const linkedAccount = await konsier.accounts.link({
  accountId: "konsier_account_id",
  externalId: "your_internal_account_id",
  metadata: { region: "us-east" },
});

// Retrieve accounts
const fetchedAccount = await konsier.accounts.get({ accountId: "konsier_account_id" });
const allAccounts = await konsier.accounts.list();
```

## Connections

Start an OAuth-style connection flow to onboard accounts:

```ts
// Generate a connection URL and redirect the user to it
const { url, expiresAt } = await konsier.connections.start({
  redirect: "https://yourapp.com/connected",
  metadata: { source: "onboarding" },
});
// Redirect user to `url`

// On your redirect handler, complete the connection using the
// token from the query string (?token=...)
app.get("/connected", async (req, res) => {
  const { account } = await konsier.connections.complete({
    token: req.query.token as string,
  });
  res.send(`Connected account: ${account.name}`);
});
```

## Sending messages

Push messages to users or conversations from your backend (outside of tool handlers):

```ts
await konsier.sendMessage({
  userId: "konsier_user_id",
  text: "Your order has shipped!",
});

await konsier.sendMessage({
  conversationId: "conv_123",
  html: "<b>Update:</b> Your table is ready.",
  attachments: [{ type: "image", url: "https://..." }],
});
```

Inside tool handlers, use `ctx.send()` for the same purpose:

```ts
handler: async (input, ctx) => {
  await ctx.send({ text: "Processing your order..." });
  const order = await processOrder(input);
  return { orderId: order.id };
},
```

## Express integration

Use the Express adapter to register the webhook route derived from `endpointUrl`:

```ts
import express from "express";
import { Konsier } from "konsier";
import { serveKonsier, verifyKonsierPage } from "konsier/express";

const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: "https://yourapp.com/konsier",
  agents: { /* ... */ },
});

const app = express();
serveKonsier(app, konsier);

app.get("/pages/*", verifyKonsierPage(konsier), (req, res) => {
  res.json({ context: req.konsier });
});

app.listen(3000, async () => {
  await konsier.sync();
});
```

## Next.js integration

Use the Next adapter with App Router route handlers:

```ts
import { Konsier } from "konsier";
import { createKonsierRoute } from "konsier/next";

const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: "https://yourapp.com/api/konsier",
  agents: { /* ... */ },
});

export const POST = createKonsierRoute(konsier);
```

For protected page requests, handle either a bootstrap `Response` or an authorized result:

```ts
import { verifyKonsierPageRequest } from "konsier/next";

export async function GET(request: Request) {
  const pageAuth = verifyKonsierPageRequest(konsier, request);
  if (pageAuth instanceof Response) {
    return pageAuth;
  }

  return Response.json(pageAuth.context);
}
```

For Next, `verifyKonsierPageRequest(...)` has two outcomes:

- it returns a `Response` during launch bootstrap/redirect
- it returns `{ type: "authorized", context }` once the page session is established

## Fastify integration

Register the webhook route directly on a Fastify instance:

```ts
import Fastify from "fastify";
import { Konsier } from "konsier";
import { registerKonsier } from "konsier/fastify";

const app = Fastify();
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: "https://yourapp.com/konsier",
  agents: { /* ... */ },
});

registerKonsier(app, konsier);
await app.listen({ port: 3000 });
await konsier.sync();
```

For protected pages, the Fastify helper returns a `PageRequestResult`:

```ts
import { verifyKonsierPageRequest } from "konsier/fastify";

app.get("/pages/ops", async (request, reply) => {
  const pageAuth = verifyKonsierPageRequest(konsier, request);
  if (pageAuth.type === "response") {
    for (const [name, value] of Object.entries(pageAuth.headers)) {
      reply.header(name, value);
    }
    reply.code(pageAuth.status);
    return pageAuth.body ?? null;
  }

  return renderPage(pageAuth.context);
});
```

For Fastify, you forward the returned response metadata yourself when `type === "response"`.

## Hono integration

Use the Hono adapter for fetch-style runtimes:

```ts
import { Hono } from "hono";
import { Konsier } from "konsier";
import { serveKonsier } from "konsier/hono";

const app = new Hono();
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: "https://yourapp.com/konsier",
  agents: { /* ... */ },
});

serveKonsier(app, konsier);
```

For protected pages, Hono follows the same pattern as Next:

```ts
import { verifyKonsierPageRequest } from "konsier/hono";

app.get("/pages/orders", async (c) => {
  const pageAuth = verifyKonsierPageRequest(konsier, c.req.raw);
  if (pageAuth instanceof Response) {
    return pageAuth;
  }

  return c.json(pageAuth.context);
});
```

For Hono, just return the bootstrap `Response` as-is when you get one.

## Custom server integration

For plain Node `http`, use `webhookHandler()` directly:

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Konsier } from "konsier";

const konsier = new Konsier({ /* config */ });
const handler = konsier.webhookHandler();

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === konsier.webhookPath()) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks);
    const request = req as IncomingMessage & { body?: string; rawBody?: Buffer };
    request.rawBody = rawBody;
    request.body = rawBody.toString("utf8");

    await handler(request, res as ServerResponse & {
      status?: (statusCode: number) => ServerResponse;
      json?: (body: unknown) => void;
      send?: (body: unknown) => void;
    } as never);
    return;
  }

  res.writeHead(404).end();
}).listen(3000);
```

## Configuration reference

### `KonsierOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your project API key from the Konsier dashboard. |
| `agents` | `Record<string, AgentEntry>` | No* | Map of agent refs to static configs or async resolver functions. |
| `internal` | `InternalEntry` | No* | Internal tools and pages — static object or async resolver. |
| `endpointUrl` | `string` | No | Your server's public Konsier webhook URL. Used by framework adapters and `sync()`. |
| `debug` | `boolean` | No | Enable debug logging (only logs when `NODE_ENV=development`). |

\* At least one of `agents` or `internal` is required.

### `AgentConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Display name for the agent. |
| `description` | `string` | No | What the agent does. |
| `systemPrompt` | `string` | Yes | The system prompt sent to the LLM. |
| `tools` | `Tool[]` | Yes | Array of tools the agent can call. |
| `events` | `AgentEvents` | No | *Coming soon.* Lifecycle hooks: `onConversationStart`, `onConversationEnd`. |

### `Konsier.tool()` options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Alphanumeric, underscores, and hyphens only. |
| `description` | `string` | Yes | What the tool does (shown to the LLM). |
| `input` | `ZodSchema` | Yes | Zod schema defining the tool's input. |
| `handler` | `(input, ctx) => object` | Yes | Async or sync function returning a JSON object. |

### `ToolContext`

Passed as the second argument to every tool handler:

| Field | Type | Description |
|-------|------|-------------|
| `user` | `EndUser` | Always has `id`. Optional: `externalId`, `metadata`, `displayName`. |
| `account` | `Account \| null` | `{ id, name, metadata }` — null if no account is linked. |
| `channel` | `Channel` | `"telegram" \| "slack" \| "discord" \| "whatsapp" \| "email" \| "sms" \| "konsier"` |
| `agent` | `string` | The agent ref handling this call (or `"internal"`). |
| `conversation` | `Conversation` | `{ id, startedAt, messageCount }` |
| `message` | `ToolMessage` | `{ text?, html?, attachments? }` — the user's triggering message. |
| `send` | `(msg) => Promise<void>` | Send a follow-up message to the conversation. |

### `PageContext`

Passed to protected pages after launch bootstrap:

| Field | Type | Description |
|-------|------|-------------|
| `pagePath` | `string` | Current protected page path, for example `/pages/orders`. |
| `projectId` | `string \| null` | Konsier project ID when available. |
| `account` | `Account \| null` | Connected account context for multi-tenant apps. |
| `theme` | `"light" \| "dark"` | Konsier theme captured when the page was launched. |
| `user` | `PageUser` | User who opened the page when available. |

### `PageUser`

Passed inside `PageContext.user`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string \| undefined` | Konsier user ID when available. |
| `email` | `string \| undefined` | User email when available. |
| `name` | `string \| undefined` | User display name when available. |

### Page notes

- Protected pages should be opened from Konsier, not bookmarked as first-load clean URLs.
- Clean page URLs work after the SDK has bootstrapped the page session cookie.
- The page theme is launch-time state, not a live sync channel.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KONSIER_API_KEY` | — | API key (can also be passed in constructor). |
| `KONSIER_API_BASE_URL` | `https://konsier.com/api` | Override the cloud API URL (for development). |

## Examples

The [`examples/`](./examples) directory contains runnable sample apps (not published to npm):

| Example | Stack | What it demonstrates |
|---------|-------|---------------------|
| [`todo`](./examples/todo) | Express | Single agent, CRUD tools, one launchable owner page |
| [`marketplace`](./examples/marketplace) | Express + Next.js | Public + internal tools, direct-launch catalog and order pages |
| [`restaurant-manager`](./examples/restaurant-manager) | Fastify | Multi-agent, multi-tenant, dynamic resolvers |

Each example follows the same steps: install, add your API key, start the server, connect it in the Konsier dashboard.

## License

Apache 2.0 — see [LICENSE](./LICENSE) for details.

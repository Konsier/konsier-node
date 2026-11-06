# Konsier

Node.js and TypeScript SDK for [Konsier](https://konsier.com).

Define agents, typed operations, internal pages, and event handlers in your app. Konsier handles channels, delivery, and orchestration across Telegram, Slack, Discord, WhatsApp, email, SMS, and Konsier's own UI.

## Requirements

- Node.js `^20.17.0 || >=22.9.0`
- A Konsier project API key
- A public webhook URL for your app during development or production

## Install

```bash
npm install konsier
```

Install your framework separately when needed, for example:

```bash
npm install express
```

The SDK uses Zod for typed operation schemas:

```ts
import { z } from "zod";
```

## Quick Start

```ts
import express from "express";
import { Konsier } from "konsier";
import { serveKonsier } from "konsier/express";
import { z } from "zod";

const listTasks = Konsier.operation({
  service: "tasks",
  resource: "items",
  action: "list",
  title: "List Tasks",
  description: "List current tasks.",
  input: z.object({
    showCompleted: z.boolean().default(true),
  }),
  output: z.object({
    tasks: z.array(z.object({ id: z.string(), title: z.string() })),
  }),
  handler: async (input, ctx) => {
    const tasks = await loadTasks({
      userId: ctx.user.id,
      includeCompleted: input.showCompleted,
    });

    return { tasks };
  },
});

const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl: "https://your-app.example.com/konsier",
  publicUrl: "https://your-app.example.com",
  agents: {
    todo_assistant: {
      name: "Todo Assistant",
      description: "Helps users manage a task list.",
      systemPrompt:
        "You manage a compact task list. Use operations before answering about task state.",
      operations: [listTasks],
    },
  },
  internal: {
    pages: [{ name: "Tasks", path: "/pages/tasks" }],
  },
});

const app = express();

serveKonsier(app, konsier);

app.listen(3000, async () => {
  await konsier.sync();
  console.log("Konsier ready on :3000");
});
```

## Core Model

- Agent: a registered assistant implementation keyed by ref such as `todo_assistant`
- Operation: a typed function defined with `Konsier.operation(...)`
- Internal operation: an owner-only operation exposed in Konsier, not to end users
- Internal page: a protected page served by your app and launched from Konsier
- Account: connected tenant context passed into operations, pages, and events
- Conversation: a cloud-managed chat thread you can inspect or send into from your backend

## Defining Operations

```ts
import { Konsier } from "konsier";
import { z } from "zod";

const createOrder = Konsier.operation({
  service: "orders",
  resource: "drafts",
  action: "create",
  title: "Create Order",
  description: "Create a draft order for the current user.",
  input: z.object({
    items: z.array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    ),
    note: z.string().optional(),
  }),
  output: z.object({ orderId: z.string(), status: z.string() }),
  handler: async (input, ctx) => {
    const order = await db.orders.create({
      accountId: ctx.account?.id ?? null,
      userId: ctx.user.id,
      items: input.items,
      note: input.note,
    });

    return {
      orderId: order.id,
      status: order.status,
    };
  },
});
```

Operation handlers receive an `OperationContext` with channel, agent, user, conversation, messages, account, stable `idempotencyKey`, unique `attemptId`, and `attach(...)`.

For message payloads, attachment inputs, and attachment-aware tool schemas, see:

- [Messages](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/messages.md)
- [Attachments](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/attachments.md)

## Configuring Agents

```ts
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl: "https://your-app.example.com/konsier",
  agents: {
    customer_support: {
      name: "Customer Support",
      description: "Helps customers browse products and place orders.",
      systemPrompt:
        "Use operations before confirming product details, inventory, or pricing.",
      operations: [searchProductsOperation, createOrderOperation],
    },
    ops_assistant: {
      systemPrompt: "Assist operators with account workflows.",
      operations: [listAccountsOperation],
    },
  },
});
```

Agent entries can also be async resolvers.

## Internal Operations And Pages

```ts
const salesSnapshot = Konsier.operation({
  service: "sales",
  resource: "snapshots",
  action: "get",
  title: "Sales Snapshot",
  description: "Summarize today's sales.",
  input: z.object({}),
  output: z.object({ revenue: z.number(), orderCount: z.number() }),
  handler: async () => {
    return {
      revenue: 1820,
      orderCount: 27,
    };
  },
});

const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl: "https://your-app.example.com/konsier",
  agents: {
    customer_support: customerSupportAgent,
  },
  internal: {
    operations: [salesSnapshot],
    pages: [
      { name: "Dashboard", path: "/pages/dashboard" },
      { name: "Orders", path: "/pages/orders" },
    ],
  },
});
```

For full page verification flow and framework-specific page patterns, see [Pages](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/pages.md).

## Framework Adapters

- `konsier/express`
  Includes `serveKonsier(...)` and `verifyKonsierPage(...)`
- `konsier/next`
  Includes `createKonsierRoute(...)` and `verifyKonsierPageRequest(...)`
- `konsier/fastify`
  Includes `registerKonsier(...)` and `verifyKonsierPageRequest(...)`
- `konsier/hono`
  Includes `serveKonsier(...)`, `konsierWebhook(...)`, and `verifyKonsierPageRequest(...)`

For custom adapters and low-level webhook/page APIs, see [Advanced](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/advanced.md).

## Cloud SDK APIs

The `Konsier` instance exposes backend APIs for users, accounts, connections, conversations, and notifications.

### Users

```ts
const user = await konsier.users.get({ userId: "user_123" });

const linkedUser = await konsier.users.link({
  userId: "user_123",
  externalId: "crm_456",
  metadata: { plan: "pro" },
});
```

### Accounts

```ts
const accounts = await konsier.accounts.list();

const account = await konsier.accounts.get({
  accountId: "acct_123",
});

const linkedAccount = await konsier.accounts.link({
  accountId: "acct_123",
  externalId: "store_456",
  metadata: { region: "us" },
});
```

### Connected App Flow

```ts
const { url, expiresAt } = await konsier.connections.start({
  redirect: "https://your-app.example.com/settings/integrations",
  metadata: { source: "billing" },
});

const { account } = await konsier.connections.complete({
  token: "connect_token",
});
```

### Conversations

Conversations are fully documented in [Conversations](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/conversations.md).

```ts
const conversations = await konsier.conversations.list({
  agentRef: "customer_support",
  limit: 20,
});
```

### Notifications

```ts
await konsier.notify({
  kind: "deployment",
  title: "Deployment complete",
  body: "Version 42 is live.",
  navigation: {
    type: "page",
    projectId: 12,
    path: "/pages/dashboard",
  },
});
```

## Telegram Slash Commands

Telegram-specific slash commands are documented in [Telegram](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/telegram.md).

## Event Handlers

Project and agent event handlers are documented in [Events](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/events.md).

## CLI

The package ships with a CLI:

```bash
konsier init
konsier sync
```

### `konsier init`

Scaffolds a starter app and can optionally connect Telegram during setup. Supported scaffolds:

- Express
- Hono
- Next.js
- Fastify

### `konsier sync`

Loads the exported SDK instance from `src/konsier.ts` or `app/konsier.ts` and runs `sync()`.

## Errors

SDK and API failures use a consistent public shape:

```json
{
  "error": {
    "code": "project.endpoint.signature_invalid",
    "message": "Konsier reached your app, but your app rejected the verification request.",
    "action": "Check that your app's KONSIER_API_KEY matches this project's API key, then try again."
  }
}
```

For error semantics and the shared contract registry, see [Errors](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/errors.md).

## Configuration Reference

### `new Konsier(options)`

```ts
type KonsierOptions = {
  apiKey: string;
  agents?: Record<string, AgentEntry>;
  internal?: InternalEntry;
  events?: ProjectEventHandlers;
  endpointUrl?: string;
  publicUrl?: string;
  debug?: boolean;
};
```

### `AgentConfig`

```ts
type AgentConfig = {
  name?: string;
  description?: string | null;
  systemPrompt: string;
  operations: Operation[];
  telegram?: AgentTelegramConfig;
  events?: AgentEventHandlers;
};
```

### `OperationContext`

```ts
type OperationContext = {
  channel: Channel;
  agent: string;
  user: EndUser;
  conversation: Conversation;
  messages: OperationMessage[];
  account: Account | null;
  idempotencyKey: string;
  attemptId: string;
  attach: (input: AttachInput | AttachInput[]) => void;
};
```

### `PageContext`

```ts
type PageContext = {
  pagePath: string;
  projectId: string | null;
  account: Account | null;
  theme: "light" | "dark";
  user: PageUser;
};
```

### Environment Variables

Common environment variables used by apps in this repo:

- `KONSIER_API_KEY`
- `KONSIER_ENDPOINT_URL`
- `KONSIER_PUBLIC_URL`
- `PORT`

`debug: true` enables SDK debug logging in development mode.

## Docs

- [Conversations](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/conversations.md)
- [Messages](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/messages.md)
- [Attachments](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/attachments.md)
- [Pages](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/pages.md)
- [Events](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/events.md)
- [Telegram](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/telegram.md)
- [Advanced](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/advanced.md)
- [Errors](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/docs/errors.md)

## Examples

Repo examples live under [`examples/`](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/examples).

- [`examples/todo`](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/examples/todo)
  Express app showing attachment-aware operations and an internal tasks page
- [`examples/restaurant-manager`](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/examples/restaurant-manager)
  Fastify app showing multi-tenant agent flows, owner operations, and owner pages
- [`examples/marketplace`](/Users/emmanuelgyekyeatta-penkra/Desktop/Workspace/Konsier/konsier-node/examples/marketplace)
  Hono + Next.js app showing a public storefront, internal pages, and automatic sync on startup

## Troubleshooting

- `endpointUrl` must be a valid `http` or `https` URL with no query string or hash
- The webhook route in your app must exactly match the path portion of `endpointUrl`
- `publicUrl` must be the public app origin only, with no path, query string, or hash; Pages are launched from this origin
- `localhost` only works if you expose it through a public tunnel during development
- If you rename or remove agent refs, run `konsier.sync()` and relink the project agent in Konsier
- If page verification fails, make sure the request is reaching the correct app origin and path

## License

Apache-2.0

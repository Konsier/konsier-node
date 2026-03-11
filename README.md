# konsier-node

Node.js/TypeScript SDK for Konsier. The published package name is `konsier`.

## Install

```bash
npm install konsier zod@^4
```

`konsier` requires Zod 4 when you pass Zod schemas as tool inputs.

## Basic usage

```ts
import express from "express";
import { Konsier } from "konsier";
import { z } from "zod";

const getMenu = Konsier.tool({
  name: "get_menu",
  description: "Returns current menu items",
  input: z.object({ category: z.string().optional() }),
  handler: async (input, ctx) => {
    return { items: [], category: input.category ?? null, account: ctx.account?.id ?? null };
  },
});

const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  agents: {
    customer: {
      name: "Customer Support",
      description: "Handles menu questions and food ordering help.",
      systemPrompt: "You help customers place food orders.",
      tools: [getMenu],
    },
  },
  internal: {
    pages: [{ name: "Orders", path: "/pages/orders" }],
  },
});

const app = express();
app.use(express.json({ verify: (req, _res, buf) => {
  req.rawBody = buf;
} }));

app.use("/konsier", konsier.handler());
app.get("/pages/*", konsier.verifyPage(), (req, res) => {
  res.json({ ok: true, context: req.konsier });
});

app.listen(3000);
```

## Example projects

This repository now includes runnable sample apps under
[`examples/`](./examples):

- `todo`: Express + TypeScript, one public agent, one protected internal page
- `marketplace`: custom Express server + Next.js storefront, owner tools and pages kept internal
- `restaurant-manager`: native Node `http` multi-tenant platform sample for connected restaurant projects

These examples are **repo-only**. They are not published with the npm package.

Each example is designed so a developer can:

1. run the app locally,
2. point a Konsier project at the local `/konsier` endpoint,
3. link the documented agent ref(s),
4. configure a channel in Konsier, and
5. verify the corresponding UI and internal pages.

Tool handlers must return JSON objects.

## Local cloud override

The SDK defaults its cloud API base URL to `https://konsier.com/api`.

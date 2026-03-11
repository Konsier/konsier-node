# konsier-node

Node.js/TypeScript SDK for Konsier. The published package name is `konsier`.

## Install

```bash
npm install konsier zod
```

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
app.use(express.json({ verify: (req, _res, buf) => ((req as any).rawBody = buf) }));

app.use("/konsier", konsier.handler());
app.get("/pages/*", konsier.verifyPage(), (req, res) => {
  res.json({ ok: true, context: (req as any).konsier });
});

app.listen(3000);
```

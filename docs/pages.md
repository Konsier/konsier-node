# Pages

Internal pages are protected routes served by your app and launched from Konsier.

## Express

```ts
import express from "express";
import { verifyKonsierPage } from "konsier/express";

const app = express();

app.get("/pages/dashboard", verifyKonsierPage(konsier), (req, res) => {
  res.type("html").send(renderDashboard(req.konsier));
});
```

## Next.js

```ts
import { createKonsierRoute, verifyKonsierPageRequest } from "konsier/next";

export const POST = createKonsierRoute(konsier);

export async function GET(request: Request) {
  const pageAuth = verifyKonsierPageRequest(konsier, request);
  if (pageAuth instanceof Response) {
    return pageAuth;
  }

  return new Response(renderDashboard(pageAuth.context), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
```

## Fastify

```ts
import Fastify from "fastify";
import { registerKonsier, verifyKonsierPageRequest } from "konsier/fastify";

const app = Fastify();

registerKonsier(app, konsier);

app.get("/pages/dashboard", async (request, reply) => {
  const pageAuth = verifyKonsierPageRequest(konsier, request);
  if (pageAuth.type !== "authorized") {
    reply.code(pageAuth.status);
    for (const [name, value] of Object.entries(pageAuth.headers)) {
      reply.header(name, value);
    }
    return pageAuth.body ?? "";
  }

  reply.header("content-type", "text/html; charset=utf-8");
  return renderDashboard(pageAuth.context);
});
```

## Hono

```ts
import { Hono } from "hono";
import {
  konsierWebhook,
  verifyKonsierPageRequest,
} from "konsier/hono";

const app = new Hono();

app.post("/api/konsier", konsierWebhook(konsier));

app.get("/pages/dashboard", (c) => {
  const pageAuth = verifyKonsierPageRequest(konsier, c.req.raw);
  if (pageAuth instanceof Response) {
    return pageAuth;
  }

  return c.html(renderDashboard(pageAuth.context));
});
```

## Page Context

```ts
type PageContext = {
  pagePath: string;
  projectId: string | null;
  account: {
    id: string | null;
    name: string;
    metadata: Record<string, unknown>;
  } | null;
  theme: "light" | "dark";
  user: {
    id?: string;
    email?: string;
    name?: string;
  };
};
```

Use `context.theme` to match Konsier light or dark mode.

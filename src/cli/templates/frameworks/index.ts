import type { Framework } from "../../types";

export function frameworkFiles(framework: Framework): Record<string, string> {
  if (framework === "express") {
    return {
      "src/konsier.ts": `import "dotenv/config";
import { Konsier } from "konsier";

export const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: process.env.KONSIER_ENDPOINT_URL!,
  agents: {
    assistant: {
      name: "Assistant",
      description: "Replace this placeholder agent with your real app behavior.",
      systemPrompt:
        "You are a placeholder agent. Replace this with your real Konsier app instructions.",
      tools: [],
    },
  },
});
`,
      "src/index.ts": `import "dotenv/config";
import express from "express";
import { serveKonsier } from "konsier/express";
import { konsier } from "./konsier";

const app = express();
serveKonsier(app, konsier);

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Konsier app ready" });
});

const port = Number(process.env.PORT ?? "3000");
app.listen(port, async () => {
  try {
    await konsier.sync();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[konsier.sync.failed]", message);
    console.error(
      "[konsier.sync.failed] Start your public tunnel/domain, verify KONSIER_ENDPOINT_URL, and try again.",
    );
  }
  console.log(\`Konsier ready on http://localhost:\${port}\`);
});
`,
    };
  }

  if (framework === "hono") {
    return {
      "src/konsier.ts": `import "dotenv/config";
import { Konsier } from "konsier";

export const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: process.env.KONSIER_ENDPOINT_URL!,
  agents: {
    assistant: {
      name: "Assistant",
      description: "Replace this placeholder agent with your real app behavior.",
      systemPrompt:
        "You are a placeholder agent. Replace this with your real Konsier app instructions.",
      tools: [],
    },
  },
});
`,
      "src/index.ts": `import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveKonsier } from "konsier/hono";
import { konsier } from "./konsier";

const app = new Hono();

serveKonsier(app, konsier);

app.get("/", (c) => c.json({ ok: true, message: "Konsier app ready" }));

const port = Number(process.env.PORT ?? "3000");
serve({ fetch: app.fetch, port }, async () => {
  try {
    await konsier.sync();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[konsier.sync.failed]", message);
    console.error(
      "[konsier.sync.failed] Start your public tunnel/domain, verify KONSIER_ENDPOINT_URL, and try again.",
    );
  }
  console.log(\`Konsier ready on http://localhost:\${port}\`);
});
`,
    };
  }

  if (framework === "fastify") {
    return {
      "src/konsier.ts": `import "dotenv/config";
import { Konsier } from "konsier";

export const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: process.env.KONSIER_ENDPOINT_URL!,
  agents: {
    assistant: {
      name: "Assistant",
      description: "Replace this placeholder agent with your real app behavior.",
      systemPrompt:
        "You are a placeholder agent. Replace this with your real Konsier app instructions.",
      tools: [],
    },
  },
});
`,
      "src/index.ts": `import "dotenv/config";
import Fastify from "fastify";
import { registerKonsier } from "konsier/fastify";
import { konsier } from "./konsier";

const app = Fastify();

registerKonsier(app, konsier);

app.get("/", async () => {
  return { ok: true, message: "Konsier app ready" };
});

const port = Number(process.env.PORT ?? "3000");
await app.listen({ port, host: "0.0.0.0" });
try {
  await konsier.sync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[konsier.sync.failed]", message);
  console.error(
    "[konsier.sync.failed] Start your public tunnel/domain, verify KONSIER_ENDPOINT_URL, and try again.",
  );
}
console.log(\`Konsier ready on http://localhost:\${port}\`);
`,
    };
  }

  return {
    "app/konsier.ts": `import "dotenv/config";
import { Konsier } from "konsier";

export const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY!,
  endpointUrl: process.env.KONSIER_ENDPOINT_URL!,
  agents: {
    assistant: {
      name: "Assistant",
      description: "Replace this placeholder agent with your real app behavior.",
      systemPrompt:
        "You are a placeholder agent. Replace this with your real Konsier app instructions.",
      tools: [],
    },
  },
});
`,
    "app/api/konsier/route.ts": `import { createKonsierRoute } from "konsier/next";
import { konsier } from "../../konsier";

export const POST = createKonsierRoute(konsier);
`,
    "app/page.tsx": `export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Konsier App Ready</h1>
      <p>Run npm run sync after starting your app to register the current manifest.</p>
    </main>
  );
}
`,
  };
}

import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import next from "next";
import { Hono } from "hono";
import { konsierWebhook, verifyKonsierPageRequest } from "konsier/hono";

import { renderCatalogInternalPage, renderOrdersInternalPage } from "../lib/internal-pages";
import { ensureMarketplaceSdkSynced, sdk } from "../lib/konsier";
import {
  SHOPPER_USER_ID,
  addToCart,
  checkoutCart,
  removeFromCart,
} from "../lib/store";

const port = Number(process.env.PORT ?? "3003");
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
  dir: process.cwd(),
});
const nextHandler = app.getRequestHandler();

const hono = new Hono();
const handleKonsierWebhook = konsierWebhook(sdk);

hono.post("/api/konsier", async (context) => {
  return handleKonsierWebhook(context);
});

hono.post("/api/cart", async (context) => {
  const formData = await context.req.formData();
  const action = String(formData.get("action") || "");
  const productId = String(formData.get("productId") || "");
  const quantity = Number(formData.get("quantity") || "1");
  const redirectTo = String(formData.get("redirectTo") || "/");

  if (action === "add" && productId) {
    addToCart(
      SHOPPER_USER_ID,
      productId,
      Number.isFinite(quantity) ? quantity : 1,
    );
  }

  if (action === "remove" && productId) {
    removeFromCart(SHOPPER_USER_ID, productId);
  }

  if (action === "checkout") {
    checkoutCart(SHOPPER_USER_ID);
  }

  return context.redirect(redirectTo, 303);
});

hono.get("/pages/catalog", async (context) => {
  return handleAuthorizedOwnerPage(
    context.req.raw,
    renderCatalogInternalPage,
  );
});

hono.get("/pages/orders", async (context) => {
  return handleAuthorizedOwnerPage(
    context.req.raw,
    renderOrdersInternalPage,
  );
});

async function main(): Promise<void> {
  await app.prepare();

  const server = createServer(async (req, res) => {
    try {
      if (shouldUseHono(req.url ?? "")) {
        const request = toWebRequest(req);
        const response = await hono.fetch(request);
        await writeWebResponse(res, response);
        return;
      }

      await nextHandler(req, res);
    } catch (error) {
      console.error("[marketplace-example.server]", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
      }
      res.end("Internal Server Error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`[marketplace-example] listening on http://localhost:${port}`);
  void syncMarketplaceSdkInBackground();
}

function shouldUseHono(url: string): boolean {
  const pathname = new URL(url, `http://localhost:${port}`).pathname;
  return (
    pathname === "/api/konsier" ||
    pathname === "/api/cart" ||
    pathname === "/pages/catalog" ||
    pathname === "/pages/orders"
  );
}

function toWebRequest(req: IncomingMessage): Request {
  const origin = `http://${req.headers.host ?? `localhost:${port}`}`;
  const url = new URL(req.url ?? "/", origin);
  const headers: [string, string][] = [];

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.push([name, entry]);
      }
      continue;
    }

    if (typeof value === "string") {
      headers.push([name, value]);
    }
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method ?? "GET",
    headers: new Headers(headers),
  };

  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req) as ReadableStream;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function writeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const body = Readable.fromWeb(response.body as NodeReadableStream);
    body.on("error", reject);
    res.on("error", reject);
    res.on("finish", resolve);
    body.pipe(res);
  });
}

function handleAuthorizedOwnerPage(
  request: Request,
  render: (context: unknown) => string,
): Response {
  const pageAuth = verifyKonsierPageRequest(sdk, request);
  if (pageAuth instanceof Response) {
    return pageAuth;
  }
  if (pageAuth.type !== "authorized") {
    return new Response(pageAuth.body ?? "", {
      status: pageAuth.status,
      headers: pageAuth.headers,
    });
  }

  return new Response(render(pageAuth.context), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

async function syncMarketplaceSdkInBackground(): Promise<void> {
  let attempt = 1;

  while (true) {
    try {
      await ensureMarketplaceSdkSynced();
      return;
    } catch (error) {
      const delayMs = Math.min(30_000, attempt * 5_000);
      console.error("[marketplace-example] sdk sync retry scheduled", {
        attempt,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

void main().catch((error) => {
  console.error("[marketplace-example.startup]", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

import { z } from "zod";

import { serveKonsier, verifyKonsierPage as verifyExpressPage } from "../src/adapters/express";
import { registerKonsier } from "../src/adapters/fastify";
import { konsierWebhook, serveKonsier as serveHonoKonsier, verifyKonsierPageRequest as verifyHonoPage } from "../src/adapters/hono";
import { createKonsierRoute, verifyKonsierPageRequest as verifyNextPage } from "../src/adapters/next";
import { createKonsierSignature, createPageContextPayload } from "../src/protocol/signatures";
import { Konsier } from "../src/client";

function createSdk() {
  return new Konsier({
    apiKey: "k_test_123",
    endpointUrl: "https://example.com/konsier",
    agents: {
      customer: {
        systemPrompt: "You help customers.",
        tools: [
          Konsier.tool({
            name: "ping",
            description: "Return pong",
            input: z.object({ value: z.string() }),
            handler: async (input) => ({ pong: input.value }),
          }),
        ],
      },
    },
  });
}

function createSignedFetchRequest(apiKey: string, body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = createKonsierSignature({
    apiKey,
    timestamp,
    payload,
  });

  return new Request("https://example.com/konsier", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-konsier-timestamp": timestamp,
      "x-konsier-signature": `sha256=${signature}`,
    },
    body: payload,
  });
}

function createPageHeaders(apiKey: string) {
  const pagePath = "/pages/orders";
  const timestamp = Date.now().toString();
  const signature = createKonsierSignature({
    apiKey,
    timestamp,
    payload: createPageContextPayload({
      pagePath,
      projectId: "10",
      account: {
        id: "10",
        name: "Acme",
        metadata: { restaurantId: "r_1" },
      },
      user: {
        id: "u_1",
        email: "owner@acme.com",
        name: "Owner",
      },
    }),
  });

  return new Headers({
    "x-konsier-timestamp": timestamp,
    "x-konsier-signature": `sha256=${signature}`,
    "x-konsier-page-path": pagePath,
    "x-konsier-project-id": "10",
    "x-konsier-account-id": "10",
    "x-konsier-account-name": "Acme",
    "x-konsier-account-metadata": JSON.stringify({ restaurantId: "r_1" }),
    "x-konsier-user-id": "u_1",
    "x-konsier-user-email": "owner@acme.com",
    "x-konsier-user-name": "Owner",
  });
}

describe("framework adapters", () => {
  it("registers the express webhook route from endpointUrl", () => {
    const sdk = createSdk();
    const calls: Array<{ path: string; handlerCount: number }> = [];

    serveKonsier(
      {
        post(path, ...handlers) {
          calls.push({ path, handlerCount: handlers.length });
        },
      },
      sdk,
    );

    expect(calls).toEqual([{ path: "/konsier", handlerCount: 2 }]);
    expect(typeof verifyExpressPage(sdk)).toBe("function");
  });

  it("handles next route requests", async () => {
    const sdk = createSdk();
    const route = createKonsierRoute(sdk);
    const response = await route(
      createSignedFetchRequest("k_test_123", {
        type: "tool_call",
        conversation: {
          id: 1,
          project_id: 10,
          execution_project_id: 10,
          started_at: "2026-03-10T00:00:00.000Z",
          message_count: 1,
        },
        message: {},
        channel: "whatsapp",
        target: {
          type: "agent",
          agent: "customer",
        },
        tool: {
          name: "ping",
          input: { value: "ok" },
        },
        account: null,
        user: {
          id: 7,
          external_id: null,
          name: "Jamie",
          metadata: null,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pong: "ok" });
  });

  it("registers the fastify webhook route from endpointUrl", () => {
    const sdk = createSdk();
    const routes: string[] = [];

    registerKonsier(
      {
        route(options) {
          routes.push(`${options.method}:${options.url}`);
        },
      },
      sdk,
    );

    expect(routes).toEqual(["POST:/konsier"]);
  });

  it("handles hono webhook requests", async () => {
    const sdk = createSdk();
    const calls: string[] = [];
    serveHonoKonsier(
      {
        post(path, handler) {
          calls.push(path);
          void handler;
        },
      },
      sdk,
    );
    expect(calls).toEqual(["/konsier"]);

    const handler = konsierWebhook(sdk);
    const response = await handler({
      req: createSignedFetchRequest("k_test_123", {
        type: "manifest",
        account: null,
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      agents: [{ ref: "customer" }],
    });
  });

  it("verifies page requests through next and hono helpers", () => {
    const sdk = createSdk();
    const request = new Request("https://example.com/pages/orders", {
      headers: createPageHeaders("k_test_123"),
    });

    expect(verifyNextPage(sdk, request)).toMatchObject({
      pagePath: "/pages/orders",
    });
    expect(verifyHonoPage(sdk, request)).toMatchObject({
      pagePath: "/pages/orders",
    });
  });

  it("syncs the current instance using its configured endpoint", async () => {
    const sdk = createSdk();
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];

    (
      sdk as unknown as {
        cloudClient: {
          post: (path: string, body: Record<string, unknown>) => Promise<void>;
        };
      }
    ).cloudClient = {
      post: async (path, body) => {
        calls.push({ path, body });
      },
    };

    await sdk.sync();

    expect(calls).toEqual([
      {
        path: "/agents/refresh",
        body: { endpoint_url: "https://example.com/konsier" },
      },
    ]);
  });
});

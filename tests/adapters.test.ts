import { z } from "zod";

import { serveKonsier, verifyKonsierPage as verifyExpressPage } from "../src/adapters/express";
import { registerKonsier } from "../src/adapters/fastify";
import { konsierWebhook, serveKonsier as serveHonoKonsier, verifyKonsierPageRequest as verifyHonoPage } from "../src/adapters/hono";
import { createKonsierRoute, verifyKonsierPageRequest as verifyNextPage } from "../src/adapters/next";
import { PAGE_LAUNCH_QUERY_PARAM, PAGE_SESSION_COOKIE_NAME } from "../src/constants";
import { createKonsierSignature, createPageLaunchToken } from "../src/protocol/signatures";
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

function createLaunchToken(apiKey: string) {
  const pagePath = "/pages/orders";
  return createPageLaunchToken({
    apiKey,
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
    theme: "dark",
    exp: Date.now() + 60_000,
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
        route(options: { method: string; url: string }) {
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
      agents: {
        customer: {
          name: "customer",
          description: null,
          events: [],
        },
      },
      project: {
        events: [],
      },
    });
  });

  it("bootstraps page requests through next and hono helpers", async () => {
    const sdk = createSdk();
    const launchToken = createLaunchToken("k_test_123");
    const request = new Request("https://example.com/pages/orders", {
      headers: {},
    });
    const bootstrapUrl = new URL(request.url);
    bootstrapUrl.searchParams.set(PAGE_LAUNCH_QUERY_PARAM, launchToken);

    const nextBootstrap = verifyNextPage(
      sdk,
      new Request(bootstrapUrl.toString()),
    );
    expect(nextBootstrap instanceof Response).toBe(true);
    if (!(nextBootstrap instanceof Response)) {
      throw new Error("Expected next bootstrap response");
    }
    expect(nextBootstrap.status).toBe(302);

    const honoBootstrap = verifyHonoPage(
      sdk,
      new Request(bootstrapUrl.toString()),
    );
    expect(honoBootstrap instanceof Response).toBe(true);
    if (!(honoBootstrap instanceof Response)) {
      throw new Error("Expected hono bootstrap response");
    }
    expect(honoBootstrap.status).toBe(302);

    const cookieHeader = nextBootstrap.headers.get("set-cookie");
    expect(cookieHeader).toContain(`${PAGE_SESSION_COOKIE_NAME}=`);

    const nextSession = verifyNextPage(
      sdk,
      new Request(request.url, {
        headers: {
          cookie: cookieHeader ?? "",
        },
      }),
    );
    if (nextSession instanceof Response || nextSession.type !== "authorized") {
      throw new Error("Expected next session context");
    }
    expect(nextSession.context.pagePath).toBe("/pages/orders");
    expect(nextSession.context.theme).toBe("dark");

    const honoSession = verifyHonoPage(
      sdk,
      new Request(request.url, {
        headers: {
          cookie: cookieHeader ?? "",
        },
      }),
    );
    if (honoSession instanceof Response || honoSession.type !== "authorized") {
      throw new Error("Expected hono session context");
    }
    expect(honoSession.context.pagePath).toBe("/pages/orders");
    expect(honoSession.context.theme).toBe("dark");
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

  it("serializes nested manifest handlers, telegram config, and resolver output", async () => {
    const sdk = new Konsier({
      apiKey: "k_test_123",
      endpointUrl: "https://example.com/konsier",
      events: {
        beforeAccountConnect: () => {},
        onAccountConnected: () => {},
      },
      agents: {
        customer: ({ account }) => ({
          name: account?.name ?? "customer",
          description: "Resolver agent",
          systemPrompt: "Support",
          tools: [],
          events: {
            beforeConversationCreated: () => {},
            onMessageReceived: () => {},
          },
          telegram: {
            slashCommands: [
              Konsier.telegram.slashCommand({
                command: "start",
                description: "Start",
                handler: async () => ({ text: "ok" }),
              }),
            ],
            events: {},
          },
        }),
      },
      internal: ({ account }) => ({
        pages: [
          {
            name: account?.name ?? "Orders",
            path: "/pages/orders",
          },
        ],
      }),
    });
    const route = createKonsierRoute(sdk);
    const response = await route(
      createSignedFetchRequest("k_test_123", {
        type: "manifest",
        account: {
          id: "acct_1",
          name: "Acme",
          metadata: { region: "us" },
        },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      project: {
        events: ["beforeAccountConnect", "onAccountConnected"],
      },
      agents: {
        customer: {
          name: "Acme",
          description: "Resolver agent",
          events: ["beforeConversationCreated", "onMessageReceived"],
          telegram: {
            slashCommands: [
              {
                command: "start",
                description: "Start",
              },
            ],
            events: [],
          },
        },
      },
      internal: {
        pages: [
          {
            name: "Acme",
            path: "/pages/orders",
          },
        ],
      },
    });
  });
});

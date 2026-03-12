import { z } from "zod";

import { createKonsierSignature } from "../src/protocol/signatures";
import { Konsier } from "../src";

function createMockResponse() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
  };

  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
    send(payload: unknown) {
      state.body = payload;
      return this;
    },
  };

  return { res, state };
}

function createSignedRequest(apiKey: string, body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = createKonsierSignature({
    apiKey,
    timestamp,
    payload,
  });

  return {
    method: "POST",
    headers: {
      "x-konsier-timestamp": timestamp,
      "x-konsier-signature": `sha256=${signature}`,
    },
    body,
    rawBody: Buffer.from(payload, "utf8"),
  };
}

describe("webhookHandler", () => {
  const apiKey = "k_test_123";

  const getMenu = Konsier.tool({
    name: "get_menu",
    description: "Return menu data",
    input: z.object({ category: z.string().optional() }),
    handler: async (input) => ({
      items: [],
      category: input.category ?? null,
    }),
  });

  const lookupOrder = Konsier.tool({
    name: "lookup_order",
    description: "Lookup an order",
    input: z.object({ orderId: z.string() }),
    handler: async (input) => ({
      orderId: input.orderId,
      status: "ready",
    }),
  });

  const sdk = new Konsier({
    apiKey,
    endpointUrl: "https://example.com/konsier",
    agents: {
      customer: {
        name: "Customer Support",
        description: "Handles restaurant support questions.",
        systemPrompt: "You help customers.",
        tools: [getMenu],
      },
    },
    internal: {
      tools: [lookupOrder],
      pages: [{ name: "Orders", path: "/pages/orders" }],
    },
  });
  const handler = sdk.webhookHandler();

  it("handles agent tool_call requests", async () => {
    const body = {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 4,
      },
      message: {
        text: "Show me dinner options",
      },
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      tool: {
        name: "get_menu",
        input: { category: "dinner" },
      },
      account: {
        id: 5,
        name: "Acme",
        metadata: { restaurantId: "r_1" },
      },
      user: {
        id: 7,
        external_id: null,
        name: "Jamie",
        metadata: null,
      },
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      items: [],
      category: "dinner",
    });
  });

  it("handles internal tool_call requests", async () => {
    const body = {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 2,
      },
      message: {
        text: "Where is order 123?",
      },
      channel: "whatsapp",
      target: {
        type: "internal",
      },
      tool: {
        name: "lookup_order",
        input: { orderId: "123" },
      },
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      orderId: "123",
      status: "ready",
    });
  });

  it("handles resolve_agent requests", async () => {
    const body = {
      type: "resolve_agent",
      agent: "customer",
      account: {
        id: 5,
        name: "Acme",
        metadata: { restaurantId: "r_1" },
      },
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({
      systemPrompt: "You help customers.",
      tools: [
        {
          name: "get_menu",
          description: "Return menu data",
          input: {
            type: "object",
            properties: {
              category: {
                type: "string",
              },
            },
            additionalProperties: false,
          },
        },
      ],
    });
  });

  it("returns a coded error when tool output is not an object", async () => {
    const badSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [
            Konsier.tool({
              name: "bad_output",
              description: "Returns a string",
              input: z.object({}),
              handler: async () => "bad" as never,
            }),
          ],
        },
      },
    });
    const badHandler = badSdk.webhookHandler();

    const body = {
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
        name: "bad_output",
        input: {},
      },
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await badHandler(req as never, res as never);

    expect(state.statusCode).toBe(500);
    expect(state.body).toEqual({
      error: "Tool handlers must return a JSON object.",
      code: "INVALID_TOOL_OUTPUT",
    });
  });

  it("rejects bad signatures", async () => {
    const body = {
      type: "resolve_agent",
      agent: "customer",
      account: null,
    };

    const req = {
      method: "POST",
      headers: {
        "x-konsier-timestamp": Date.now().toString(),
        "x-konsier-signature": "sha256=not-valid",
      },
      body,
      rawBody: Buffer.from(JSON.stringify(body), "utf8"),
    };

    const { res, state } = createMockResponse();
    await handler(req as never, res as never);

    expect(state.statusCode).toBe(401);
    expect(state.body).toEqual({ error: "SIGNATURE_MISMATCH" });
  });
});

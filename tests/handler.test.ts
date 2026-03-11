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

describe("handler", () => {
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

  const sdk = new Konsier({
    apiKey,
    agents: {
      customer: {
        name: "Customer Support",
        description: "Handles restaurant support questions.",
        systemPrompt: "You help customers.",
        tools: [getMenu],
      },
    },
    internal: {
      pages: [{ name: "Orders", path: "/pages/orders" }],
    },
  });

  it("handles tool_call requests", async () => {
    const body = {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
      },
      channel: "whatsapp",
      agent: "customer",
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

    await sdk.handler()(req, res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      result: {
        items: [],
        category: "dinner",
      },
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

    await sdk.handler()(req, res);

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({
      systemPrompt: "You help customers.",
      tools: [
        {
          name: "get_menu",
          description: "Return menu data",
        },
      ],
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
    await sdk.handler()(req, res);

    expect(state.statusCode).toBe(401);
    expect(state.body).toEqual({ error: "SIGNATURE_MISMATCH" });
  });
});

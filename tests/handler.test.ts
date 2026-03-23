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

  it("exports attachment helper inputs as att refs and parses resolved attachments", async () => {
    const attachTool = Konsier.tool({
      name: "Save Receipt",
      description: "Save an uploaded receipt",
      input: z.object({
        receipt: Konsier.attachment.file()
          .describe("Uploaded receipt from the conversation"),
        fallback: z
          .union([
            Konsier.attachment.image(),
            Konsier.attachment.file(),
          ])
          .optional(),
      }),
      handler: async (input) => ({
        type: input.receipt.type,
        receiptName: input.receipt.name ?? null,
        fallbackType: input.fallback?.type ?? null,
      }),
    });

    const attachSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [attachTool],
        },
      },
    });
    const attachHandler = attachSdk.webhookHandler();

    const resolveReq = createSignedRequest(apiKey, {
      type: "resolve_agent",
      agent: "customer",
      account: null,
    });
    const resolveRes = createMockResponse();

    await attachHandler(resolveReq as never, resolveRes.res as never);

    expect(resolveRes.state.statusCode).toBe(200);
    expect(resolveRes.state.body).toMatchObject({
      tools: [
        {
          name: "save_receipt",
          input: {
            type: "object",
            properties: {
              receipt: {
                type: "string",
                pattern: "^att:[^\\s]+$",
                description:
                  "Uploaded receipt from the conversation Pass an attachment reference in att:... format for a file from the conversation.",
                "x-konsier": {
                  kind: "attachment",
                  allowed_types: ["file"],
                },
              },
              fallback: {
                anyOf: [
                  {
                    type: "string",
                    pattern: "^att:[^\\s]+$",
                    "x-konsier": {
                      kind: "attachment",
                      allowed_types: ["image"],
                    },
                  },
                  {
                    type: "string",
                    pattern: "^att:[^\\s]+$",
                    "x-konsier": {
                      kind: "attachment",
                      allowed_types: ["file"],
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    });

    const toolReq = createSignedRequest(apiKey, {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [
        {
          text: "Save this receipt",
          sentAt: "2026-03-10T00:00:00.000Z",
        },
      ],
      channel: "telegram",
      target: {
        type: "agent",
        agent: "customer",
      },
      tool: {
        name: "save_receipt",
        input: {
          receipt: {
            id: "att_1",
            type: "file",
            name: "receipt.pdf",
            url: "storage://receipt.pdf",
            mimeType: "application/pdf",
          },
          fallback: {
            id: "att_2",
            type: "image",
            name: "photo.jpg",
            url: "storage://photo.jpg",
            mimeType: "image/jpeg",
          },
        },
      },
      account: null,
      user: null,
    });
    const toolRes = createMockResponse();

    await attachHandler(toolReq as never, toolRes.res as never);

    expect(toolRes.state.statusCode).toBe(200);
    expect(toolRes.state.body).toEqual({
      type: "file",
      receiptName: "receipt.pdf",
      fallbackType: "image",
    });
  });

  it("supports arrays of typed attachment helpers", async () => {
    const attachTool = Konsier.tool({
      name: "Save Gallery",
      description: "Save uploaded images",
      input: z.object({
        photos: z
          .array(Konsier.attachment.image())
          .min(1)
          .describe("Uploaded photos from the conversation"),
      }),
      handler: async (input) => ({
        count: input.photos.length,
        firstType: input.photos[0]?.type ?? null,
      }),
    });

    const attachSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [attachTool],
        },
      },
    });
    const attachHandler = attachSdk.webhookHandler();

    const resolveReq = createSignedRequest(apiKey, {
      type: "resolve_agent",
      agent: "customer",
      account: null,
    });
    const resolveRes = createMockResponse();

    await attachHandler(resolveReq as never, resolveRes.res as never);

    expect(resolveRes.state.statusCode).toBe(200);
    expect(resolveRes.state.body).toMatchObject({
      tools: [
        {
          name: "save_gallery",
          input: {
            properties: {
              photos: {
                type: "array",
                description: "Uploaded photos from the conversation",
                items: {
                  type: "string",
                  pattern: "^att:[^\\s]+$",
                  "x-konsier": {
                    kind: "attachment",
                    allowed_types: ["image"],
                  },
                },
              },
            },
          },
        },
      ],
    });

    const toolReq = createSignedRequest(apiKey, {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [
        {
          text: "Save these photos",
          sentAt: "2026-03-10T00:00:00.000Z",
        },
      ],
      channel: "telegram",
      target: {
        type: "agent",
        agent: "customer",
      },
      tool: {
        name: "save_gallery",
        input: {
          photos: [
            {
              id: "att_1",
              type: "image",
              name: "photo-1.jpg",
              url: "https://example.com/photo-1.jpg",
            },
            {
              id: "att_2",
              type: "image",
              name: "photo-2.jpg",
              url: "https://example.com/photo-2.jpg",
            },
          ],
        },
      },
      account: null,
      user: null,
    });
    const toolRes = createMockResponse();

    await attachHandler(toolReq as never, toolRes.res as never);

    expect(toolRes.state.statusCode).toBe(200);
    expect(toolRes.state.body).toEqual({
      count: 2,
      firstType: "image",
    });
  });

  it("normalizes human-readable tool names for manifest and invocation", async () => {
    const friendlyTool = Konsier.tool({
      name: "Search Products",
      description: "Search product data",
      input: z.object({ query: z.string().optional() }),
      handler: async (input) => ({
        ok: true,
        query: input.query ?? null,
      }),
    });

    const friendlySdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [friendlyTool],
        },
      },
    });
    const friendlyHandler = friendlySdk.webhookHandler();

    const resolveReq = createSignedRequest(apiKey, {
      type: "resolve_agent",
      agent: "customer",
      account: null,
    });
    const resolveRes = createMockResponse();

    await friendlyHandler(resolveReq as never, resolveRes.res as never);

    expect(resolveRes.state.statusCode).toBe(200);
    expect(resolveRes.state.body).toMatchObject({
      tools: [
        {
          name: "search_products",
          description: "Search product data",
        },
      ],
    });

    const toolReq = createSignedRequest(apiKey, {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      message: {
        text: "Find products",
      },
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      tool: {
        name: "search_products",
        input: { query: "mug" },
      },
      account: null,
      user: null,
    });
    const toolRes = createMockResponse();

    await friendlyHandler(toolReq as never, toolRes.res as never);

    expect(toolRes.state.statusCode).toBe(200);
    expect(toolRes.state.body).toEqual({
      ok: true,
      query: "mug",
    });
  });

  it("rejects duplicate normalized tool keys", () => {
    expect(
      () =>
        new Konsier({
          apiKey,
          endpointUrl: "https://example.com/konsier",
          agents: {
            customer: {
              systemPrompt: "Support",
              tools: [
                Konsier.tool({
                  name: "Search Products",
                  description: "First tool",
                  input: z.object({}),
                  handler: async () => ({ ok: true }),
                }),
                Konsier.tool({
                  name: "search-products",
                  description: "Second tool",
                  input: z.object({}),
                  handler: async () => ({ ok: true }),
                }),
              ],
            },
          },
        }),
    ).toThrow('duplicate normalized tool key "search_products"');
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
      error: "Tool handlers must return a JSON object or return ctx.end(...).",
      code: "INVALID_TOOL_OUTPUT",
    });
  });

  it("serializes messages, attachments, and end controls from tool handlers", async () => {
    const richSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [
            Konsier.tool({
              name: "share_menu",
              description: "Queue an attachment and stop",
              input: z.object({}),
              handler: async (_input, ctx) => {
                expect(ctx.messages).toEqual([
                  {
                    text: "Show me tonight's specials",
                    sentAt: "2026-03-10T00:00:00.000Z",
                  },
                ]);

                ctx.attach({
                  type: "image",
                  url: "https://example.com/menu.jpg",
                  name: "menu.jpg",
                });
                return ctx.end({
                  text: "Here are tonight's specials.",
                  attachments: [
                    {
                      type: "image",
                      url: "https://example.com/specials.jpg",
                      name: "specials.jpg",
                    },
                  ],
                });
              },
            }),
          ],
        },
      },
    });
    const richHandler = richSdk.webhookHandler();

    const body = {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [
        {
          text: "Show me tonight's specials",
          sentAt: "2026-03-10T00:00:00.000Z",
        },
      ],
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      tool: {
        name: "share_menu",
        input: {},
      },
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await richHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      text: "Here are tonight's specials.",
      __konsier: {
        end: true,
        attachments: [
          {
            type: "image",
            url: "https://example.com/menu.jpg",
            name: "menu.jpg",
          },
          {
            type: "image",
            url: "https://example.com/specials.jpg",
            name: "specials.jpg",
          },
        ],
      },
    });
  });

  it("ignores ctx.end when the handler does not return it", async () => {
    const richSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [
            Konsier.tool({
              name: "continue_after_end",
              description: "Calls ctx.end without returning it",
              input: z.object({}),
              handler: async (_input, ctx) => {
                ctx.end({
                  text: "This should be ignored.",
                  attachments: [
                    {
                      type: "image",
                      url: "https://example.com/ignored.jpg",
                    },
                  ],
                });

                return {
                  ok: true,
                };
              },
            }),
          ],
        },
      },
    });
    const richHandler = richSdk.webhookHandler();

    const body = {
      type: "tool_call",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [
        {
          text: "Keep going",
          sentAt: "2026-03-10T00:00:00.000Z",
        },
      ],
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      tool: {
        name: "continue_after_end",
        input: {},
      },
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await richHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
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

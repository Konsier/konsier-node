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

  const getMenu = Konsier.operation({
    service: "app",
    resource: "operations",
    action: "get_menu",
    title: "get_menu",
    description: "Return menu data",
    input: z.object({ category: z.string().optional() }),
    output: z.record(z.string(), z.any()),
    handler: async (input) => ({
      items: [],
      category: input.category ?? null,
    }),
  });

  const lookupOrder = Konsier.operation({
    service: "app",
    resource: "operations",
    action: "lookup_order",
    title: "lookup_order",
    description: "Lookup an order",
    input: z.object({ orderId: z.string() }),
    output: z.record(z.string(), z.any()),
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
        operations: [getMenu],
      },
    },
    internal: {
      operations: [lookupOrder],
      pages: [{ name: "Orders", path: "/pages/orders" }],
    },
  });
  const handler = sdk.webhookHandler();

  it("handles agent operation_invoke requests", async () => {
    const body = {
      type: "operation_invoke",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 4,
      },
      messages: [{ text: "Show me dinner options" }],
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      operation: {
        service: "app",
        resource: "operations",
        action: "get_menu",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
      input: { category: "dinner" },
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
      ok: true,
      output: {
        items: [],
        category: "dinner",
      },
    });
  });

  it("handles internal operation_invoke requests", async () => {
    const body = {
      type: "operation_invoke",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 2,
      },
      messages: [{ text: "Where is order 123?" }],
      channel: "whatsapp",
      target: {
        type: "internal",
      },
      operation: {
        service: "app",
        resource: "operations",
        action: "lookup_order",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
      input: { orderId: "123" },
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      output: {
        orderId: "123",
        status: "ready",
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

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({
      systemPrompt: "You help customers.",
      operations: [
        {
          service: "app",
          resource: "operations",
          action: "get_menu",
          description: "Return menu data",
          inputSchema: {
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

  it("handles telegram slash_command requests", async () => {
    const commandSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
          telegram: {
            slashCommands: [
              Konsier.telegram.slashCommand({
                command: "start",
                description: "Start a new conversation",
                handler: async (ctx) => ({
                  text: `${ctx.command.name}:${ctx.command.args}:${ctx.user.id}`,
                }),
              }),
            ],
          },
        },
      },
    });
    const commandHandler = commandSdk.webhookHandler();

    const req = createSignedRequest(apiKey, {
      type: "slash_command",
      agent: "customer",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [
        {
          text: "/start fresh",
          sentAt: "2026-03-10T00:00:00.000Z",
        },
      ],
      channel: "telegram",
      command: {
        name: "start",
        args: "fresh",
        text: "/start fresh",
      },
      account: null,
      user: {
        id: 7,
        external_id: null,
        name: "Jamie",
        metadata: null,
      },
    });
    const { res, state } = createMockResponse();

    await commandHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      message: {
        text: "start:fresh:7",
      },
    });
  });

  it("returns slash command messages directly", async () => {
    const commandSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
          telegram: {
            slashCommands: [
              Konsier.telegram.slashCommand({
                command: "reset",
                description: "Reset the thread",
                handler: () => ({ text: "Fresh start!" }),
              }),
            ],
          },
        },
      },
    });
    const commandHandler = commandSdk.webhookHandler();

    const req = createSignedRequest(apiKey, {
      type: "slash_command",
      agent: "customer",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [],
      channel: "telegram",
      command: {
        name: "reset",
        args: "",
        text: "/reset",
      },
      account: null,
      user: {
        id: 7,
        external_id: null,
        name: "Jamie",
        metadata: null,
      },
    });
    const { res, state } = createMockResponse();

    await commandHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      message: {
        text: "Fresh start!",
      },
    });
  });

  it("dispatches project and agent events through event_dispatch", async () => {
    const seen: Array<Record<string, unknown>> = [];
    const eventSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      events: {
        onAccountConnected: async (ctx) => {
          seen.push({
            scope: "project",
            accountId: ctx.account?.id ?? null,
            payload: ctx.payload,
          });
        },
      },
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
          events: {
            onMessageReceived: async (ctx) => {
              seen.push({
                scope: "agent",
                payload: ctx.payload,
              });
            },
          },
        },
      },
    });
    const eventHandler = eventSdk.webhookHandler();

    const projectReq = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "project",
      },
      event: {
        name: "account.connected",
        phase: "on",
        payload: {
          connection_id: "conn_1",
        },
      },
      account: {
        id: "acct_1",
        name: "Acme",
        metadata: {},
      },
    });
    const projectRes = createMockResponse();

    await eventHandler(projectReq as never, projectRes.res as never);

    const agentReq = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "agent",
        agent: "customer",
      },
      event: {
        name: "message.received",
        phase: "on",
        payload: {
          conversation_id: 10,
          text: "hello",
        },
      },
      account: null,
    });
    const agentRes = createMockResponse();

    await eventHandler(agentReq as never, agentRes.res as never);

    expect(projectRes.state.statusCode).toBe(200);
    expect(projectRes.state.body).toEqual({ data: {} });
    expect(agentRes.state.statusCode).toBe(200);
    expect(agentRes.state.body).toEqual({ data: {} });
    expect(seen).toEqual([
      {
        scope: "project",
        accountId: "acct_1",
        payload: {
          connection_id: "conn_1",
        },
      },
      {
        scope: "agent",
        payload: {
          conversation_id: 10,
          text: "hello",
        },
      },
    ]);
  });

  it("runs before event handlers without a terminal response path", async () => {
    const eventSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
          events: {
            beforeMessageReceived: (ctx) => {
              expect(ctx.payload).toEqual({
                conversation_id: 10,
              });
              return undefined;
            },
          },
        },
      },
    });
    const eventHandler = eventSdk.webhookHandler();

    const req = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "agent",
        agent: "customer",
      },
      event: {
        name: "message.received",
        phase: "before",
        payload: {
          conversation_id: 10,
        },
      },
      account: null,
    });
    const { res, state } = createMockResponse();

    await eventHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({ data: {} });
  });

  it("returns 400 for invalid slash_command payloads", async () => {
    const req = createSignedRequest(apiKey, {
      type: "slash_command",
      agent: "customer",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [],
      channel: "telegram",
      command: {
        name: "",
        args: "",
        text: "/bad",
      },
      account: null,
      user: null,
    });
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      error: {
        code: "validation.request.invalid",
        message: "Invalid slash_command request.",
        action: "Check the request input and try again.",
      },
    });
  });

  it("returns 400 for invalid event_dispatch payloads", async () => {
    const req = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "agent",
      },
      event: {
        name: "message.received",
        phase: "before",
        payload: {},
      },
      account: null,
    });
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      error: {
        code: "validation.request.invalid",
        message: "Invalid event_dispatch request.",
        action: "Check the request input and try again.",
      },
    });
  });

  it("returns 404 for unknown slash commands on an agent", async () => {
    const commandSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
          telegram: {
            slashCommands: [
              Konsier.telegram.slashCommand({
                command: "start",
                description: "Start",
                handler: async () => ({ text: "ok" }),
              }),
            ],
          },
        },
      },
    });
    const commandHandler = commandSdk.webhookHandler();
    const req = createSignedRequest(apiKey, {
      type: "slash_command",
      agent: "customer",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [],
      channel: "telegram",
      command: {
        name: "missing",
        args: "",
        text: "/missing",
      },
      account: null,
      user: null,
    });
    const { res, state } = createMockResponse();

    await commandHandler(req as never, res as never);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      error: {
        code: "validation.request.invalid",
        message:
          'Telegram slash command "missing" is not registered for agent "customer".',
        action: "Check the request input and try again.",
      },
    });
  });

  it("returns 404 for unknown event names", async () => {
    const eventSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
        },
      },
    });
    const eventHandler = eventSdk.webhookHandler();
    const req = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "agent",
        agent: "customer",
      },
      event: {
        name: "unknown.event",
        phase: "on",
        payload: {},
      },
      account: null,
    });
    const { res, state } = createMockResponse();

    await eventHandler(req as never, res as never);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      error: {
        code: "validation.request.invalid",
        message: 'SDK event "on:unknown.event" is not registered.',
        action: "Check the request input and try again.",
      },
    });
  });

  it("returns 404 for unknown agent event targets", async () => {
    const eventSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
        },
      },
    });
    const eventHandler = eventSdk.webhookHandler();
    const req = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "agent",
        agent: "missing",
      },
      event: {
        name: "message.received",
        phase: "on",
        payload: {},
      },
      account: null,
    });
    const { res, state } = createMockResponse();

    await eventHandler(req as never, res as never);

    expect(state.statusCode).toBe(404);
    expect(state.body).toEqual({
      error: {
        code: "agent.resource.not_found",
        message: 'Agent "missing" is not registered in this SDK instance.',
        action: "Check the agent identifier and try again.",
      },
    });
  });

  it("returns 400 for malformed slash_command account or user payloads", async () => {
    const req = createSignedRequest(apiKey, {
      type: "slash_command",
      agent: "customer",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [],
      channel: "telegram",
      command: {
        name: "start",
        args: "",
        text: "/start",
      },
      account: {
        id: 1,
      },
      user: {
        id: 7,
        external_id: null,
        name: null,
        metadata: "bad",
      },
    });
    const { res, state } = createMockResponse();

    await handler(req as never, res as never);

    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({
      error: {
        code: "validation.request.invalid",
        message: "Invalid slash_command request.",
        action: "Check the request input and try again.",
      },
    });
  });

  it("normalizes non-object event handler returns to empty data", async () => {
    const eventSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [],
          events: {
            onMessageReceived: async () => "ignored" as never,
          },
        },
      },
    });
    const eventHandler = eventSdk.webhookHandler();
    const req = createSignedRequest(apiKey, {
      type: "event_dispatch",
      target: {
        scope: "agent",
        agent: "customer",
      },
      event: {
        name: "message.received",
        phase: "on",
        payload: {},
      },
      account: null,
    });
    const { res, state } = createMockResponse();

    await eventHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      data: {},
    });
  });

  it("exports attachment helper inputs as att refs and parses resolved attachments", async () => {
    const attachTool = Konsier.operation({
      service: "app",
      resource: "operations",
      action: "save_receipt",
      title: "Save Receipt",
      description: "Save an uploaded receipt",
      input: z.object({
        receipt: Konsier.attachment
          .file()
          .describe("Uploaded receipt from the conversation"),
        fallback: z
          .union([Konsier.attachment.image(), Konsier.attachment.file()])
          .optional(),
      }),
      output: z.record(z.string(), z.any()),
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
          operations: [attachTool],
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
      operations: [
        {
          service: "app",
          resource: "operations",
          action: "save_receipt",
          inputSchema: {
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
      type: "operation_invoke",
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
      operation: {
        service: "app",
        resource: "operations",
        action: "save_receipt",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
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
      account: null,
      user: null,
    });
    const toolRes = createMockResponse();

    await attachHandler(toolReq as never, toolRes.res as never);

    expect(toolRes.state.statusCode).toBe(200);
    expect(toolRes.state.body).toEqual({
      ok: true,
      output: {
        type: "file",
        receiptName: "receipt.pdf",
        fallbackType: "image",
      },
    });
  });

  it("supports arrays of typed attachment helpers", async () => {
    const attachTool = Konsier.operation({
      service: "app",
      resource: "operations",
      action: "save_gallery",
      title: "Save Gallery",
      description: "Save uploaded images",
      input: z.object({
        photos: z
          .array(Konsier.attachment.image())
          .min(1)
          .describe("Uploaded photos from the conversation"),
      }),
      output: z.record(z.string(), z.any()),
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
          operations: [attachTool],
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
      operations: [
        {
          service: "app",
          resource: "operations",
          action: "save_gallery",
          inputSchema: {
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
      type: "operation_invoke",
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
      operation: {
        service: "app",
        resource: "operations",
        action: "save_gallery",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
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
      account: null,
      user: null,
    });
    const toolRes = createMockResponse();

    await attachHandler(toolReq as never, toolRes.res as never);

    expect(toolRes.state.statusCode).toBe(200);
    expect(toolRes.state.body).toEqual({
      ok: true,
      output: {
        count: 2,
        firstType: "image",
      },
    });
  });

  it("normalizes human-readable tool names for manifest and invocation", async () => {
    const friendlyTool = Konsier.operation({
      service: "app",
      resource: "operations",
      action: "search_products",
      title: "Search Products",
      description: "Search product data",
      input: z.object({ query: z.string().optional() }),
      output: z.record(z.string(), z.any()),
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
          operations: [friendlyTool],
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
      operations: [
        {
          service: "app",
          resource: "operations",
          action: "search_products",
          description: "Search product data",
        },
      ],
    });

    const toolReq = createSignedRequest(apiKey, {
      type: "operation_invoke",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [{ text: "Find products" }],
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      operation: {
        service: "app",
        resource: "operations",
        action: "search_products",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
      input: { query: "mug" },
      account: null,
      user: null,
    });
    const toolRes = createMockResponse();

    await friendlyHandler(toolReq as never, toolRes.res as never);

    expect(toolRes.state.statusCode).toBe(200);
    expect(toolRes.state.body).toEqual({
      ok: true,
      output: {
        ok: true,
        query: "mug",
      },
    });
  });

  it("rejects duplicate operation identities", () => {
    expect(
      () =>
        new Konsier({
          apiKey,
          endpointUrl: "https://example.com/konsier",
          agents: {
            customer: {
              systemPrompt: "Support",
              operations: [
                Konsier.operation({
                  service: "app",
                  resource: "operations",
                  action: "search_products",
                  title: "Search Products",
                  description: "First tool",
                  input: z.object({}),
                  output: z.record(z.string(), z.any()),
                  handler: async () => ({ ok: true }),
                }),
                Konsier.operation({
                  service: "app",
                  resource: "operations",
                  action: "search_products",
                  title: "search-products",
                  description: "Second tool",
                  input: z.object({}),
                  output: z.record(z.string(), z.any()),
                  handler: async () => ({ ok: true }),
                }),
              ],
            },
          },
        }),
    ).toThrow(
      'agent "customer" contains duplicate operation "app.operations.search_products"',
    );
  });

  it("returns a coded validation error when operation output is invalid", async () => {
    const badSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [
            Konsier.operation({
              service: "app",
              resource: "operations",
              action: "bad_output",
              title: "bad_output",
              description: "Returns a string",
              input: z.object({}),
              output: z.record(z.string(), z.any()),
              handler: async () => "bad" as never,
            }),
          ],
        },
      },
    });
    const badHandler = badSdk.webhookHandler();

    const body = {
      type: "operation_invoke",
      conversation: {
        id: 1,
        project_id: 10,
        execution_project_id: 10,
        started_at: "2026-03-10T00:00:00.000Z",
        message_count: 1,
      },
      messages: [{}],
      channel: "whatsapp",
      target: {
        type: "agent",
        agent: "customer",
      },
      operation: {
        service: "app",
        resource: "operations",
        action: "bad_output",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
      input: {},
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await badHandler(req as never, res as never);

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({
      error: {
        code: "validation.request.invalid",
      },
    });
  });

  it("serializes validated output and queued operation attachments", async () => {
    const richSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [
            Konsier.operation({
              service: "app",
              resource: "operations",
              action: "share_menu",
              title: "share_menu",
              description: "Queue an attachment",
              input: z.object({}),
              output: z.record(z.string(), z.any()),
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
                return { shared: true };
              },
            }),
          ],
        },
      },
    });
    const richHandler = richSdk.webhookHandler();

    const body = {
      type: "operation_invoke",
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
      operation: {
        service: "app",
        resource: "operations",
        action: "share_menu",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
      input: {},
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await richHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      output: { shared: true },
      attachments: [
        {
          type: "image",
          url: "https://example.com/menu.jpg",
          name: "menu.jpg",
        },
      ],
    });
  });

  it("provides stable idempotency and unique attempt identifiers", async () => {
    const richSdk = new Konsier({
      apiKey,
      endpointUrl: "https://example.com/konsier",
      agents: {
        customer: {
          systemPrompt: "Support",
          operations: [
            Konsier.operation({
              service: "app",
              resource: "operations",
              action: "inspect_ids",
              title: "inspect_ids",
              description: "Returns operation request identifiers",
              input: z.object({}),
              output: z.record(z.string(), z.any()),
              handler: async (_input, ctx) => {
                return {
                  idempotencyKey: ctx.idempotencyKey,
                  attemptId: ctx.attemptId,
                };
              },
            }),
          ],
        },
      },
    });
    const richHandler = richSdk.webhookHandler();

    const body = {
      type: "operation_invoke",
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
      operation: {
        service: "app",
        resource: "operations",
        action: "inspect_ids",
      },
      idempotency_key: "idem_1",
      attempt_id: "attempt_1",
      input: {},
      account: null,
      user: null,
    };

    const req = createSignedRequest(apiKey, body);
    const { res, state } = createMockResponse();

    await richHandler(req as never, res as never);

    expect(state.statusCode).toBe(200);
    expect(state.body).toEqual({
      ok: true,
      output: {
        idempotencyKey: "idem_1",
        attemptId: "attempt_1",
      },
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
    expect(state.body).toEqual({
      error: {
        code: "auth.request.unauthorized",
        message: "SIGNATURE_MISMATCH",
        action: "Check your credentials and try again.",
      },
    });
  });
});

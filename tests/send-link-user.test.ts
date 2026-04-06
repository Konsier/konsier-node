import { Konsier } from "../src";
import { KonsierError } from "../src/errors";

describe("sdk resources", () => {
  const originalBaseUrl = process.env.KONSIER_API_BASE_URL;

  afterEach(() => {
    process.env.KONSIER_API_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  it("calls Cloud link endpoints", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";

    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/users/link")) {
        return new Response(
          JSON.stringify({
            user: {
              id: "1",
              externalId: "customer_1",
              metadata: { plan: "pro" },
              firstName: null,
              lastName: null,
              email: null,
              phoneNumber: null,
              displayName: "eu_1",
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (input.endsWith("/accounts/link")) {
        return new Response(
          JSON.stringify({
            account: {
              id: "2",
              name: "Tenant 1",
              logoUrl: null,
              externalId: "tenant_1",
              metadata: { region: "us" },
              connectedAt: new Date().toISOString(),
              linkedAgents: [],
              internal: { pages: [], tools: [] },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    await sdk.users.link({
      userId: "eu_1",
      externalId: "customer_1",
      metadata: { plan: "pro" },
    });

    await sdk.accounts.link({
      accountId: "acct_1",
      externalId: "tenant_1",
      metadata: { region: "us" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/users/link",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/accounts/link",
      expect.any(Object),
    );
  });

  it("calls notify and conversation cloud endpoints", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";

    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/sdk/notify")) {
        return new Response(JSON.stringify({ id: "notif_1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (input.endsWith("/sdk/conversations/list")) {
        return new Response(
          JSON.stringify({
            conversations: [
              {
                id: 42,
                project_id: 10,
                group: "support",
                agent_channel_id: 3,
                platform_conversation_id: "tg_42",
                title: "Customer support",
                metadata: null,
                mode: "automated",
                deleted_at: null,
                created_at: "2026-03-10T00:00:00.000Z",
                updated_at: "2026-03-10T00:00:00.000Z",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (input.endsWith("/sdk/conversations/42/get")) {
        return new Response(
          JSON.stringify({
            conversation: {
              id: 42,
              project_id: 10,
              group: "support",
              agent_channel_id: 3,
              platform_conversation_id: "tg_42",
              title: "Customer support",
              metadata: null,
              mode: "automated",
              deleted_at: null,
              created_at: "2026-03-10T00:00:00.000Z",
              updated_at: "2026-03-10T00:00:00.000Z",
            },
            entries: [],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (input.endsWith("/sdk/conversations/42/messages/list")) {
        return new Response(
          JSON.stringify({
            conversation: {
              id: 42,
              project_id: 10,
              group: "support",
              agent_channel_id: 3,
              platform_conversation_id: "tg_42",
              title: "Customer support",
              metadata: null,
              mode: "automated",
              deleted_at: null,
              created_at: "2026-03-10T00:00:00.000Z",
              updated_at: "2026-03-10T00:00:00.000Z",
            },
            messages: [],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (
        input.endsWith("/sdk/conversations/42/send") ||
        input.endsWith("/sdk/conversations/42/clear") ||
        input.endsWith("/sdk/conversations/42/takeover") ||
        input.endsWith("/sdk/conversations/42/resume") ||
        input.endsWith("/sdk/conversations/42")
      ) {
        return new Response(JSON.stringify({ ok: true, method: init?.method ?? "GET" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    await sdk.notify({
      title: "Human requested",
      body: "A conversation needs attention",
      navigation: { type: "none" },
    });

    const [conversation] = await sdk.conversations.list({
      userId: "7",
      agentRef: "customer",
      channel: "telegram",
      limit: 10,
      cursor: "cursor_1",
    });

    expect(conversation).toBeDefined();
    if (!conversation) {
      throw new Error("Expected a conversation handle");
    }

    await conversation.get();
    await conversation.messages.list({ before: 12, limit: 5 });
    await conversation.sendMessage({ text: "On it" });
    await conversation.clear();
    await conversation.delete();
    await conversation.takeover();
    await conversation.resume();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/sdk/notify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Human requested",
          body: "A conversation needs attention",
          navigation: { type: "none" },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/sdk/conversations/list",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: "7",
          agentRef: "customer",
          channel: "telegram",
          limit: 10,
          cursor: "cursor_1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/api/sdk/conversations/42/get",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/api/sdk/conversations/42/messages/list",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          before: 12,
          limit: 5,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3000/api/sdk/conversations/42/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "On it",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:3000/api/sdk/conversations/42/clear",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:3000/api/sdk/conversations/42",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "http://localhost:3000/api/sdk/conversations/42/takeover",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      "http://localhost:3000/api/sdk/conversations/42/resume",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  });

  it("parses 4xx cloud errors from the public envelope", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "validation.request.invalid",
              message: "Bad notify payload.",
              action: "Fix it.",
            },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    await expect(
      sdk.notify({
        title: "Broken",
        body: "Broken",
        navigation: { type: "none" },
      }),
    ).rejects.toMatchObject({
      code: "validation.request.invalid",
      message: "Bad notify payload.",
      action: "Fix it.",
      statusCode: 400,
    } satisfies Partial<KonsierError>);
  });

  it("retries 5xx responses once before succeeding", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "internal.system.unexpected",
              message: "Try again",
              action: "Retry",
            },
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "notif_1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    const result = await sdk.notify({
      title: "Retry",
      body: "Retry",
      navigation: { type: "none" },
    });

    expect(result).toEqual({ id: "notif_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces network failures with the unreachable error contract", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );

    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    await expect(
      sdk.notify({
        title: "Retry",
        body: "Retry",
        navigation: { type: "none" },
      }),
    ).rejects.toMatchObject({
      code: "client.network.unreachable",
      statusCode: 503,
    } satisfies Partial<KonsierError>);
  });

  it("surfaces request timeouts with the timeout error contract", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn((_input: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          });
        }),
      );

      const sdk = new Konsier({
        apiKey: "k_test_123",
        agents: {
          customer: {
            systemPrompt: "Support",
            tools: [],
          },
        },
      });

      const request = sdk.notify({
        title: "Timeout",
        body: "Timeout",
        navigation: { type: "none" },
      });
      const assertion = expect(request).rejects.toMatchObject({
        code: "client.network.timeout",
        statusCode: 504,
      } satisfies Partial<KonsierError>);

      await vi.advanceTimersByTimeAsync(20_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("omits undefined fields from cloud request bodies", async () => {
    process.env.KONSIER_API_BASE_URL = "http://localhost:3000/api";

    const fetchMock = vi.fn(async (_input: string) => {
      return new Response(JSON.stringify({ conversations: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const sdk = new Konsier({
      apiKey: "k_test_123",
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    await sdk.conversations.list({ userId: "7" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/sdk/conversations/list",
      expect.objectContaining({
        body: JSON.stringify({
          userId: "7",
        }),
      }),
    );
  });
});

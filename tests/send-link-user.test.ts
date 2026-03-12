import { Konsier } from "../src";

describe("sendMessage and sdk resources", () => {
  const originalBaseUrl = process.env.KONSIER_API_BASE_URL;

  afterEach(() => {
    process.env.KONSIER_API_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  it("calls Cloud message and link endpoints", async () => {
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

    await sdk.sendMessage({
      userId: "eu_1",
      text: "hello",
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

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/messages/send",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/users/link",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/api/accounts/link",
      expect.any(Object),
    );
  });
});

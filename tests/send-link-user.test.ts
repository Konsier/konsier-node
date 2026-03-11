import { Konsier } from "../src";

describe("sendMessage and linkUser", () => {
  const originalBaseUrl = process.env.KONSIER_API_BASE_URL;

  afterEach(() => {
    process.env.KONSIER_API_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  it("calls Cloud message and link endpoints", async () => {
    const fetchMock = vi.fn(async () => {
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

    await sdk.linkUser({
      userId: "eu_1",
      externalId: "customer_1",
      metadata: { plan: "pro" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/messages/send",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/end-users/link",
      expect.any(Object),
    );
  });
});

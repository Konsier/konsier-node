import { Konsier } from "../src";

describe("send and linkUser", () => {
  it("calls Cloud message and link endpoints", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const sdk = new Konsier({
      apiKey: "k_test_123",
      fetchImpl: fetchMock as unknown as typeof fetch,
      agents: {
        customer: {
          systemPrompt: "Support",
          tools: [],
        },
      },
    });

    await sdk.send({
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
      "https://api.konsier.com/api/messages/send",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.konsier.com/api/end-users/link",
      expect.any(Object),
    );
  });
});

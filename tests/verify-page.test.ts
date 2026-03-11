import {
  createKonsierSignature,
  createPageContextPayload,
} from "../src/protocol/signatures";
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

describe("verifyPage", () => {
  const apiKey = "k_test_123";
  const sdk = new Konsier({
    apiKey,
    agents: {
      customer: {
        systemPrompt: "Support",
        tools: [],
      },
    },
  });

  it("verifies signed page requests and attaches req.konsier", () => {
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

    const req: Record<string, unknown> = {
      headers: {
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
      },
    };

    const { res, state } = createMockResponse();
    let nextCalled = false;

    sdk.verifyPage()(req as never, res as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(state.statusCode).toBe(200);
    expect((req.konsier as Record<string, unknown>).pagePath).toBe(pagePath);
    expect((req.konsier as { account?: { name?: string } }).account?.name).toBe(
      "Acme",
    );
  });

  it("rejects invalid signatures", () => {
    const req = {
      headers: {
        "x-konsier-timestamp": Date.now().toString(),
        "x-konsier-signature": "sha256=bad",
        "x-konsier-page-path": "/pages/orders",
      },
    };

    const { res, state } = createMockResponse();
    let nextCalled = false;

    sdk.verifyPage()(req as never, res as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(state.statusCode).toBe(401);
  });
});

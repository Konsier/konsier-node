import { PAGE_LAUNCH_QUERY_PARAM, PAGE_SESSION_COOKIE_NAME } from "../src/constants";
import { createPageLaunchToken } from "../src/protocol/signatures";
import { Konsier } from "../src";

describe("pageRequest", () => {
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

  it("bootstraps a browser page launch and returns page context from session cookie", () => {
    const pagePath = "/pages/orders";
    const launchToken = createPageLaunchToken({
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

    const bootstrap = sdk.pageRequest({
      url: `https://example.com/pages/orders?${PAGE_LAUNCH_QUERY_PARAM}=${launchToken}`,
      headers: {},
    });
    expect(bootstrap.type).toBe("response");
    if (bootstrap.type !== "response") {
      throw new Error("Expected bootstrap response");
    }
    expect(bootstrap.status).toBe(302);

    const cookieHeader = bootstrap.headers["set-cookie"];
    expect(cookieHeader).toContain(`${PAGE_SESSION_COOKIE_NAME}=`);
    if (!cookieHeader) {
      throw new Error("Expected session cookie header");
    }

    const session = sdk.pageRequest({
      url: "https://example.com/pages/orders",
      headers: {
        cookie: cookieHeader.split(";")[0],
      },
    });
    expect(session.type).toBe("authorized");
    if (session.type !== "authorized") {
      throw new Error("Expected authorized page session");
    }

    expect(session.context.pagePath).toBe(pagePath);
    expect(session.context.account?.name).toBe("Acme");
    expect(session.context.theme).toBe("dark");
  });

  it("rejects invalid launch tokens", () => {
    const result = sdk.pageRequest({
      url: `https://example.com/pages/orders?${PAGE_LAUNCH_QUERY_PARAM}=bad`,
      headers: {},
    });

    expect(result).toMatchObject({
      type: "response",
      status: 401,
    });
  });
});

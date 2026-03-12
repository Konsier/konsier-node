import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";

import { type PageAuthContext } from "konsier";

import { readBody, responseLike, sendHtml, sendJson } from "./http";
import { pageVerifier, sdk } from "./konsier";
import { getTenantSnapshot, listTenants } from "./state";
import {
  renderHomePage,
  renderNotFoundPage,
  renderOpsPage,
  renderTenantPage,
  renderUnauthorizedPage,
  renderWorkerPage,
} from "./views/pages";

const port = Number(process.env.PORT ?? "3004");

type KonsierRequest = IncomingMessage & {
  body?: unknown;
  rawBody?: Buffer;
  konsier?: PageAuthContext;
};

type KonsierMiddleware = (
  req: KonsierRequest,
  res: ReturnType<typeof responseLike>,
  next?: (error?: unknown) => void,
) => void | Promise<void>;

const webhookHandler = sdk.webhookHandler() as KonsierMiddleware;

async function runKonsierRoute(
  req: KonsierRequest,
  res: ReturnType<typeof responseLike>,
): Promise<boolean> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (req.method !== "POST" || url.pathname !== sdk.webhookPath()) {
    return false;
  }

  const rawBody = await readBody(req);
  req.rawBody = Buffer.from(rawBody, "utf8");
  req.body = rawBody;

  await webhookHandler(req, res);

  return true;
}

function appOrigin(req: IncomingMessage): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto.trim()
      ? forwardedProto.trim().split(",")[0]
      : "http";
  return `${proto}://${req.headers.host ?? `localhost:${port}`}`;
}

async function homePageInput(origin: string, status?: string) {
  try {
    const result = await sdk.connections.start({
      redirect: `${origin}/connect/callback`,
      metadata: {},
    });

    return {
      connectUrl: result.url,
      connectStatus: status ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to generate connect link.";
    return {
      connectUrl: null,
      connectStatus: status ?? message,
    };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const response = responseLike(res);
  const konsierReq = req as KonsierRequest;

  if (await runKonsierRoute(konsierReq, response)) {
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, tenants: listTenants().length });
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    sendHtml(res, 200, renderHomePage(await homePageInput(appOrigin(req))));
    return;
  }

  if (req.method === "GET" && url.pathname === "/connect/callback") {
    const token = (url.searchParams.get("token") ?? "").trim();
    if (!token) {
      sendHtml(
        res,
        400,
        renderHomePage(
          await homePageInput(appOrigin(req), "Missing connection token."),
        ),
      );
      return;
    }

    try {
      const result = await sdk.connections.complete({ token });
      sendHtml(
        res,
        200,
        renderHomePage(
          await homePageInput(
            appOrigin(req),
            `Connected ${result.account.name}.`,
          ),
        ),
      );
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
      const status =
        code === "CONNECT_CANCELLED"
          ? "Connection cancelled."
          : code === "CONNECT_EXPIRED"
            ? "Connection expired. Start again."
            : code === "CONNECT_INVALID_TOKEN"
              ? "Invalid connection token."
              : error instanceof Error && error.message
                ? error.message
                : "Failed to complete connection.";
      sendHtml(res, 400, renderHomePage(await homePageInput(appOrigin(req), status)));
    }
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/tenants/")) {
    const accountId = decodeURIComponent(
      url.pathname.slice("/tenants/".length),
    );
    const snapshot = getTenantSnapshot({
      accountId,
      accountName: null,
    });
    sendHtml(
      res,
      200,
      renderTenantPage(snapshot.accountId, snapshot.accountName),
    );
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/workers/")) {
    const accountId = decodeURIComponent(
      url.pathname.slice("/workers/".length),
    );
    const snapshot = getTenantSnapshot({
      accountId,
      accountName: null,
    });
    sendHtml(
      res,
      200,
      renderWorkerPage(snapshot.accountId, snapshot.accountName),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/pages/ops") {
    const requestLike: {
      method?: string;
      headers: IncomingMessage["headers"];
      konsier?: PageAuthContext;
    } = {
      method: req.method,
      headers: req.headers,
    };
    let verifiedContext: PageAuthContext | null = null;

    pageVerifier(requestLike, response, () => {
      verifiedContext = requestLike.konsier ?? null;
    });

    if (res.writableEnded) {
      return;
    }

    if (!verifiedContext) {
      sendHtml(res, 401, renderUnauthorizedPage());
      return;
    }

    const pageContext: PageAuthContext = verifiedContext;

    sendHtml(
      res,
      200,
      renderOpsPage(
        pageContext.account?.id ?? "unknown",
        pageContext.account?.name ?? "Unknown Restaurant",
        pageContext,
      ),
    );
    return;
  }

  sendHtml(res, 404, renderNotFoundPage());
});

server.listen(port, async () => {
  await sdk.sync();
  console.log(`[restaurant-example] listening on http://localhost:${port}`);
});

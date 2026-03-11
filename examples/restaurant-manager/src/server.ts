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
const konsierHandler = sdk.handler();

const server = createServer(async (req, res) => {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (req.method === "POST" && url.pathname === "/konsier") {
    const rawBody = await readBody(req);
    let parsedBody: unknown = undefined;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
      parsedBody = undefined;
    }

    await konsierHandler(
      {
        method: req.method,
        headers: req.headers,
        body: parsedBody,
        rawBody,
      } as {
        method?: string;
        headers: IncomingMessage["headers"];
        body?: unknown;
        rawBody?: string;
      },
      responseLike(res),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, tenants: listTenants().length });
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    sendHtml(res, 200, renderHomePage());
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

    pageVerifier(requestLike, responseLike(res), () => {
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

server.listen(port, () => {
  console.log(`[restaurant-example] listening on http://localhost:${port}`);
});

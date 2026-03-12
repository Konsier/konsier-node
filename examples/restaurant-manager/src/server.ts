import "dotenv/config";
import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import { registerKonsier, verifyKonsierPageRequest } from "konsier/fastify";

import { sdk } from "./konsier";
import { getTenantSnapshot, listTenants, registerConnectedTenant } from "./state";
import {
  renderHomePage,
  renderOpsPage,
  renderTenantPage,
  renderUnauthorizedPage,
  renderWorkerPage,
} from "./views/pages";

type AccountRouteParams = {
  accountId: string;
};

type ConnectCallbackQuery = {
  token?: string;
};

const port = Number(process.env.PORT ?? "3004");

const app = Fastify({
  logger: false,
});

await app.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

registerKonsier(app, sdk);

app.get("/health", async () => {
  return { ok: true, tenants: listTenants().length };
});

app.get("/", async (request, reply) => {
  const connectStatus = readConnectStatus(request.url);

  reply.type("text/html; charset=utf-8");
  return renderHomePage({ connectStatus });
});

app.get("/connect", async (request, reply) => {
  try {
    const connection = await sdk.connections.start({
      redirect: resolveConnectCallbackUrl(request),
    });

    return reply.redirect(connection.url);
  } catch (error) {
    console.error("[restaurant-example.connect.start]", formatErrorForLog(error));
    return reply.redirect("/?connect_status=Connection%20failed");
  }
});

app.get<{ Querystring: ConnectCallbackQuery }>(
  "/connect/callback",
  async (request, reply) => {
    const token = request.query.token?.trim() ?? "";

    if (!token) {
      return reply.redirect("/?connect_status=Missing%20token");
    }

    try {
      const result = await sdk.connections.complete({ token });
      const tenant = registerConnectedTenant({
        accountId: result.account.id,
        accountName: result.account.name?.trim() || result.account.externalId,
      });

      return reply.redirect(
        `/?connect_status=${encodeURIComponent(`${tenant.accountName} connected`)}`,
      );
    } catch (error) {
      console.error(
        "[restaurant-example.connect.callback]",
        formatErrorForLog(error),
      );
      return reply.redirect("/?connect_status=Connection%20failed");
    }
  },
);

app.get<{ Params: AccountRouteParams }>(
  "/tenants/:accountId",
  async (request, reply) => {
    const accountId = decodeURIComponent(request.params.accountId);
    const snapshot = getTenantSnapshot({
      accountId,
      accountName: null,
    });

    reply.type("text/html; charset=utf-8");
    return renderTenantPage(snapshot.accountId, snapshot.accountName);
  },
);

app.get<{ Params: AccountRouteParams }>(
  "/workers/:accountId",
  async (request, reply) => {
    const accountId = decodeURIComponent(request.params.accountId);
    const snapshot = getTenantSnapshot({
      accountId,
      accountName: null,
    });

    reply.type("text/html; charset=utf-8");
    return renderWorkerPage(snapshot.accountId, snapshot.accountName);
  },
);

app.get("/pages/ops", async (request, reply) => {
  const pageAuth = verifyKonsierPageRequest(sdk, request);
  if (pageAuth.type === "response") {
    for (const [name, value] of Object.entries(pageAuth.headers)) {
      reply.header(name, value);
    }
    reply.code(pageAuth.status);
    if (pageAuth.status === 401) {
      reply.type("text/html; charset=utf-8");
      return renderUnauthorizedPage();
    }
    return pageAuth.body ?? null;
  }

  reply.type("text/html; charset=utf-8");
  return renderOpsPage(
    pageAuth.context.account?.id ?? "unknown",
    pageAuth.context.account?.name ?? "Unknown Restaurant",
    pageAuth.context,
  );
});

await app.listen({ port, host: "0.0.0.0" });
await sdk.sync();

console.log(`[restaurant-example] listening on http://localhost:${port}`);

function readConnectStatus(requestUrl: string): string | null {
  const url = new URL(requestUrl, resolveDefaultBaseUrl());
  const value = url.searchParams.get("connect_status")?.trim() ?? "";
  return value || null;
}

function resolveConnectCallbackUrl(request: {
  protocol?: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const publicEndpointUrl =
    process.env.KONSIER_ENDPOINT_URL?.trim() || resolveDefaultEndpointUrl();

  try {
    const endpoint = new URL(publicEndpointUrl);
    endpoint.pathname = "/connect/callback";
    endpoint.search = "";
    endpoint.hash = "";
    return endpoint.toString();
  } catch {
    const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
    const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
    const protocol = forwardedProto || request.protocol || "http";
    const host = forwardedHost || request.headers.host || `localhost:${port}`;

    return `${protocol}://${host}/connect/callback`;
  }
}

function resolveDefaultBaseUrl(): string {
  const endpointUrl =
    process.env.KONSIER_ENDPOINT_URL?.trim() || resolveDefaultEndpointUrl();

  try {
    return new URL(endpointUrl).origin;
  } catch {
    return `http://localhost:${port}`;
  }
}

function resolveDefaultEndpointUrl(): string {
  return `http://localhost:${port}/konsier`;
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function formatErrorForLog(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error };
  }

  const record = error as Error & {
    code?: unknown;
    statusCode?: unknown;
    details?: unknown;
  };

  return {
    name: record.name,
    message: record.message,
    code: record.code ?? null,
    statusCode: record.statusCode ?? null,
    details: record.details ?? null,
  };
}

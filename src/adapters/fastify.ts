import type {
  HeadersLike,
  HttpResponseLike,
  PageRequestInput,
  PageRequestResult,
} from "../types";
import type { Konsier } from "../client";
import { verifyPageRequest } from "./shared";

type FastifyRequestLike = {
  method?: string;
  headers: HeadersLike;
  body?: unknown;
  raw?: {
    method?: string;
    headers: HeadersLike;
  };
  rawBody?: string | Buffer;
};

type FastifyReplyLike = {
  status?: (statusCode: number) => FastifyReplyLike;
  code?: (statusCode: number) => FastifyReplyLike;
  header?: (name: string, value: string) => FastifyReplyLike;
  send: (payload: unknown) => unknown;
};

type FastifyRouteOptions = {
  method: string;
  url: string;
  config?: {
    rawBody?: boolean;
  };
  handler: (
    request: FastifyRequestLike,
    reply: FastifyReplyLike,
  ) => Promise<void>;
};

export function registerKonsier(
  fastify: {
    route: unknown;
  },
  konsier: Konsier,
): void {
  const route = fastify.route as (options: FastifyRouteOptions) => unknown;

  route({
    method: "POST",
    url: konsier.webhookPath(),
    config: {
      rawBody: true,
    },
    handler: async (
      request: FastifyRequestLike,
      reply: FastifyReplyLike,
    ) => {
      await konsier.webhookHandler()(
        {
          method: request.raw?.method ?? request.method,
          headers: request.raw?.headers ?? request.headers,
          body: request.body,
          rawBody: request.rawBody,
        } as never,
        createReplyAdapter(reply) as never,
      );
    },
  });
}

export function verifyKonsierPageRequest(
  konsier: Konsier,
  request:
    | Request
    | PageRequestInput
    | {
        headers: HeadersLike;
        url?: string;
        raw?: {
          url?: string;
          headers: HeadersLike;
        };
        protocol?: string;
      },
): PageRequestResult {
  if (request instanceof Request) {
    return verifyPageRequest(konsier, request);
  }

  if ("url" in request && typeof request.url === "string" && "headers" in request) {
    return verifyPageRequest(konsier, {
      url: request.url,
      headers: request.headers,
    });
  }

  const rawRequest = "raw" in request ? request.raw : undefined;
  const headers = rawRequest?.headers ?? request.headers;
  const path = rawRequest?.url ?? request.url ?? "/";
  const protocol =
    firstHeaderValue(headers["x-forwarded-proto"]) ||
    ("protocol" in request ? request.protocol : undefined) ||
    "http";
  const host = firstHeaderValue(headers["x-forwarded-host"]) ||
    firstHeaderValue(headers.host) ||
    "localhost";

  return verifyPageRequest(konsier, {
    url: `${protocol}://${host}${path}`,
    headers,
  });
}

function createReplyAdapter(reply: FastifyReplyLike): HttpResponseLike {
  return {
    status(statusCode: number) {
      if (typeof reply.status === "function") {
        reply.status(statusCode);
      } else if (typeof reply.code === "function") {
        reply.code(statusCode);
      }
      return this;
    },
    json(body: unknown) {
      if (typeof reply.header === "function") {
        reply.header("content-type", "application/json");
      }
      reply.send(body);
      return this;
    },
    send(body: unknown) {
      reply.send(body);
      return this;
    },
    end(body?: unknown) {
      reply.send(body);
      return this;
    },
    setHeader(name: string, value: string) {
      if (typeof reply.header === "function") {
        reply.header(name, value);
      }
      return this;
    },
  };
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

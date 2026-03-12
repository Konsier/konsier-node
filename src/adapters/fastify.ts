import type { HeadersLike, HttpResponseLike, PageAuthContext } from "../types";
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

export interface FastifyLike {
  route: (options: {
    method: "POST";
    url: string;
    handler: (
      request: FastifyRequestLike,
      reply: FastifyReplyLike,
    ) => unknown | Promise<unknown>;
  }) => unknown;
}

export function registerKonsier(
  fastify: FastifyLike,
  konsier: Konsier,
): void {
  fastify.route({
    method: "POST",
    url: konsier.webhookPath(),
    handler: async (request, reply) => {
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
  request: Request | Headers | HeadersLike | { headers: HeadersLike },
): PageAuthContext {
  if (request instanceof Request || request instanceof Headers) {
    return verifyPageRequest(konsier, request);
  }

  if ("headers" in request) {
    return verifyPageRequest(
      konsier,
      (request as { headers: HeadersLike }).headers,
    );
  }

  return verifyPageRequest(konsier, request);
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

import type { IncomingMessage, ServerResponse } from "node:http";

export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function responseLike(res: ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.setHeader("content-type", "application/json");
      }
      res.end(JSON.stringify(body));
      return this;
    },
    send(body: unknown) {
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        res.end(body);
      } else {
        if (!res.headersSent) {
          res.setHeader("content-type", "application/json");
        }
        res.end(JSON.stringify(body));
      }
      return this;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
      return this;
    },
    end(body?: unknown) {
      if (typeof body === "undefined") {
        res.end();
        return this;
      }

      if (typeof body === "string" || Buffer.isBuffer(body)) {
        res.end(body);
      } else {
        res.end(JSON.stringify(body));
      }
      return this;
    },
  };
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function sendHtml(
  res: ServerResponse,
  statusCode: number,
  body: string,
): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(body);
}

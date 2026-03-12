import { KonsierError } from "../errors";
import type { HeadersLike, HttpResponseLike, PageAuthContext } from "../types";
import type { Konsier } from "../client";

export function headersToObject(
  headers: Headers | HeadersLike,
): HeadersLike {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const normalized: HeadersLike = {};
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  return headers;
}

export async function handleFetchWebhook(
  konsier: Konsier,
  request: Request,
): Promise<Response> {
  const rawBody = await request.text();
  const recorder = createResponseRecorder();

  await konsier.webhookHandler()(
    {
      method: request.method,
      headers: headersToObject(request.headers),
      body: rawBody,
      rawBody,
    } as never,
    recorder as never,
  );

  return recorder.toResponse();
}

export function verifyPageRequest(
  konsier: Konsier,
  input: Request | Headers | HeadersLike,
): PageAuthContext {
  const req: { headers: HeadersLike; konsier?: PageAuthContext } = {
    headers:
      input instanceof Request
        ? headersToObject(input.headers)
        : headersToObject(input),
  };
  const recorder = createResponseRecorder();
  let context: PageAuthContext | null = null;

  konsier.verifyPage()(req as never, recorder as never, () => {
    context = req.konsier ?? null;
  });

  if (context) {
    return context;
  }

  const message =
    typeof recorder.body === "string" && recorder.body
      ? recorder.body
      : "Unauthorized";

  throw new KonsierError({
    code: "UNAUTHORIZED",
    message,
    statusCode: recorder.statusCode,
  });
}

function createResponseRecorder(): HttpResponseLike & {
  statusCode: number;
  body: BodyInit | null;
  headers: Headers;
  toResponse: () => Response;
} {
  return {
    statusCode: 200,
    body: null,
    headers: new Headers(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.headers.set("content-type", "application/json");
      this.body = JSON.stringify(payload);
      return this;
    },
    send(payload: unknown) {
      if (typeof payload === "string" || payload instanceof Uint8Array) {
        this.body = payload;
        return this;
      }

      this.headers.set("content-type", "application/json");
      this.body = JSON.stringify(payload);
      return this;
    },
    end(payload?: unknown) {
      if (typeof payload === "undefined") {
        this.body = null;
        return this;
      }

      if (typeof payload === "string" || payload instanceof Uint8Array) {
        this.body = payload;
        return this;
      }

      this.body = JSON.stringify(payload);
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    },
    toResponse() {
      return new Response(this.body, {
        status: this.statusCode,
        headers: this.headers,
      });
    },
  };
}

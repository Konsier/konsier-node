import type {
  HeadersLike,
  HttpResponseLike,
  PageRequestInput,
  PageRequestResult,
} from "../types";
import type { Konsier } from "../client";

type ResponseBody = string | Uint8Array | null;

export function headersToObject(
  headers: Headers | HeadersLike,
): HeadersLike {
  const normalized: HeadersLike = {};

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = value;
  }

  return normalized;
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
  input: Request | PageRequestInput,
): PageRequestResult {
  if (input instanceof Request) {
    return konsier.pageRequest({
      url: input.url,
      headers: headersToObject(input.headers),
    });
  }

  return konsier.pageRequest({
    url: input.url,
    headers: headersToObject(input.headers),
  });
}

export function pageResultToResponse(result: Extract<PageRequestResult, {
  type: "response";
}>): Response {
  return new Response(result.body ?? null, {
    status: result.status,
    headers: result.headers,
  });
}

function createResponseRecorder(): HttpResponseLike & {
  statusCode: number;
  body: ResponseBody;
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

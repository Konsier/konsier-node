import { ERROR_CODES, createPublicApiError } from "../contracts";
import { KonsierError } from "../errors";
import type {
  AccountGetInput,
  AccountLinkInput,
  ConnectionCompleteInput,
  ConnectionCompleteResult,
  ConnectionStartInput,
  ConnectionStartResult,
  SdkAccount,
  SdkUser,
  UserGetInput,
  UserLinkInput,
} from "../types";
import type { CloudApiClient } from "./http";

function requireNonEmptyString(
  value: string | undefined,
  input: { code: typeof ERROR_CODES.validation.request.invalid; message: string },
): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    const publicError = createPublicApiError(input);
    throw new KonsierError({
      code: publicError.code,
      message: publicError.message,
      action: publicError.action,
      statusCode: 400,
    });
  }
  return normalized;
}

function normalizeSdkUser(raw: unknown): SdkUser {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.client.response.invalid,
        message: "users.get() returned an invalid payload.",
      }),
      statusCode: 500,
      details: raw,
    });
  }

  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.client.response.invalid,
        message: "users.get() returned an invalid payload.",
      }),
      statusCode: 500,
      details: raw,
    });
  }

  return {
    id,
    externalId:
      typeof record.externalId === "string" ? record.externalId : null,
    metadata:
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {},
    firstName: typeof record.firstName === "string" ? record.firstName : null,
    lastName: typeof record.lastName === "string" ? record.lastName : null,
    email: typeof record.email === "string" ? record.email : null,
    phoneNumber:
      typeof record.phoneNumber === "string" ? record.phoneNumber : null,
    displayName:
      typeof record.displayName === "string" ? record.displayName : null,
  };
}

function normalizeSdkAccount(raw: unknown): SdkAccount {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.client.response.invalid,
        message: "accounts API returned an invalid payload.",
      }),
      statusCode: 500,
      details: raw,
    });
  }

  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!id || !name) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.client.response.invalid,
        message: "accounts API returned an invalid payload.",
      }),
      statusCode: 500,
      details: raw,
    });
  }

  const internalRecord =
    record.internal && typeof record.internal === "object" && !Array.isArray(record.internal)
      ? (record.internal as Record<string, unknown>)
      : null;

  return {
    id,
    name,
    logoUrl: typeof record.logoUrl === "string" ? record.logoUrl : null,
    externalId:
      typeof record.externalId === "string" ? record.externalId : null,
    metadata:
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {},
    connectedAt:
      typeof record.connectedAt === "string" ? record.connectedAt : "",
    linkedAgents: Array.isArray(record.linkedAgents)
      ? record.linkedAgents
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }
            const entry = item as Record<string, unknown>;
            const ref = typeof entry.ref === "string" ? entry.ref.trim() : "";
            const agentId =
              typeof entry.agentId === "string" ? entry.agentId.trim() : "";
            const agentName =
              typeof entry.agentName === "string" ? entry.agentName.trim() : "";
            if (!ref || !agentId || !agentName) {
              return null;
            }
            return { ref, agentId, agentName };
          })
          .filter(
            (
              item,
            ): item is { ref: string; agentId: string; agentName: string } =>
              item !== null,
          )
      : [],
    internal: {
      pages: Array.isArray(internalRecord?.pages)
        ? internalRecord.pages.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      tools: Array.isArray(internalRecord?.tools)
        ? internalRecord.tools.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    },
  };
}

export async function getUser(
  client: CloudApiClient,
  input: UserGetInput,
): Promise<SdkUser> {
  const userId = requireNonEmptyString(input.userId, {
    code: ERROR_CODES.validation.request.invalid,
    message: "users.get() requires userId.",
  });
  const payload = await client.get(`/users/${encodeURIComponent(userId)}`);
  return normalizeSdkUser(payload.user);
}

export async function linkUser(
  client: CloudApiClient,
  input: UserLinkInput,
): Promise<SdkUser> {
  const userId = requireNonEmptyString(input.userId, {
    code: ERROR_CODES.validation.request.invalid,
    message: "users.link() requires userId.",
  });
  const externalId = requireNonEmptyString(input.externalId, {
    code: ERROR_CODES.validation.request.invalid,
    message: "users.link() requires externalId.",
  });
  const payload = await client.post("/users/link", {
    userId,
    externalId,
    metadata: input.metadata ?? {},
  });
  return normalizeSdkUser(payload.user);
}

export async function listAccounts(
  client: CloudApiClient,
): Promise<SdkAccount[]> {
  const payload = await client.get("/accounts");
  const items = Array.isArray(payload.accounts) ? payload.accounts : [];
  return items.map((item) => normalizeSdkAccount(item));
}

export async function getAccount(
  client: CloudApiClient,
  input: AccountGetInput,
): Promise<SdkAccount> {
  const accountId = requireNonEmptyString(input.accountId, {
    code: ERROR_CODES.validation.request.invalid,
    message: "accounts.get() requires accountId.",
  });
  const payload = await client.get(`/accounts/${encodeURIComponent(accountId)}`);
  return normalizeSdkAccount(payload.account);
}

export async function linkAccount(
  client: CloudApiClient,
  input: AccountLinkInput,
): Promise<SdkAccount> {
  const accountId = requireNonEmptyString(input.accountId, {
    code: ERROR_CODES.validation.request.invalid,
    message: "accounts.link() requires accountId.",
  });
  const externalId = requireNonEmptyString(input.externalId, {
    code: ERROR_CODES.validation.request.invalid,
    message: "accounts.link() requires externalId.",
  });
  const payload = await client.post("/accounts/link", {
    accountId,
    externalId,
    metadata: input.metadata ?? {},
  });
  return normalizeSdkAccount(payload.account);
}

export async function startConnection(
  client: CloudApiClient,
  input: ConnectionStartInput,
): Promise<ConnectionStartResult> {
  const redirect = requireNonEmptyString(input.redirect, {
    code: ERROR_CODES.validation.request.invalid,
    message: "connections.start() requires redirect.",
  });
  const payload = await client.post("/connections/start", {
    redirect,
    metadata: input.metadata ?? {},
  });
  const url = typeof payload.url === "string" ? payload.url : "";
  const expiresAt =
    typeof payload.expiresAt === "string" ? payload.expiresAt : "";
  if (!url || !expiresAt) {
    throw new KonsierError({
      ...createPublicApiError({
        code: ERROR_CODES.client.response.invalid,
        message: "connections.start() returned an invalid payload.",
      }),
      statusCode: 500,
      details: payload,
    });
  }
  return { url, expiresAt };
}

export async function completeConnection(
  client: CloudApiClient,
  input: ConnectionCompleteInput,
): Promise<ConnectionCompleteResult> {
  const token = requireNonEmptyString(input.token, {
    code: ERROR_CODES.validation.request.invalid,
    message: "connections.complete() requires token.",
  });
  const payload = await client.post("/connections/complete", {
    token,
  });
  return {
    account: normalizeSdkAccount(payload.account),
  };
}

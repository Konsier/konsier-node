import { KonsierError } from "../errors";
import type { LinkUserInput } from "../types";
import type { CloudApiClient } from "./http";

export async function linkUser(
  client: CloudApiClient,
  input: LinkUserInput,
): Promise<void> {
  if (!input.userId?.trim()) {
    throw new KonsierError({
      code: "INVALID_LINK_USER_INPUT",
      message: "linkUser() requires userId.",
      statusCode: 400,
    });
  }

  if (!input.externalId?.trim()) {
    throw new KonsierError({
      code: "INVALID_LINK_USER_INPUT",
      message: "linkUser() requires externalId.",
      statusCode: 400,
    });
  }

  await client.post("/end-users/link", {
    userId: input.userId,
    externalId: input.externalId,
    metadata: input.metadata ?? {},
  });
}

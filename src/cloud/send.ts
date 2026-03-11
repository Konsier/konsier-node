import { KonsierError } from "../errors";
import type { SendInput } from "../types";
import type { CloudApiClient } from "./http";

export async function sendMessage(
  client: CloudApiClient,
  input: SendInput,
): Promise<void> {
  if (!input.userId && !input.conversationId) {
    throw new KonsierError({
      code: "INVALID_SEND_INPUT",
      message: "send() requires either userId or conversationId.",
      statusCode: 400,
    });
  }

  if (!input.text && !input.html && (!input.attachments || input.attachments.length === 0)) {
    throw new KonsierError({
      code: "INVALID_SEND_INPUT",
      message: "send() requires text, html, or at least one attachment.",
      statusCode: 400,
    });
  }

  await client.post("/messages/send", {
    userId: input.userId,
    conversationId:
      input.conversationId === undefined
        ? undefined
        : String(input.conversationId),
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}

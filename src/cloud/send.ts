import { KonsierError } from "../errors";
import type {
  AttachInput,
  SendInput,
} from "../types";
import type { CloudApiClient } from "./http";

type SerializedAttachInput =
  | {
      type: "image" | "video" | "audio" | "file";
      url: string;
      name?: string;
      mimeType?: string;
      caption?: string;
    }
  | {
      type: "image" | "video" | "audio" | "file";
      bufferBase64: string;
      name?: string;
      mimeType?: string;
      caption?: string;
    }
  | {
      fileId: string;
    }
  | {
      type: "location";
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };

function serializeAttachments(
  attachments: AttachInput[] | undefined,
): SerializedAttachInput[] | undefined {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  return attachments.map((attachment) => {
    if ("fileId" in attachment) {
      return { fileId: attachment.fileId };
    }

    if (attachment.type === "location") {
      return {
        type: "location",
        latitude: attachment.latitude,
        longitude: attachment.longitude,
        ...(attachment.name ? { name: attachment.name } : {}),
        ...(attachment.address ? { address: attachment.address } : {}),
      };
    }

    if ("buffer" in attachment) {
      return {
        type: attachment.type,
        bufferBase64: attachment.buffer.toString("base64"),
        ...(attachment.name ? { name: attachment.name } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.caption ? { caption: attachment.caption } : {}),
      };
    }

    return {
      type: attachment.type,
      url: attachment.url,
      ...(attachment.name ? { name: attachment.name } : {}),
      ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
      ...(attachment.caption ? { caption: attachment.caption } : {}),
    };
  });
}

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

  if (
    !input.text &&
    (!input.attachments || input.attachments.length === 0)
  ) {
    throw new KonsierError({
      code: "INVALID_SEND_INPUT",
      message: "send() requires text or at least one attachment.",
      statusCode: 400,
    });
  }

  const attachments = serializeAttachments(input.attachments);

  await client.post("/messages/send", {
    userId: input.userId,
    conversationId:
      input.conversationId === undefined
        ? undefined
        : String(input.conversationId),
    text: input.text,
    attachments,
    quickReplies: input.quickReplies,
  });
}

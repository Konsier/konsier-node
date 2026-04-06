import type { CloudApiClient } from "./cloud/http";
import type { NotificationInput } from "./types";

export async function notify(
  client: CloudApiClient,
  input: NotificationInput,
): Promise<Record<string, unknown>> {
  return client.post("/sdk/notify", {
    kind: input.kind,
    title: input.title,
    body: input.body,
    navigation: input.navigation,
  });
}

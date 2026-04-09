# Events

Konsier supports project-level and agent-level event handlers.

## Project Events

```ts
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl: "https://your-app.example.com/konsier",
  events: {
    beforeAccountConnect: async (ctx) => {
      if (!isAllowed(ctx.payload.user_id)) {
        return ctx.end({ text: "Account linking is not allowed." });
      }
    },
    onAccountConnected: async (ctx) => {
      await auditLog("account.connected", ctx.payload);
    },
  },
});
```

Supported project handlers:

- `beforeAccountConnect`
- `onAccountConnected`
- `onAccountDisconnected`

Project payload shapes:

```ts
type ConnectedAppConnectEventPayload = {
  project_id: number;
  token: string;
  agent_mappings: Array<{
    platform_ref: string;
    client_agent_id?: number | null;
    create_new_name?: string | null;
  }>;
  user_id: string;
};

type ConnectedAppConnectedEventPayload = {
  project_id: number;
  timestamp: string;
};

type ConnectedAppDisconnectedEventPayload = {
  project_id: number;
  connection_id: number;
  timestamp: string;
};
```

## Agent Events

```ts
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl: "https://your-app.example.com/konsier",
  agents: {
    support_bot: {
      systemPrompt: "Handle support requests.",
      tools: [lookupTicketTool],
      events: {
        beforeMessageReceived: async (ctx) => {
          if (ctx.payload.mode === "manual") {
            return ctx.end({ text: "A human is already handling this chat." });
          }
        },
        onHumanRequested: async (ctx) => {
          await pageOps(ctx.payload.conversation_id);
        },
      },
    },
  },
});
```

Supported agent handlers:

- `beforeConversationCreated`
- `onConversationCreated`
- `beforeMessageReceived`
- `onMessageReceived`
- `onConversationCleared`
- `onConversationDeleted`
- `onConversationTakeover`
- `onConversationResume`
- `onHumanRequested`

Agent payload shapes:

```ts
type ConversationCreatedEventPayload = {
  project_id: number;
  conversation_id: number;
  group: string;
  title: string | null;
  timestamp: string;
};

type ConversationMessageReceivedEventPayload = {
  project_id: number;
  conversation_id: number;
  group: string;
  mode: "automated" | "manual";
  channel: string;
  transcript: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  latest_message: {
    role: "user" | "assistant" | null;
    content: string | null;
  };
  execution_mode: "simulate" | "live";
  agent_channel_id: number | null;
  platform_conversation_id: string | null;
  channel_user_id: string | null;
  timestamp: string;
};

type ConversationClearedEventPayload = {
  project_id: number;
  conversation_id: number;
  group: string;
  deleted_count: number;
  timestamp: string;
};

type ConversationDeletedEventPayload = {
  project_id: number;
  conversation_id: number;
  group: string;
  timestamp: string;
};

type ConversationTakeoverEventPayload = {
  project_id: number;
  conversation_id: number;
  group: string;
  timestamp: string;
};

type ConversationResumeEventPayload = {
  project_id: number;
  conversation_id: number;
  group: string;
  timestamp: string;
};

type HumanSupportRequestedEventPayload = {
  project_id: number;
  conversation_id: number;
  timestamp: string;
};
```

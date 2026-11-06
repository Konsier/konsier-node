# Telegram

Konsier supports Telegram slash commands on a per-agent basis.

## Registering Slash Commands

```ts
const konsier = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl: "https://your-app.example.com/konsier",
  agents: {
    support_bot: {
      systemPrompt: "Handle support conversations.",
      operations: [lookupTicketOperation],
      telegram: {
        slashCommands: [
          Konsier.telegram.slashCommand({
            command: "status",
            description: "Show account status",
            handler: async (ctx) => {
              return {
                text: `Signed in as ${ctx.user.displayName ?? ctx.user.id}.`,
              };
            },
          }),
        ],
      },
    },
  },
});
```

Commands are normalized to lowercase.

## Slash Command Context

```ts
type TelegramSlashCommandContext = {
  channel: "telegram";
  command: {
    name: string;
    args: string;
    text: string;
  };
  user: EndUser;
  conversation: Conversation;
  messages: OperationMessage[];
  account: Account | null;
};
```

Return a `SendMessage` when the slash command should produce a user-facing response.

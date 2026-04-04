import type { SkillTemplate } from "../../types";

export const konsierAgentsSkill: SkillTemplate = {
  name: "konsier-agents",
  description: "How to define agents, dynamic resolvers, and event hooks.",
  body: `# Konsier Agents

Agents live under \`agents: { ... }\`.

## Static Agents

Use a plain object when behavior is mostly fixed:

- \`name\`
- \`description\`
- \`systemPrompt\`
- \`tools\`
- optional \`events\`

## Dynamic Agents

Use \`async (ctx) => ({ ... })\` when behavior depends on the linked account.

The dynamic context includes \`account\`.

## System Prompt Order

Keep instructions in this order:

1. Role and objective
2. Success criteria
3. Tool policy
4. Edge cases
5. Tone and formatting

## Events

Use agent events like \`onConversationStart\` and \`onConversationEnd\` for lifecycle hooks.`,
};

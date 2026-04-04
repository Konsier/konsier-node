import type { SkillTemplate } from "../../types";

export const konsierMessagingSkill: SkillTemplate = {
  name: "konsier-messaging",
  description: "Proactive messaging, ending flows, and quick replies.",
  body: `# Konsier Messaging

Use \`konsier.sendMessage()\` for proactive outbound messages.

Use \`ctx.end()\` when the tool should control the final user-facing response.

Quick replies use:

\`\`\`ts
{ label: "Yes", value: "yes" }
\`\`\`

Prefer \`ctx.end()\` when:

- the tool is returning the final message
- the tool is offering next-step choices
- the conversation should clearly conclude`,
};

import type { SkillTemplate } from "../../types";

export const konsierMessagingSkill: SkillTemplate = {
  name: "konsier-messaging",
  description: "Proactive messaging and quick replies.",
  body: `# Konsier Messaging

Use \`konsier.sendMessage()\` for proactive outbound messages.

Quick replies use:

\`\`\`ts
{ label: "Yes", value: "yes" }
\`\`\`

Operation handlers return structured data. The agent's plain final text is the
user-facing reply; there is no operation-level terminal signal.`,
};

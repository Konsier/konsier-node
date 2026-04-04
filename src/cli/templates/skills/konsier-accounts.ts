import type { SkillTemplate } from "../../types";

export const konsierAccountsSkill: SkillTemplate = {
  name: "konsier-accounts",
  description: "Accounts, linked connections, and multi-tenant agent behavior.",
  body: `# Konsier Accounts

Use:

- \`konsier.accounts.list()\`
- \`konsier.accounts.get({ accountId })\`
- \`konsier.accounts.link({ accountId, externalId, metadata })\`

Connection flow:

- \`konsier.connections.start({ redirect, metadata })\`
- \`konsier.connections.complete({ token })\`

Dynamic agents can read \`ctx.account\` and tailor behavior per account.`,
};

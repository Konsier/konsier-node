import type { SkillTemplate } from "../../types";

export const konsierUsersSkill: SkillTemplate = {
  name: "konsier-users",
  description: "User lookup and external identity linking.",
  body: `# Konsier Users

Use:

- \`konsier.users.get({ userId })\`
- \`konsier.users.link({ userId, externalId, metadata })\`

Use this when you need to associate a Konsier conversation user with your own application user.`,
};

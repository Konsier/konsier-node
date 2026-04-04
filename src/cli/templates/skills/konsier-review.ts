import type { SkillTemplate } from "../../types";

export const konsierReviewSkill: SkillTemplate = {
  name: "konsier-review",
  description: "A final self-review checklist for generated Konsier code.",
  body: `# Konsier Review

Before finishing, verify:

- tool names are distinct and descriptive
- tools do not overlap
- no rare one-off tools were created
- there are no hidden sequencing dependencies
- the system prompt is structured by priority
- durable policy lives in prompts, dynamic guidance in tool outputs
- each agent has a manageable tool count
- Zod fields use \`.describe()\`
- handlers return objects or \`ctx.end()\`
- failure cases throw errors
- UI-heavy flows use links instead of fragmented tools`,
};

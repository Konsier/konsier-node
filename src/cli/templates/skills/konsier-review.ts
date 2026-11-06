import type { SkillTemplate } from "../../types";

export const konsierReviewSkill: SkillTemplate = {
  name: "konsier-review",
  description: "A final self-review checklist for generated Konsier code.",
  body: `# Konsier Review

Before finishing, verify:

- operation identities and titles are distinct and descriptive
- operations do not overlap
- no rare one-off operations were created
- there are no hidden sequencing dependencies
- the system prompt is structured by priority
- durable policy lives in prompts, dynamic guidance in operation outputs
- each agent has a manageable operation count
- Zod fields use \`.describe()\`
- handlers return objects matching their output schemas
- failure cases throw errors
- UI-heavy flows use links instead of fragmented operations`,
};

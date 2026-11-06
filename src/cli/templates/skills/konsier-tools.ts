import type { SkillTemplate } from "../../types";

export const konsierToolsSkill: SkillTemplate = {
  name: "konsier-tools",
  description: "Operation creation rules, schemas, approvals, and handler outputs.",
  body: `# Konsier Operations

Create operations with \`Konsier.operation({ ... })\`. Every operation has lowercase
\`service\`, \`resource\`, and \`action\` identifiers, a title, a description, input
and output Zod schemas, and an optional approval policy.

## Input

- \`input\` must be a Zod schema
- add \`.describe()\` on every meaningful field

## Handler

- signature: \`async (input, ctx)\`
- return a plain JSON object matching the output schema
- do not return arrays, primitives, or \`null\`

## Context

Useful fields on \`ctx\`:

- \`ctx.channel\`
- \`ctx.agent\`
- \`ctx.user\`
- \`ctx.account\`
- \`ctx.conversation\`
- \`ctx.messages\`
- \`ctx.idempotencyKey\`
- \`ctx.attemptId\`

## Errors

Throw normal \`Error\` instances for failure cases. The SDK converts them into proper cloud errors.`,
};

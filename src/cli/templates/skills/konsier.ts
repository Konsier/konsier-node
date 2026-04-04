import type { SkillTemplate } from "../../types";

export const konsierSkill: SkillTemplate = {
  name: "konsier",
  description: "Project setup, env vars, adapters, and sync behavior for Konsier apps.",
  body: `# Konsier

Use the Konsier SDK to expose agents and internal surfaces to Konsier Cloud.

## Core Setup

- Import \`Konsier\` from \`konsier\`
- Import \`z\` from \`zod\`
- Configure the SDK with:
  - \`apiKey\`
  - \`endpointUrl\`
  - \`agents\`
  - optional \`internal\`
  - optional \`debug\`

## Environment

- \`KONSIER_API_KEY\`
- \`KONSIER_ENDPOINT_URL\`
- \`PORT\`

## Sync

Call \`await konsier.sync()\` on startup so the cloud picks up the latest manifest.

## Adapter Patterns

- Express: \`serveKonsier(app, konsier)\`
- Hono: \`serveKonsier(app, konsier)\`
- Next.js: \`export const POST = createKonsierRoute(konsier)\`
- Fastify: \`registerKonsier(app, konsier)\`

## Endpoint URL

- \`endpointUrl\` must be a public http(s) URL
- it is usually your app URL plus \`/konsier\`
- do not include query params or fragments`,
};

import type { SkillTemplate } from "../../types";

export const konsierTestingSkill: SkillTemplate = {
  name: "konsier-testing",
  description: "How to test a Konsier app locally and through real channels.",
  body: `# Konsier Testing

## Local Run

- start your app with \`npm run dev\`
- expose it with a tunnel if you are testing real channels
- set \`KONSIER_ENDPOINT_URL\` to the public webhook URL

## Test Paths

- your real channel, for example Telegram
- the Konsier dashboard test chat

## Debugging

- enable \`debug: true\` on the SDK
- inspect server logs when handlers throw
- verify the API key and endpoint URL match the right project`,
};

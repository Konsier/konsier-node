import type { CodingAgent, SkillTemplate } from "../../types";

function formatSharedSkill(skill: SkillTemplate): string {
  return `---
name: ${skill.name}
description: ${skill.description}
---

${skill.body}
`;
}

export function formatSkillForAgent(
  skill: SkillTemplate,
  agent: CodingAgent,
): { relativePath: string; content: string } {
  if (agent === "opencode" || agent === "codex") {
    return {
      relativePath: `.agents/skills/${skill.name}/SKILL.md`,
      content: formatSharedSkill(skill),
    };
  }

  if (agent === "claude") {
    return {
      relativePath: `.claude/skills/${skill.name}/SKILL.md`,
      content: formatSharedSkill(skill),
    };
  }

  if (agent === "cursor") {
    return {
      relativePath: `.cursor/rules/${skill.name}.mdc`,
      content: `---
description: ${skill.description}
alwaysApply: false
---

${skill.body}
`,
    };
  }

  if (agent === "windsurf") {
    return {
      relativePath: `.windsurf/rules/${skill.name}.md`,
      content: `---
trigger: model_decision
description: ${skill.description}
---

${skill.body}
`,
    };
  }

  return {
    relativePath: `.clinerules/${skill.name}.md`,
    content: `${skill.body}
`,
  };
}

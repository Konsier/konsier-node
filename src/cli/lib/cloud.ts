import { CloudApiClient, resolveCloudBaseUrl } from "../../cloud/http";

export type ProjectContext = {
  id: number;
  name: string;
};

export type AgentContext = {
  id: number;
  name: string;
};

function toRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createCloudClient(apiKey: string): CloudApiClient {
  return new CloudApiClient({
    apiKey,
    baseUrl: resolveCloudBaseUrl(),
  });
}

export function parseProjectResponse(
  payload: Record<string, unknown>,
): ProjectContext {
  const project = toRecord(payload.project);
  const id = typeof project?.id === "number" ? project.id : Number(project?.id);
  const name = typeof project?.name === "string" ? project.name.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !name) {
    throw new Error("Konsier returned an invalid project payload.");
  }
  return { id, name };
}

export function parseAgentResponse(
  payload: Record<string, unknown>,
): AgentContext {
  const agent = toRecord(payload.agent);
  const id = typeof agent?.id === "number" ? agent.id : Number(agent?.id);
  const name = typeof agent?.name === "string" ? agent.name.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !name) {
    throw new Error("Konsier returned an invalid agent payload.");
  }
  return { id, name };
}

export function parseTelegramDeployment(
  payload: Record<string, unknown>,
): string {
  const deployment = toRecord(payload.deployment);
  const botUsername =
    typeof deployment?.bot_username === "string"
      ? deployment.bot_username.trim()
      : "";
  if (!botUsername) {
    throw new Error("Konsier returned an invalid Telegram deployment payload.");
  }
  return botUsername;
}

export async function validateProject(
  client: CloudApiClient,
): Promise<ProjectContext> {
  const payload = await client.get("/projects/me");
  return parseProjectResponse(payload);
}

export async function ensureProjectAgent(
  client: CloudApiClient,
  projectId: number,
): Promise<AgentContext> {
  try {
    const payload = await client.post(`/projects/${projectId}/agents`, {
      name: "Primary Agent",
    });
    return parseAgentResponse(payload);
  } catch {
    const payload = await client.get(`/projects/${projectId}/agents`);
    const agents = Array.isArray(payload.agents) ? payload.agents : [];
    const existing = agents.find((entry) => {
      const record = toRecord(entry);
      return (
        typeof record?.name === "string" &&
        record.name.trim() === "Primary Agent"
      );
    });
    if (!existing) {
      throw new Error(
        "Konsier could not prepare the default agent for Telegram setup.",
      );
    }
    return parseAgentResponse({ agent: existing });
  }
}

export async function connectTelegram(
  client: CloudApiClient,
  input: {
    projectId: number;
    agentId: number;
    token: string;
  },
): Promise<string> {
  const payload = await client.post(
    `/channels/telegram/project/${input.projectId}`,
    {
      token: input.token,
      agent_key: String(input.agentId),
    },
  );
  return parseTelegramDeployment(payload);
}

import type { PageAuthContext } from "konsier";

import { listTasks, taskStats } from "../state";
import { renderTemplate, renderTemplates } from "./template";

interface DashboardInput {
  heading: string;
  context?: PageAuthContext | null;
}

export function renderDashboard(input: DashboardInput): string {
  const tasks = listTasks();
  const stats = taskStats();
  const contextCard = input.context
    ? renderTemplate("partials/context-card.html", {
        projectId: escapeHtml(input.context.projectId ?? "none"),
        pagePath: escapeHtml(input.context.pagePath),
        accountName: escapeHtml(input.context.account?.name ?? "none"),
        userName: escapeHtml(
          input.context.user.name ?? input.context.user.email ?? "unknown",
        ),
      })
    : "";

  const taskItems = renderTemplates(
    "partials/task-item.html",
    tasks.map((task) => ({
      taskStateClass: task.done ? "done" : "",
      title: escapeHtml(task.title),
      priority: escapeHtml(task.priority),
      encodedTaskId: encodeURIComponent(task.id),
      toggleLabel: task.done ? "Reopen" : "Complete",
    })),
  );

  return renderTemplate("dashboard.html", {
    pageTitle: "Todo Example",
    heading: escapeHtml(input.heading),
    contextCard,
    taskItems,
    totalTasks: String(stats.total),
    openTasks: String(stats.open),
    doneTasks: String(stats.done),
    highPriorityTasks: String(stats.highPriority),
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

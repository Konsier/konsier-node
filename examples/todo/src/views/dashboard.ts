import type { PageContext } from "konsier";

import { listTasks, taskStats } from "../state";
import { renderTemplate, renderTemplates } from "./template";

interface DashboardInput {
  heading: string;
  context?: PageContext | null;
}

export function renderDashboard(input: DashboardInput): string {
  const tasks = listTasks();
  const stats = taskStats();
  const contextCard = input.context
    ? renderTemplate("partials/context-card.html", {
        projectId: escapeHtml(input.context.projectId ?? "none"),
        pagePath: escapeHtml(input.context.pagePath),
        accountName: escapeHtml(input.context.account?.name ?? "none"),
        theme: escapeHtml(input.context.theme),
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
      attachmentBadge:
        task.attachments.length > 0
          ? `<span class="badge badge-neutral">${task.attachments.length} attachment${
              task.attachments.length === 1 ? "" : "s"
            }</span>`
          : "",
      attachmentList:
        task.attachments.length > 0
          ? `<div class="attachment-list">${task.attachments
              .map((attachment) => renderAttachment(attachment))
              .join("")}</div>`
          : "",
      encodedTaskId: encodeURIComponent(task.id),
      toggleLabel: task.done ? "Reopen" : "Complete",
    })),
  );

  return renderTemplate("dashboard.html", {
    pageTitle: "Todo Example",
    heading: escapeHtml(input.heading),
    themeClass: input.context?.theme === "dark" ? "theme-dark" : "theme-light",
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

function renderAttachment(taskAttachment: {
  id: string;
  type: string;
  name?: string;
  caption?: string;
  url?: string;
  filename?: string;
  originalName?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}): string {
  const label =
    taskAttachment.caption?.trim() ||
    taskAttachment.originalName?.trim() ||
    taskAttachment.name?.trim() ||
    taskAttachment.filename?.trim() ||
    attachmentDefaultLabel(taskAttachment.type);

  const meta =
    taskAttachment.type === "location"
      ? [
          typeof taskAttachment.latitude === "number"
            ? `lat ${taskAttachment.latitude.toFixed(5)}`
            : "",
          typeof taskAttachment.longitude === "number"
            ? `lng ${taskAttachment.longitude.toFixed(5)}`
            : "",
          taskAttachment.address?.trim() ?? "",
        ]
          .filter(Boolean)
          .join(" · ")
      : taskAttachment.filename?.trim() || taskAttachment.originalName?.trim() || "";

  const links =
    taskAttachment.type === "location" || !taskAttachment.url
      ? ""
      : `<div class="attachment-links"><a href="${escapeHtml(taskAttachment.url)}" target="_blank" rel="noreferrer">View</a><a href="${escapeHtml(taskAttachment.url)}" download>Download</a></div>`;

  return `<div class="attachment-item"><div class="attachment-top"><span class="attachment-name">${escapeHtml(label)}</span><span class="badge badge-neutral">${escapeHtml(taskAttachment.type)}</span></div>${
    meta ? `<div class="attachment-meta">${escapeHtml(meta)}</div>` : ""
  }${links}</div>`;
}

function attachmentDefaultLabel(type: string): string {
  switch (type) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "file":
      return "File";
    case "location":
      return "Location";
    default:
      return "Attachment";
  }
}

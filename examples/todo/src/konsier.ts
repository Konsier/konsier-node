import { Konsier, type AttachInput, type Attachment } from "konsier";
import { verifyKonsierPage } from "konsier/express";
import { z } from "zod";

import {
  addTask,
  completeTask,
  deleteTask,
  getTask,
  listTasks,
  taskToToolResult,
} from "./state";

const apiKey = process.env.KONSIER_API_KEY ?? "";
const endpointUrl =
  process.env.KONSIER_ENDPOINT_URL ??
  `http://localhost:${process.env.PORT ?? "3002"}/konsier`;
const publicUrl =
  process.env.KONSIER_PUBLIC_URL ??
  `http://localhost:${process.env.PORT ?? "3002"}`;

function toAttachment(
  attachment: NonNullable<z.infer<typeof addTaskToolInput.shape.attachment>>,
): Attachment {
  const base = {
    id: attachment.id,
    type: attachment.type,
    ...(attachment.name !== undefined ? { name: attachment.name } : {}),
    ...(attachment.caption !== undefined
      ? { caption: attachment.caption }
      : {}),
    ...(attachment.mimeType !== undefined
      ? { mimeType: attachment.mimeType }
      : {}),
  };

  if (attachment.type === "location") {
    return {
      ...base,
      type: "location",
      latitude: attachment.latitude,
      longitude: attachment.longitude,
      ...(attachment.address !== undefined
        ? { address: attachment.address }
        : {}),
    };
  }

  return {
    ...base,
    type: attachment.type,
    url: attachment.url,
    ...(attachment.filename !== undefined
      ? { filename: attachment.filename }
      : {}),
    ...(attachment.originalName !== undefined
      ? { originalName: attachment.originalName }
      : {}),
  };
}

const listTasksTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "list_tasks",
  title: "List Tasks",
  description: "List current tasks and completion state.",
  input: z.object({ showCompleted: z.boolean().default(true) }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    const tasks = listTasks().filter((task) =>
      input.showCompleted ? true : !task.done,
    );

    return {
      tasks: tasks.map(taskToToolResult),
      channel: ctx.channel,
      count: tasks.length,
    };
  },
});

const addTaskToolInput = z.object({
  title: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).optional(),
  attachment: z
    .union([
      Konsier.attachment.image(),
      Konsier.attachment.video(),
      Konsier.attachment.audio(),
      Konsier.attachment.file(),
      Konsier.attachment.location(),
    ])
    .optional()
    .describe(
      "Uploaded attachment from the conversation to store on the task.",
    ),
});

const addTaskTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "add_task",
  title: "Add Task",
  description: "Create a new task in the in-memory board.",
  input: addTaskToolInput,
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    const task = addTask({
      title: input.title,
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.attachment
        ? { attachments: [toAttachment(input.attachment)] }
        : {}),
    });

    return {
      task: taskToToolResult(task),
    };
  },
});

const taskReferenceSchema = z
  .string()
  .min(1)
  .describe(
    "Prefer the exact task id such as task_4 from prior tool results. If an id is unavailable, pass a short distinctive task title or slug.",
  );

const getTaskDetailsTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "get_task_details",
  title: "Get Task Details",
  description:
    "Return details for one task and resend any attachments saved on it.",
  input: z.object({ taskId: taskReferenceSchema }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    const task = getTask(input.taskId);
    if (!task) {
      throw new Error(`Task "${input.taskId}" was not found.`);
    }

    if (task.attachments.length > 0) {
      ctx.attach(
        task.attachments.map((attachment): AttachInput => {
          if (attachment.type === "location") {
            return {
              type: "location" as const,
              latitude: attachment.latitude,
              longitude: attachment.longitude,
              ...(attachment.name ? { name: attachment.name } : {}),
              ...(attachment.address ? { address: attachment.address } : {}),
            };
          }

          return {
            attachmentId: attachment.id,
          };
        }),
      );
    }

    return {
      task: taskToToolResult(task),
    };
  },
});

const completeTaskTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "complete_task",
  title: "Complete Task",
  description: "Mark a task as completed.",
  input: z.object({ taskId: taskReferenceSchema }),
  output: z.record(z.string(), z.any()),
  approval: { required: true, bypassable: true },
  handler: async (input) => {
    const task = completeTask(input.taskId);
    if (!task) {
      throw new Error(`Task "${input.taskId}" was not found.`);
    }

    return { task: taskToToolResult(task) };
  },
});

const deleteTaskTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "delete_task",
  title: "Delete Task",
  description: "Delete a task from the list.",
  input: z.object({ taskId: taskReferenceSchema }),
  output: z.record(z.string(), z.any()),
  approval: { required: true, bypassable: false },
  handler: async (input) => {
    const deleted = deleteTask(input.taskId);
    if (!deleted) {
      throw new Error(`Task "${input.taskId}" was not found.`);
    }

    return { ok: true };
  },
});

export const konsier = new Konsier({
  apiKey,
  endpointUrl,
  publicUrl,
  debug: true,
  agents: {
    todo_assistant: {
      name: "Todo Assistant",
      description: "Tracks a compact todo list for demos.",
      systemPrompt:
        "You manage a lightweight task board. Use tools to read or modify tasks before responding. Always prefer exact task ids like task_4 from prior tool outputs when calling task detail, complete, or delete tools. If the user only gives a title, pass the clearest short task title or slug. If a task should include an uploaded file, photo, audio clip, video, or location, pass it explicitly in the Add Task tool's attachment field instead of assuming the latest message attachment. When task details include attachments, let the user know they are included in the response, but do not repeat internal attachment transcript markers.",
      operations: [
        listTasksTool,
        addTaskTool,
        getTaskDetailsTool,
        completeTaskTool,
        deleteTaskTool,
      ],
    },
  },
  internal: {
    pages: [{ name: "Tasks", path: "/pages/tasks" }],
  },
});

export const pageAuth = verifyKonsierPage(konsier);

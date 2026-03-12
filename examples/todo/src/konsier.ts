import { Konsier } from "konsier";
import { verifyKonsierPage } from "konsier/express";
import { z } from "zod";

import { addTask, completeTask, deleteTask, listTasks } from "./state";

const apiKey = process.env.KONSIER_API_KEY ?? "";
const endpointUrl = `http://localhost:${process.env.PORT ?? "3002"}/konsier`;

const listTasksTool = Konsier.tool({
  name: "list_tasks",
  description: "List current tasks and completion state.",
  input: z.object({ showCompleted: z.boolean().default(true) }),
  handler: async (input, ctx) => {
    const tasks = listTasks().filter((task) =>
      input.showCompleted ? true : !task.done,
    );

    console.log("List tasks", input, ctx);

    return {
      tasks,
      channel: ctx.channel,
      count: tasks.length,
    };
  },
});

const addTaskTool = Konsier.tool({
  name: "add_task",
  description: "Create a new task in the in-memory board.",
  input: z.object({
    title: z.string().min(1),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  handler: async (input, ctx) => {
    const task = input.priority
      ? addTask({ title: input.title, priority: input.priority })
      : addTask({ title: input.title });

    console.log("Add task", input, ctx);

    return { task };
  },
});

const completeTaskTool = Konsier.tool({
  name: "complete_task",
  description: "Mark a task as completed.",
  input: z.object({ taskId: z.string().min(1) }),
  handler: async (input) => {
    const task = completeTask(input.taskId);
    if (!task) {
      throw new Error(`Task "${input.taskId}" was not found.`);
    }

    return { task };
  },
});

const deleteTaskTool = Konsier.tool({
  name: "delete_task",
  description: "Delete a task from the list.",
  input: z.object({ taskId: z.string().min(1) }),
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
  debug: true,
  agents: {
    todo_assistant: {
      name: "Todo Assistant",
      description: "Tracks a compact todo list for demos.",
      systemPrompt:
        "You manage a lightweight task board. Use tools to read or modify tasks before responding.",
      tools: [listTasksTool, addTaskTool, completeTaskTool, deleteTaskTool],
    },
  },
  internal: {
    pages: [{ name: "Tasks", path: "/pages/tasks" }],
  },
});

export const pageAuth = verifyKonsierPage(konsier);

import type { Attachment } from "konsier";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  createdAt: string;
  attachments: Attachment[];
};

const tasks: Task[] = [
  {
    id: "task_1",
    title: "Draft onboarding checklist",
    done: false,
    priority: "high",
    createdAt: new Date("2026-03-10T08:00:00.000Z").toISOString(),
    attachments: [],
  },
  {
    id: "task_2",
    title: "Reply to warehouse supplier",
    done: true,
    priority: "medium",
    createdAt: new Date("2026-03-09T16:30:00.000Z").toISOString(),
    attachments: [],
  },
  {
    id: "task_3",
    title: "Schedule Friday release review",
    done: false,
    priority: "low",
    createdAt: new Date("2026-03-08T12:15:00.000Z").toISOString(),
    attachments: [],
  },
];

let nextTaskNumber = tasks.length + 1;

function cloneAttachment(attachment: Attachment): Attachment {
  if (attachment.type === "location") {
    return { ...attachment };
  }

  return { ...attachment };
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    attachments: task.attachments.map(cloneAttachment),
  };
}

export function taskToToolResult(task: Task) {
  return {
    id: task.id,
    title: task.title,
    done: task.done,
    priority: task.priority,
    createdAt: task.createdAt,
    attachmentCount: task.attachments.length,
  };
}

export function listTasks(): Task[] {
  return tasks.map(cloneTask);
}

export function addTask(input: {
  title: string;
  priority?: Task["priority"];
  attachments?: Attachment[];
}): Task {
  const task: Task = {
    id: `task_${nextTaskNumber++}`,
    title: input.title.trim(),
    done: false,
    priority: input.priority ?? "medium",
    createdAt: new Date().toISOString(),
    attachments: (input.attachments ?? []).map(cloneAttachment),
  };

  tasks.unshift(task);
  return cloneTask(task);
}

function normalizeTaskReference(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveTaskIndex(reference: string): number {
  const exactIndex = tasks.findIndex((candidate) => candidate.id === reference);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const normalizedReference = normalizeTaskReference(reference);
  if (!normalizedReference) {
    return -1;
  }

  const exactTitleMatchIndex = tasks.findIndex(
    (candidate) =>
      normalizeTaskReference(candidate.title) === normalizedReference,
  );
  if (exactTitleMatchIndex >= 0) {
    return exactTitleMatchIndex;
  }

  const partialMatches = tasks.reduce<number[]>((matches, candidate, index) => {
    if (normalizeTaskReference(candidate.title).includes(normalizedReference)) {
      matches.push(index);
    }
    return matches;
  }, []);

  if (partialMatches.length !== 1) {
    return -1;
  }

  return partialMatches[0] ?? -1;
}

export function getTask(reference: string): Task | null {
  const taskIndex = resolveTaskIndex(reference);
  if (taskIndex < 0) {
    return null;
  }

  const task = tasks[taskIndex];
  if (!task) {
    return null;
  }

  return cloneTask(task);
}

export function toggleTask(id: string): Task | null {
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) {
    return null;
  }

  task.done = !task.done;
  return cloneTask(task);
}

export function completeTask(reference: string): Task | null {
  const taskIndex = resolveTaskIndex(reference);
  if (taskIndex < 0) {
    return null;
  }

  const task = tasks[taskIndex];
  if (!task) {
    return null;
  }

  task.done = true;
  return cloneTask(task);
}

export function deleteTask(reference: string): boolean {
  const index = resolveTaskIndex(reference);
  if (index < 0) {
    return false;
  }

  tasks.splice(index, 1);
  return true;
}

export function taskStats() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  const open = total - done;
  const highPriority = tasks.filter((task) => task.priority === "high").length;

  return { total, done, open, highPriority };
}

export type Task = {
  id: string;
  title: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  createdAt: string;
};

const tasks: Task[] = [
  {
    id: "task_1",
    title: "Draft onboarding checklist",
    done: false,
    priority: "high",
    createdAt: new Date("2026-03-10T08:00:00.000Z").toISOString(),
  },
  {
    id: "task_2",
    title: "Reply to warehouse supplier",
    done: true,
    priority: "medium",
    createdAt: new Date("2026-03-09T16:30:00.000Z").toISOString(),
  },
  {
    id: "task_3",
    title: "Schedule Friday release review",
    done: false,
    priority: "low",
    createdAt: new Date("2026-03-08T12:15:00.000Z").toISOString(),
  },
];

let nextTaskNumber = tasks.length + 1;

export function listTasks(): Task[] {
  return tasks.map((task) => ({ ...task }));
}

export function addTask(input: {
  title: string;
  priority?: Task["priority"];
}): Task {
  const task: Task = {
    id: `task_${nextTaskNumber++}`,
    title: input.title.trim(),
    done: false,
    priority: input.priority ?? "medium",
    createdAt: new Date().toISOString(),
  };

  tasks.unshift(task);
  return { ...task };
}

export function toggleTask(id: string): Task | null {
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) {
    return null;
  }

  task.done = !task.done;
  return { ...task };
}

export function completeTask(id: string): Task | null {
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) {
    return null;
  }

  task.done = true;
  return { ...task };
}

export function deleteTask(id: string): boolean {
  const index = tasks.findIndex((candidate) => candidate.id === id);
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

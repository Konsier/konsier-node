import "dotenv/config";
import express from "express";
import { resolve } from "node:path";
import { serveKonsier } from "konsier/express";

import { konsier, pageVerifier } from "./konsier";
import { addTask, deleteTask, taskStats, toggleTask } from "./state";
import { renderDashboard } from "./views/dashboard";

const port = Number(process.env.PORT ?? "3002");

const app = express();

app.use("/assets", express.static(resolve(process.cwd(), "src", "public")));
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, tasks: taskStats().total });
});

app.get("/", (_req, res) => {
  res.send(renderDashboard({ heading: "Mock Task Board" }));
});

app.post("/tasks", (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const priority =
    req.body?.priority === "low" ||
    req.body?.priority === "medium" ||
    req.body?.priority === "high"
      ? req.body.priority
      : "medium";

  if (title) {
    addTask({ title, priority });
  }

  res.redirect("/");
});

app.post("/tasks/:taskId/toggle", (req, res) => {
  toggleTask(req.params.taskId);
  res.redirect("/");
});

app.post("/tasks/:taskId/delete", (req, res) => {
  deleteTask(req.params.taskId);
  res.redirect("/");
});

app.get("/pages/tasks", pageVerifier, (req, res) => {
  const context =
    (req as typeof req & { konsier?: unknown }).konsier ?? null;

  res.send(
    renderDashboard({
      heading: "Konsier Internal Task Board",
      context,
    }),
  );
});

serveKonsier(app, konsier);

app.listen(port, async () => {
  await konsier.sync();
  console.log(`[todo-example] listening on http://localhost:${port}`);
});

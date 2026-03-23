# Todo Example

Smallest `konsier-node` sample app.

## What it shows

- Express adapter via `serveKonsier(app, konsier)`
- One public agent ref: `todo_assistant`
- One public local dashboard at `/`
- One protected owner page at `/pages/tasks`, launched directly on the app origin from Konsier
- In-memory task state only
- Explicit attachment tool inputs can be stored on tasks and resent later with `Get Task Details`
- Task tools prefer exact ids and fall back to an unambiguous normalized title match for demo friendliness

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) for the local dashboard.

## Konsier setup

1. Create or open a project in Konsier.
2. Point the implementation endpoint to `http://localhost:3002/konsier`.
3. Link a project agent to the ref `todo_assistant`.
4. Optionally connect Telegram in Konsier for quick channel testing.
5. Open the page from Konsier and verify the browser launch + redirect bootstrap flow works.

## Attachment flow to test

1. Send a photo or file with a prompt like `add this as a todo called vendor receipt`.
2. Ask `show me the details for vendor receipt`.
3. The agent should pass the uploaded item explicitly into the `Add Task` tool's `attachment` field.
4. The task should show an attachment count in the dashboard, and the details tool should resend the stored attachment back through the channel.
5. Task lookup tools prefer ids like `task_4`, but the demo also accepts a distinctive task title such as `pitch deck` when it maps unambiguously.

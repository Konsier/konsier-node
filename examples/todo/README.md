# Todo Example

Smallest `konsier-node` sample app.

## What it shows

- Express adapter via `serveKonsier(app, konsier)`
- One public agent ref: `task_assistant`
- One public local dashboard at `/`
- One protected Konsier internal page at `/pages/tasks`
- In-memory task state only

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
3. Link a project agent to the ref `task_assistant`.
4. Optionally connect Telegram in Konsier for quick channel testing.
5. Open the internal page exposed by this app to verify `verifyKonsierPage()` works.

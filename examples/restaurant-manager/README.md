# Restaurant Manager Example

High-complexity platform sample for connected restaurant projects.

## What it shows

- Native Node `http` server with direct `webhookHandler()` usage
- Two public agent refs:
  - `restaurant_customer`
  - `restaurant_worker`
- Owner tooling exposed through `internal.tools`
- Protected owner internal page at `/pages/ops`
- Multi-tenant in-memory state partitioned by Konsier `account.id`

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3004](http://localhost:3004) to inspect the local platform dashboard.

Set `KONSIER_ENDPOINT_URL` in `.env` when the app is reachable at a non-default public URL. The local default is `http://localhost:3004/konsier`.

## Konsier setup

1. Use this app as the implementation endpoint for a platform project.
2. Point Konsier at the same URL configured in `KONSIER_ENDPOINT_URL` or use the default `http://localhost:3004/konsier`.
3. Expose the refs `restaurant_customer` and `restaurant_worker`.
4. Open the dashboard and use the built-in connect button to start the account connection flow.
5. Approve the connection from another Konsier project, then return to the callback page.
6. Test tenant-aware behavior by opening the owner page from the connected restaurant account.

# Restaurant Manager Example

Fastify sample for connected restaurant projects.

## What it shows

- Fastify webhook registration with `registerKonsier(app, sdk)`
- Two public agent refs:
  - `restaurant_customer`
  - `restaurant_worker`
- Owner tooling exposed through `internal.tools`
- Protected owner page at `/pages/ops`, launched directly from Konsier
- Multi-tenant in-memory state partitioned by Konsier `account.id`

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3004](http://localhost:3004) to inspect the local platform dashboard.

Set `KONSIER_ENDPOINT_URL` to the webhook route and `KONSIER_PUBLIC_URL` to the public app origin. The local defaults are `http://localhost:3004/konsier` and `http://localhost:3004`.

## Konsier setup

1. Use this app as the implementation endpoint for a platform project.
2. Configure both URLs in `.env`; Pages are launched from `KONSIER_PUBLIC_URL`.
3. Expose the refs `restaurant_customer` and `restaurant_worker`.
4. Open the local dashboard to inspect tenant state.
5. Open the owner page from Konsier to verify the direct-launch Fastify page flow.

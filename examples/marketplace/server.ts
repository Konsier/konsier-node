import "dotenv/config";
import express from "express";
import { serveKonsier, verifyKonsierPage } from "konsier/express";
import next from "next";

import {
  renderCatalogInternalPage,
  renderOrdersInternalPage,
} from "./lib/internal-pages";
import { sdk } from "./lib/konsier";

const port = Number(process.env.PORT || "3003");
const dev = process.env.NODE_ENV !== "production";

const nextApp = next({ dev, dir: "." });
const handle = nextApp.getRequestHandler();

await nextApp.prepare();

const server = express();
const pageVerifier = verifyKonsierPage(sdk);

serveKonsier(server, sdk);

server.get("/health", (_req, res) => {
  res.json({ ok: true });
});

server.get("/pages/catalog", pageVerifier, (req, res) => {
  res.send(renderCatalogInternalPage(req.konsier ?? null));
});

server.get("/pages/orders", pageVerifier, (req, res) => {
  res.send(renderOrdersInternalPage(req.konsier ?? null));
});

server.all(/.*/, (req, res) => {
  return handle(req, res);
});

server.listen(port, async () => {
  await sdk.sync();
  console.log(`[marketplace-example] listening on http://localhost:${port}`);
});

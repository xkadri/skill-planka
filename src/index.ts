#!/usr/bin/env node
/**
 * MCP server for the Planka project management API.
 *
 * Designed to run as a sidecar container alongside a Planka instance,
 * exposing every board/list/card/label/task/comment/user/webhook operation
 * as an MCP tool over streamable HTTP (default) or stdio.
 *
 * Auth model: PLANKA_BASE_URL is fixed per-deployment (the sidecar always
 * talks to the one Planka instance it runs next to), but the Planka API key
 * is supplied by each MCP client per-request over HTTP -- via an
 * `Authorization: Bearer <key>` or `X-Planka-Api-Key: <key>` header -- rather
 * than baked into the container's environment. This lets one sidecar safely
 * serve multiple users/clients, each acting as themselves in Planka. stdio
 * mode has no per-request header channel, so it falls back to requiring
 * PLANKA_API_KEY in the environment (appropriate since a stdio server is
 * already scoped to a single local client/session).
 */

import express, { type Request } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { resolveBaseUrl, requireStdioApiKey, getTransport, getPort, type PlankaConfig } from "./config.js";
import { PlankaClient } from "./services/plankaClient.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerBoardTools } from "./tools/boards.js";
import { registerListTools } from "./tools/lists.js";
import { registerCardTools } from "./tools/cards.js";
import { registerLabelTools } from "./tools/labels.js";
import { registerTasklistTools } from "./tools/tasklists.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerUserTools } from "./tools/users.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerBoardMembershipTools } from "./tools/boardMemberships.js";

function buildServer(config: PlankaConfig): McpServer {
  const client = new PlankaClient(config);

  const server = new McpServer({
    name: "planka-mcp-server",
    version: "1.0.0",
  });

  registerProjectTools(server, client);
  registerBoardTools(server, client);
  registerListTools(server, client);
  registerCardTools(server, client);
  registerLabelTools(server, client);
  registerTasklistTools(server, client);
  registerTaskTools(server, client);
  registerCommentTools(server, client);
  registerUserTools(server, client);
  registerNotificationTools(server, client);
  registerWebhookTools(server, client);
  registerBoardMembershipTools(server, client);

  return server;
}

/** Extract the caller-supplied Planka API key from the request headers. */
function extractApiKey(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const custom = req.header("x-planka-api-key");
  if (custom) return custom.trim();
  return undefined;
}

async function runStdio(): Promise<void> {
  const config: PlankaConfig = { baseUrl: resolveBaseUrl(), apiKey: requireStdioApiKey() };
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("planka-mcp-server running via stdio");
}

async function runHttp(): Promise<void> {
  const baseUrl = resolveBaseUrl();
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message:
            "Missing Planka API key. Send it as 'Authorization: Bearer <key>' or 'X-Planka-Api-Key: <key>'.",
        },
        id: null,
      });
      return;
    }

    // Stateless: a fresh server + transport per request avoids request-ID collisions
    // across concurrent clients and keeps the sidecar simple to scale/restart.
    const server = buildServer({ baseUrl, apiKey });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  const port = getPort();
  app.listen(port, () => {
    console.error(`planka-mcp-server listening on http://0.0.0.0:${port}/mcp`);
    console.error(`Planka base URL: ${baseUrl}`);
    console.error("Clients must send their own Planka API key via 'Authorization: Bearer <key>'.");
  });
}

const transport = getTransport();
const run = transport === "stdio" ? runStdio() : runHttp();
run.catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

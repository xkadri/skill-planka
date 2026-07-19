import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerWebhookTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_list_webhooks",
    {
      title: "List Planka Webhooks",
      description: "List all configured webhooks (admin only).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => runTool(async () => jsonResult(await client.webhookList()))
  );

  server.registerTool(
    "planka_create_webhook",
    {
      title: "Create Planka Webhook",
      description: "Register a new webhook that Planka will POST events to (admin only).",
      inputSchema: {
        name: z.string().min(1).describe("Webhook name"),
        url: z.string().url().describe("Target URL to receive webhook events"),
        accessToken: z.string().optional().describe("Bearer token Planka should send with each request"),
        events: z.array(z.string()).optional().describe("Event types to subscribe to (omit for all events)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ name, url, accessToken, events }) =>
      runTool(async () => {
        const extra: Record<string, unknown> = {};
        if (accessToken) extra.accessToken = accessToken;
        if (events) extra.events = events;
        return jsonResult(await client.webhookCreate(name, url, extra));
      })
  );

  server.registerTool(
    "planka_update_webhook",
    {
      title: "Update Planka Webhook",
      description: "Update an existing webhook's name, URL, token, or subscribed events.",
      inputSchema: {
        id: z.string().describe("Webhook ID"),
        name: z.string().optional(),
        url: z.string().url().optional(),
        accessToken: z.string().optional(),
        events: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.webhookUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_webhook",
    {
      title: "Delete Planka Webhook",
      description: "Permanently delete a webhook.",
      inputSchema: { id: z.string().describe("Webhook ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.webhookDelete(id)))
  );
}

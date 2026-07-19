import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerNotificationTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_list_notifications",
    {
      title: "List Planka Notifications",
      description: "List the authenticated user's notifications.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => runTool(async () => jsonResult(await client.notificationList()))
  );

  server.registerTool(
    "planka_read_all_notifications",
    {
      title: "Mark All Planka Notifications Read",
      description: "Mark all of the authenticated user's notifications as read.",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => runTool(async () => jsonResult(await client.notificationReadAll()))
  );
}

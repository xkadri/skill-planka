import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerTasklistTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_get_tasklist",
    {
      title: "Get Planka Task List",
      description: "Get a checklist (task list) by ID, e.g. a card's 'Acceptance Criteria' checklist.",
      inputSchema: { id: z.string().describe("Task list ID") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.tasklistGet(id)))
  );

  server.registerTool(
    "planka_create_tasklist",
    {
      title: "Create Planka Task List",
      description: "Create a new checklist (task list) on a card.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        name: z.string().min(1).describe("Task list name, e.g. 'Checklist'"),
        position: z.number().int().default(65536),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ cardId, name, position }) =>
      runTool(async () => jsonResult(await client.tasklistCreate(cardId, name, position)))
  );

  server.registerTool(
    "planka_update_tasklist",
    {
      title: "Update Planka Task List",
      description: "Rename or reposition a checklist (task list).",
      inputSchema: {
        id: z.string().describe("Task list ID"),
        name: z.string().optional(),
        position: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.tasklistUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_tasklist",
    {
      title: "Delete Planka Task List",
      description: "Permanently delete a checklist (task list) and all its tasks. This cannot be undone.",
      inputSchema: { id: z.string().describe("Task list ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.tasklistDelete(id)))
  );
}

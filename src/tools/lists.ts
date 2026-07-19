import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerListTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_get_list",
    {
      title: "Get Planka List",
      description: "Get a single list (column) by ID.",
      inputSchema: { id: z.string().describe("List ID") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.listGet(id)))
  );

  server.registerTool(
    "planka_create_list",
    {
      title: "Create Planka List",
      description: "Create a new list (column) on a board, e.g. 'To Do', 'In Progress', 'Done'.",
      inputSchema: {
        boardId: z.string().describe("Parent board ID"),
        name: z.string().min(1).describe("List name"),
        type: z.enum(["active", "closed"]).default("active"),
        position: z.number().int().default(65536).describe("Ordering position among sibling lists"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ boardId, name, type, position }) =>
      runTool(async () => jsonResult(await client.listCreate(boardId, name, type, position)))
  );

  server.registerTool(
    "planka_update_list",
    {
      title: "Update Planka List",
      description: "Update fields on an existing list, e.g. rename it or change its position/type.",
      inputSchema: {
        id: z.string().describe("List ID"),
        name: z.string().optional(),
        type: z.enum(["active", "closed"]).optional(),
        position: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.listUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_list",
    {
      title: "Delete Planka List",
      description: "Permanently delete a list and all cards inside it. This cannot be undone.",
      inputSchema: { id: z.string().describe("List ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.listDelete(id)))
  );

  server.registerTool(
    "planka_get_list_cards",
    {
      title: "Get Cards In Planka List",
      description: "Get the cards inside a list, optionally filtered by search text, member user IDs, or label IDs.",
      inputSchema: {
        id: z.string().describe("List ID"),
        search: z.string().optional().describe("Free-text search over card name/description"),
        userIds: z.string().optional().describe("Comma-separated user IDs to filter by card member"),
        labelIds: z.string().optional().describe("Comma-separated label IDs to filter by"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, search, userIds, labelIds }) =>
      runTool(async () => {
        const params: Record<string, unknown> = {};
        if (search) params.search = search;
        if (userIds) params.userIds = userIds;
        if (labelIds) params.labelIds = labelIds;
        return jsonResult(await client.listCards(id, params));
      })
  );

  server.registerTool(
    "planka_sort_list_cards",
    {
      title: "Sort Cards In Planka List",
      description: "Re-sort all cards within a list by a field.",
      inputSchema: {
        id: z.string().describe("List ID"),
        by: z.enum(["name", "dueDate", "createdAt"]).default("name"),
        order: z.enum(["asc", "desc"]).default("asc"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, by, order }) => runTool(async () => jsonResult(await client.listSortCards(id, by, order)))
  );

  server.registerTool(
    "planka_move_list_cards",
    {
      title: "Move All Cards Between Planka Lists",
      description: "Move every card currently in one list into another list (bulk move).",
      inputSchema: {
        id: z.string().describe("Source list ID"),
        toListId: z.string().describe("Destination list ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ id, toListId }) => runTool(async () => jsonResult(await client.listMoveCards(id, toListId)))
  );
}

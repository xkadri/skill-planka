import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerBoardTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_get_board",
    {
      title: "Get Planka Board",
      description:
        "Get a Planka board by ID, including included lists, cards, labels, and memberships in the 'included' field.",
      inputSchema: { id: z.string().describe("Board ID") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.boardGet(id)))
  );

  server.registerTool(
    "planka_create_board",
    {
      title: "Create Planka Board",
      description: "Create a new board inside a Planka project.",
      inputSchema: {
        projectId: z.string().describe("Parent project ID"),
        name: z.string().min(1).describe("Board name"),
        position: z.number().int().default(65536).describe("Ordering position among sibling boards"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ projectId, name, position }) =>
      runTool(async () => jsonResult(await client.boardCreate(projectId, name, position)))
  );

  server.registerTool(
    "planka_update_board",
    {
      title: "Update Planka Board",
      description: "Update fields on an existing Planka board.",
      inputSchema: {
        id: z.string().describe("Board ID"),
        name: z.string().optional(),
        position: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.boardUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_board",
    {
      title: "Delete Planka Board",
      description: "Permanently delete a Planka board and all its lists/cards. This cannot be undone.",
      inputSchema: { id: z.string().describe("Board ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.boardDelete(id)))
  );

  server.registerTool(
    "planka_get_board_actions",
    {
      title: "Get Planka Board Activity",
      description: "Get the activity log (actions) for a board, most recent first.",
      inputSchema: {
        id: z.string().describe("Board ID"),
        beforeId: z.string().optional().describe("Return actions before this action ID (for pagination)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, beforeId }) => runTool(async () => jsonResult(await client.boardActions(id, beforeId)))
  );

  server.registerTool(
    "planka_get_board_summary",
    {
      title: "Get Planka Board Summary",
      description:
        "Get a human-readable summary of a board: its lists in order, each with a card count and per-card name/labels/URL. " +
        "Much more compact than planka_get_board for a quick status check.",
      inputSchema: { id: z.string().describe("Board ID") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.boardSummary(id)))
  );
}

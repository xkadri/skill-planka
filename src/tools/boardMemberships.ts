import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerBoardMembershipTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_add_board_member",
    {
      title: "Add Planka Board Member",
      description: "Grant a user access to a board with a given role.",
      inputSchema: {
        boardId: z.string().describe("Board ID"),
        userId: z.string().describe("User ID to add"),
        role: z.enum(["editor", "viewer"]).default("editor"),
        canComment: z.boolean().optional().describe("Whether a viewer can comment (ignored for editors)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ boardId, userId, role, canComment }) =>
      runTool(async () => jsonResult(await client.boardMemberAdd(boardId, userId, role, canComment)))
  );

  server.registerTool(
    "planka_update_board_member",
    {
      title: "Update Planka Board Member",
      description: "Change a board membership's role or comment permission.",
      inputSchema: {
        id: z.string().describe("Board membership ID"),
        role: z.enum(["editor", "viewer"]).optional(),
        canComment: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.boardMemberUpdate(id, fields)))
  );

  server.registerTool(
    "planka_remove_board_member",
    {
      title: "Remove Planka Board Member",
      description: "Revoke a user's access to a board.",
      inputSchema: { id: z.string().describe("Board membership ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.boardMemberRemove(id)))
  );
}

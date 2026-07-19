import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerCommentTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_list_comments",
    {
      title: "List Planka Card Comments",
      description: "List comments on a card, most recent first.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        beforeId: z.string().optional().describe("Return comments before this comment ID (for pagination)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, beforeId }) => runTool(async () => jsonResult(await client.commentList(cardId, beforeId)))
  );

  server.registerTool(
    "planka_create_comment",
    {
      title: "Create Planka Comment",
      description: "Post a new comment on a card.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        text: z.string().min(1).describe("Comment text (Markdown supported)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ cardId, text }) => runTool(async () => jsonResult(await client.commentCreate(cardId, text)))
  );

  server.registerTool(
    "planka_update_comment",
    {
      title: "Update Planka Comment",
      description: "Edit the text of an existing comment.",
      inputSchema: {
        id: z.string().describe("Comment ID"),
        text: z.string().min(1).describe("New comment text"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, text }) => runTool(async () => jsonResult(await client.commentUpdate(id, text)))
  );

  server.registerTool(
    "planka_delete_comment",
    {
      title: "Delete Planka Comment",
      description: "Permanently delete a comment.",
      inputSchema: { id: z.string().describe("Comment ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.commentDelete(id)))
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerCardTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_get_card",
    {
      title: "Get Planka Card",
      description: "Get a single card by ID.",
      inputSchema: { id: z.string().describe("Card ID") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.cardGet(id)))
  );

  server.registerTool(
    "planka_create_card",
    {
      title: "Create Planka Card",
      description:
        "Create a new card in a list. The response includes '_path' (full Project > Board > List > Card hierarchy) " +
        "and '_url' (direct link to the card) for convenience.",
      inputSchema: {
        listId: z.string().describe("Destination list ID"),
        name: z.string().min(1).describe("Card title"),
        type: z.enum(["project", "story"]).default("project"),
        description: z.string().optional().describe("Card description (Markdown supported)"),
        dueDate: z.string().optional().describe("ISO 8601 due date, e.g. 2026-08-01T00:00:00.000Z"),
        position: z.number().int().default(65536).describe("Ordering position among sibling cards"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ listId, name, type, description, dueDate, position }) =>
      runTool(async () => {
        const extra: Record<string, unknown> = {};
        if (description) extra.description = description;
        if (dueDate) extra.dueDate = dueDate;
        return jsonResult(await client.cardCreate(listId, name, type, position, extra));
      })
  );

  server.registerTool(
    "planka_update_card",
    {
      title: "Update Planka Card",
      description: "Update fields on an existing card (rename, redescribe, reschedule, or reposition within its current list).",
      inputSchema: {
        id: z.string().describe("Card ID"),
        name: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.string().optional().describe("ISO 8601 due date, or empty string to clear"),
        isDueCompleted: z.boolean().optional(),
        position: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.cardUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_card",
    {
      title: "Delete Planka Card",
      description: "Permanently delete a card. This cannot be undone.",
      inputSchema: { id: z.string().describe("Card ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.cardDelete(id)))
  );

  server.registerTool(
    "planka_duplicate_card",
    {
      title: "Duplicate Planka Card",
      description: "Create a copy of an existing card, including its task lists and labels.",
      inputSchema: {
        id: z.string().describe("Card ID to duplicate"),
        name: z.string().optional().describe("Name for the duplicated card (defaults to the original name)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ id, name }) =>
      runTool(async () => jsonResult(await client.cardDuplicate(id, name ? { name } : {})))
  );

  server.registerTool(
    "planka_get_card_actions",
    {
      title: "Get Planka Card Activity",
      description: "Get the activity log (actions/comments history) for a card, most recent first.",
      inputSchema: {
        id: z.string().describe("Card ID"),
        beforeId: z.string().optional().describe("Return actions before this action ID (for pagination)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, beforeId }) => runTool(async () => jsonResult(await client.cardActions(id, beforeId)))
  );

  server.registerTool(
    "planka_move_card",
    {
      title: "Move Planka Card",
      description:
        "Move a card to a different list. Exactly one of listId, listName, next, or done must be provided:\n" +
        "  - listId: move to a specific list by ID\n" +
        "  - listName: move to a list identified by name (case-insensitive, resolved within the card's board)\n" +
        "  - next: move to the next list in board order\n" +
        "  - done: move to the first list named 'Done' (case-insensitive) on the card's board\n" +
        "The card is placed at the end of the destination list.",
      inputSchema: {
        id: z.string().describe("Card ID"),
        listId: z.string().optional().describe("Target list ID"),
        listName: z.string().optional().describe("Target list name (case-insensitive)"),
        next: z.boolean().optional().describe("Move to the next list in board order"),
        done: z.boolean().optional().describe("Move to the 'Done' list"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ id, listId, listName, next, done }) =>
      runTool(async () => {
        const modes = [listId, listName, next, done].filter((v) => v !== undefined && v !== false);
        if (modes.length !== 1) {
          return jsonResult({
            error:
              "Exactly one of listId, listName, next, or done must be provided.",
          });
        }
        if (listId) return jsonResult(await client.cardMove(id, listId));
        if (listName) return jsonResult(await client.cardMoveByName(id, listName));
        if (next) return jsonResult(await client.cardMoveNext(id));
        return jsonResult(await client.cardMoveDone(id));
      })
  );

  server.registerTool(
    "planka_add_card_member",
    {
      title: "Add Member To Planka Card",
      description: "Assign a user as a member of a card.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        userId: z.string().describe("User ID to add"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, userId }) =>
      runTool(async () => jsonResult(await client.cardMemberAdd(cardId, userId)))
  );

  server.registerTool(
    "planka_remove_card_member",
    {
      title: "Remove Member From Planka Card",
      description: "Remove a user from a card's members.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        userId: z.string().describe("User ID to remove"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, userId }) =>
      runTool(async () => jsonResult(await client.cardMemberRemove(cardId, userId)))
  );
}

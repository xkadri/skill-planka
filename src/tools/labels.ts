import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerLabelTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_create_label",
    {
      title: "Create Planka Label",
      description: "Create a new label on a board.",
      inputSchema: {
        boardId: z.string().describe("Board ID"),
        name: z.string().min(1).describe("Label name"),
        color: z.string().describe("Planka label color name, e.g. 'berry-red', 'pumpkin-orange', 'lagoon-blue'"),
        position: z.number().int().default(65536),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ boardId, name, color, position }) =>
      runTool(async () => jsonResult(await client.labelCreate(boardId, name, color, position)))
  );

  server.registerTool(
    "planka_update_label",
    {
      title: "Update Planka Label",
      description: "Update a label's name, color, or position.",
      inputSchema: {
        id: z.string().describe("Label ID"),
        name: z.string().optional(),
        color: z.string().optional(),
        position: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.labelUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_label",
    {
      title: "Delete Planka Label",
      description: "Permanently delete a label from a board, removing it from all cards. This cannot be undone.",
      inputSchema: { id: z.string().describe("Label ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.labelDelete(id)))
  );

  server.registerTool(
    "planka_add_card_label",
    {
      title: "Add Label To Card By ID",
      description: "Attach an existing label (by label ID) to a card.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        labelId: z.string().describe("Label ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, labelId }) =>
      runTool(async () => jsonResult(await client.cardLabelAdd(cardId, labelId)))
  );

  server.registerTool(
    "planka_remove_card_label",
    {
      title: "Remove Label From Card By ID",
      description: "Remove a label (by label ID) from a card.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        labelId: z.string().describe("Label ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, labelId }) =>
      runTool(async () => jsonResult(await client.cardLabelRemove(cardId, labelId)))
  );

  server.registerTool(
    "planka_add_card_label_by_name",
    {
      title: "Add Label To Card By Name",
      description:
        "Attach a label to a card by its name (case-insensitive), resolved against the labels defined on the card's board. " +
        "Avoids needing to look up the label ID first.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        name: z.string().describe("Label name (case-insensitive)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, name }) =>
      runTool(async () => jsonResult(await client.cardLabelAddByName(cardId, name)))
  );

  server.registerTool(
    "planka_remove_card_label_by_name",
    {
      title: "Remove Label From Card By Name",
      description: "Remove a label from a card by its name (case-insensitive), resolved against the card's board.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        name: z.string().describe("Label name (case-insensitive)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, name }) =>
      runTool(async () => jsonResult(await client.cardLabelRemoveByName(cardId, name)))
  );

  server.registerTool(
    "planka_set_card_labels",
    {
      title: "Replace Planka Card Labels",
      description:
        "Replace ALL labels currently on a card with the given set of label names (case-insensitive). " +
        "Removes any existing labels not in the list and adds any missing ones.",
      inputSchema: {
        cardId: z.string().describe("Card ID"),
        names: z.array(z.string()).min(0).describe("Label names the card should end up with"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ cardId, names }) =>
      runTool(async () => jsonResult(await client.cardLabelSet(cardId, names)))
  );
}

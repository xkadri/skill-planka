import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerTaskTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_create_task",
    {
      title: "Create Planka Task",
      description: "Create a new checklist item (task) inside a task list.",
      inputSchema: {
        tasklistId: z.string().describe("Task list (checklist) ID"),
        name: z.string().min(1).describe("Task text, e.g. 'Write unit tests'"),
        position: z.number().int().default(65536),
        completed: z.boolean().default(false).describe("Whether the task starts checked off"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ tasklistId, name, position, completed }) =>
      runTool(async () =>
        jsonResult(await client.taskCreate(tasklistId, name, position, { isCompleted: completed }))
      )
  );

  server.registerTool(
    "planka_update_task",
    {
      title: "Update Planka Task",
      description: "Update a checklist item, e.g. rename it, reposition it, or mark it complete/incomplete.",
      inputSchema: {
        id: z.string().describe("Task ID"),
        name: z.string().optional(),
        isCompleted: z.boolean().optional(),
        position: z.number().int().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.taskUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_task",
    {
      title: "Delete Planka Task",
      description: "Permanently delete a checklist item (task).",
      inputSchema: { id: z.string().describe("Task ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.taskDelete(id)))
  );
}

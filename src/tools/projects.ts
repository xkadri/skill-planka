import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerProjectTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_list_projects",
    {
      title: "List Planka Projects",
      description: "List all Planka projects visible to the authenticated user.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => runTool(async () => jsonResult(await client.projectList()))
  );

  server.registerTool(
    "planka_get_project",
    {
      title: "Get Planka Project",
      description: "Get a single Planka project by ID, including its board list.",
      inputSchema: { id: z.string().describe("Project ID") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.projectGet(id)))
  );

  server.registerTool(
    "planka_create_project",
    {
      title: "Create Planka Project",
      description: "Create a new Planka project.",
      inputSchema: {
        name: z.string().min(1).describe("Project name"),
        type: z.enum(["private", "shared"]).default("private").describe("Project visibility type"),
        description: z.string().optional().describe("Project description"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ name, type, description }) =>
      runTool(async () => jsonResult(await client.projectCreate(type, name, description)))
  );

  server.registerTool(
    "planka_update_project",
    {
      title: "Update Planka Project",
      description: "Update fields on an existing Planka project.",
      inputSchema: {
        id: z.string().describe("Project ID"),
        name: z.string().optional(),
        description: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) =>
      runTool(async () => jsonResult(await client.projectUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_project",
    {
      title: "Delete Planka Project",
      description: "Permanently delete a Planka project and all its boards. This cannot be undone.",
      inputSchema: { id: z.string().describe("Project ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.projectDelete(id)))
  );
}

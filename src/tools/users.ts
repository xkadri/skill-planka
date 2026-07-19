import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlankaClient } from "../services/plankaClient.js";
import { jsonResult, runTool } from "./helpers.js";

export function registerUserTools(server: McpServer, client: PlankaClient) {
  server.registerTool(
    "planka_list_users",
    {
      title: "List Planka Users",
      description: "List all users on this Planka instance (admin only).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => runTool(async () => jsonResult(await client.userList()))
  );

  server.registerTool(
    "planka_get_user",
    {
      title: "Get Planka User",
      description: "Get a user by ID, or the currently authenticated user when id is omitted (id defaults to 'me').",
      inputSchema: { id: z.string().default("me").describe("User ID, or 'me' for the authenticated user") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.userGet(id)))
  );

  server.registerTool(
    "planka_create_user",
    {
      title: "Create Planka User",
      description: "Create a new user account (admin only).",
      inputSchema: {
        email: z.string().email().describe("User's email address"),
        password: z.string().min(6).describe("Initial password"),
        role: z.enum(["admin", "projectOwner", "boardUser"]).describe("Account role"),
        name: z.string().min(1).describe("Display name"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ email, password, role, name }) =>
      runTool(async () => jsonResult(await client.userCreate(email, password, role, name)))
  );

  server.registerTool(
    "planka_update_user",
    {
      title: "Update Planka User",
      description: "Update fields on an existing user account.",
      inputSchema: {
        id: z.string().describe("User ID"),
        name: z.string().optional(),
        email: z.string().email().optional(),
        username: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ id, ...fields }) => runTool(async () => jsonResult(await client.userUpdate(id, fields)))
  );

  server.registerTool(
    "planka_delete_user",
    {
      title: "Delete Planka User",
      description: "Permanently delete a user account (admin only). This cannot be undone.",
      inputSchema: { id: z.string().describe("User ID") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }) => runTool(async () => jsonResult(await client.userDelete(id)))
  );
}

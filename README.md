# planka-mcp-server

An [MCP](https://modelcontextprotocol.io) server for [Planka](https://planka.app) — the open-source kanban project management tool.

Designed to run as a **sidecar container** alongside your Planka instance, exposing the full Planka REST API (projects, boards, lists, cards, labels, task lists, tasks, comments, users, board memberships, notifications, webhooks) as MCP tools that any MCP-compatible client (Claude Code, Claude Desktop, etc.) can call over the network.

## Features

- 42 tools covering the entire Planka API surface: full CRUD on every resource, plus high-level workflow shortcuts
- Move a card by list name, to the next list, or to "Done" — no ID lookups required
- Add/remove/replace card labels by name
- Board summary tool — compact per-list card counts and names for quick status checks
- Streamable HTTP transport (default, for the sidecar/network use case) or stdio (for local development)
- Ships as a small multi-stage Docker image with a healthcheck

## Configuration

The sidecar's *location* (which Planka instance it talks to) is fixed server-side via env vars. The Planka *API key* is **not** server-side config — in HTTP mode, each MCP client sends its own key on every request, so one shared sidecar can safely serve multiple users, each acting as themselves in Planka.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PLANKA_BASE_URL` | No | `http://localhost:3000/api` | Base URL of your Planka instance (`/api` appended automatically if missing) |
| `TRANSPORT` | No | `http` | `http` (streamable HTTP) or `stdio` |
| `PORT` | No | `3001` | Port to listen on when `TRANSPORT=http` |
| `PLANKA_API_KEY` | Only for `TRANSPORT=stdio` | — | stdio has no per-request header channel, so the key is read from env there. **Not used in HTTP mode.** |

See [.env.example](.env.example).

### Supplying the API key (HTTP mode)

Each client sends its own key generated from Planka (User Settings → API Keys), via either header:

```
Authorization: Bearer <your-planka-api-key>
```
```
X-Planka-Api-Key: <your-planka-api-key>
```

Requests without one of these headers get a `401` with a clear error instead of reaching Planka.

## Quick Start (Docker)

```bash
docker build -t planka-mcp-server .

docker run -d \
  --name planka-mcp \
  -e PLANKA_BASE_URL=https://your-planka-instance.example.com \
  -p 3001:3001 \
  planka-mcp-server
```

The server is now reachable at `http://localhost:3001/mcp` (each client authenticates itself via header, see above), with a health check at `http://localhost:3001/healthz`.

## Running as a Sidecar (docker-compose)

Run the MCP server alongside Planka itself, using Docker's internal networking so the sidecar reaches Planka by service name. No API key goes in this file — clients supply their own per-request.

```yaml
services:
  planka:
    image: ghcr.io/plankanban/planka:latest
    ports:
      - "1337:1337"
    environment:
      BASE_URL: http://localhost:1337
      # ... see Planka's own docs for full required config (DB, secrets, etc.)

  planka-mcp:
    build: ./planka-mcp-server   # or: image: your-registry/planka-mcp-server
    restart: unless-stopped
    depends_on:
      - planka
    environment:
      PLANKA_BASE_URL: http://planka:1337
    ports:
      - "3001:3001"
```

## Connecting an MCP Client

Point your MCP client at the streamable HTTP endpoint and configure your Planka API key as a header, e.g. for Claude Code:

```bash
claude mcp add --transport http planka http://localhost:3001/mcp \
  --header "Authorization: Bearer <your-planka-api-key>"
```

For local development without Docker, run with `TRANSPORT=stdio` (which reads the key from env, since stdio has no header channel):

```bash
npm install
npm run build
PLANKA_API_KEY=... PLANKA_BASE_URL=... TRANSPORT=stdio node dist/index.js
```

## Local Development

```bash
npm install
npm run dev     # tsx watch, TRANSPORT defaults to http on :3001
npm run build   # compile to dist/
```

Test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

## Tools

All tools are prefixed `planka_`. Destructive tools (`delete`, `remove`) are annotated `destructiveHint: true`.

| Resource | Tools |
|---|---|
| Projects | `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project` |
| Boards | `get_board`, `create_board`, `update_board`, `delete_board`, `get_board_actions`, **`get_board_summary`** |
| Lists | `get_list`, `create_list`, `update_list`, `delete_list`, `get_list_cards`, `sort_list_cards`, `move_list_cards` |
| Cards | `get_card`, `create_card`, `update_card`, `delete_card`, `duplicate_card`, `get_card_actions`, **`move_card`** (by list ID, list name, next, or done), `add_card_member`, `remove_card_member` |
| Labels | `create_label`, `update_label`, `delete_label`, `add_card_label`, `remove_card_label`, **`add_card_label_by_name`**, **`remove_card_label_by_name`**, **`set_card_labels`** |
| Task Lists | `get_tasklist`, `create_tasklist`, `update_tasklist`, `delete_tasklist` |
| Tasks | `create_task`, `update_task`, `delete_task` |
| Comments | `list_comments`, `create_comment`, `update_comment`, `delete_comment` |
| Users | `list_users`, `get_user`, `create_user`, `update_user`, `delete_user` |
| Board Members | `add_board_member`, `update_board_member`, `remove_board_member` |
| Notifications | `list_notifications`, `read_all_notifications` |
| Webhooks | `list_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook` |

Bold entries are high-level workflow shortcuts that resolve names/positions server-side instead of requiring the client to look up IDs first.

## API Notes

- Card-label removal uses Planka's `labelId:{id}` path segment: `DELETE /cards/{cardId}/card-labels/labelId:{labelId}`
- Card-membership removal uses `userId:{id}`: `DELETE /cards/{cardId}/card-memberships/userId:{userId}`
- Moving cards between lists requires a `position`; the server auto-calculates end-of-list positions (multiples of `65536`) when not explicitly provided

## Requirements

- Docker (for the sidecar deployment), or Node.js 18+ for local development
- A running Planka instance with API key auth enabled

## License

MIT

---
name: planka
description: "Interact with Planka project management tool via its API. Create and manage projects, boards, lists, cards, tasks, comments, and notifications. Use for automating workflows, integrating with other tools, or building custom dashboards."
metadata: { "openclaw": { "emoji": "📋" } }
---

## Setup

Config is read from `~/.config/planka/auth.json`:

```json
{
  "api_url": "https://your-planka-instance.example.com",
  "api_key": "your-api-key-here"
}
```

Or via environment variables:
- `PLANKA_BASE_URL` — base URL of your Planka instance
- `PLANKA_API_KEY` — your Planka API key

The script lives at `scripts/planka-api.py` relative to the skill directory.

```bash
# Verify connection
python3 scripts/planka-api.py user get me
```

## Workflow Shortcuts (High-Level)

### Move a card

```bash
# Move to a specific list by name (case-insensitive, resolved within card's board)
python3 planka-api.py card move <card-id> --list-name "Done"
python3 planka-api.py card move <card-id> --list-name "In Progress"

# Move to next list in board order
python3 planka-api.py card move <card-id> --next

# Move to the 'Done' list (shorthand)
python3 planka-api.py card move <card-id> --done

# Move to a specific list by ID
python3 planka-api.py card move <card-id> --list-id <list-id>
```

### Labels by name

```bash
# Add a label by name (looks up label on the card's board)
python3 planka-api.py label add-by-name --card-id <id> --name "🔄 In Progress"

# Remove a label by name
python3 planka-api.py label remove-by-name --card-id <id> --name "🔄 In Progress"

# Replace ALL labels on a card with a new set (by name)
python3 planka-api.py label set --card-id <id> --names "🔄 In Progress" "Derbert"
```

### Card members

```bash
python3 planka-api.py card member add --card-id <id> --user-id <user-id>
python3 planka-api.py card member remove --card-id <id> --user-id <user-id>
```

### Board overview

```bash
# Returns lists with card counts and card names (great for quick status check)
python3 planka-api.py board summary <board-id>
```

---

## Basic Operations

```bash
python3 planka-api.py project list
python3 planka-api.py project create --name "My Project"
python3 planka-api.py board create --project-id <id> --name "Sprint 1"
python3 planka-api.py list create --board-id <id> --name "To Do"
python3 planka-api.py card update <id> name="New name" description="..."
python3 planka-api.py tasklist create --card-id <id> --name "Checklist"
python3 planka-api.py task create --tasklist-id <id> --name "Step 1"
python3 planka-api.py comment create --card-id <id> --text "LGTM"
python3 planka-api.py user get me
python3 planka-api.py notification list
```

## Creating Cards

```bash
python3 planka-api.py card create --list-id <id> --name "Task Title"
python3 planka-api.py card create --list-id <id> --name "Task Title" --position 131072 --description "..."
```

`position` defaults to `65536`. Use multiples of `65536` to control ordering.

### Card Creation Response

When a card is created, the response includes:

- **`_path`**: Full hierarchical path (e.g., `"My Project > Sprint 1 > To Do > Task Title"`)
- **`_url`**: Direct clickable link to the card (e.g., `"https://your-planka-instance.example.com/cards/xyz789"`)

Both are printed to stderr for convenience (so JSON output remains pure).

---

## All Commands Reference

| Resource | Actions |
|----------|---------|
| `project` | list, get, create, update, delete |
| `board` | get, create, update, delete, actions, **summary** |
| `list` | get, create, update, delete, cards, sort, move-cards |
| `card` | get, create, update, delete, duplicate, actions, **move**, **member add/remove** |
| `label` | create, update, delete, add, remove, **add-by-name**, **remove-by-name**, **set** |
| `tasklist` | get, create, update, delete |
| `task` | create, update, delete |
| `comment` | list, create, update, delete |
| `user` | list, get, create, update, delete |
| `notification` | list, read-all |
| `webhook` | list, create, update, delete |

## API Notes

- Card-label delete uses `labelId:{id}` path: `DELETE /cards/{cardId}/card-labels/labelId:{labelId}`
- Card-membership delete uses `userId:{id}` path: `DELETE /cards/{cardId}/card-memberships/userId:{userId}`
- Moving cards between lists requires `position` (auto-calculated as end of target list)

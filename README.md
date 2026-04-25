# skill-planka

An [OpenClaw](https://openclaw.ai) skill for interacting with [Planka](https://planka.app) — the open-source kanban project management tool.

## Features

- Manage projects, boards, lists, cards, tasks, comments, labels, members
- Move cards between lists by name or ID
- Add/remove/set labels by name (no need to look up label IDs)
- Board summary — quick status overview with card counts per list
- Webhook management
- Notification listing

## Install

Copy the skill directory to your OpenClaw skills folder:

```bash
cp -r skill-planka ~/.openclaw/skills/planka
```

Or clone directly:

```bash
git clone https://github.com/urmator/skill-planka ~/.openclaw/skills/planka
```

## Setup

Create `~/.config/planka/auth.json`:

```json
{
  "api_url": "https://your-planka-instance.example.com",
  "api_key": "your-api-key-here"
}
```

Or set environment variables:

```bash
export PLANKA_BASE_URL=https://your-planka-instance.example.com
export PLANKA_API_KEY=your-api-key-here
```

## Quick Start

```bash
# List all projects
python3 scripts/planka-api.py project list

# Board summary
python3 scripts/planka-api.py board summary <board-id>

# Move a card to "Done"
python3 scripts/planka-api.py card move <card-id> --done

# Set labels on a card
python3 scripts/planka-api.py label set --card-id <id> --names "🔄 In Progress" "Priority"
```

See [SKILL.md](SKILL.md) for the full command reference.

## Requirements

- Python 3.8+
- No external dependencies (uses stdlib `urllib` only)
- A running Planka instance with API key auth enabled

## License

MIT

#!/usr/bin/env python3
"""Planka API CLI wrapper — reads API key from ~/.config/planka/config.json."""

import argparse
import json
import os
import sys
from urllib import request, error
from urllib.parse import urlencode

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CONFIG_PATH = os.path.expanduser("~/.config/planka/auth.json")
DEFAULT_BASE_URL = "http://localhost:3000/api"


def load_config():
    path = os.environ.get("PLANKA_CONFIG", CONFIG_PATH)
    if os.path.isfile(path):
        with open(path) as f:
            try:
                return json.load(f)
            except json.JSONDecodeError as exc:
                print(f"Warning: cannot parse {path}: {exc}", file=sys.stderr)
    return {}


def get_api_key(cfg):
    if os.environ.get("PLANKA_API_KEY"):
        return os.environ["PLANKA_API_KEY"]
    for k in ("apiKey", "api_key", "API_KEY", "key"):
        if cfg.get(k):
            return cfg[k]
    return None


def get_base_url(cfg):
    if os.environ.get("PLANKA_BASE_URL"):
        return os.environ["PLANKA_BASE_URL"].rstrip("/")
    # Config key precedence: baseUrl > base_url > url (bare host) > default
    raw = cfg.get("apiUrl") or cfg.get("api_url") or cfg.get("url") or DEFAULT_BASE_URL
    raw = raw.rstrip("/")
    # Append /api when the URL is a bare host without the API path
    if not raw.endswith("/api"):
        raw = raw + "/api"
    return raw


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


class PlankaClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key

    def _req(self, method: str, path: str, data=None, params=None):
        url = f"{self.base_url}{path}"
        if params:
            url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
        body = json.dumps(data).encode() if data is not None else None
        headers = {
            "X-Api-Key": self.api_key,
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        if body:
            headers["Content-Type"] = "application/json"
        req = request.Request(url, data=body, headers=headers, method=method)
        try:
            with request.urlopen(req) as resp:
                return json.loads(resp.read())
        except error.HTTPError as exc:
            payload = exc.read()
            try:
                print(json.dumps(json.loads(payload), indent=2), file=sys.stderr)
            except Exception:
                print(payload.decode(errors="replace"), file=sys.stderr)
            sys.exit(exc.code)

    def get(self, path, params=None):
        return self._req("GET", path, params=params)

    def post(self, path, data=None):
        return self._req("POST", path, data=data if data is not None else {})

    def patch(self, path, data):
        return self._req("PATCH", path, data=data)

    def delete(self, path):
        return self._req("DELETE", path)

    # ---- Projects ----------------------------------------------------------
    def project_list(self):
        return self.get("/projects")

    def project_get(self, id_):
        return self.get(f"/projects/{id_}")

    def project_create(self, type_, name, desc=None):
        d = {"type": type_, "name": name}
        if desc:
            d["description"] = desc
        return self.post("/projects", d)

    def project_update(self, id_, **kw):
        return self.patch(f"/projects/{id_}", kw)

    def project_delete(self, id_):
        return self.delete(f"/projects/{id_}")

    # ---- Boards ------------------------------------------------------------
    def board_get(self, id_):
        return self.get(f"/boards/{id_}")

    def board_create(self, project_id, name, position=65536):
        return self.post(f"/projects/{project_id}/boards",
                         {"name": name, "position": position})

    def board_update(self, id_, **kw):
        return self.patch(f"/boards/{id_}", kw)

    def board_delete(self, id_):
        return self.delete(f"/boards/{id_}")

    def board_actions(self, id_, before_id=None):
        return self.get(f"/boards/{id_}/actions",
                        params={"beforeId": before_id} if before_id else None)

    def board_summary(self, id_):
        """Return a human-readable summary of a board: lists + card counts."""
        resp = self.board_get(id_)
        included = resp.get("included", {})
        board = resp.get("item", {})
        lists = sorted(
            [l for l in included.get("lists", []) if l.get("type") == "active"],
            key=lambda l: l.get("position", 0),
        )
        cards = included.get("cards", [])
        card_labels_map = {}
        for cl in included.get("cardLabels", []):
            card_labels_map.setdefault(cl["cardId"], []).append(cl["labelId"])
        labels_by_id = {l["id"]: l for l in included.get("labels", [])}
        list_id_to_name = {l["id"]: l["name"] for l in lists}

        summary = {
            "board": board.get("name"),
            "url": f"{self.base_url.rsplit('/api', 1)[0]}/boards/{id_}",
            "lists": [],
        }
        counts = {}
        card_details = {}
        for c in cards:
            lid = c.get("listId")
            counts[lid] = counts.get(lid, 0) + 1
            card_details.setdefault(lid, []).append({
                "id": c["id"],
                "name": c["name"],
                "labels": [labels_by_id[lbl_id]["name"] for lbl_id in card_labels_map.get(c["id"], []) if lbl_id in labels_by_id],
                "url": f"{self.base_url.rsplit('/api', 1)[0]}/cards/{c['id']}",
            })

        for lst in lists:
            summary["lists"].append({
                "id": lst["id"],
                "name": lst["name"],
                "card_count": counts.get(lst["id"], 0),
                "cards": card_details.get(lst["id"], []),
            })
        return summary

    # ---- Lists -------------------------------------------------------------
    def list_get(self, id_):
        return self.get(f"/lists/{id_}")

    def list_create(self, board_id, name, type_="active", position=65536):
        return self.post(f"/boards/{board_id}/lists",
                         {"name": name, "type": type_, "position": position})

    def list_update(self, id_, **kw):
        return self.patch(f"/lists/{id_}", kw)

    def list_delete(self, id_):
        return self.delete(f"/lists/{id_}")

    def list_cards(self, id_, **params):
        return self.get(f"/lists/{id_}/cards", params=params or None)

    def list_sort_cards(self, id_, field_name, order="asc"):
        return self.post(f"/lists/{id_}/sort", {"fieldName": field_name, "order": order})

    def list_move_cards(self, id_, to_list_id):
        return self.post(f"/lists/{id_}/move-cards", {"listId": to_list_id})

    # ---- Cards -------------------------------------------------------------
    def card_get(self, id_):
        return self.get(f"/cards/{id_}")

    def card_create(self, list_id, name, type_="project", position=65536, **kw):
        d = {"type": type_, "name": name, "position": position}
        d.update(kw)
        response = self.post(f"/lists/{list_id}/cards", d)
        # Extract card data (API wraps it in 'item')
        card = response.get("item", response)
        # Fetch parent hierarchy for full path
        try:
            list_response = self.list_get(list_id)
            list_obj = list_response.get("item", list_response)
            board_response = self.board_get(list_obj["boardId"])
            board_obj = board_response.get("item", board_response)
            project_response = self.project_get(board_obj["projectId"])
            project_obj = project_response.get("item", project_response)
            card["_path"] = f"{project_obj['name']} > {board_obj['name']} > {list_obj['name']} > {card['name']}"
            card["_url"] = f"{self.base_url.rsplit('/api', 1)[0]}/cards/{card['id']}"
        except Exception:
            pass  # Return card without path if hierarchy fetch fails
        return response  # Return full response to maintain structure

    def card_update(self, id_, **kw):
        return self.patch(f"/cards/{id_}", kw)

    def card_delete(self, id_):
        return self.delete(f"/cards/{id_}")

    def card_duplicate(self, id_, **kw):
        return self.post(f"/cards/{id_}/duplicate", kw)

    def card_actions(self, id_, before_id=None):
        return self.get(f"/cards/{id_}/actions",
                        params={"beforeId": before_id} if before_id else None)

    def _next_position_in_list(self, list_id):
        """Return a position value that places the card at the end of the target list."""
        try:
            resp = self.list_cards(list_id)
            cards = resp.get("items", [])
            if not cards:
                return 65536
            max_pos = max((c.get("position", 0) for c in cards), default=0)
            return max_pos + 65536
        except Exception:
            return 65536

    def card_move(self, card_id, list_id, position=None):
        """Move a card to a specific list by list ID."""
        pos = position if position is not None else self._next_position_in_list(list_id)
        return self.patch(f"/cards/{card_id}", {"listId": list_id, "position": pos})

    def card_move_by_name(self, card_id, list_name):
        """Move a card to a list identified by name (within the card's board)."""
        card_resp = self.card_get(card_id)
        card = card_resp.get("item", card_resp)
        board_resp = self.board_get(card["boardId"])
        included = board_resp.get("included", {})
        lists = [l for l in included.get("lists", []) if l.get("type") == "active"]
        match = next(
            (l for l in lists if l["name"].lower() == list_name.lower()), None
        )
        if not match:
            available = [l["name"] for l in lists]
            print(
                f"List '{list_name}' not found. Available lists: {available}",
                file=sys.stderr,
            )
            sys.exit(1)
        pos = self._next_position_in_list(match["id"])
        result = self.patch(f"/cards/{card_id}", {"listId": match["id"], "position": pos})
        print(f"Moved to: {match['name']} (id: {match['id']})", file=sys.stderr)
        return result

    def card_move_next(self, card_id):
        """Move a card to the next list in position order on its board."""
        card_resp = self.card_get(card_id)
        card = card_resp.get("item", card_resp)
        board_resp = self.board_get(card["boardId"])
        included = board_resp.get("included", {})
        lists = sorted(
            [l for l in included.get("lists", []) if l.get("type") == "active"],
            key=lambda l: l.get("position", 0),
        )
        current_idx = next(
            (i for i, l in enumerate(lists) if l["id"] == card["listId"]), None
        )
        if current_idx is None:
            print("Could not find card's current list.", file=sys.stderr)
            sys.exit(1)
        if current_idx + 1 >= len(lists):
            print(
                f"Already in last list: '{lists[current_idx]['name']}'. Cannot move further.",
                file=sys.stderr,
            )
            sys.exit(1)
        next_list = lists[current_idx + 1]
        pos = self._next_position_in_list(next_list["id"])
        result = self.patch(f"/cards/{card_id}", {"listId": next_list["id"], "position": pos})
        print(
            f"Moved from '{lists[current_idx]['name']}' → '{next_list['name']}'",
            file=sys.stderr,
        )
        return result

    def card_move_done(self, card_id):
        """Move a card to the first list named 'Done' (case-insensitive) on its board."""
        return self.card_move_by_name(card_id, "Done")

    # ---- Card labels (by name) ---------------------------------------------
    def _get_board_data_for_card(self, card_id):
        """Return (card, lists, labels) fetched from the card's board."""
        card_resp = self.card_get(card_id)
        card = card_resp.get("item", card_resp)
        board_resp = self.board_get(card["boardId"])
        included = board_resp.get("included", {})
        return card, included.get("lists", []), included.get("labels", []), included.get("cardLabels", [])

    def card_label_add(self, card_id, label_id):
        return self.post(f"/cards/{card_id}/card-labels", {"labelId": label_id})

    def card_label_remove(self, card_id, label_id):
        return self.delete(f"/cards/{card_id}/card-labels/labelId:{label_id}")

    def card_label_add_by_name(self, card_id, label_name):
        """Add a label to a card by label name (resolved within the card's board)."""
        card, _, labels, _ = self._get_board_data_for_card(card_id)
        match = next(
            (l for l in labels if l["name"].lower() == label_name.lower()), None
        )
        if not match:
            available = [l["name"] for l in labels]
            print(
                f"Label '{label_name}' not found on board. Available: {available}",
                file=sys.stderr,
            )
            sys.exit(1)
        result = self.post(f"/cards/{card_id}/card-labels", {"labelId": match["id"]})
        print(f"Added label: {match['name']}", file=sys.stderr)
        return result

    def card_label_remove_by_name(self, card_id, label_name):
        """Remove a label from a card by label name."""
        card, _, labels, card_labels = self._get_board_data_for_card(card_id)
        match = next(
            (l for l in labels if l["name"].lower() == label_name.lower()), None
        )
        if not match:
            available = [l["name"] for l in labels]
            print(
                f"Label '{label_name}' not found on board. Available: {available}",
                file=sys.stderr,
            )
            sys.exit(1)
        # Check if this label is actually on the card
        cl_entry = next(
            (cl for cl in card_labels if cl["cardId"] == card_id and cl["labelId"] == match["id"]),
            None,
        )
        if not cl_entry:
            print(f"Label '{label_name}' is not applied to this card.", file=sys.stderr)
            sys.exit(1)
        # Delete uses labelId: prefix format
        result = self.delete(f"/cards/{card_id}/card-labels/labelId:{match['id']}")
        print(f"Removed label: {match['name']}", file=sys.stderr)
        return result

    def card_label_set(self, card_id, label_names):
        """Replace all labels on a card with the given list of label names."""
        card, _, labels, card_labels = self._get_board_data_for_card(card_id)
        # Remove all current labels on this card using labelId: prefix format
        current_cls = [cl for cl in card_labels if cl["cardId"] == card_id]
        for cl in current_cls:
            self.delete(f"/cards/{card_id}/card-labels/labelId:{cl['labelId']}")

        results = []
        labels_lower = {l["name"].lower(): l for l in labels}
        for name in label_names:
            match = labels_lower.get(name.lower())
            if not match:
                available = list(labels_lower.keys())
                print(
                    f"Label '{name}' not found on board. Available: {available}",
                    file=sys.stderr,
                )
                sys.exit(1)
            r = self.post(f"/cards/{card_id}/card-labels", {"labelId": match["id"]})
            results.append({"label": match["name"], "result": r})
            print(f"Set label: {match['name']}", file=sys.stderr)
        return {"set": results}

    # ---- Card members (card memberships) -----------------------------------
    def card_member_add(self, card_id, user_id):
        return self.post(f"/cards/{card_id}/card-memberships", {"userId": user_id})

    def card_member_remove(self, card_id, user_id):
        """Remove a user from a card's members by user ID."""
        return self.delete(f"/cards/{card_id}/card-memberships/userId:{user_id}")

    # ---- Task lists --------------------------------------------------------
    def tasklist_get(self, id_):
        return self.get(f"/task-lists/{id_}")

    def tasklist_create(self, card_id, name, position=65536, **kw):
        d = {"name": name, "position": position}
        d.update(kw)
        return self.post(f"/cards/{card_id}/task-lists", d)

    def tasklist_update(self, id_, **kw):
        return self.patch(f"/task-lists/{id_}", kw)

    def tasklist_delete(self, id_):
        return self.delete(f"/task-lists/{id_}")

    # ---- Tasks -------------------------------------------------------------
    def task_create(self, tasklist_id, name, position=65536, **kw):
        d = {"name": name, "position": position}
        d.update(kw)
        return self.post(f"/task-lists/{tasklist_id}/tasks", d)

    def task_update(self, id_, **kw):
        return self.patch(f"/tasks/{id_}", kw)

    def task_delete(self, id_):
        return self.delete(f"/tasks/{id_}")

    # ---- Labels ------------------------------------------------------------
    def label_create(self, board_id, name, color, position=65536):
        return self.post(f"/boards/{board_id}/labels",
                         {"name": name, "color": color, "position": position})

    def label_update(self, id_, **kw):
        return self.patch(f"/labels/{id_}", kw)

    def label_delete(self, id_):
        return self.delete(f"/labels/{id_}")

    # ---- Comments ----------------------------------------------------------
    def comment_list(self, card_id, before_id=None):
        return self.get(f"/cards/{card_id}/comments",
                        params={"beforeId": before_id} if before_id else None)

    def comment_create(self, card_id, text):
        return self.post(f"/cards/{card_id}/comments", {"text": text})

    def comment_update(self, id_, text):
        return self.patch(f"/comments/{id_}", {"text": text})

    def comment_delete(self, id_):
        return self.delete(f"/comments/{id_}")

    # ---- Users -------------------------------------------------------------
    def user_list(self):
        return self.get("/users")

    def user_get(self, id_="me"):
        return self.get(f"/users/{id_}")

    def user_create(self, email, password, role, name, **kw):
        d = {"email": email, "password": password, "role": role, "name": name}
        d.update(kw)
        return self.post("/users", d)

    def user_update(self, id_, **kw):
        return self.patch(f"/users/{id_}", kw)

    def user_delete(self, id_):
        return self.delete(f"/users/{id_}")

    # ---- Board memberships -------------------------------------------------
    def board_member_add(self, board_id, user_id, role="editor", can_comment=None):
        d = {"userId": user_id, "role": role}
        if can_comment is not None:
            d["canComment"] = can_comment
        return self.post(f"/boards/{board_id}/memberships", d)

    def board_member_update(self, id_, **kw):
        return self.patch(f"/board-memberships/{id_}", kw)

    def board_member_remove(self, id_):
        return self.delete(f"/board-memberships/{id_}")

    # ---- Notifications -----------------------------------------------------
    def notification_list(self):
        return self.get("/notifications")

    def notification_read_all(self):
        return self.post("/notifications/read-all")

    # ---- Webhooks (admin) --------------------------------------------------
    def webhook_list(self):
        return self.get("/webhooks")

    def webhook_create(self, name, url, **kw):
        d = {"name": name, "url": url}
        d.update(kw)
        return self.post("/webhooks", d)

    def webhook_update(self, id_, **kw):
        return self.patch(f"/webhooks/{id_}", kw)

    def webhook_delete(self, id_):
        return self.delete(f"/webhooks/{id_}")


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------


def out(data, raw=False):
    print(json.dumps(data) if raw else json.dumps(data, indent=2, ensure_ascii=False))


def kv_pairs(pairs):
    """Parse ['key=value', ...] into a dict, JSON-decoding values where possible."""
    d = {}
    for p in (pairs or []):
        if "=" not in p:
            print(f"Invalid key=value: {p!r}  (expected key=value)", file=sys.stderr)
            sys.exit(1)
        k, v = p.split("=", 1)
        try:
            v = json.loads(v)
        except (ValueError, json.JSONDecodeError):
            pass
        d[k] = v
    return d


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------


def build_parser():
    p = argparse.ArgumentParser(
        prog="planka-api",
        description="CLI wrapper for the Planka REST API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Workflow shortcuts:
  card move <id> --list-name Done              Move card to 'Done' list by name
  card move <id> --next                        Move card to next list in sequence
  card move <id> --done                        Move card to first 'Done' list
  label add-by-name --card-id <id> --name X    Add label by name
  label remove-by-name --card-id <id> --name X Remove label by name
  label set --card-id <id> --names X Y Z       Replace all labels with named set
  card member add --card-id <id> --user-id <u> Add user to card
  board summary <id>                           Board overview with card counts

Tip: pipe output through `jq` for further filtering.
""",
    )
    p.add_argument("--raw", action="store_true", help="Output compact JSON")
    sub = p.add_subparsers(dest="resource", metavar="RESOURCE")

    # ---- project -----------------------------------------------------------
    proj = sub.add_parser("project", help="Project operations")
    ps = proj.add_subparsers(dest="action", metavar="ACTION")
    ps.add_parser("list")
    g = ps.add_parser("get");    g.add_argument("id")
    c = ps.add_parser("create")
    c.add_argument("--type", default="private", choices=["private", "shared"])
    c.add_argument("--name", required=True)
    c.add_argument("--description")
    u = ps.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = ps.add_parser("delete"); d.add_argument("id")

    # ---- board -------------------------------------------------------------
    board = sub.add_parser("board", help="Board operations")
    bs = board.add_subparsers(dest="action", metavar="ACTION")
    g = bs.add_parser("get"); g.add_argument("id")
    c = bs.add_parser("create")
    c.add_argument("--project-id", required=True)
    c.add_argument("--name", required=True)
    c.add_argument("--position", type=int, default=65536)
    u = bs.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = bs.add_parser("delete"); d.add_argument("id")
    a = bs.add_parser("actions"); a.add_argument("id"); a.add_argument("--before-id")
    bs.add_parser("summary").add_argument("id", help="Board ID")

    # ---- list --------------------------------------------------------------
    lst = sub.add_parser("list", help="List operations")
    ls = lst.add_subparsers(dest="action", metavar="ACTION")
    g = ls.add_parser("get"); g.add_argument("id")
    c = ls.add_parser("create")
    c.add_argument("--board-id", required=True)
    c.add_argument("--name", required=True)
    c.add_argument("--type", default="active", choices=["active", "closed"])
    c.add_argument("--position", type=int, default=65536)
    u = ls.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = ls.add_parser("delete"); d.add_argument("id")
    ca = ls.add_parser("cards"); ca.add_argument("id")
    ca.add_argument("--search"); ca.add_argument("--user-ids"); ca.add_argument("--label-ids")
    srt = ls.add_parser("sort"); srt.add_argument("id")
    srt.add_argument("--by", default="name", choices=["name", "dueDate", "createdAt"])
    srt.add_argument("--order", default="asc", choices=["asc", "desc"])
    mv = ls.add_parser("move-cards"); mv.add_argument("id"); mv.add_argument("--to-list", required=True)

    # ---- card --------------------------------------------------------------
    crd = sub.add_parser("card", help="Card operations")
    cs = crd.add_subparsers(dest="action", metavar="ACTION")
    g = cs.add_parser("get"); g.add_argument("id")
    c = cs.add_parser("create")
    c.add_argument("--list-id", required=True)
    c.add_argument("--name", required=True)
    c.add_argument("--type", default="project", choices=["project", "story"])
    c.add_argument("--description")
    c.add_argument("--due-date")
    c.add_argument("--position", type=int, default=65536)
    u = cs.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = cs.add_parser("delete"); d.add_argument("id")
    dup = cs.add_parser("duplicate"); dup.add_argument("id"); dup.add_argument("kv", nargs="*", metavar="key=value")
    a = cs.add_parser("actions"); a.add_argument("id"); a.add_argument("--before-id")

    # card move — smart move with multiple strategies
    mv = cs.add_parser("move", help="Move card to a list")
    mv.add_argument("id", help="Card ID")
    mv_group = mv.add_mutually_exclusive_group(required=True)
    mv_group.add_argument("--list-id", help="Target list ID")
    mv_group.add_argument("--list-name", metavar="NAME", help="Target list name (resolved within card's board)")
    mv_group.add_argument("--next", action="store_true", help="Move to next list in board order")
    mv_group.add_argument("--done", action="store_true", help="Move to 'Done' list")

    # card member management
    cm = cs.add_parser("member", help="Manage card members")
    cms = cm.add_subparsers(dest="member_action", metavar="ACTION")
    cma = cms.add_parser("add"); cma.add_argument("--card-id", required=True); cma.add_argument("--user-id", required=True)
    cmr = cms.add_parser("remove"); cmr.add_argument("--card-id", required=True); cmr.add_argument("--user-id", required=True)

    # ---- tasklist ----------------------------------------------------------
    tl = sub.add_parser("tasklist", help="Task list operations")
    tls = tl.add_subparsers(dest="action", metavar="ACTION")
    g = tls.add_parser("get"); g.add_argument("id")
    c = tls.add_parser("create")
    c.add_argument("--card-id", required=True)
    c.add_argument("--name", required=True)
    c.add_argument("--position", type=int, default=65536)
    u = tls.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = tls.add_parser("delete"); d.add_argument("id")

    # ---- task --------------------------------------------------------------
    tsk = sub.add_parser("task", help="Task operations")
    tsks = tsk.add_subparsers(dest="action", metavar="ACTION")
    c = tsks.add_parser("create")
    c.add_argument("--tasklist-id", required=True)
    c.add_argument("--name", required=True)
    c.add_argument("--position", type=int, default=65536)
    c.add_argument("--completed", action="store_true")
    u = tsks.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = tsks.add_parser("delete"); d.add_argument("id")

    # ---- label -------------------------------------------------------------
    lbl = sub.add_parser("label", help="Label operations")
    lbls = lbl.add_subparsers(dest="action", metavar="ACTION")
    c = lbls.add_parser("create")
    c.add_argument("--board-id", required=True)
    c.add_argument("--name", required=True)
    c.add_argument("--color", required=True)
    c.add_argument("--position", type=int, default=65536)
    u = lbls.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = lbls.add_parser("delete"); d.add_argument("id")
    la = lbls.add_parser("add"); la.add_argument("--card-id", required=True); la.add_argument("--label-id", required=True)
    lr = lbls.add_parser("remove"); lr.add_argument("--card-id", required=True); lr.add_argument("--label-id", required=True)

    # label by-name operations
    lan = lbls.add_parser("add-by-name", help="Add label to card by label name")
    lan.add_argument("--card-id", required=True)
    lan.add_argument("--name", required=True, help="Label name (case-insensitive)")
    lrn = lbls.add_parser("remove-by-name", help="Remove label from card by label name")
    lrn.add_argument("--card-id", required=True)
    lrn.add_argument("--name", required=True, help="Label name (case-insensitive)")
    lset = lbls.add_parser("set", help="Replace all card labels with named labels")
    lset.add_argument("--card-id", required=True)
    lset.add_argument("--names", nargs="+", required=True, metavar="NAME", help="Label name(s) to set")

    # ---- comment -----------------------------------------------------------
    com = sub.add_parser("comment", help="Comment operations")
    coms = com.add_subparsers(dest="action", metavar="ACTION")
    l = coms.add_parser("list"); l.add_argument("card_id"); l.add_argument("--before-id")
    c = coms.add_parser("create"); c.add_argument("--card-id", required=True); c.add_argument("--text", required=True)
    u = coms.add_parser("update"); u.add_argument("id"); u.add_argument("--text", required=True)
    d = coms.add_parser("delete"); d.add_argument("id")

    # ---- user --------------------------------------------------------------
    usr = sub.add_parser("user", help="User operations")
    usrs = usr.add_subparsers(dest="action", metavar="ACTION")
    usrs.add_parser("list")
    g = usrs.add_parser("get"); g.add_argument("id", nargs="?", default="me")
    c = usrs.add_parser("create")
    c.add_argument("--email", required=True)
    c.add_argument("--password", required=True)
    c.add_argument("--role", required=True, choices=["admin", "projectOwner", "boardUser"])
    c.add_argument("--name", required=True)
    u = usrs.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = usrs.add_parser("delete"); d.add_argument("id")

    # ---- notification ------------------------------------------------------
    notif = sub.add_parser("notification", help="Notification operations")
    ns = notif.add_subparsers(dest="action", metavar="ACTION")
    ns.add_parser("list")
    ns.add_parser("read-all")

    # ---- webhook (admin) ---------------------------------------------------
    wh = sub.add_parser("webhook", help="Webhook operations (admin)")
    whs = wh.add_subparsers(dest="action", metavar="ACTION")
    whs.add_parser("list")
    c = whs.add_parser("create"); c.add_argument("--name", required=True); c.add_argument("--url", required=True)
    c.add_argument("kv", nargs="*", metavar="key=value")
    u = whs.add_parser("update"); u.add_argument("id"); u.add_argument("kv", nargs="*", metavar="key=value")
    d = whs.add_parser("delete"); d.add_argument("id")

    return p


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------


def main():
    cfg = load_config()
    api_key = get_api_key(cfg)
    if not api_key:
        cfg_path = os.environ.get("PLANKA_CONFIG", CONFIG_PATH)
        print(
            f"No API key found.\n"
            f"  Set PLANKA_API_KEY env var, or\n"
            f"  create {cfg_path} with {{\"apiKey\": \"<your-key>\"}}",
            file=sys.stderr,
        )
        sys.exit(1)

    client = PlankaClient(get_base_url(cfg), api_key)
    parser = build_parser()
    args = parser.parse_args()
    raw = getattr(args, "raw", False)
    emit = lambda d: out(d, raw=raw)

    r = args.resource
    a = getattr(args, "action", None)

    if r == "project":
        if a == "list":     emit(client.project_list())
        elif a == "get":    emit(client.project_get(args.id))
        elif a == "create": emit(client.project_create(args.type, args.name, args.description))
        elif a == "update": emit(client.project_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.project_delete(args.id))
        else: parser.parse_args(["project", "--help"])

    elif r == "board":
        if a == "get":      emit(client.board_get(args.id))
        elif a == "create": emit(client.board_create(args.project_id, args.name, args.position))
        elif a == "update": emit(client.board_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.board_delete(args.id))
        elif a == "actions":emit(client.board_actions(args.id, args.before_id))
        elif a == "summary":emit(client.board_summary(args.id))
        else: parser.parse_args(["board", "--help"])

    elif r == "list":
        if a == "get":      emit(client.list_get(args.id))
        elif a == "create": emit(client.list_create(args.board_id, args.name, args.type, args.position))
        elif a == "update": emit(client.list_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.list_delete(args.id))
        elif a == "cards":
            params = {}
            if args.search:    params["search"] = args.search
            if args.user_ids:  params["userIds"] = args.user_ids
            if args.label_ids: params["labelIds"] = args.label_ids
            emit(client.list_cards(args.id, **params))
        elif a == "sort":       emit(client.list_sort_cards(args.id, args.by, args.order))
        elif a == "move-cards": emit(client.list_move_cards(args.id, args.to_list))
        else: parser.parse_args(["list", "--help"])

    elif r == "card":
        if a == "get":      emit(client.card_get(args.id))
        elif a == "create":
            kw = {}
            if args.description: kw["description"] = args.description
            if args.due_date:    kw["dueDate"] = args.due_date
            result = client.card_create(args.list_id, args.name, args.type, args.position, **kw)
            emit(result)
            # Print path and URL for convenience (to stderr so they don't break JSON output)
            card = result.get("item", result)
            if "_path" in card:
                print(f"Path: {card['_path']}", file=sys.stderr)
            if "_url" in card:
                print(f"URL:  {card['_url']}", file=sys.stderr)
        elif a == "update":    emit(client.card_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete":    emit(client.card_delete(args.id))
        elif a == "duplicate": emit(client.card_duplicate(args.id, **kv_pairs(args.kv)))
        elif a == "actions":   emit(client.card_actions(args.id, args.before_id))
        elif a == "move":
            if args.list_id:
                emit(client.card_move(args.id, args.list_id))
            elif args.list_name:
                emit(client.card_move_by_name(args.id, args.list_name))
            elif args.next:
                emit(client.card_move_next(args.id))
            elif args.done:
                emit(client.card_move_done(args.id))
        elif a == "member":
            ma = getattr(args, "member_action", None)
            if ma == "add":    emit(client.card_member_add(args.card_id, args.user_id))
            elif ma == "remove": emit(client.card_member_remove(args.card_id, args.user_id))
            else: parser.parse_args(["card", "member", "--help"])
        else: parser.parse_args(["card", "--help"])

    elif r == "tasklist":
        if a == "get":      emit(client.tasklist_get(args.id))
        elif a == "create": emit(client.tasklist_create(args.card_id, args.name, args.position))
        elif a == "update": emit(client.tasklist_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.tasklist_delete(args.id))
        else: parser.parse_args(["tasklist", "--help"])

    elif r == "task":
        if a == "create":
            emit(client.task_create(args.tasklist_id, args.name, args.position,
                                    isCompleted=args.completed))
        elif a == "update": emit(client.task_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.task_delete(args.id))
        else: parser.parse_args(["task", "--help"])

    elif r == "label":
        if a == "create":        emit(client.label_create(args.board_id, args.name, args.color, args.position))
        elif a == "update":      emit(client.label_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete":      emit(client.label_delete(args.id))
        elif a == "add":         emit(client.card_label_add(args.card_id, args.label_id))
        elif a == "remove":      emit(client.card_label_remove(args.card_id, args.label_id))
        elif a == "add-by-name": emit(client.card_label_add_by_name(args.card_id, args.name))
        elif a == "remove-by-name": emit(client.card_label_remove_by_name(args.card_id, args.name))
        elif a == "set":         emit(client.card_label_set(args.card_id, args.names))
        else: parser.parse_args(["label", "--help"])

    elif r == "comment":
        if a == "list":     emit(client.comment_list(args.card_id, args.before_id))
        elif a == "create": emit(client.comment_create(args.card_id, args.text))
        elif a == "update": emit(client.comment_update(args.id, args.text))
        elif a == "delete": emit(client.comment_delete(args.id))
        else: parser.parse_args(["comment", "--help"])

    elif r == "user":
        if a == "list":   emit(client.user_list())
        elif a == "get":  emit(client.user_get(args.id))
        elif a == "create":
            emit(client.user_create(args.email, args.password, args.role, args.name))
        elif a == "update": emit(client.user_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.user_delete(args.id))
        else: parser.parse_args(["user", "--help"])

    elif r == "notification":
        if a == "list":       emit(client.notification_list())
        elif a == "read-all": emit(client.notification_read_all())
        else: parser.parse_args(["notification", "--help"])

    elif r == "webhook":
        if a == "list":   emit(client.webhook_list())
        elif a == "create":
            emit(client.webhook_create(args.name, args.url, **kv_pairs(args.kv)))
        elif a == "update": emit(client.webhook_update(args.id, **kv_pairs(args.kv)))
        elif a == "delete": emit(client.webhook_delete(args.id))
        else: parser.parse_args(["webhook", "--help"])

    else:
        parser.print_help()


if __name__ == "__main__":
    main()

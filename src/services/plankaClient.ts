import axios, { AxiosError, type AxiosInstance } from "axios";
import { DEFAULT_POSITION } from "../constants.js";
import type { PlankaConfig } from "../config.js";
import type { BoardSummary, PlankaEnvelope } from "../types.js";

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<any>;
    if (err.response) {
      const detail =
        (err.response.data && (err.response.data as any).message) ||
        JSON.stringify(err.response.data);
      switch (err.response.status) {
        case 400:
          return `Error: Bad request (400) - ${detail}. Check the parameters you supplied.`;
        case 401:
          return "Error: Unauthorized (401). Check that PLANKA_API_KEY is set and valid.";
        case 403:
          return "Error: Permission denied (403). You don't have access to this resource.";
        case 404:
          return "Error: Resource not found (404). Please check the ID is correct.";
        case 429:
          return "Error: Rate limit exceeded (429). Please wait before making more requests.";
        default:
          return `Error: API request failed with status ${err.response.status} - ${detail}`;
      }
    } else if (err.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    } else if (err.code === "ECONNREFUSED") {
      return "Error: Connection refused. Check that PLANKA_BASE_URL points at a running Planka instance.";
    }
  }
  return `Error: Unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`;
}

export class PlankaApiError extends Error {}

export class PlankaClient {
  private readonly http: AxiosInstance;
  readonly baseUrl: string;

  constructor(config: PlankaConfig) {
    this.baseUrl = config.baseUrl;
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        "X-Api-Key": config.apiKey,
        Accept: "application/json",
      },
    });
  }

  /** Base URL of the Planka web app (baseUrl without the trailing /api). */
  get webUrl(): string {
    return this.baseUrl.replace(/\/api$/, "");
  }

  private async request<T = any>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<T> {
    try {
      const response = await this.http.request<T>({ method, url: path, data, params });
      return response.data;
    } catch (error) {
      throw new PlankaApiError(handleApiError(error));
    }
  }

  private get<T = any>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }
  private post<T = any>(path: string, data?: unknown): Promise<T> {
    return this.request<T>("POST", path, data ?? {});
  }
  private patch<T = any>(path: string, data: unknown): Promise<T> {
    return this.request<T>("PATCH", path, data);
  }
  private del<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private static unwrap<T>(envelope: PlankaEnvelope<T> | T): T {
    if (envelope && typeof envelope === "object" && "item" in (envelope as any)) {
      return (envelope as PlankaEnvelope<T>).item as T;
    }
    return envelope as T;
  }

  // ---- Projects -----------------------------------------------------------
  projectList() {
    return this.get("/projects");
  }
  projectGet(id: string) {
    return this.get(`/projects/${id}`);
  }
  projectCreate(type: string, name: string, description?: string) {
    const d: Record<string, unknown> = { type, name };
    if (description) d.description = description;
    return this.post("/projects", d);
  }
  projectUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/projects/${id}`, fields);
  }
  projectDelete(id: string) {
    return this.del(`/projects/${id}`);
  }

  // ---- Boards ---------------------------------------------------------------
  boardGet(id: string) {
    return this.get(`/boards/${id}`);
  }
  boardCreate(projectId: string, name: string, position = DEFAULT_POSITION) {
    return this.post(`/projects/${projectId}/boards`, { name, position });
  }
  boardUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/boards/${id}`, fields);
  }
  boardDelete(id: string) {
    return this.del(`/boards/${id}`);
  }
  boardActions(id: string, beforeId?: string) {
    return this.get(`/boards/${id}/actions`, beforeId ? { beforeId } : undefined);
  }

  async boardSummary(id: string): Promise<BoardSummary> {
    const resp = await this.boardGet(id);
    const included = resp.included || {};
    const board = resp.item || {};
    const lists = (included.lists || [])
      .filter((l: any) => l.type === "active")
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const cards: any[] = included.cards || [];
    const cardLabelsMap = new Map<string, string[]>();
    for (const cl of included.cardLabels || ([] as any[])) {
      const arr = cardLabelsMap.get((cl as any).cardId) || [];
      arr.push((cl as any).labelId);
      cardLabelsMap.set((cl as any).cardId, arr);
    }
    const labelsById = new Map((included.labels || ([] as any[])).map((l: any) => [l.id, l]));

    const counts = new Map<string, number>();
    const cardDetails = new Map<string, any[]>();
    for (const c of cards) {
      const lid = c.listId;
      counts.set(lid, (counts.get(lid) || 0) + 1);
      const arr = cardDetails.get(lid) || [];
      arr.push({
        id: c.id,
        name: c.name,
        labels: (cardLabelsMap.get(c.id) || [])
          .map((lblId) => labelsById.get(lblId))
          .filter(Boolean)
          .map((l: any) => l.name),
        url: `${this.webUrl}/cards/${c.id}`,
      });
      cardDetails.set(lid, arr);
    }

    return {
      board: (board as any).name,
      url: `${this.webUrl}/boards/${id}`,
      lists: lists.map((lst: any) => ({
        id: lst.id,
        name: lst.name,
        card_count: counts.get(lst.id) || 0,
        cards: cardDetails.get(lst.id) || [],
      })),
    };
  }

  // ---- Lists ------------------------------------------------------------
  listGet(id: string) {
    return this.get(`/lists/${id}`);
  }
  listCreate(boardId: string, name: string, type = "active", position = DEFAULT_POSITION) {
    return this.post(`/boards/${boardId}/lists`, { name, type, position });
  }
  listUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/lists/${id}`, fields);
  }
  listDelete(id: string) {
    return this.del(`/lists/${id}`);
  }
  listCards(id: string, params?: Record<string, unknown>) {
    return this.get(`/lists/${id}/cards`, params);
  }
  listSortCards(id: string, fieldName: string, order = "asc") {
    return this.post(`/lists/${id}/sort`, { fieldName, order });
  }
  listMoveCards(id: string, toListId: string) {
    return this.post(`/lists/${id}/move-cards`, { listId: toListId });
  }

  // ---- Cards --------------------------------------------------------------
  cardGet(id: string) {
    return this.get(`/cards/${id}`);
  }

  async cardCreate(
    listId: string,
    name: string,
    type = "project",
    position = DEFAULT_POSITION,
    extra: Record<string, unknown> = {}
  ) {
    const d = { type, name, position, ...extra };
    const response = await this.post(`/lists/${listId}/cards`, d);
    const card = PlankaClient.unwrap(response) as any;
    try {
      const listResp = await this.listGet(listId);
      const list = PlankaClient.unwrap(listResp) as any;
      const boardResp = await this.boardGet(list.boardId);
      const board = PlankaClient.unwrap(boardResp) as any;
      const projectResp = await this.projectGet(board.projectId);
      const project = PlankaClient.unwrap(projectResp) as any;
      card._path = `${project.name} > ${board.name} > ${list.name} > ${card.name}`;
      card._url = `${this.webUrl}/cards/${card.id}`;
    } catch {
      // Return card without path if hierarchy fetch fails.
    }
    return response;
  }

  cardUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/cards/${id}`, fields);
  }
  cardDelete(id: string) {
    return this.del(`/cards/${id}`);
  }
  cardDuplicate(id: string, fields: Record<string, unknown> = {}) {
    return this.post(`/cards/${id}/duplicate`, fields);
  }
  cardActions(id: string, beforeId?: string) {
    return this.get(`/cards/${id}/actions`, beforeId ? { beforeId } : undefined);
  }

  private async nextPositionInList(listId: string): Promise<number> {
    try {
      const resp = await this.listCards(listId);
      const cards: any[] = resp.items || [];
      if (!cards.length) return DEFAULT_POSITION;
      const maxPos = Math.max(...cards.map((c) => c.position ?? 0));
      return maxPos + DEFAULT_POSITION;
    } catch {
      return DEFAULT_POSITION;
    }
  }

  async cardMove(cardId: string, listId: string, position?: number) {
    const pos = position ?? (await this.nextPositionInList(listId));
    return this.cardUpdate(cardId, { listId, position: pos });
  }

  async cardMoveByName(cardId: string, listName: string) {
    const cardResp = await this.cardGet(cardId);
    const card = PlankaClient.unwrap(cardResp) as any;
    const boardResp = await this.boardGet(card.boardId);
    const included = boardResp.included || {};
    const lists = (included.lists || []).filter((l: any) => l.type === "active");
    const match = lists.find((l: any) => l.name.toLowerCase() === listName.toLowerCase());
    if (!match) {
      const available = lists.map((l: any) => l.name);
      throw new PlankaApiError(`List '${listName}' not found. Available lists: ${JSON.stringify(available)}`);
    }
    const pos = await this.nextPositionInList((match as any).id);
    const result = await this.cardUpdate(cardId, { listId: (match as any).id, position: pos });
    return { result, movedTo: match };
  }

  async cardMoveNext(cardId: string) {
    const cardResp = await this.cardGet(cardId);
    const card = PlankaClient.unwrap(cardResp) as any;
    const boardResp = await this.boardGet(card.boardId);
    const included = boardResp.included || {};
    const lists = (included.lists || [])
      .filter((l: any) => l.type === "active")
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const currentIdx = lists.findIndex((l: any) => l.id === card.listId);
    if (currentIdx === -1) {
      throw new PlankaApiError("Could not find card's current list.");
    }
    if (currentIdx + 1 >= lists.length) {
      throw new PlankaApiError(
        `Already in last list: '${(lists[currentIdx] as any).name}'. Cannot move further.`
      );
    }
    const nextList = lists[currentIdx + 1] as any;
    const pos = await this.nextPositionInList(nextList.id);
    const result = await this.cardUpdate(cardId, { listId: nextList.id, position: pos });
    return { result, from: lists[currentIdx], to: nextList };
  }

  cardMoveDone(cardId: string) {
    return this.cardMoveByName(cardId, "Done");
  }

  // ---- Card labels (by name) -----------------------------------------------
  private async boardDataForCard(cardId: string) {
    const cardResp = await this.cardGet(cardId);
    const card = PlankaClient.unwrap(cardResp) as any;
    const boardResp = await this.boardGet(card.boardId);
    const included = boardResp.included || {};
    return {
      card,
      lists: included.lists || [],
      labels: included.labels || [],
      cardLabels: included.cardLabels || [],
    };
  }

  cardLabelAdd(cardId: string, labelId: string) {
    return this.post(`/cards/${cardId}/card-labels`, { labelId });
  }
  cardLabelRemove(cardId: string, labelId: string) {
    return this.del(`/cards/${cardId}/card-labels/labelId:${labelId}`);
  }

  async cardLabelAddByName(cardId: string, labelName: string) {
    const { labels } = await this.boardDataForCard(cardId);
    const match = (labels as any[]).find((l) => l.name.toLowerCase() === labelName.toLowerCase());
    if (!match) {
      const available = (labels as any[]).map((l) => l.name);
      throw new PlankaApiError(`Label '${labelName}' not found on board. Available: ${JSON.stringify(available)}`);
    }
    const result = await this.post(`/cards/${cardId}/card-labels`, { labelId: match.id });
    return { result, label: match };
  }

  async cardLabelRemoveByName(cardId: string, labelName: string) {
    const { labels, cardLabels } = await this.boardDataForCard(cardId);
    const match = (labels as any[]).find((l) => l.name.toLowerCase() === labelName.toLowerCase());
    if (!match) {
      const available = (labels as any[]).map((l) => l.name);
      throw new PlankaApiError(`Label '${labelName}' not found on board. Available: ${JSON.stringify(available)}`);
    }
    const entry = (cardLabels as any[]).find((cl) => cl.cardId === cardId && cl.labelId === match.id);
    if (!entry) {
      throw new PlankaApiError(`Label '${labelName}' is not applied to this card.`);
    }
    const result = await this.del(`/cards/${cardId}/card-labels/labelId:${match.id}`);
    return { result, label: match };
  }

  async cardLabelSet(cardId: string, labelNames: string[]) {
    const { labels, cardLabels } = await this.boardDataForCard(cardId);
    const currentCls = (cardLabels as any[]).filter((cl) => cl.cardId === cardId);
    for (const cl of currentCls) {
      await this.del(`/cards/${cardId}/card-labels/labelId:${cl.labelId}`);
    }

    const labelsByLower = new Map((labels as any[]).map((l) => [l.name.toLowerCase(), l]));
    const results: Array<{ label: string; result: unknown }> = [];
    for (const name of labelNames) {
      const match = labelsByLower.get(name.toLowerCase());
      if (!match) {
        const available = Array.from(labelsByLower.keys());
        throw new PlankaApiError(`Label '${name}' not found on board. Available: ${JSON.stringify(available)}`);
      }
      const r = await this.post(`/cards/${cardId}/card-labels`, { labelId: match.id });
      results.push({ label: match.name, result: r });
    }
    return { set: results };
  }

  // ---- Card members (card memberships) -------------------------------------
  cardMemberAdd(cardId: string, userId: string) {
    return this.post(`/cards/${cardId}/card-memberships`, { userId });
  }
  cardMemberRemove(cardId: string, userId: string) {
    return this.del(`/cards/${cardId}/card-memberships/userId:${userId}`);
  }

  // ---- Task lists -----------------------------------------------------------
  tasklistGet(id: string) {
    return this.get(`/task-lists/${id}`);
  }
  tasklistCreate(cardId: string, name: string, position = DEFAULT_POSITION, extra: Record<string, unknown> = {}) {
    return this.post(`/cards/${cardId}/task-lists`, { name, position, ...extra });
  }
  tasklistUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/task-lists/${id}`, fields);
  }
  tasklistDelete(id: string) {
    return this.del(`/task-lists/${id}`);
  }

  // ---- Tasks ------------------------------------------------------------
  taskCreate(tasklistId: string, name: string, position = DEFAULT_POSITION, extra: Record<string, unknown> = {}) {
    return this.post(`/task-lists/${tasklistId}/tasks`, { name, position, ...extra });
  }
  taskUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/tasks/${id}`, fields);
  }
  taskDelete(id: string) {
    return this.del(`/tasks/${id}`);
  }

  // ---- Labels -----------------------------------------------------------
  labelCreate(boardId: string, name: string, color: string, position = DEFAULT_POSITION) {
    return this.post(`/boards/${boardId}/labels`, { name, color, position });
  }
  labelUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/labels/${id}`, fields);
  }
  labelDelete(id: string) {
    return this.del(`/labels/${id}`);
  }

  // ---- Comments ---------------------------------------------------------
  commentList(cardId: string, beforeId?: string) {
    return this.get(`/cards/${cardId}/comments`, beforeId ? { beforeId } : undefined);
  }
  commentCreate(cardId: string, text: string) {
    return this.post(`/cards/${cardId}/comments`, { text });
  }
  commentUpdate(id: string, text: string) {
    return this.patch(`/comments/${id}`, { text });
  }
  commentDelete(id: string) {
    return this.del(`/comments/${id}`);
  }

  // ---- Users --------------------------------------------------------------
  userList() {
    return this.get("/users");
  }
  userGet(id = "me") {
    return this.get(`/users/${id}`);
  }
  userCreate(email: string, password: string, role: string, name: string, extra: Record<string, unknown> = {}) {
    return this.post("/users", { email, password, role, name, ...extra });
  }
  userUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/users/${id}`, fields);
  }
  userDelete(id: string) {
    return this.del(`/users/${id}`);
  }

  // ---- Board memberships -----------------------------------------------
  boardMemberAdd(boardId: string, userId: string, role = "editor", canComment?: boolean) {
    const d: Record<string, unknown> = { userId, role };
    if (canComment !== undefined) d.canComment = canComment;
    return this.post(`/boards/${boardId}/memberships`, d);
  }
  boardMemberUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/board-memberships/${id}`, fields);
  }
  boardMemberRemove(id: string) {
    return this.del(`/board-memberships/${id}`);
  }

  // ---- Notifications -------------------------------------------------------
  notificationList() {
    return this.get("/notifications");
  }
  notificationReadAll() {
    return this.post("/notifications/read-all");
  }

  // ---- Webhooks (admin) ---------------------------------------------------
  webhookList() {
    return this.get("/webhooks");
  }
  webhookCreate(name: string, url: string, extra: Record<string, unknown> = {}) {
    return this.post("/webhooks", { name, url, ...extra });
  }
  webhookUpdate(id: string, fields: Record<string, unknown>) {
    return this.patch(`/webhooks/${id}`, fields);
  }
  webhookDelete(id: string) {
    return this.del(`/webhooks/${id}`);
  }
}

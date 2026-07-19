// Loosely-typed Planka API entities. Planka's API returns additional fields
// beyond what's modeled here; these interfaces cover what the server reads.

export interface PlankaEnvelope<T = Record<string, unknown>> {
  item?: T;
  items?: T[];
  included?: Record<string, unknown[]>;
  [key: string]: unknown;
}

export interface PlankaProject {
  id: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

export interface PlankaBoard {
  id: string;
  name: string;
  projectId: string;
  position?: number;
  [key: string]: unknown;
}

export interface PlankaList {
  id: string;
  name: string;
  boardId: string;
  type?: string;
  position?: number;
  [key: string]: unknown;
}

export interface PlankaCard {
  id: string;
  name: string;
  listId: string;
  boardId: string;
  position?: number;
  _path?: string;
  _url?: string;
  [key: string]: unknown;
}

export interface PlankaLabel {
  id: string;
  name: string;
  boardId: string;
  color?: string;
  [key: string]: unknown;
}

export interface PlankaCardLabel {
  cardId: string;
  labelId: string;
  [key: string]: unknown;
}

export interface BoardSummaryList {
  id: string;
  name: string;
  card_count: number;
  cards: Array<{
    id: string;
    name: string;
    labels: string[];
    url: string;
  }>;
}

export interface BoardSummary {
  board: string | undefined;
  url: string;
  lists: BoardSummaryList[];
}

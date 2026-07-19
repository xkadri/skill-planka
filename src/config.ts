export interface PlankaConfig {
  baseUrl: string;
  apiKey: string;
}

const DEFAULT_BASE_URL = "http://localhost:3000/api";

/**
 * Base URL of the Planka instance this sidecar talks to. Fixed per-deployment
 * via env var — unlike the API key, it is not supplied per-request, since one
 * sidecar instance is expected to sit next to one Planka instance.
 */
export function resolveBaseUrl(): string {
  const raw = (process.env.PLANKA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

/**
 * API key for stdio transport, where there's no per-request header channel
 * and the server process is inherently scoped to a single client/session.
 * Required at startup; the process exits with a clear error if missing.
 */
export function requireStdioApiKey(): string {
  const apiKey = process.env.PLANKA_API_KEY;
  if (!apiKey) {
    console.error(
      "ERROR: PLANKA_API_KEY environment variable is required when TRANSPORT=stdio.\n" +
        "  Set PLANKA_API_KEY before starting the server."
    );
    process.exit(1);
  }
  return apiKey;
}

export function getTransport(): "http" | "stdio" {
  const t = (process.env.TRANSPORT || "http").toLowerCase();
  return t === "stdio" ? "stdio" : "http";
}

export function getPort(): number {
  return parseInt(process.env.PORT || "3001", 10);
}

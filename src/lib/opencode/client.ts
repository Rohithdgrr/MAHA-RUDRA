import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client";
import { buildBasicAuthHeader } from "../utils/env";

export interface ClientFactoryConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

/** Creates a raw SDK client. Prefer the BackendAdapter; use this only inside adapters/helpers. */
export function createClient(config: ClientFactoryConfig): OpencodeClient {
  const authHeader = config.password
    ? buildBasicAuthHeader(config.username?.trim() || "opencode", config.password)
    : undefined;
  return createOpencodeClient({
    baseUrl: config.baseUrl,
    fetch: (req: Request) => {
      if (authHeader) req.headers.set("Authorization", authHeader);
      return globalThis.fetch(req);
    },
  });
}

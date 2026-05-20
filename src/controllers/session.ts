import type { Request } from "express";

/** Anonymous session for follows / feed likes when not using Clerk user id yet. */
export function getSessionId(req: Request): string {
  const raw = req.headers["x-session-id"];
  const header =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return header || req.ip || "anonymous";
}

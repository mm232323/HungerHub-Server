import type { Request } from "express";
import { getAuth } from "@clerk/express";

/** Anonymous session for follows / feed likes when not using Clerk user id yet. */
export function getSessionId(req: Request): string {
  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      return auth.userId;
    }
  } catch (error) {
    // Ignore error if getAuth fails (e.g., outside of Clerk context)
  }

  const raw = req.headers["x-session-id"];
  const header =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return header || req.ip || "anonymous";
}

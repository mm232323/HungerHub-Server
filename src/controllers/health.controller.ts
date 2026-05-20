import type { Request, Response } from "express";
import { HealthCheckResponse } from "#api-zod";

export function healthz(_req: Request, res: Response): void {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

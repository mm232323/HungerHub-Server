import { Router, type IRouter } from "express";
import * as healthController from "../../controllers/health.controller";

const router: IRouter = Router();

router.get("/healthz", healthController.healthz);

export default router;

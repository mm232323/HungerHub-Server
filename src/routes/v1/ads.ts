import { Router, type IRouter } from "express";
import * as adsController from "../../controllers/ads.controller.js";

const router: IRouter = Router();

router.get("/ads", adsController.list);
router.post("/ads", adsController.create);
router.put("/ads/:id", adsController.update);
router.delete("/ads/:id", adsController.remove);

export default router;

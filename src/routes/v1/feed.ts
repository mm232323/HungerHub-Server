import { Router, type IRouter } from "express";
import * as feedController from "../../controllers/feed.controller";

const router: IRouter = Router();

router.get("/feed/stories", feedController.stories);
router.get("/feed", feedController.list);
/** Client-compatible paths */
router.post("/feed/posts/:id/like", feedController.toggleLike);
router.post("/feed/posts/:id/save", feedController.toggleSave);
router.post("/feed/:id/like", feedController.toggleLike);
router.post("/feed/:id/save", feedController.toggleSave);

export default router;

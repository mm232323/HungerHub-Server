import { Router, type IRouter } from "express";
import * as feedController from "../../controllers/feed.controller.js";

const router: IRouter = Router();

router.get("/feed/stories", feedController.stories);
router.get("/feed/ads", feedController.activeAds);
router.get("/feed", feedController.list);
/** Client-compatible paths */
router.post("/feed/posts/:id/like", feedController.toggleLike);
router.post("/feed/posts/:id/save", feedController.toggleSave);
router.post("/feed/:id/like", feedController.toggleLike);
router.post("/feed/:id/save", feedController.toggleSave);

router.post("/feed/posts/:id/comment", feedController.commentFeedPost);
router.get("/feed/posts/:id/comments", feedController.getFeedPostComments);

router.get("/feed/ads/:id/likes", feedController.getFeedAdLikes);
router.post("/feed/ads/:id/like", feedController.likeFeedAd);
router.post("/feed/ads/:id/comment", feedController.commentFeedAd);
router.get("/feed/ads/:id/comments", feedController.getFeedAdComments);

export default router;

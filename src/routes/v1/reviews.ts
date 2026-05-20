import { Router, type IRouter } from "express";
import * as reviewsController from "../../controllers/reviews.controller";

const router: IRouter = Router();

router.post("/reviews", reviewsController.create);

export default router;

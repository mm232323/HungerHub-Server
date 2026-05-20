import { Router, type IRouter } from "express";
import * as categoriesController from "../../controllers/categories.controller";

const router: IRouter = Router();

router.get("/categories", categoriesController.list);

export default router;

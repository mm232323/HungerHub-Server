import { Router, type IRouter } from "express";
import * as categoriesController from "../../controllers/categories.controller.js";

const router: IRouter = Router();

router.get("/categories", categoriesController.list);

export default router;

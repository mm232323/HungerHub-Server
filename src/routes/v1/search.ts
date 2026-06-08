import { Router, type IRouter } from "express";
import * as searchController from "../../controllers/search.controller.js";

const router: IRouter = Router();

router.get("/search", searchController.search);

export default router;

import { Router, type IRouter } from "express";
import * as productsController from "../../controllers/products.controller";

const router: IRouter = Router();

router.get("/products/trending", productsController.trending);
router.get("/products", productsController.list);
router.get("/products/:id", productsController.getById);

export default router;

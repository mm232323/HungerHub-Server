import { Router, type IRouter } from "express";
import * as ordersController from "../../controllers/orders.controller";

const router: IRouter = Router();

router.get("/orders", ordersController.list);
router.post("/orders", ordersController.create);
router.get("/orders/:id", ordersController.getById);
router.patch("/orders/:id/status", ordersController.updateStatus);
router.put("/orders/:id/status", ordersController.updateStatus);

export default router;

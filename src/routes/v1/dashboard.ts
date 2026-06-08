import { Router, type IRouter } from "express";
import * as dashboardController from "../../controllers/dashboard.controller.js";

const router: IRouter = Router();

router.post("/dashboard/init", dashboardController.initMerchant);
router.get("/dashboard/merchant", dashboardController.getProfile);
router.put("/dashboard/merchant", dashboardController.updateProfile);
router.get("/dashboard/stats", dashboardController.stats);
router.get("/dashboard/revenue-chart", dashboardController.revenueChart);
/** Client uses `/dashboard/revenue` */
router.get("/dashboard/revenue", dashboardController.revenueChart);
router.get("/dashboard/orders", dashboardController.listOrders);
router.get("/dashboard/products", dashboardController.listProducts);
router.post("/dashboard/products", dashboardController.createProduct);
router.patch("/dashboard/products/:id", dashboardController.updateProduct);
router.delete("/dashboard/products/:id", dashboardController.deleteProduct);
router.get("/dashboard/analytics", dashboardController.analytics);
router.get("/dashboard/top-products", dashboardController.topProducts);
router.get("/dashboard/promotions", dashboardController.listPromotions);
router.post("/dashboard/promotions", dashboardController.createPromotion);

export default router;

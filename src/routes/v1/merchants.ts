import { Router, type IRouter } from "express";
import * as merchantsController from "../../controllers/merchants.controller.js";

const router: IRouter = Router();

router.get("/merchants/trending", merchantsController.trending);
router.get("/merchants/followed", merchantsController.followed);
router.get("/merchants", merchantsController.list);
router.post("/merchants", merchantsController.create);
router.get("/merchants/:id/products", merchantsController.listProducts);
router.get("/merchants/:id/reviews", merchantsController.listReviews);
router.get("/merchants/slug/:slug", merchantsController.getBySlug);
router.get("/merchants/:id", merchantsController.getById);
router.post("/merchants/:id/follow", merchantsController.follow);

export default router;

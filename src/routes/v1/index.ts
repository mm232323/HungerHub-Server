import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import merchantsRouter from "./merchants";
import productsRouter from "./products";
import feedRouter from "./feed";
import ordersRouter from "./orders";
import reviewsRouter from "./reviews";
import searchRouter from "./search";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(merchantsRouter);
router.use(productsRouter);
router.use(feedRouter);
router.use(ordersRouter);
router.use(reviewsRouter);
router.use(searchRouter);
router.use(dashboardRouter);

export default router;

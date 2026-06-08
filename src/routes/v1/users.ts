import { Router, type IRouter } from "express";
import * as usersController from "../../controllers/users.controller.js";

const router: IRouter = Router();

router.post("/users/init", usersController.initUser);

export default router;

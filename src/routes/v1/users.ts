import { Router, type IRouter } from "express";
import * as usersController from "../../controllers/users.controller";

const router: IRouter = Router();

router.post("/users/init", usersController.initUser);

export default router;

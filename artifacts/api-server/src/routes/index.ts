import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import venuesRouter from "./venues";
import showsRouter from "./shows";
import friendsRouter from "./friends";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(venuesRouter);
router.use(showsRouter);
router.use(friendsRouter);
router.use(exportRouter);

export default router;

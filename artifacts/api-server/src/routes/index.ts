import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import passwordResetRouter from "./passwordReset";
import usersRouter from "./users";
import venuesRouter from "./venues";
import showsRouter from "./shows";
import friendsRouter from "./friends";
import exportRouter from "./export";
import ticketmasterRouter from "./ticketmaster";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(passwordResetRouter);
router.use(usersRouter);
router.use(venuesRouter);
router.use(showsRouter);
router.use(friendsRouter);
router.use(exportRouter);
router.use(ticketmasterRouter);
router.use(adminRouter);

export default router;

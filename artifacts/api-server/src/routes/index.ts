import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import checkinsRouter from "./checkins";
import workoutsRouter from "./workouts";
import environmentsRouter from "./environments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(checkinsRouter);
router.use(workoutsRouter);
router.use(environmentsRouter);

export default router;

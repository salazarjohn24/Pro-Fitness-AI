import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import socialAuthRouter from "./socialAuth";
import profileRouter from "./profile";
import checkinsRouter from "./checkins";
import workoutsRouter from "./workouts";
import environmentsRouter from "./environments";
import workoutRouter from "./workout";
import exercisesRouter from "./exercises";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(socialAuthRouter);
router.use(profileRouter);
router.use(checkinsRouter);
router.use(workoutsRouter);
router.use(environmentsRouter);
router.use(workoutRouter);
router.use(exercisesRouter);
router.use(auditRouter);

export default router;

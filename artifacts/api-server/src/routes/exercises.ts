import { Router, type IRouter, type Request, type Response } from "express";
import { EXERCISE_LIBRARY, exerciseMap, type ExerciseData } from "../data/exercises";

const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const router: IRouter = Router();

router.get("/exercises", (_req: Request, res: Response) => {
  res.json(EXERCISE_LIBRARY);
});

router.get("/exercises/:id/alternatives", (req: Request, res: Response) => {
  const exercise = exerciseMap.get(req.params.id);
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const sourceRank = DIFFICULTY_RANK[exercise.difficulty] ?? 2;

  function isValidSwap(e: ExerciseData): boolean {
    if (e.id === exercise!.id) return false;
    if (e.primaryMuscle !== exercise!.primaryMuscle) return false;
    const eRank = DIFFICULTY_RANK[e.difficulty] ?? 2;
    const difficultyOk = eRank <= sourceRank;
    const equipmentDiffers = !e.equipment.every(eq => exercise!.equipment.includes(eq));
    return difficultyOk || equipmentDiffers;
  }

  const directAlternatives = exercise.alternatives
    .map(id => exerciseMap.get(id))
    .filter((e): e is ExerciseData => !!e && isValidSwap(e));

  const sameMuscleAlts = EXERCISE_LIBRARY.filter(e =>
    isValidSwap(e) &&
    !exercise.alternatives.includes(e.id)
  );

  const allAlternatives = [...directAlternatives, ...sameMuscleAlts].slice(0, 5);

  res.json(allAlternatives);
});

export default router;

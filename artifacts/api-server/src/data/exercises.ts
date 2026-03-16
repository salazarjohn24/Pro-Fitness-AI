export interface ExerciseData {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string[];
  category: "warmup" | "compound" | "accessory" | "core" | "cooldown";
  difficulty: "beginner" | "intermediate" | "advanced";
  alternatives: string[];
  youtubeKeyword: string;
}

export const EXERCISE_LIBRARY: ExerciseData[] = [
  { id: "wu-1", name: "Arm Circles", primaryMuscle: "shoulders", secondaryMuscles: [], equipment: ["bodyweight"], category: "warmup", difficulty: "beginner", alternatives: ["wu-2", "wu-3"], youtubeKeyword: "arm circles warm up" },
  { id: "wu-2", name: "Leg Swings", primaryMuscle: "hips", secondaryMuscles: ["hamstrings"], equipment: ["bodyweight"], category: "warmup", difficulty: "beginner", alternatives: ["wu-1", "wu-4"], youtubeKeyword: "leg swings warm up" },
  { id: "wu-3", name: "Band Pull-Apart", primaryMuscle: "shoulders", secondaryMuscles: ["upper back"], equipment: ["resistance band"], category: "warmup", difficulty: "beginner", alternatives: ["wu-1", "wu-5"], youtubeKeyword: "band pull apart" },
  { id: "wu-4", name: "Hip Circles", primaryMuscle: "hips", secondaryMuscles: ["glutes"], equipment: ["bodyweight"], category: "warmup", difficulty: "beginner", alternatives: ["wu-2", "wu-5"], youtubeKeyword: "hip circles warm up" },
  { id: "wu-5", name: "Inchworm", primaryMuscle: "core", secondaryMuscles: ["shoulders", "hamstrings"], equipment: ["bodyweight"], category: "warmup", difficulty: "beginner", alternatives: ["wu-1", "wu-4"], youtubeKeyword: "inchworm exercise" },
  { id: "wu-6", name: "Cat-Cow Stretch", primaryMuscle: "back", secondaryMuscles: ["core"], equipment: ["bodyweight"], category: "warmup", difficulty: "beginner", alternatives: ["wu-5", "wu-4"], youtubeKeyword: "cat cow stretch" },
  { id: "wu-7", name: "World's Greatest Stretch", primaryMuscle: "hips", secondaryMuscles: ["hamstrings", "shoulders"], equipment: ["bodyweight"], category: "warmup", difficulty: "beginner", alternatives: ["wu-2", "wu-4"], youtubeKeyword: "worlds greatest stretch" },

  { id: "c-1", name: "Back Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings", "core"], equipment: ["barbell", "squat rack"], category: "compound", difficulty: "intermediate", alternatives: ["c-2", "c-3"], youtubeKeyword: "barbell back squat" },
  { id: "c-2", name: "Front Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "core"], equipment: ["barbell", "squat rack"], category: "compound", difficulty: "advanced", alternatives: ["c-1", "c-3"], youtubeKeyword: "barbell front squat" },
  { id: "c-3", name: "Goblet Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "core"], equipment: ["dumbbell"], category: "compound", difficulty: "beginner", alternatives: ["c-1", "c-2"], youtubeKeyword: "goblet squat" },
  { id: "c-4", name: "Conventional Deadlift", primaryMuscle: "back", secondaryMuscles: ["hamstrings", "glutes", "core"], equipment: ["barbell"], category: "compound", difficulty: "intermediate", alternatives: ["c-5", "c-6"], youtubeKeyword: "conventional deadlift" },
  { id: "c-5", name: "Sumo Deadlift", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings", "quads", "back"], equipment: ["barbell"], category: "compound", difficulty: "intermediate", alternatives: ["c-4", "c-6"], youtubeKeyword: "sumo deadlift" },
  { id: "c-6", name: "Romanian Deadlift", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "back"], equipment: ["barbell"], category: "compound", difficulty: "intermediate", alternatives: ["c-4", "c-5"], youtubeKeyword: "romanian deadlift" },
  { id: "c-7", name: "Bench Press", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: ["barbell", "bench"], category: "compound", difficulty: "intermediate", alternatives: ["c-8", "c-9"], youtubeKeyword: "barbell bench press" },
  { id: "c-8", name: "Incline Bench Press", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: ["barbell", "bench"], category: "compound", difficulty: "intermediate", alternatives: ["c-7", "c-9"], youtubeKeyword: "incline bench press" },
  { id: "c-9", name: "Dumbbell Bench Press", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: ["dumbbell", "bench"], category: "compound", difficulty: "beginner", alternatives: ["c-7", "c-8"], youtubeKeyword: "dumbbell bench press" },
  { id: "c-10", name: "Overhead Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps", "core"], equipment: ["barbell"], category: "compound", difficulty: "intermediate", alternatives: ["c-11", "a-7"], youtubeKeyword: "overhead press" },
  { id: "c-11", name: "Dumbbell Shoulder Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: ["dumbbell"], category: "compound", difficulty: "beginner", alternatives: ["c-10", "a-7"], youtubeKeyword: "dumbbell shoulder press" },
  { id: "c-12", name: "Barbell Row", primaryMuscle: "back", secondaryMuscles: ["biceps", "core"], equipment: ["barbell"], category: "compound", difficulty: "intermediate", alternatives: ["c-13", "a-1"], youtubeKeyword: "barbell row" },
  { id: "c-13", name: "Pull-Up", primaryMuscle: "back", secondaryMuscles: ["biceps", "core"], equipment: ["pull-up bar"], category: "compound", difficulty: "intermediate", alternatives: ["c-12", "a-1"], youtubeKeyword: "pull up" },
  { id: "c-14", name: "Weighted Pull-Up", primaryMuscle: "back", secondaryMuscles: ["biceps", "core"], equipment: ["pull-up bar", "weight belt"], category: "compound", difficulty: "advanced", alternatives: ["c-13", "c-12"], youtubeKeyword: "weighted pull up" },
  { id: "c-15", name: "Leg Press", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: ["leg press machine"], category: "compound", difficulty: "beginner", alternatives: ["c-1", "c-3"], youtubeKeyword: "leg press" },

  { id: "a-1", name: "Cable Row", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: ["cable machine"], category: "accessory", difficulty: "beginner", alternatives: ["a-2", "c-12"], youtubeKeyword: "cable row" },
  { id: "a-2", name: "Lat Pulldown", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: ["cable machine"], category: "accessory", difficulty: "beginner", alternatives: ["a-1", "c-13"], youtubeKeyword: "lat pulldown" },
  { id: "a-3", name: "Dumbbell Curl", primaryMuscle: "biceps", secondaryMuscles: [], equipment: ["dumbbell"], category: "accessory", difficulty: "beginner", alternatives: ["a-4", "a-5"], youtubeKeyword: "dumbbell curl" },
  { id: "a-4", name: "EZ Bar Curl", primaryMuscle: "biceps", secondaryMuscles: [], equipment: ["ez bar"], category: "accessory", difficulty: "beginner", alternatives: ["a-3", "a-5"], youtubeKeyword: "ez bar curl" },
  { id: "a-5", name: "Hammer Curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: ["dumbbell"], category: "accessory", difficulty: "beginner", alternatives: ["a-3", "a-4"], youtubeKeyword: "hammer curl" },
  { id: "a-6", name: "Tricep Pushdown", primaryMuscle: "triceps", secondaryMuscles: [], equipment: ["cable machine"], category: "accessory", difficulty: "beginner", alternatives: ["a-8", "a-9"], youtubeKeyword: "tricep pushdown" },
  { id: "a-7", name: "Lateral Raise", primaryMuscle: "shoulders", secondaryMuscles: [], equipment: ["dumbbell"], category: "accessory", difficulty: "beginner", alternatives: ["a-10", "c-11"], youtubeKeyword: "lateral raise" },
  { id: "a-8", name: "Overhead Tricep Extension", primaryMuscle: "triceps", secondaryMuscles: [], equipment: ["dumbbell"], category: "accessory", difficulty: "beginner", alternatives: ["a-6", "a-9"], youtubeKeyword: "overhead tricep extension" },
  { id: "a-9", name: "Skull Crusher", primaryMuscle: "triceps", secondaryMuscles: [], equipment: ["ez bar", "bench"], category: "accessory", difficulty: "intermediate", alternatives: ["a-6", "a-8"], youtubeKeyword: "skull crusher" },
  { id: "a-10", name: "Face Pull", primaryMuscle: "shoulders", secondaryMuscles: ["upper back"], equipment: ["cable machine"], category: "accessory", difficulty: "beginner", alternatives: ["a-7", "wu-3"], youtubeKeyword: "face pull" },
  { id: "a-11", name: "Dumbbell Fly", primaryMuscle: "chest", secondaryMuscles: [], equipment: ["dumbbell", "bench"], category: "accessory", difficulty: "beginner", alternatives: ["a-12", "c-9"], youtubeKeyword: "dumbbell fly" },
  { id: "a-12", name: "Cable Crossover", primaryMuscle: "chest", secondaryMuscles: [], equipment: ["cable machine"], category: "accessory", difficulty: "intermediate", alternatives: ["a-11", "c-9"], youtubeKeyword: "cable crossover" },
  { id: "a-13", name: "Leg Curl", primaryMuscle: "hamstrings", secondaryMuscles: [], equipment: ["leg curl machine"], category: "accessory", difficulty: "beginner", alternatives: ["a-14", "c-6"], youtubeKeyword: "leg curl" },
  { id: "a-14", name: "Leg Extension", primaryMuscle: "quads", secondaryMuscles: [], equipment: ["leg extension machine"], category: "accessory", difficulty: "beginner", alternatives: ["c-3", "c-15"], youtubeKeyword: "leg extension" },
  { id: "a-15", name: "Calf Raise", primaryMuscle: "calves", secondaryMuscles: [], equipment: ["bodyweight"], category: "accessory", difficulty: "beginner", alternatives: ["a-16"], youtubeKeyword: "calf raise" },
  { id: "a-16", name: "Seated Calf Raise", primaryMuscle: "calves", secondaryMuscles: [], equipment: ["calf raise machine"], category: "accessory", difficulty: "beginner", alternatives: ["a-15"], youtubeKeyword: "seated calf raise" },
  { id: "a-17", name: "Bulgarian Split Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: ["dumbbell", "bench"], category: "accessory", difficulty: "intermediate", alternatives: ["a-18", "c-3"], youtubeKeyword: "bulgarian split squat" },
  { id: "a-18", name: "Walking Lunge", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: ["dumbbell"], category: "accessory", difficulty: "beginner", alternatives: ["a-17", "c-3"], youtubeKeyword: "walking lunge" },
  { id: "a-19", name: "Hip Thrust", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], equipment: ["barbell", "bench"], category: "accessory", difficulty: "intermediate", alternatives: ["a-20", "c-5"], youtubeKeyword: "hip thrust" },
  { id: "a-20", name: "Glute Bridge", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], equipment: ["bodyweight"], category: "accessory", difficulty: "beginner", alternatives: ["a-19"], youtubeKeyword: "glute bridge" },

  { id: "co-1", name: "Plank", primaryMuscle: "core", secondaryMuscles: ["shoulders"], equipment: ["bodyweight"], category: "core", difficulty: "beginner", alternatives: ["co-2", "co-3"], youtubeKeyword: "plank exercise" },
  { id: "co-2", name: "Dead Bug", primaryMuscle: "core", secondaryMuscles: [], equipment: ["bodyweight"], category: "core", difficulty: "beginner", alternatives: ["co-1", "co-3"], youtubeKeyword: "dead bug exercise" },
  { id: "co-3", name: "Ab Wheel Rollout", primaryMuscle: "core", secondaryMuscles: ["shoulders"], equipment: ["ab wheel"], category: "core", difficulty: "intermediate", alternatives: ["co-1", "co-4"], youtubeKeyword: "ab wheel rollout" },
  { id: "co-4", name: "Hanging Leg Raise", primaryMuscle: "core", secondaryMuscles: ["hip flexors"], equipment: ["pull-up bar"], category: "core", difficulty: "intermediate", alternatives: ["co-5", "co-1"], youtubeKeyword: "hanging leg raise" },
  { id: "co-5", name: "Cable Woodchop", primaryMuscle: "core", secondaryMuscles: ["obliques"], equipment: ["cable machine"], category: "core", difficulty: "intermediate", alternatives: ["co-6", "co-1"], youtubeKeyword: "cable woodchop" },
  { id: "co-6", name: "Russian Twist", primaryMuscle: "core", secondaryMuscles: ["obliques"], equipment: ["bodyweight"], category: "core", difficulty: "beginner", alternatives: ["co-5", "co-2"], youtubeKeyword: "russian twist" },

  { id: "cd-1", name: "Standing Hamstring Stretch", primaryMuscle: "hamstrings", secondaryMuscles: [], equipment: ["bodyweight"], category: "cooldown", difficulty: "beginner", alternatives: ["cd-2", "cd-3"], youtubeKeyword: "hamstring stretch" },
  { id: "cd-2", name: "Pigeon Stretch", primaryMuscle: "hips", secondaryMuscles: ["glutes"], equipment: ["bodyweight"], category: "cooldown", difficulty: "beginner", alternatives: ["cd-1", "cd-3"], youtubeKeyword: "pigeon stretch" },
  { id: "cd-3", name: "Child's Pose", primaryMuscle: "back", secondaryMuscles: ["shoulders"], equipment: ["bodyweight"], category: "cooldown", difficulty: "beginner", alternatives: ["cd-4", "cd-2"], youtubeKeyword: "childs pose stretch" },
  { id: "cd-4", name: "Chest Doorway Stretch", primaryMuscle: "chest", secondaryMuscles: ["shoulders"], equipment: ["bodyweight"], category: "cooldown", difficulty: "beginner", alternatives: ["cd-3", "cd-5"], youtubeKeyword: "chest doorway stretch" },
  { id: "cd-5", name: "Foam Roll Quads", primaryMuscle: "quads", secondaryMuscles: [], equipment: ["foam roller"], category: "cooldown", difficulty: "beginner", alternatives: ["cd-6", "cd-1"], youtubeKeyword: "foam roll quads" },
  { id: "cd-6", name: "Foam Roll Back", primaryMuscle: "back", secondaryMuscles: [], equipment: ["foam roller"], category: "cooldown", difficulty: "beginner", alternatives: ["cd-3", "cd-5"], youtubeKeyword: "foam roll upper back" },
];

export const exerciseMap = new Map(EXERCISE_LIBRARY.map(e => [e.id, e]));

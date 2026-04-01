export interface ExerciseDescription {
  description: string;
  formCues: string[];
  commonMistakes: string[];
  youtubeKeyword: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  difficulty?: string;
}

export const EXERCISE_DESCRIPTIONS: Record<string, ExerciseDescription> = {
  "arm circles": {
    description: "A dynamic shoulder warm-up that increases blood flow to the rotator cuff and improves joint mobility before overhead or upper-body work.",
    formCues: ["Stand tall, feet shoulder-width apart", "Extend arms straight out to the sides", "Make small circles, gradually increasing in size", "Reverse direction after 15 reps"],
    commonMistakes: ["Shrugging shoulders toward ears", "Bending the elbows mid-rotation"],
    youtubeKeyword: "arm circles warm up",
    primaryMuscle: "shoulders",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "leg swings": {
    description: "A dynamic hip mobility drill that loosens the hip flexors and hamstrings before lower-body or cardio sessions.",
    formCues: ["Hold a wall or post for balance", "Keep the swinging leg straight", "Drive the leg forward and back in a controlled arc", "Perform lateral swings as a second variation"],
    commonMistakes: ["Swinging past a comfortable range of motion", "Rotating the torso instead of isolating the hip"],
    youtubeKeyword: "leg swings warm up",
    primaryMuscle: "hips",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "hip circles": {
    description: "A rotational hip mobility movement that lubricates the hip joint and activates the glutes before squats, lunges, and deadlifts.",
    formCues: ["Hands on hips, feet shoulder-width", "Rotate the hips in a large circle", "Keep the upper body still", "Reverse direction each set"],
    commonMistakes: ["Letting the knees collapse inward", "Rushing through the rotation"],
    youtubeKeyword: "hip circles warm up",
    primaryMuscle: "hips",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "inchworm": {
    description: "A total-body warm-up that simultaneously warms the hamstrings, core, and shoulders while rehearsing a neutral spine.",
    formCues: ["Stand tall, hinge at hips and walk hands out to plank", "Hold plank briefly, then walk feet back to hands", "Keep knees as straight as tolerable throughout", "Move slowly and deliberately"],
    commonMistakes: ["Sagging the lower back in plank position", "Bending knees excessively to compensate for tight hamstrings"],
    youtubeKeyword: "inchworm exercise",
    primaryMuscle: "core",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "cat-cow stretch": {
    description: "A spinal mobility drill that alternates spinal flexion and extension to decompress the spine and warm up the back before lifting.",
    formCues: ["Start on all fours, wrists under shoulders", "Exhale and round the spine to the ceiling (cat)", "Inhale and let the belly drop, lifting the head (cow)", "Move in sync with your breath"],
    commonMistakes: ["Rushing the movement instead of breathing through it", "Collapsing the elbows rather than pressing the floor away"],
    youtubeKeyword: "cat cow stretch",
    primaryMuscle: "back",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "world's greatest stretch": {
    description: "A multi-joint mobility drill targeting the hips, hamstrings, thoracic spine, and shoulders in a single flowing movement — often called the best single warm-up exercise.",
    formCues: ["Step into a deep lunge, front foot flat", "Place same-side hand inside the front foot", "Rotate upper body, reaching opposite arm to ceiling", "Push hips down and forward to deepen the hip flexor stretch"],
    commonMistakes: ["Letting the back knee touch the ground too early", "Neglecting the thoracic rotation — don't skip the reach"],
    youtubeKeyword: "worlds greatest stretch",
    primaryMuscle: "hips",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "band pull-apart": {
    description: "A shoulder health exercise that strengthens the rear deltoids and external rotators, counteracting the internal rotation of pressing movements.",
    formCues: ["Hold band at shoulder height with arms extended", "Initiate the pull from the rear delts, not the hands", "Squeeze the shoulder blades together at the end range", "Control the return slowly"],
    commonMistakes: ["Shrugging the traps instead of activating rear delts", "Using excessive momentum to complete the rep"],
    youtubeKeyword: "band pull apart",
    primaryMuscle: "shoulders",
    equipment: "resistance band",
    difficulty: "beginner",
  },
  "high knees": {
    description: "A cardiovascular warm-up that elevates heart rate and activates the hip flexors and core, preparing the body for athletic movement.",
    formCues: ["Drive knees up to hip height alternately", "Pump arms in opposition to legs", "Stay on the balls of your feet", "Keep a brisk, rhythmic pace"],
    commonMistakes: ["Leaning backward instead of staying upright", "Not lifting knees high enough to get the benefit"],
    youtubeKeyword: "high knees exercise",
    primaryMuscle: "hips",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "jumping jacks": {
    description: "A classic full-body warm-up exercise that raises heart rate and warms the shoulders and legs through coordinated jumping and arm movement.",
    formCues: ["Land softly with knees slightly bent", "Raise arms fully overhead each rep", "Keep a steady rhythm throughout", "Engage the core to protect the spine"],
    commonMistakes: ["Landing flat-footed with straight knees", "Letting arms only reach shoulder height"],
    youtubeKeyword: "jumping jacks",
    primaryMuscle: "shoulders",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "butt kicks": {
    description: "A dynamic warm-up drill that activates the hamstrings and elevates heart rate by kicking the heels back toward the glutes while jogging in place.",
    formCues: ["Run in place focusing on heel-to-glute contact", "Pump arms to maintain rhythm", "Stay light on the balls of your feet", "Keep the knees pointed downward"],
    commonMistakes: ["Kicking the feet out behind rather than up under the glutes", "Leaning forward excessively"],
    youtubeKeyword: "butt kicks exercise",
    primaryMuscle: "hamstrings",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "pigeon pose": {
    description: "A deep hip opener that targets the piriformis and hip external rotators — essential cooldown work after squats, lunges, or running.",
    formCues: ["From plank, bring one knee forward to the same-side wrist", "Square the hips toward the ground", "Fold forward over the front leg to deepen", "Hold for 30–90 seconds each side"],
    commonMistakes: ["Letting the hips collapse to one side instead of staying square", "Forcing the knee position when hips are very tight"],
    youtubeKeyword: "pigeon pose stretch",
    primaryMuscle: "hips",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "child's pose": {
    description: "A restorative yoga stretch that decompresses the spine and opens the hips and shoulders — ideal as a cooldown after any heavy compound lifting.",
    formCues: ["Kneel and sit back toward your heels", "Extend arms long in front or rest them alongside the body", "Rest the forehead on the floor", "Breathe deeply into the lower back"],
    commonMistakes: ["Holding the breath instead of using the exhale to relax deeper", "Propping up on the hands rather than fully resting"],
    youtubeKeyword: "child's pose stretch",
    primaryMuscle: "back",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "hip flexor stretch": {
    description: "A kneeling stretch that lengthens the iliopsoas — often shortened by sitting and heavy squatting — reducing lower back tension and improving posture.",
    formCues: ["Start in a half-kneeling position, back knee on the floor", "Tuck the pelvis slightly under (posterior pelvic tilt)", "Lean forward into the stretch without arching the back", "Hold 30–60 seconds each side"],
    commonMistakes: ["Arching the lower back instead of tucking the pelvis", "Not sinking far enough into the lunge to feel the stretch"],
    youtubeKeyword: "kneeling hip flexor stretch",
    primaryMuscle: "hips",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "hamstring stretch": {
    description: "A standing or seated stretch targeting the hamstrings, reducing the risk of posterior chain tightness and lower back pain after heavy leg work.",
    formCues: ["Stand and hinge at the hip, keeping the back flat", "Reach toward the toes without rounding the spine", "Micro-bend the knees to protect them", "Hold 20–40 seconds each side"],
    commonMistakes: ["Rounding the lower back to reach further", "Bouncing or pulsing rather than holding a steady stretch"],
    youtubeKeyword: "standing hamstring stretch",
    primaryMuscle: "hamstrings",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "quad stretch": {
    description: "A standing stretch that lengthens the quadriceps and hip flexors — critical after squats, leg press, or running.",
    formCues: ["Stand on one foot, pull the opposite heel to the glute", "Keep knees together and stand tall", "Tuck the pelvis slightly for a deeper hip flexor component", "Hold a wall for balance if needed"],
    commonMistakes: ["Letting the bent knee drift forward or outward", "Leaning the torso forward rather than standing upright"],
    youtubeKeyword: "standing quad stretch",
    primaryMuscle: "quads",
    equipment: "bodyweight",
    difficulty: "beginner",
  },
  "back squat": {
    description: "The foundational lower-body strength movement that trains the quads, glutes, and hamstrings under a barbell load. The most effective exercise for building leg size and strength.",
    formCues: ["Bar rests on upper traps (high bar) or rear delts (low bar)", "Take a deep breath and brace the core before descent", "Push knees out in line with toes throughout", "Drive the floor away on the way up — don't think 'lift the bar'"],
    commonMistakes: ["Caving knees inward (valgus collapse)", "Good-morning-ing out of the hole by hinging at the hip", "Heel rise from tight ankles — use a heel wedge or work ankle mobility"],
    youtubeKeyword: "barbell back squat form",
  },
  "front squat": {
    description: "A quad-dominant squat variation with the barbell racked in front on the shoulders. More upright torso angle than back squat, demands significant thoracic mobility and core bracing.",
    formCues: ["Rack the bar on the front delts with elbows high", "Keep elbows up throughout — if they drop the bar rolls forward", "Stay very upright — torso nearly vertical", "Squat deep — the front squat rewards depth"],
    commonMistakes: ["Dropping the elbows and losing the rack position", "Insufficient thoracic mobility causing excessive forward lean"],
    youtubeKeyword: "barbell front squat form",
  },
  "goblet squat": {
    description: "A beginner-friendly squat variation holding a dumbbell or kettlebell at the chest. The counterweight naturally promotes an upright torso and good squat mechanics.",
    formCues: ["Hold the weight at chest height against the sternum", "Push elbows between knees at the bottom", "Sit deep between the heels", "Drive up through the full foot"],
    commonMistakes: ["Letting the weight pull the torso forward", "Not squatting deep enough to get the postural benefit"],
    youtubeKeyword: "goblet squat form",
  },
  "conventional deadlift": {
    description: "The king of posterior chain movements — trains the entire back, hamstrings, glutes, and grip simultaneously. One of the best measures of total-body strength.",
    formCues: ["Bar over mid-foot, hips above knees, shoulders above hips", "Engage lats by pulling them 'into your back pockets'", "Drive the floor away — don't think 'pull the bar up'", "Lock out hips and knees simultaneously at the top"],
    commonMistakes: ["Rounding the lumbar spine under load", "Jerking the bar off the floor rather than building tension first", "Bar drifting away from the legs — keep it in contact throughout"],
    youtubeKeyword: "conventional deadlift form",
  },
  "romanian deadlift": {
    description: "A hip-hinge movement that isolates the hamstrings and glutes through a long eccentric stretch. The best single exercise for hamstring hypertrophy.",
    formCues: ["Soft bend in the knees — maintain it throughout", "Push the hips back as the bar descends, don't bend the knees", "Lower until a strong hamstring stretch is felt (typically mid-shin)", "Drive hips forward to stand — squeeze glutes at the top"],
    commonMistakes: ["Turning it into a regular deadlift by bending the knees too much", "Rounding the lower back at the bottom of the range"],
    youtubeKeyword: "romanian deadlift form",
  },
  "sumo deadlift": {
    description: "A wide-stance deadlift variation with toes pointed outward. Shifts more load to the glutes and inner thighs, and reduces lower back stress due to a more upright torso.",
    formCues: ["Stand wide, toes 45–60° outward", "Grip inside the legs, arms straight down", "Push knees out over toes to create torque", "Keep the chest up and pull the bar in close to the body"],
    commonMistakes: ["Stance too narrow to be truly sumo", "Letting knees cave inward during the pull"],
    youtubeKeyword: "sumo deadlift form",
  },
  "bench press": {
    description: "The primary horizontal pushing exercise for chest, shoulder, and tricep development. The barbell bench press is the most widely used upper-body strength test.",
    formCues: ["Arch the upper back slightly, keep lower back naturally arched", "Retract and depress the scapulae to create a stable base", "Lower bar to lower chest with elbows at 45–75°", "Drive feet into the floor and press explosively"],
    commonMistakes: ["Flaring elbows to 90° — stresses the shoulder joint", "Bouncing the bar off the chest to use momentum", "Wrists bending backward — keep them straight and stacked"],
    youtubeKeyword: "barbell bench press form",
  },
  "incline bench press": {
    description: "A bench press variation at 30–45° incline that emphasizes the upper portion of the pectoralis major and front deltoid.",
    formCues: ["Set bench to 30–45° — avoid going higher", "Same scapular setup as flat bench", "Bar path angles slightly toward the clavicle", "Control the descent — don't drop the bar to the chest"],
    commonMistakes: ["Setting the incline too steep, turning it into a shoulder press", "Not retracting scapulae — losing the chest-dominant movement pattern"],
    youtubeKeyword: "incline bench press form",
  },
  "dumbbell bench press": {
    description: "A chest press using dumbbells that allows a greater range of motion than the barbell and trains each side independently, revealing and correcting strength imbalances.",
    formCues: ["Lower dumbbells to chest level with elbows at 45–75°", "Touch the weights at the top without fully locking out", "Maintain a slight arch in the upper back", "Press in a slight arc — not straight up"],
    commonMistakes: ["Going too heavy and losing control of the path", "Fully rotating the grip to neutral — loses chest activation"],
    youtubeKeyword: "dumbbell bench press form",
  },
  "pull-up": {
    description: "The premier vertical pulling exercise that builds the latissimus dorsi, biceps, and upper back. A true test of relative upper-body strength.",
    formCues: ["Dead hang to start — full shoulder depression and retraction", "Initiate by pulling shoulder blades down and back first", "Drive elbows toward hips — not just 'pull with biceps'", "Clear chin over bar, then control the descent fully"],
    commonMistakes: ["Kipping or swinging to compensate for lack of strength", "Incomplete range of motion — not reaching full hang between reps", "Only using arm strength without engaging lats"],
    youtubeKeyword: "pull up form tutorial",
  },
  "chin-up": {
    description: "A pull-up variation with supinated (underhand) grip that increases bicep involvement while still building a thick back.",
    formCues: ["Supinated grip shoulder-width or slightly narrower", "Full dead hang at the bottom", "Pull chest to bar — not just chin", "Squeeze biceps and lats at the top"],
    commonMistakes: ["Stopping when chin clears bar — go higher for full range", "Swinging or kipping"],
    youtubeKeyword: "chin up form",
  },
  "overhead press": {
    description: "The fundamental vertical pressing movement for shoulder size and strength. The barbell overhead press also serves as a full-body stability challenge requiring core bracing.",
    formCues: ["Bar rests in front delts, grip just outside shoulders", "Take a big breath and brace the core before pressing", "Press in a straight vertical line — move head back briefly as bar passes", "Lock out fully overhead — don't stop short"],
    commonMistakes: ["Overarching the lower back — brace and tuck the ribs", "Pressing forward instead of vertically — lean back slightly, not forward"],
    youtubeKeyword: "overhead press form barbell",
  },
  "dumbbell shoulder press": {
    description: "A shoulder press using dumbbells that trains each arm independently, allows a natural wrist rotation, and can be done seated or standing.",
    formCues: ["Start with dumbbells at ear height, elbows at 90°", "Press up and together — slight arc not perfectly vertical", "Avoid fully locking out to maintain tension", "Lower under control back to ear height"],
    commonMistakes: ["Leaning back excessively to compensate for heavy load", "Pressing directly sideways instead of slightly in front of the plane"],
    youtubeKeyword: "dumbbell shoulder press form",
  },
  "barbell row": {
    description: "A heavy horizontal pulling exercise that builds upper and mid-back thickness. One of the most effective mass builders for the lats and rhomboids.",
    formCues: ["Hinge to 45° torso angle, bar hanging at arm's length", "Pull bar to the lower abs — not the chest", "Retract the shoulder blades at the top", "Lower slowly — the eccentric builds as much as the pull"],
    commonMistakes: ["Standing too upright — turns it into a shrug", "Using momentum to heave the bar up"],
    youtubeKeyword: "barbell bent over row form",
  },
  "cable row": {
    description: "A seated cable pull that trains the mid-back and lats with constant tension throughout the range of motion — excellent for hypertrophy.",
    formCues: ["Sit tall, slight lean forward at the start", "Pull handle to the navel with elbows tight to sides", "Retract shoulder blades hard at the finish", "Let the weight pull you forward in a controlled stretch before the next rep"],
    commonMistakes: ["Leaning back too far — becomes a low-back exercise", "Not reaching a full stretch at the front — losing the range of motion"],
    youtubeKeyword: "seated cable row form",
  },
  "hip thrust": {
    description: "The most effective isolated glute exercise — produces maximum glute activation through a full hip extension range. Essential for glute development and posterior chain health.",
    formCues: ["Upper back rests on a bench, bar padded across the hips", "Plant feet flat, hip-width apart", "Drive through the full foot and squeeze glutes hard at the top", "Chin tucked — avoid neck extension"],
    commonMistakes: ["Not achieving full hip extension at the top (hyperextend the hip, not the spine)", "Feet too far away — turns into a hamstring exercise"],
    youtubeKeyword: "barbell hip thrust form",
  },
  "glute bridge": {
    description: "A floor-based glute isolation movement that serves as a foundation for the hip thrust. Ideal for warm-up activation or when a bench isn't available.",
    formCues: ["Lie on your back, feet flat and hip-width", "Press through the heels and squeeze the glutes to lift the hips", "Hold 1–2 seconds at the top", "Lower slowly — don't just drop"],
    commonMistakes: ["Driving through the toes instead of the heels", "Hyperextending the lower back at the top instead of squeezing the glutes"],
    youtubeKeyword: "glute bridge exercise",
  },
  "bicep curl": {
    description: "The fundamental bicep isolation exercise. Trains the biceps brachii and brachialis through elbow flexion.",
    formCues: ["Keep elbows pinned to sides throughout", "Full extension at the bottom — don't curl from a shortened position", "Supinate the wrist at the top for peak bicep contraction", "Control the descent — the eccentric phase builds strength too"],
    commonMistakes: ["Swinging the torso to heave the weight up", "Allowing elbows to drift forward at the top — reduces peak contraction"],
    youtubeKeyword: "dumbbell bicep curl form",
  },
  "tricep pushdown": {
    description: "A cable isolation exercise for the triceps that trains all three heads, with emphasis on the lateral head. Essential for overall arm size.",
    formCues: ["Elbows locked to the sides — don't let them flare", "Press down to full elbow extension", "Pause briefly at the bottom", "Control the bar back up — don't let the stack pull you"],
    commonMistakes: ["Leaning forward and using body weight instead of triceps", "Not reaching full extension at the bottom of each rep"],
    youtubeKeyword: "tricep pushdown form",
  },
  "lateral raise": {
    description: "An isolation exercise for the medial deltoid that builds shoulder width. One of the few direct medial delt exercises available.",
    formCues: ["Slight bend in the elbows throughout", "Lead with the elbows, not the hands — think 'pour water out of a pitcher'", "Raise to shoulder height only — going higher shifts load to traps", "Control the descent over 2–3 seconds"],
    commonMistakes: ["Using momentum and swinging to get the weights up", "Internally rotating the shoulder — keep pinkies slightly up"],
    youtubeKeyword: "lateral raise form",
  },
  "face pull": {
    description: "A cable exercise targeting the rear deltoids and external rotators — critical for shoulder health and posture, counterbalancing heavy pressing.",
    formCues: ["Set cable at face height or above", "Pull to forehead with elbows high and flared wide", "Externally rotate at the end — fists pointing to ceiling", "Control the return"],
    commonMistakes: ["Pulling to the chin instead of the forehead — becomes a row", "Not achieving external rotation — the key part of the exercise"],
    youtubeKeyword: "face pull exercise form",
  },
  "plank": {
    description: "An isometric core exercise that trains the ability to maintain a neutral spine under load — the foundational anti-extension core exercise.",
    formCues: ["Forearms on the floor, elbows under shoulders", "Body forms a straight line from head to heel", "Squeeze glutes and brace abs as if about to be punched", "Push the floor away — don't sag or pike"],
    commonMistakes: ["Hips too high (piking) or too low (sagging)", "Holding the breath — breathe in and out while bracing"],
    youtubeKeyword: "plank form tutorial",
  },
  "russian twist": {
    description: "A rotational core exercise that trains the obliques through spinal rotation. Can be weighted with a plate, dumbbell, or medicine ball.",
    formCues: ["Sit at 45° with knees bent and feet slightly elevated", "Keep the spine long — don't round the back", "Rotate from the ribs, not just the arms", "Touch the weight to the floor on each side"],
    commonMistakes: ["Rounding the back and collapsing the posture", "Moving only the arms without true thoracic rotation"],
    youtubeKeyword: "russian twist exercise",
  },
  "hanging leg raise": {
    description: "A challenging lower ab exercise performed from a dead hang that also trains grip strength and hip flexors.",
    formCues: ["Dead hang from a pull-up bar", "Tuck the pelvis under (posterior pelvic tilt) before lifting legs", "Raise legs to 90° or higher while controlling the swing", "Lower slowly — don't drop the legs"],
    commonMistakes: ["Swinging to generate momentum rather than using core strength", "Not tilting the pelvis — turns it into a hip flexor exercise only"],
    youtubeKeyword: "hanging leg raise form",
  },
  "dead bug": {
    description: "An anti-extension core exercise that trains the deep stabilizers while maintaining a neutral spine — excellent for lower back health and athletic transfer.",
    formCues: ["Press lower back firmly into the floor throughout", "Extend opposite arm and leg simultaneously", "Move slowly and only within a range where the back stays flat", "Exhale fully as you extend to engage the transverse abdominis"],
    commonMistakes: ["Allowing the lower back to arch off the floor — stop the range if this happens", "Moving too fast and using momentum rather than control"],
    youtubeKeyword: "dead bug exercise form",
  },
  "leg press": {
    description: "A machine compound exercise that loads the quads, glutes, and hamstrings through a guided pressing movement — useful for high volume leg work with less spinal loading than squats.",
    formCues: ["Feet hip-width, toes slightly outward", "Lower until knees reach 90° or slightly past", "Press through the full foot — don't rise on the toes", "Don't lock out knees fully at the top"],
    commonMistakes: ["Placing feet too low — stresses the knees", "Partial range of motion — go deep to maximize muscle activation"],
    youtubeKeyword: "leg press form",
  },
  "leg curl": {
    description: "A machine isolation exercise for the hamstrings that trains knee flexion — the primary function of the biceps femoris, semitendinosus, and semimembranosus.",
    formCues: ["Pad just above the ankles, hips fully flat on the bench", "Curl through full range — heels to glutes", "Pause and squeeze at the top", "Lower slowly over 2–3 seconds"],
    commonMistakes: ["Hips lifting off the bench to assist the movement", "Not reaching full range of motion at the top"],
    youtubeKeyword: "lying leg curl form",
  },
  "leg extension": {
    description: "A machine isolation exercise for the quadriceps that trains knee extension in isolation — the only true quad isolation exercise.",
    formCues: ["Adjust pad to rest just above the ankle", "Extend fully to lockout and squeeze the quads", "Lower under control over 2–3 seconds", "Seat adjusted so knee aligns with machine pivot"],
    commonMistakes: ["Swinging the legs up with momentum", "Not reaching full extension — losing the peak contraction"],
    youtubeKeyword: "leg extension machine form",
  },
  "calf raise": {
    description: "An isolation exercise for the gastrocnemius and soleus that trains plantarflexion. Calves are a high-rep muscle — they respond best to volume and full stretch.",
    formCues: ["Start at a full stretch — heel below the step", "Rise to maximum height on the ball of the foot", "Hold 1–2 seconds at the top", "Lower fully to a deep stretch each rep"],
    commonMistakes: ["Bouncing through the stretch at the bottom — losing range and risking injury", "Not reaching the full peak contraction at the top"],
    youtubeKeyword: "standing calf raise form",
  },
  "skull crusher": {
    description: "A lying triceps extension using a barbell or dumbbells that emphasizes the long head of the triceps through elbow flexion and extension.",
    formCues: ["Lie on a bench, bar or dumbbells held above chest at arm's length", "Lower the weight toward the forehead or behind the head by bending only at the elbows", "Keep elbows pointing at the ceiling — don't let them flare", "Extend back to the start, maintaining elbow position"],
    commonMistakes: ["Letting elbows flare wide, turning it into a chest press", "Not lowering far enough — partial reps reduce the long-head stretch"],
    youtubeKeyword: "skull crusher exercise form",
  },
  "ab wheel": {
    description: "An advanced anti-extension core exercise using an ab wheel that trains the rectus abdominis and obliques through a full range rollout.",
    formCues: ["Start kneeling, wheel directly under shoulders", "Roll forward slowly while keeping the core braced", "Stop before the back arches — control is everything", "Pull the wheel back by driving the abs, not the arms"],
    commonMistakes: ["Rolling too far before building sufficient core strength — risking lower back injury", "Using the arms to pull back rather than contracting the abs"],
    youtubeKeyword: "ab wheel rollout form",
  },
};

export function lookupExerciseDescription(name: string): ExerciseDescription | null {
  const key = name.toLowerCase().trim();
  if (EXERCISE_DESCRIPTIONS[key]) return EXERCISE_DESCRIPTIONS[key];
  for (const k of Object.keys(EXERCISE_DESCRIPTIONS)) {
    if (key.includes(k) || k.includes(key)) return EXERCISE_DESCRIPTIONS[k];
  }
  return null;
}

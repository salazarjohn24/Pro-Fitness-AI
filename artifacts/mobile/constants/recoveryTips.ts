export interface RecoveryTip {
  icon: string;
  title: string;
  body: string;
}

export interface NutritionTip {
  icon: string;
  title: string;
  body: string;
}

const MUSCLE_RECOVERY_TIPS: Record<string, RecoveryTip[]> = {
  chest: [
    { icon: "activity", title: "Doorway Chest Release", body: "Hold a doorway chest stretch (arms at 90° on the frame, gently lean forward) for 30 seconds. Do 3 rounds tonight. Dramatically reduces morning pec tightness." },
    { icon: "activity", title: "Lacrosse Ball Pec Flush", body: "Roll a ball along your pectoral minor and anterior delt for 60 seconds per side. Releases fascial adhesions that build up after heavy pressing volume." },
    { icon: "moon", title: "Sleep Flat Tonight", body: "Side-sleeping compresses the pecs overnight. Sleeping on your back gives your chest muscles unobstructed blood flow — your most controllable recovery variable." },
  ],
  back: [
    { icon: "activity", title: "Hang to Decompress", body: "Dead hang from a pull-up bar for 20–30 seconds — do 3 sets. Decompresses the spine and increases lat length after rows or pulldowns. Your back will feel longer tomorrow." },
    { icon: "activity", title: "Thoracic Roll-Out", body: "Foam roller placed across your mid-back: extend over it, moving segment by segment for 2 minutes. Reverses the spinal compression of pulling movements." },
    { icon: "activity", title: "Cat-Cow Before Bed", body: "10 slow cat-cow cycles on all fours before sleep keeps the spinal erectors from stiffening overnight. Takes 90 seconds and pays off dramatically in the morning." },
  ],
  shoulders: [
    { icon: "activity", title: "Sleeper Stretch Protocol", body: "Cross-body sleeper stretch: lie on your side, 3 × 30 seconds per arm. The most evidence-backed protocol for reducing posterior shoulder tightness after heavy pressing." },
    { icon: "activity", title: "Band Pull-Aparts", body: "3 × 20 band pull-aparts within the next few hours. Counteracts internal rotation from pressing and directly reduces next-day rotator cuff soreness." },
    { icon: "thermometer", title: "Ice First, Heat Later", body: "Ice for 10 minutes within the first 2 hours (reduces inflammation), then heat after 24 hours (promotes blood flow). Most people get this backwards — sequence matters." },
  ],
  quads: [
    { icon: "activity", title: "Couch Stretch", body: "Kneeling lunge with back foot against a wall — the gold standard quad recovery stretch. 2 × 60 seconds each side. Your quads will be meaningfully less sore tomorrow." },
    { icon: "droplet", title: "Cold Water for Legs", body: "10 minutes in a cold shower or cold-water immersion for your legs within 2 hours cuts quad DOMS by 20–30%. The science is consistent — it works." },
    { icon: "activity", title: "Easy Cycling Tomorrow", body: "20 minutes of low-resistance cycling the day after heavy leg training floods quads with blood flow without adding mechanical stress. Stiffness drops by 40%." },
  ],
  hamstrings: [
    { icon: "activity", title: "90/90 Hip Stretch", body: "The 90/90 stretch simultaneously targets hip flexors and hamstrings. 2 × 90 seconds per side today and tomorrow morning dramatically reduces posterior chain stiffness." },
    { icon: "activity", title: "Walk It Out", body: "A 20-minute walk within 4 hours of hamstring training keeps blood circulating through the posterior chain. Simple and highly effective — don't skip it just because you're tired." },
  ],
  glutes: [
    { icon: "activity", title: "Pigeon Pose Tonight", body: "90 seconds of pigeon pose per side releases glute medius tension from hip extension work. Do it before sleeping for maximum overnight tissue relaxation." },
    { icon: "activity", title: "Lacrosse Ball on Piriformis", body: "Sit on a ball placed under your glute, cross that ankle over the opposite knee. 60–90 seconds per side. Reduces trigger points that cause referred pain down the leg." },
  ],
  biceps: [
    { icon: "activity", title: "Supination Stretch", body: "Extend your arm with palm up, gently rotate it down with your other hand. 30 seconds per arm. Reduces bicep tendon soreness at the insertion after heavy curl volume." },
    { icon: "activity", title: "Light Cardio Flush Tomorrow", body: "20 minutes of easy cardio tomorrow increases bicep blood flow without any training stress. Your arms will be noticeably less sore the next day." },
  ],
  triceps: [
    { icon: "activity", title: "Overhead Tricep Stretch", body: "Elbow bent behind head, apply gentle pressure at the elbow with your other hand. 2 × 30 seconds each arm. Targets the long head where DOMS hits hardest after close-grip work." },
    { icon: "thermometer", title: "Warm Compress on Back of Arms", body: "A warm compress on the triceps 24 hours after training increases local circulation and protein synthesis. 15 minutes while watching something — simple and effective." },
  ],
  core: [
    { icon: "activity", title: "Diaphragmatic Breathing", body: "5 minutes of 360° breathing (breathe into your sides and back) before sleep activates the parasympathetic system and restores core pressure tolerance after heavy ab work." },
    { icon: "activity", title: "McGill Big 3 Tomorrow", body: "Bird-dog, modified curl-up, and side plank at low intensity the next day is the most evidence-backed protocol for spinal recovery. 10 minutes total — do all three." },
  ],
  calves: [
    { icon: "activity", title: "Elevate Your Legs", body: "Elevate your legs above heart level for 15 minutes post-workout. Reduces lower leg swelling and soreness from high-volume calf work. Simple and immediately effective." },
    { icon: "activity", title: "Slow Eccentric Loading Tomorrow", body: "Very slow calf lowering on a step (5-second descent) — 2 sets of 8 per leg, 48 hours post-training. Proven to accelerate gastrocnemius repair versus passive rest." },
  ],
};

const GENERAL_RECOVERY_TIPS: RecoveryTip[] = [
  { icon: "moon", title: "7–9 Hours Is a Training Variable", body: "Muscle protein synthesis peaks during slow-wave sleep. A single night under 6 hours reduces MPS by up to 18%. Guard tonight's sleep like you guard your training plan." },
  { icon: "activity", title: "Active Recovery Walk Tomorrow", body: "20–30 minutes at conversational pace promotes systemic blood flow, reduces inflammatory markers, and won't interfere with adaptation. Don't skip this even when you're tired." },
  { icon: "droplet", title: "Cold-to-Hot Contrast Shower", body: "2 minutes cold, 2 minutes hot, 3 rounds in the shower. Stimulates the lymphatic system and reduces full-body muscle soreness better than either temperature alone." },
  { icon: "heart", title: "Stress Competes With Recovery", body: "High cortisol from non-training stress directly competes with anabolic hormones. 10 minutes of slow breathing or mindfulness tonight will measurably improve your recovery quality." },
];

const NUTRITION_TIPS: NutritionTip[] = [
  { icon: "zap", title: "Post-Workout Protein Window", body: "30–40g of fast-digesting protein within the next hour — shake, Greek yogurt, or chicken — kicks off muscle protein synthesis at its most effective window." },
  { icon: "zap", title: "Restore Glycogen With Carbs", body: "50–75g of carbs (rice, oats, fruit) in your post-workout meal restores muscle glycogen faster and blunts the cortisol response from training. Don't skip carbs today." },
  { icon: "zap", title: "Creatine Post-Training", body: "Post-workout is the optimal creatine timing. 5g now leads to 30% greater muscle phosphocreatine resaturation versus taking it pre-workout or at other times." },
  { icon: "droplet", title: "Rehydrate Precisely", body: "For every pound lost during training (mostly water), drink 16oz. Even 2% dehydration reduces next-session strength by 3–4%. Weigh yourself before and after if curious." },
  { icon: "moon", title: "Pre-Sleep Protein Hack", body: "40g of casein protein (cottage cheese, slow-release shake) 30–60 minutes before sleep increases overnight muscle protein synthesis by 22%. One of the highest-ROI nutrition habits." },
  { icon: "zap", title: "Leucine Is the Trigger", body: "Leucine, found in whey, eggs, and meat, is the amino acid that activates muscle protein synthesis. Target at least 3g of leucine in your post-workout meal." },
  { icon: "activity", title: "Anti-Inflammatory Foods Tonight", body: "Berries, fatty fish, turmeric, and tart cherry juice have strong evidence for reducing exercise inflammation. Any one in your next meal meaningfully accelerates recovery." },
  { icon: "zap", title: "Magnesium Before Bed", body: "300mg of magnesium glycinate before sleep improves sleep quality, reduces cramping, and supports testosterone production — all directly impacting recovery from today's session." },
  { icon: "zap", title: "Zinc for Recovery", body: "Heavy training depletes zinc through sweat, which directly reduces testosterone production. Beef, pumpkin seeds, and shellfish are the highest sources — aim for one today." },
  { icon: "zap", title: "Protein Total Matters Most", body: "Total daily protein (0.7–1g per lb bodyweight) matters more than timing windows. Synthesis remains elevated for 24–48 hours — prioritize hitting your number today." },
  { icon: "droplet", title: "Electrolytes, Not Just Water", body: "Sodium, potassium, and magnesium lost in sweat affect muscle contraction and nerve function. An electrolyte drink within 2 hours rebalances these faster than water alone." },
  { icon: "activity", title: "Colorful Plate = Faster Recovery", body: "Phytonutrients in colorful vegetables act as natural anti-inflammatories. A varied plate tonight will outperform most single supplements for cellular repair." },
];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export function getRecoveryTip(muscleGroups: string[]): RecoveryTip {
  const day = getDayOfYear();
  const normalized = muscleGroups.map(m => m.toLowerCase().split(" ")[0]);
  const match = normalized.find(m => MUSCLE_RECOVERY_TIPS[m]);
  if (match) {
    const tips = MUSCLE_RECOVERY_TIPS[match];
    return tips[day % tips.length];
  }
  return GENERAL_RECOVERY_TIPS[day % GENERAL_RECOVERY_TIPS.length];
}

export function getNutritionTip(offset = 0): NutritionTip {
  const day = getDayOfYear();
  return NUTRITION_TIPS[(day + offset) % NUTRITION_TIPS.length];
}

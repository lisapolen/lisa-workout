-- ============================================================
-- Part C: Descriptions for original exercises
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- Weight Machine exercises: descriptions only (no video)
UPDATE public.exercises SET description = 'Sit in the leg press machine, place your feet shoulder-width apart on the platform, and push the sled to full extension before slowly returning. A foundational quad and glute builder that allows heavier loading than most free-weight leg exercises.' WHERE name = 'Seated Leg Press';

UPDATE public.exercises SET description = 'Lie face down on the machine and curl the pad toward your glutes by bending your knees against the resistance. Isolates the hamstrings through a full range of motion.' WHERE name = 'Leg Curl';

UPDATE public.exercises SET description = 'Sit in the machine with the pad across your shins and extend your legs to full lockout, then lower with control. Isolates the quadriceps and is especially effective for building the teardrop muscle above the knee.' WHERE name = 'Leg Extension';

UPDATE public.exercises SET description = 'Sit in the machine and push your knees outward against the padded resistance, then return with control. Strengthens the glute medius and hip abductors, which stabilize the pelvis and protect the knees.' WHERE name = 'Hip Abduction';

UPDATE public.exercises SET description = 'Sit in the machine and squeeze your knees inward against the padded resistance, then return with control. Targets the inner thigh adductors and helps balance hip strength.' WHERE name = 'Hip Adduction';

UPDATE public.exercises SET description = 'Sit in the chest press machine and push the handles forward to full arm extension, then lower slowly back to the start. Builds the chest, shoulders, and triceps with a stable, guided range of motion.' WHERE name = 'Chest Press';

UPDATE public.exercises SET description = 'Grip the bar with hands wider than shoulder-width and pull it down to chest height by driving your elbows toward your hips. A primary lat builder that develops width and pulling strength.' WHERE name = 'Lat Pulldown';

UPDATE public.exercises SET description = 'Sit facing the cable stack, grip the handle, and row it toward your lower ribs while keeping your back straight and squeezing your shoulder blades together. Targets the lats, rhomboids, and rear deltoids.' WHERE name = 'Seated Cable Row';

UPDATE public.exercises SET description = 'Attach a bar or rope to a low cable and curl it upward toward your shoulders while keeping your elbows pinned. Isolates the biceps with consistent cable tension through the full range of motion.' WHERE name = 'Arm Curl';

UPDATE public.exercises SET description = 'Attach a bar or rope to a high cable and push it downward to full arm extension while keeping your elbows at your sides. Isolates the triceps and is one of the most effective exercises for building the back of the arms.' WHERE name = 'Tricep Pushdown';

UPDATE public.exercises SET description = 'Attach a rope to a high cable, pull it toward your face with elbows flared wide, and finish with your hands beside your ears. Strengthens the rear deltoids, rotator cuff, and upper back — essential for shoulder health.' WHERE name = 'Face Pull';

UPDATE public.exercises SET description = 'Stand sideways to a cable, hold the handle at chest height, and press it straight out in front of you while resisting the pull of the cable trying to rotate your torso. Builds anti-rotation core stability.' WHERE name = 'Pallof Press';

UPDATE public.exercises SET description = 'Set a cable at high or low position, grip the handle with both hands, and pull it diagonally across your body in a chopping motion. Trains rotational core strength and the obliques.' WHERE name = 'Cable Woodchop';

-- Non-machine exercises: descriptions + cuisine + video
UPDATE public.exercises SET
  cuisine = 'Free Weights',
  description = 'Hold dumbbells in front of your thighs, hinge at the hips with a flat back, and lower the weights down your shins until you feel a deep hamstring stretch, then drive your hips forward to stand. Builds the hamstrings, glutes, and lower back.',
  video_url = 'https://www.youtube.com/shorts/wiekN4aIJ0g'
WHERE name = 'Romanian Deadlift';

UPDATE public.exercises SET
  cuisine = 'Free Weights',
  description = 'Stand with dumbbells at your sides, rise onto the balls of your feet as high as possible, pause at the top, then lower slowly. Strengthens the gastrocnemius and soleus, improving ankle stability and lower leg endurance.',
  video_url = 'https://www.youtube.com/shorts/XiRzKM1_ooc'
WHERE name = 'Calf Raise';

UPDATE public.exercises SET
  cuisine = 'Mat Work',
  description = 'Lie on your back with arms up and knees bent to 90°, press your lower back into the floor, then slowly extend one arm overhead and the opposite leg toward the floor without letting your back arch. Builds deep core stability and coordination.',
  video_url = 'https://www.youtube.com/shorts/Aoipu_fl3HA'
WHERE name = 'Dead Bug';

UPDATE public.exercises SET
  cuisine = 'Bodyweight',
  description = 'Hold a push-up position with forearms or hands on the floor, keeping your body in a straight line from head to heels. Builds total-body tension and core endurance — the foundation of functional strength.',
  video_url = 'https://www.youtube.com/shorts/hoeNgjheDHk'
WHERE name = 'Plank';

UPDATE public.exercises SET
  cuisine = 'Bodyweight',
  description = 'Hold a side plank on your forearm and feet, then lower your hip toward the floor and drive it back up. Targets the obliques and glute medius through a dynamic range of motion.',
  video_url = 'https://www.youtube.com/shorts/Vasw_qGnBpY'
WHERE name = 'Side Plank with Dips';

UPDATE public.exercises SET
  cuisine = 'Bodyweight',
  description = 'Start on all fours with a neutral spine, then simultaneously extend one arm forward and the opposite leg back, hold briefly, and return. Builds core stability, glute strength, and teaches the body to resist rotation.',
  video_url = 'https://www.youtube.com/shorts/wh2spJeDDQs'
WHERE name = 'Bird Dog';

UPDATE public.exercises SET
  cuisine = 'Mat Work',
  description = 'Kneel behind a stability ball with hands on it, brace your core, and roll the ball forward until your arms are extended, then use your abs to pull back to the start. Challenges the entire anterior core through a long lever movement.',
  video_url = 'https://www.youtube.com/shorts/OLrLFXASODE'
WHERE name = 'Stability Ball Rollout';

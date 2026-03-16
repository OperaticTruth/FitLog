// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CONFIG
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const API = window.FITLOG_API_URL || 'https://YOUR-APP-NAME.onrender.com';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let session = null;
let viewingPartner = false;
let todayWorkout = null; // generated workout for today
let selectedWorkoutDate = new Date(); // selected date for workout generation (default: today)
let swapTargetIndex = null;
let libFilterMuscle = 'All';
let swapFilterMuscle = 'All';

const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MUSCLE_GROUPS = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core','Full Body','Cardio'];

// Default schedules
const DEFAULT_SCHEDULES = {
  me: {
    Monday:    { gym: true, muscle: 'Chest & Triceps',  style: 'Strength' },
    Tuesday:   { gym: true, muscle: 'Posterior Chain',  style: 'Strength' },
    Wednesday: { gym: true, muscle: 'Back & Biceps',    style: 'Strength' },
    Thursday:  { gym: true, muscle: 'Anterior Chain',   style: 'Strength' },
    Friday:    { gym: true, muscle: 'Shoulders',        style: 'Strength' },
    Saturday:  { gym: false, muscle: 'Rest',            style: '' },
    Sunday:    { gym: false, muscle: 'Rest',            style: '' },
  },
  partner: {
    Monday:    { gym: true,  muscle: 'Upper Body',  style: 'HIIT / Supersets' },
    Tuesday:   { gym: true,  muscle: 'Lower Body',  style: 'HIIT / Supersets' },
    Wednesday: { gym: false, muscle: 'Pole Dancing',style: '' },
    Thursday:  { gym: true,  muscle: 'Full Body',   style: 'HIIT / Supersets' },
    Friday:    { gym: false, muscle: 'Cardio / Pole',style: '' },
    Saturday:  { gym: false, muscle: 'Rest',        style: '' },
    Sunday:    { gym: false, muscle: 'Rest',        style: '' },
  }
};

// Default training profiles
const DEFAULT_PROFILES = {
  me: { goal: 'Body recomp â€” lose fat, build muscle. Target: 180-185 lbs, body fat 13-15%. Strength focused, progressive overload.', style: 'Strength / Hypertrophy', experience: 'Intermediate' },
  partner: { goal: 'Lose 40 lbs in 6 months. Fat loss focused. Prefers HIIT, supersets, shorter rest periods.', style: 'HIIT / Supersets', experience: 'Beginner-Intermediate' }
};

function scheduleKey(who) { return `fitlog_workout_schedule_${who}`; }
function profileKey(who)   { return `fitlog_workout_profile_${who}`; }
function historyKey(who)   { return `fitlog_workout_history_${who}`; }
function prKey(who)        { return `fitlog_workout_prs_${who}`; }
function libraryKey()      { return 'fitlog_exercise_library'; }

function loadLocal(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; }
  catch { return def; }
}
function saveLocal(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getSchedule(who) { return loadLocal(scheduleKey(who), DEFAULT_SCHEDULES[who] || DEFAULT_SCHEDULES.partner); }
function getProfile(who)  { return loadLocal(profileKey(who),  DEFAULT_PROFILES[who]  || DEFAULT_PROFILES.partner); }
function getHistory(who)  { return loadLocal(historyKey(who), []); }
function getPRs(who)      { return loadLocal(prKey(who), {}); }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  EXERCISE LIBRARY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const BASE_LIBRARY = [
  // Chest
  { id:'bench-barbell',    name:'Barbell Bench Press',      muscle:'Chest',     equip:'Barbell',    notes:'Flat bench, grip slightly wider than shoulders.' },
  { id:'bench-incline',    name:'Incline Dumbbell Press',   muscle:'Chest',     equip:'Dumbbell',   notes:'30-45Â° incline, focus upper chest.' },
  { id:'fly-cable',        name:'Cable Chest Fly',          muscle:'Chest',     equip:'Cable',      notes:'Cross-body, squeeze at center.' },
  { id:'pushup',           name:'Push-Up',                  muscle:'Chest',     equip:'Bodyweight', notes:'Full ROM, core tight.' },
  { id:'chest-press-machine',name:'Chest Press Machine',   muscle:'Chest',     equip:'Machine',    notes:'Adjust seat so handles are at chest height.' },
  { id:'dip',              name:'Dips (Chest Focus)',        muscle:'Chest',     equip:'Bodyweight', notes:'Lean slightly forward to bias chest.' },
  // Back
  { id:'deadlift',         name:'Deadlift',                 muscle:'Back',      equip:'Barbell',    notes:'Hip hinge, neutral spine, drive through heels.' },
  { id:'row-barbell',      name:'Barbell Row',              muscle:'Back',      equip:'Barbell',    notes:'Hinge 45Â°, pull to lower chest.' },
  { id:'row-db',           name:'Dumbbell Row',             muscle:'Back',      equip:'Dumbbell',   notes:'Brace on bench, pull elbow back.' },
  { id:'pullup',           name:'Pull-Up',                  muscle:'Back',      equip:'Bodyweight', notes:'Full hang, chin over bar.' },
  { id:'lat-pulldown',     name:'Lat Pulldown',             muscle:'Back',      equip:'Cable',      notes:'Wide grip, pull to upper chest, lean slightly back.' },
  { id:'seated-row',       name:'Seated Cable Row',         muscle:'Back',      equip:'Cable',      notes:'Neutral grip, squeeze shoulder blades.' },
  { id:'rdl',              name:'Romanian Deadlift',        muscle:'Back',      equip:'Barbell',    notes:'Hinge at hips, slight knee bend, feel hamstring stretch.' },
  // Shoulders
  { id:'ohp',              name:'Overhead Press',           muscle:'Shoulders', equip:'Barbell',    notes:'Bar starts at collar, press overhead.' },
  { id:'ohp-db',           name:'Dumbbell Shoulder Press',  muscle:'Shoulders', equip:'Dumbbell',   notes:'Seated or standing, press overhead.' },
  { id:'lateral-raise',    name:'Lateral Raise',            muscle:'Shoulders', equip:'Dumbbell',   notes:'Slight forward lean, raise to shoulder height.' },
  { id:'face-pull',        name:'Face Pull',                muscle:'Shoulders', equip:'Cable',      notes:'High pulley, pull to face, elbows high.' },
  { id:'front-raise',      name:'Front Raise',              muscle:'Shoulders', equip:'Dumbbell',   notes:'Alternating or both, raise to shoulder height.' },
  { id:'upright-row',      name:'Upright Row',              muscle:'Shoulders', equip:'Barbell',    notes:'Narrow grip, pull to chin, elbows flare out.' },
  // Biceps
  { id:'curl-barbell',     name:'Barbell Curl',             muscle:'Biceps',    equip:'Barbell',    notes:'Full ROM, don\'t swing.' },
  { id:'curl-db',          name:'Dumbbell Curl',            muscle:'Biceps',    equip:'Dumbbell',   notes:'Alternate or together, supinate at top.' },
  { id:'hammer-curl',      name:'Hammer Curl',              muscle:'Biceps',    equip:'Dumbbell',   notes:'Neutral grip, works brachialis.' },
  { id:'preacher-curl',    name:'Preacher Curl',            muscle:'Biceps',    equip:'Machine',    notes:'Full stretch at bottom.' },
  { id:'cable-curl',       name:'Cable Curl',               muscle:'Biceps',    equip:'Cable',      notes:'Constant tension throughout ROM.' },
  // Triceps
  { id:'skullcrusher',     name:'Skull Crusher',            muscle:'Triceps',   equip:'Barbell',    notes:'Lower bar to forehead, keep elbows in.' },
  { id:'pushdown-cable',   name:'Tricep Pushdown',          muscle:'Triceps',   equip:'Cable',      notes:'Rope or bar, fully extend at bottom.' },
  { id:'overhead-tri',     name:'Overhead Tricep Extension',muscle:'Triceps',   equip:'Dumbbell',   notes:'Both hands on one DB, lower behind head.' },
  { id:'close-grip-bench', name:'Close-Grip Bench Press',   muscle:'Triceps',   equip:'Barbell',    notes:'Shoulder-width grip, elbows close to body.' },
  { id:'dip-tri',          name:'Dips (Tricep Focus)',       muscle:'Triceps',   equip:'Bodyweight', notes:'Stay upright to bias triceps.' },
  // Quads
  { id:'squat',            name:'Barbell Back Squat',       muscle:'Quads',     equip:'Barbell',    notes:'Hip crease below parallel, knees tracking toes.' },
  { id:'front-squat',      name:'Front Squat',              muscle:'Quads',     equip:'Barbell',    notes:'Upright torso, more quad dominant.' },
  { id:'leg-press',        name:'Leg Press',                muscle:'Quads',     equip:'Machine',    notes:'Foot position changes muscle emphasis.' },
  { id:'hack-squat',       name:'Hack Squat',               muscle:'Quads',     equip:'Machine',    notes:'Great quad isolation.' },
  { id:'leg-extension',    name:'Leg Extension',            muscle:'Quads',     equip:'Machine',    notes:'Squeeze at top.' },
  { id:'lunge',            name:'Walking Lunge',            muscle:'Quads',     equip:'Dumbbell',   notes:'Long stride, keep front knee over ankle.' },
  { id:'bulgarian',        name:'Bulgarian Split Squat',    muscle:'Quads',     equip:'Dumbbell',   notes:'Rear foot elevated, drop straight down.' },
  // Hamstrings
  { id:'leg-curl',         name:'Lying Leg Curl',           muscle:'Hamstrings',equip:'Machine',    notes:'Curl heel to glute, control eccentric.' },
  { id:'seated-leg-curl',  name:'Seated Leg Curl',          muscle:'Hamstrings',equip:'Machine',    notes:'Full stretch at bottom.' },
  { id:'nordic-curl',      name:'Nordic Curl',              muscle:'Hamstrings',equip:'Bodyweight', notes:'Very challenging, build up slowly.' },
  { id:'rdl-db',           name:'DB Romanian Deadlift',     muscle:'Hamstrings',equip:'Dumbbell',   notes:'Hinge back, feel hamstring stretch.' },
  // Glutes
  { id:'hip-thrust',       name:'Barbell Hip Thrust',       muscle:'Glutes',    equip:'Barbell',    notes:'Shoulder blades on bench, drive hips up, squeeze at top.' },
  { id:'hip-thrust-db',    name:'Dumbbell Hip Thrust',      muscle:'Glutes',    equip:'Dumbbell',   notes:'Same as barbell version, good for beginners.' },
  { id:'glute-kickback',   name:'Cable Glute Kickback',     muscle:'Glutes',    equip:'Cable',      notes:'Low pulley, kick back and squeeze.' },
  { id:'sumo-dl',          name:'Sumo Deadlift',            muscle:'Glutes',    equip:'Barbell',    notes:'Wide stance, targets inner thigh and glutes.' },
  { id:'abduction',        name:'Hip Abduction Machine',    muscle:'Glutes',    equip:'Machine',    notes:'Push knees out, squeeze glutes.' },
  // Calves
  { id:'calf-raise-stand', name:'Standing Calf Raise',      muscle:'Calves',    equip:'Machine',    notes:'Full ROM, pause at top.' },
  { id:'calf-raise-seated',name:'Seated Calf Raise',        muscle:'Calves',    equip:'Machine',    notes:'Targets soleus more than gastrocnemius.' },
  // Core
  { id:'plank',            name:'Plank',                    muscle:'Core',      equip:'Bodyweight', notes:'Squeeze everything, breathe.' },
  { id:'crunch',           name:'Crunch',                   muscle:'Core',      equip:'Bodyweight', notes:'Small ROM, focus on contraction.' },
  { id:'leg-raise',        name:'Hanging Leg Raise',        muscle:'Core',      equip:'Bodyweight', notes:'Control the descent.' },
  { id:'ab-wheel',         name:'Ab Wheel Rollout',         muscle:'Core',      equip:'Bodyweight', notes:'Keep lower back flat.' },
  { id:'cable-crunch',     name:'Cable Crunch',             muscle:'Core',      equip:'Cable',      notes:'Crunch with rope from high pulley.' },
  { id:'pallof-press',     name:'Pallof Press',             muscle:'Core',      equip:'Cable',      notes:'Anti-rotation, great for core stability.' },
  // Full Body / Cardio
  { id:'burpee',           name:'Burpee',                   muscle:'Full Body', equip:'Bodyweight', notes:'High intensity, great for fat loss.' },
  { id:'kettlebell-swing', name:'Kettlebell Swing',         muscle:'Full Body', equip:'Kettlebell', notes:'Hip hinge power movement.' },
  { id:'box-jump',         name:'Box Jump',                 muscle:'Full Body', equip:'Bodyweight', notes:'Land softly, step down.' },
  { id:'battle-rope',      name:'Battle Ropes',             muscle:'Cardio',    equip:'Bodyweight', notes:'30s on, 15s off.' },
  { id:'jump-rope',        name:'Jump Rope',                muscle:'Cardio',    equip:'Bodyweight', notes:'Great warm-up or HIIT finisher.' },
  { id:'row-machine',      name:'Rowing Machine',           muscle:'Cardio',    equip:'Machine',    notes:'Full body cardio, great calorie burn.' },
];

function getLibrary() {
  const custom = loadLocal(libraryKey(), []);
  return [...BASE_LIBRARY, ...custom];
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  UTILS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (err?' err':'') + ' show';
  setTimeout(()=>t.classList.remove('show'), 2400);
}
function todayName() { return DAYS_OF_WEEK[new Date().getDay()]; }
function todayStr()  { return new Date().toISOString().split('T')[0]; }
function selectedDayName() { return DAYS_OF_WEEK[selectedWorkoutDate.getDay()]; }
function selectedDateStr() { return selectedWorkoutDate.toISOString().split('T')[0]; }
function maxWorkoutDate() { const d = new Date(); d.setDate(d.getDate()+5); return d.toISOString().split('T')[0]; }
function setWorkoutDate(dateStr) { selectedWorkoutDate = new Date(dateStr+'T12:00:00'); todayWorkout = null; renderToday(); }
function fmtDate(s)  { return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}); }
function viewKey()   { return viewingPartner ? 'partner' : 'me'; }
function viewName()  { return viewingPartner ? (session.partner?.name||'Partner') : session.name; }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  AUTH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function doLogin() {
  const name = document.getElementById('ln').value.trim();
  const pin  = document.getElementById('lp').value.trim();
  const err  = document.getElementById('lerr');
  err.style.display = 'none';
  if (!name || pin.length < 4) { err.textContent='Enter name and 4-digit PIN'; err.style.display='block'; return; }
  try {
    const res = await fetch(API+'/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,pin}) });
    if (!res.ok) throw new Error((await res.json()).detail || 'Invalid credentials');
    session = await res.json();
    launchApp();
  } catch(e) { err.textContent = e.message; err.style.display='block'; }
}

function launchApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('myBtn').textContent = 'ðŸ‘¤ ' + session.name.split(' ')[0];
  if (session.partner) {
    document.getElementById('ptBtn').textContent = 'ðŸ’œ ' + session.partner.name.split(' ')[0];
  } else {
    document.getElementById('ptBtn').style.display = 'none';
  }
  renderToday();
  renderLibrary();
  renderSettings();
}

function doLogout() {
  session = null; todayWorkout = null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('lp').value='';
}

function switchView(who) {
  if (who==='partner' && !session?.partner) { toast('No partner linked', true); return; }
  viewingPartner = who==='partner';
  document.getElementById('myBtn').classList.toggle('active', !viewingPartner);
  document.getElementById('ptBtn').classList.toggle('active', viewingPartner);
  todayWorkout = null;
  renderToday();
  renderSettings();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  NAV
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  const navBtns = document.querySelectorAll('.nav-btn');
  const pages = ['today','history','prs','library','settings'];
  const idx = pages.indexOf(id);
  if (idx>=0 && navBtns[idx]) navBtns[idx].classList.add('active');
  if (id==='today')   renderToday();
  if (id==='history') renderHistory();
  if (id==='prs')     renderPRs();
  if (id==='library') renderLibrary();
  if (id==='settings') renderSettings();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  TODAY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function renderToday() {
  const el = document.getElementById('today-content');
  const day = selectedDayName();
  const sched = getSchedule(viewKey());
  const dayInfo = sched[day] || { gym: false, muscle: 'Rest', style: '' };
  const dayAbbr = day.substring(0,3).toUpperCase();
  const profile = getProfile(viewKey());
  const displayDate = selectedWorkoutDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const isToday = selectedDateStr() === todayStr();

  const datePicker = `<div style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
    <label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">Workout Date</label>
    <input type="date" value="${selectedDateStr()}" min="${todayStr()}" max="${maxWorkoutDate()}" onchange="setWorkoutDate(this.value)" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:13px;padding:6px 10px;border-radius:8px;outline:none">
  </div>`;

  if (!dayInfo.gym) {
    el.innerHTML = `
      <div class="card">
        ${datePicker}
        <div class="today-header">
          <div class="today-day">${dayAbbr}</div>
          <div class="today-info">
            <div class="today-date">${displayDate}</div>
            <div class="today-muscle">${dayInfo.muscle}</div>
          </div>
        </div>
        <div class="rest-day">
          <div class="icon">${dayInfo.muscle.includes('Pole')?'ðŸŽª':dayInfo.muscle.includes('Cardio')?'ðŸƒ':dayInfo.muscle.includes('Rest')?'ðŸ˜´':'ðŸ’†'}</div>
          <h2>${dayInfo.muscle.toUpperCase()}</h2>
          <p>${dayInfo.muscle.includes('Rest') ? 'Recovery is part of the program. See you tomorrow.' : 'Get after it!'}</p>
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn ai" id="gen-btn" onclick="generateWorkout()" style="opacity:0.5" disabled title="Change the date above to a gym day to generate">✦ Generate Workout</button>
          <button class="btn ghost" onclick="openManualWorkout()">✏️ Manual Workout</button>
        </div>
      </div>`;
    return;
  }

  // Check if already logged for selected date
  const history = getHistory(viewKey());
  const alreadyLogged = history.find(h=>h.date===selectedDateStr());

  el.innerHTML = `
    <div class="card">
      ${datePicker}
      <div class="today-header">
        <div class="today-day">${dayAbbr}</div>
        <div class="today-info">
          <div class="today-date">${displayDate}</div>
          <div class="today-muscle">${dayInfo.muscle}</div>
          <div class="today-style">${dayInfo.style}</div>
        </div>
      </div>
      ${alreadyLogged ? `<div style="background:rgba(200,245,66,0.08);border:1px solid rgba(200,245,66,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--accent-a)">âœ“ Workout already logged for ${isToday?'today':displayDate}! You can still generate a new one or log again.</div>` : ''}
      <div class="btn-row">
        <button class="btn ai" id="gen-btn" onclick="generateWorkout()">âœ¦ Generate Workout</button>
        <button class="btn ghost" onclick="openManualWorkout()">âœï¸ Manual Workout</button>
        ${todayWorkout ? `<button class="btn ghost" onclick="saveWorkout()">ðŸ’¾ Save Workout</button>` : ''}
      </div>
    </div>
    <div id="workout-display"></div>`;

  if (todayWorkout) renderWorkoutDisplay();
}

async function generateWorkout() {
  const btn = document.getElementById('gen-btn');
  const display = document.getElementById('workout-display');
  btn.disabled = true;
  btn.textContent = 'âœ¦ Generating...';

  const day = selectedDayName();
  const sched = getSchedule(viewKey());
  const dayInfo = sched[day];
  const profile = getProfile(viewKey());
  const history = getHistory(viewKey());
  const prs = getPRs(viewKey());
  const isPartner = viewingPartner;

  // Build recent history context
  const recentWorkouts = history.slice(-5).map(h =>
    `${h.date} (${h.muscleGroup}): ${h.exercises.map(e=>`${e.name} â€” ${e.sets.map(s=>`${s.reps}x${s.weight}lbs`).join(', ')}`).join(' | ')}`
  ).join('\n');

  // Build PR context
  const prContext = Object.entries(prs).map(([ex,pr])=>`${ex}: ${pr.weight}lbs x ${pr.reps}`).join(', ');

  const prompt = `You are an expert personal trainer creating a workout for ${viewName()}.

PROFILE:
- Goal: ${profile.goal}
- Training style: ${profile.style}
- Experience: ${profile.experience}
- Today: ${day} â€” ${dayInfo.muscle} day
- Style for today: ${dayInfo.style}

RECENT WORKOUT HISTORY:
${recentWorkouts || 'No recent history yet.'}

PERSONAL RECORDS:
${prContext || 'No PRs recorded yet.'}

IMPORTANT RULES:
${isPartner ? `
- Lindsay wants to LOSE 40 LBS in 6 months â€” keep intensity HIGH
- Use supersets wherever possible to maximize calorie burn
- Keep rest periods SHORT (30-60 seconds between sets)
- Include HIIT elements â€” metabolic finishers are great
- Mix compound and isolation movements
- 4-5 exercises, some paired as supersets
` : `
- Jake wants body recomp â€” lose fat, build muscle, strength focus
- Progressive overload is key â€” suggest weights based on PR history
- Moderate rest (60-90 seconds)
- 5-6 exercises, mostly compound movements with isolation finish
- Strength rep ranges: 3-5 sets of 5-8 reps for compounds
`}

EXERCISE LIBRARY (use these names exactly, or invent if needed):
${getLibrary().map(e=>e.name).join(', ')}

OUTPUT FORMAT â€” respond with ONLY valid JSON, no markdown, no explanation:
{
  "title": "Workout title",
  "notes": "One sentence tip or motivation for today",
  "exercises": [
    {
      "name": "Exercise Name",
      "muscle": "Muscle Group",
      "sets": 3,
      "reps": "8-10",
      "weight_suggestion": "Start at 95 lbs (based on your PR)",
      "notes": "Brief cue",
      "superset_with": null
    }
  ]
}

For supersets, set superset_with to the name of the exercise it pairs with (both exercises should reference each other).
Generate the workout now.`;

  display.innerHTML = `<div class="ai-loading"><div class="ai-spinner"></div><p><strong>AI is building your ${dayInfo.muscle} workout...</strong><br>Analyzing your history and goals</p></div>`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    let text = data.content.map(c=>c.text||'').join('');
    text = text.replace(/```json|```/g,'').trim();
    const workout = JSON.parse(text);
    workout.day = selectedDayName();
    workout.muscleGroup = dayInfo.muscle;
    workout.style = dayInfo.style;
    // Initialize logging state
    workout.exercises = workout.exercises.map((ex, i) => ({
      ...ex,
      id: i,
      loggedSets: Array(ex.sets).fill(null).map(() => ({ reps: '', weight: '', done: false }))
    }));
    todayWorkout = workout;
    renderWorkoutDisplay();
    // Show save button
    document.querySelector('.btn-row').innerHTML = `
      <button class="btn ai" id="gen-btn" onclick="generateWorkout()">âœ¦ Regenerate</button>
      <button class="btn ghost" onclick="saveWorkout()">ðŸ’¾ Save Workout</button>`;
  } catch(e) {
    display.innerHTML = `<div class="card"><p style="color:var(--red)">Failed to generate workout: ${e.message}. Make sure the backend API URL is set.</p></div>`;
  }
  btn.disabled = false;
}

function renderWorkoutDisplay() {
  const display = document.getElementById('workout-display');
  if (!todayWorkout) return;
  const w = todayWorkout;
  const history = getHistory(viewKey());
  const prs = getPRs(viewKey());

  // Group supersets
  const rendered = new Set();
  let html = '';

  // Workout title card
  html += `<div class="card" style="background:linear-gradient(135deg,#111118,#0f1a20);border-color:rgba(66,200,245,0.2)">
    <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:var(--accent-c);margin-bottom:6px">${w.title}</div>
    <div style="font-size:13px;color:var(--text-dim)">${w.notes}</div>
  </div>`;

  w.exercises.forEach((ex, idx) => {
    if (rendered.has(idx)) return;
    rendered.add(idx);

    const isSuperset = !!ex.superset_with;
    const superPartnerIdx = isSuperset ? w.exercises.findIndex(e=>e.name===ex.superset_with && e.id!==ex.id) : -1;
    if (superPartnerIdx>=0) rendered.add(superPartnerIdx);
    const superPartner = superPartnerIdx>=0 ? w.exercises[superPartnerIdx] : null;

    // Find last performance
    const lastPerf = findLastPerformance(ex.name, history);
    const prVal = prs[ex.name];

    const exHTML = (exercise, exIdx) => {
      const lp = findLastPerformance(exercise.name, history);
      const pr = prs[exercise.name];
      return `
        <div style="${isSuperset&&exIdx>0?'margin-top:12px;padding-top:12px;border-top:1px solid var(--border)':''}">
          <div class="ex-header">
            <div>
              <div class="ex-name">${exercise.name}</div>
              <div class="ex-muscle">${exercise.muscle}</div>
              <div class="ex-badges">
                ${isSuperset?'<span class="badge superset">SUPERSET</span>':''}
                ${w.style?.includes('HIIT')?'<span class="badge hiit">HIIT</span>':'<span class="badge strength">STRENGTH</span>'}
              </div>
            </div>
            <button class="btn danger" onclick="openSwapModal(${exIdx})">â‡„ Swap</button>
          </div>
          ${lp ? `<div class="last-performance">ðŸ“Š Last time: <strong>${lp.sets.map(s=>`${s.reps}Ã—${s.weight}lbs`).join(', ')}</strong> on ${fmtDate(lp.date)}</div>` : ''}
          ${exercise.weight_suggestion ? `<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;font-style:italic">ðŸ’¡ ${exercise.weight_suggestion}</div>` : ''}
          ${exercise.notes ? `<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px">ðŸ“Œ ${exercise.notes}</div>` : ''}
          <table class="sets-table">
            <thead><tr><th>SET</th><th>REPS</th><th>WEIGHT (lbs)</th><th>âœ“</th></tr></thead>
            <tbody>
              ${exercise.loggedSets.map((s,si)=>`
                <tr>
                  <td><span class="set-num">${si+1}</span></td>
                  <td><input type="number" placeholder="${exercise.reps}" value="${s.reps}" id="reps-${exIdx}-${si}" oninput="updateSet(${exIdx},${si},'reps',this.value);checkPR(${exIdx},${si})"></td>
                  <td><input type="number" placeholder="lbs" value="${s.weight}" id="wt-${exIdx}-${si}" oninput="updateSet(${exIdx},${si},'weight',this.value);checkPR(${exIdx},${si})"></td>
                  <td><button class="check-set ${s.done?'done':''}" id="chk-${exIdx}-${si}" onclick="toggleSet(${exIdx},${si})">${s.done?'âœ“':''}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <button class="btn ghost sm" onclick="addSet(${exIdx})" style="margin-top:4px">+ Set</button>
        </div>`;
    };

    if (isSuperset && superPartner) {
      html += `<div class="exercise-block superset">
        <div class="superset-label">âš¡ Superset</div>
        ${exHTML(ex, idx)}
        ${exHTML(superPartner, superPartnerIdx)}
      </div>`;
    } else {
      html += `<div class="exercise-block">${exHTML(ex, idx)}</div>`;
    }
  });

  display.innerHTML = html;
}

function findLastPerformance(exName, history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const found = history[i].exercises?.find(e => e.name === exName);
    if (found && found.sets?.some(s=>s.weight)) return { ...found, date: history[i].date };
  }
  return null;
}

function updateSet(exIdx, setIdx, field, val) {
  if (!todayWorkout) return;
  todayWorkout.exercises[exIdx].loggedSets[setIdx][field] = val;
}

function toggleSet(exIdx, setIdx) {
  if (!todayWorkout) return;
  const s = todayWorkout.exercises[exIdx].loggedSets[setIdx];
  s.done = !s.done;
  const btn = document.getElementById(`chk-${exIdx}-${setIdx}`);
  btn.classList.toggle('done', s.done);
  btn.textContent = s.done ? 'âœ“' : '';
}

function addSet(exIdx) {
  if (!todayWorkout) return;
  todayWorkout.exercises[exIdx].loggedSets.push({ reps: '', weight: '', done: false });
  renderWorkoutDisplay();
}

function checkPR(exIdx, setIdx) {
  if (!todayWorkout) return;
  const ex = todayWorkout.exercises[exIdx];
  const set = ex.loggedSets[setIdx];
  const prs = getPRs(viewKey());
  const existingPR = prs[ex.name];
  const w = parseFloat(set.weight), r = parseFloat(set.reps);
  if (!w || !r) return;
  const wtEl = document.getElementById(`wt-${exIdx}-${setIdx}`);
  if (!existingPR || w > existingPR.weight || (w === existingPR.weight && r > existingPR.reps)) {
    wtEl?.classList.add('pr-input');
  } else {
    wtEl?.classList.remove('pr-input');
  }
}

function saveWorkout() {
  if (!todayWorkout) return;
  const prs = getPRs(viewKey());
  let newPRs = 0;

  const exercises = todayWorkout.exercises.map(ex => {
    const sets = ex.loggedSets.filter(s => s.reps || s.weight).map(s => ({
      reps: parseFloat(s.reps) || 0,
      weight: parseFloat(s.weight) || 0,
      done: s.done
    }));

    // Check PRs
    sets.forEach(s => {
      if (!s.weight) return;
      const existing = prs[ex.name];
      if (!existing || s.weight > existing.weight || (s.weight === existing.weight && s.reps > existing.reps)) {
        prs[ex.name] = { weight: s.weight, reps: s.reps, date: todayStr() };
        newPRs++;
      }
    });

    return { name: ex.name, muscle: ex.muscle, sets };
  }).filter(e => e.sets.length > 0);

  if (!exercises.length) { toast('Log at least one set before saving', true); return; }

  const history = getHistory(viewKey());
  history.push({
    date: selectedDateStr(),
    muscleGroup: todayWorkout.muscleGroup,
    style: todayWorkout.style,
    title: todayWorkout.title,
    exercises
  });
  saveLocal(historyKey(viewKey()), history);
  saveLocal(prKey(viewKey()), prs);

  toast(newPRs > 0 ? `Workout saved! ðŸ† ${newPRs} new PR${newPRs>1?'s':''}!` : 'Workout saved âœ“');
  todayWorkout = null;
  renderToday();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SWAP EXERCISE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openSwapModal(exIdx) {
  swapTargetIndex = exIdx;
  swapFilterMuscle = 'All';
  renderSwapLibrary('', 'All');
  openModal('swap-modal');
}

function filterSwapLibrary(q) { renderSwapLibrary(q, swapFilterMuscle); }

function renderSwapLibrary(q='', muscle='All') {
  const lib = getLibrary();
  const filtered = lib.filter(e =>
    (muscle==='All' || e.muscle===muscle) &&
    (!q || e.name.toLowerCase().includes(q.toLowerCase()))
  );
  const muscles = ['All', ...new Set(lib.map(e=>e.muscle))];
  document.getElementById('swap-filters').innerHTML = muscles.map(m=>
    `<span class="lib-filter ${m===muscle?'active':''}" onclick="swapFilterMuscle='${m}';filterSwapLibrary(document.getElementById('swap-search').value)">${m}</span>`
  ).join('');
  document.getElementById('swap-list').innerHTML = filtered.map(e=>
    `<div class="lib-item" onclick="doSwap('${e.id||e.name}')">
      <div><div class="lib-item-name">${e.name}</div><div class="lib-item-meta">${e.muscle} Â· ${e.equip}</div></div>
      <div class="lib-item-add">â†’</div>
    </div>`
  ).join('') || '<div class="empty"><p>No exercises found</p></div>';
}

function doSwap(exId) {
  if (swapTargetIndex === null || !todayWorkout) return;
  const lib = getLibrary();
  const ex = lib.find(e=>(e.id||e.name)===exId);
  if (!ex) return;
  const old = todayWorkout.exercises[swapTargetIndex];
  todayWorkout.exercises[swapTargetIndex] = {
    ...old,
    name: ex.name,
    muscle: ex.muscle,
    notes: ex.notes || '',
    weight_suggestion: '',
  };
  closeModal('swap-modal');
  renderWorkoutDisplay();
  toast(`Swapped to ${ex.name}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  HISTORY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderHistory() {
  const history = getHistory(viewKey());
  const el = document.getElementById('history-list');
  if (!history.length) { el.innerHTML='<div class="empty"><div class="icon">ðŸ“‹</div><p>No workouts logged yet</p></div>'; return; }
  el.innerHTML = [...history].reverse().map((h,i)=>{
    const totalSets = h.exercises.reduce((acc,e)=>acc+e.sets.length,0);
    return `<div class="history-item" onclick="toggleHistoryDetail(${i})">
      <div class="history-item-header">
        <div><div class="history-date">${fmtDate(h.date)} â€” ${h.muscleGroup}</div><div class="history-muscle">${h.title||''}</div></div>
        <div class="history-stats">${h.exercises.length} ex Â· ${totalSets} sets</div>
      </div>
      <div class="history-detail" id="hist-detail-${i}">
        ${h.exercises.map(e=>`
          <div class="history-ex">
            <strong>${e.name}</strong>
            <span>${e.sets.map(s=>`${s.reps}Ã—${s.weight}lbs`).join(', ')}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleHistoryDetail(i) {
  const el = document.getElementById('hist-detail-'+i);
  el.classList.toggle('open');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PRs
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderPRs() {
  const prs = getPRs(viewKey());
  const el = document.getElementById('pr-grid');
  const entries = Object.entries(prs);
  if (!entries.length) { el.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="icon">ðŸ†</div><p>No PRs yet â€” start logging workouts!</p></div>'; return; }
  el.innerHTML = entries.sort((a,b)=>a[0].localeCompare(b[0])).map(([name,pr])=>`
    <div class="pr-box">
      <div class="pr-ex">${name}</div>
      <div class="pr-val">${pr.weight} lbs</div>
      <div class="pr-meta">${pr.reps} reps Â· ${fmtDate(pr.date)}</div>
    </div>`).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  LIBRARY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function filterLibrary(q) { renderLibraryList(q, libFilterMuscle); }

function renderLibrary() {
  const muscles = ['All', ...MUSCLE_GROUPS];
  document.getElementById('lib-filters').innerHTML = muscles.map(m=>
    `<span class="lib-filter ${m===libFilterMuscle?'active':''}" onclick="libFilterMuscle='${m}';renderLibraryList(document.getElementById('lib-search').value,'${m}')">${m}</span>`
  ).join('');
  renderLibraryList('', libFilterMuscle);
}

function renderLibraryList(q='', muscle='All') {
  const lib = getLibrary();
  const filtered = lib.filter(e=>
    (muscle==='All'||e.muscle===muscle) &&
    (!q||e.name.toLowerCase().includes(q.toLowerCase()))
  );
  document.getElementById('lib-list').innerHTML = filtered.map(e=>`
    <div class="lib-item" style="cursor:default">
      <div>
        <div class="lib-item-name">${e.name}</div>
        <div class="lib-item-meta">${e.muscle} Â· ${e.equip}${e.notes?` Â· ${e.notes}`:''}</div>
      </div>
    </div>`).join('') || '<div class="empty"><p>No exercises found</p></div>';
}

function openAddExerciseModal() { openModal('add-ex-modal'); }

function saveNewExercise() {
  const name = document.getElementById('new-ex-name').value.trim();
  if (!name) { toast('Enter exercise name', true); return; }
  const custom = loadLocal(libraryKey(), []);
  custom.push({
    id: 'custom-' + Date.now(),
    name,
    muscle: document.getElementById('new-ex-muscle').value,
    equip: document.getElementById('new-ex-equip').value,
    notes: document.getElementById('new-ex-notes').value.trim()
  });
  saveLocal(libraryKey(), custom);
  closeModal('add-ex-modal');
  document.getElementById('new-ex-name').value='';
  document.getElementById('new-ex-notes').value='';
  renderLibrary();
  toast(`${name} added to library âœ“`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SETTINGS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MUSCLE_OPTIONS = ['Rest','Upper Body','Lower Body','Full Body','Push (Chest/Shoulders/Triceps)','Pull (Back/Biceps)','Chest & Triceps','Back & Biceps','Shoulders','Legs','Posterior Chain','Anterior Chain','Cardio','Pole Dancing','Cardio / Pole'];
const STYLE_OPTIONS = ['','Strength','Hypertrophy','HIIT / Supersets','Cardio'];

function renderSettings() {
  const sched = getSchedule(viewKey());
  const profile = getProfile(viewKey());

  // Schedule editor
  document.getElementById('schedule-editor').innerHTML = DAYS_ORDER.map(day => {
    const d = sched[day] || { gym: false, muscle: 'Rest', style: '' };
    return `<div class="set-row">
      <div>
        <label>${day}</label>
        <small>${d.gym ? 'ðŸ‹ï¸ Gym day' : 'ðŸ’¤ Off'}</small>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="sched-muscle-${day}" onchange="schedGymCheck('${day}')">
          ${MUSCLE_OPTIONS.map(m=>`<option ${d.muscle===m?'selected':''}>${m}</option>`).join('')}
        </select>
        <select id="sched-style-${day}">
          ${STYLE_OPTIONS.map(s=>`<option ${d.style===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }).join('');

  // Profile editor
  document.getElementById('training-profile-editor').innerHTML = `
    <div class="set-row">
      <div><label>Training Style</label><small>How the AI programs your workouts</small></div>
      <select id="prof-style">
        ${['Strength','Hypertrophy','HIIT / Supersets','Strength / Hypertrophy'].map(s=>`<option ${profile.style===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="set-row">
      <div><label>Experience Level</label></div>
      <select id="prof-exp">
        ${['Beginner','Beginner-Intermediate','Intermediate','Advanced'].map(s=>`<option ${profile.experience===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div style="margin-top:14px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin-bottom:8px">Goal (tells the AI what to optimize for)</div>
      <textarea id="prof-goal" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;padding:10px 12px;border-radius:8px;outline:none;resize:vertical;min-height:80px">${profile.goal}</textarea>
    </div>`;
}

function schedGymCheck(day) {
  const muscle = document.getElementById(`sched-muscle-${day}`).value;
  // auto-mark as gym or rest
}

function saveSchedule() {
  const sched = {};
  DAYS_ORDER.forEach(day => {
    const muscle = document.getElementById(`sched-muscle-${day}`)?.value || 'Rest';
    const style = document.getElementById(`sched-style-${day}`)?.value || '';
    const gym = !['Rest','Pole Dancing','Cardio / Pole'].includes(muscle);
    sched[day] = { gym, muscle, style };
  });
  saveLocal(scheduleKey(viewKey()), sched);
  toast('Schedule saved âœ“');
  todayWorkout = null;
}

function saveProfile() {
  const profile = {
    style: document.getElementById('prof-style')?.value || 'Strength',
    experience: document.getElementById('prof-exp')?.value || 'Intermediate',
    goal: document.getElementById('prof-goal')?.value || ''
  };
  saveLocal(profileKey(viewKey()), profile);
  toast('Training profile saved âœ“');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MANUAL WORKOUT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let manualExercises = [];

function openManualWorkout() {
  manualExercises = [];
  const day = selectedDayName();
  const sched = getSchedule(viewKey());
  const dayInfo = sched[day] || { muscle: 'Custom', style: '' };
  document.getElementById('manual-title').value = dayInfo.muscle + ' - Custom Workout';
  document.getElementById('manual-notes').value = '';
  renderManualExercises();
  openModal('manual-modal');
}

function renderManualExercises() {
  const el = document.getElementById('manual-exercises');
  if (!manualExercises.length) {
    el.innerHTML = '<div class="empty" style="padding:20px"><p style="color:var(--text-dim);font-size:13px">No exercises added yet. Add from the library or type your own.</p></div>';
    return;
  }
  el.innerHTML = manualExercises.map((ex, i) => `
    <div class="exercise-block" style="margin-bottom:8px">
      <div class="ex-header">
        <div>
          <div class="ex-name">${ex.name}</div>
          <div class="ex-muscle">${ex.muscle || ''}</div>
        </div>
        <button class="btn danger" style="font-size:11px;padding:4px 8px" onclick="removeManualEx(${i})">âœ•</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <div class="fg" style="flex:1"><label>Sets</label><input type="number" value="${ex.sets}" min="1" max="10" onchange="manualExercises[${i}].sets=parseInt(this.value)" style="background:var(--surface3);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:14px;padding:6px;border-radius:6px;text-align:center;width:100%"></div>
        <div class="fg" style="flex:1"><label>Reps</label><input type="text" value="${ex.reps}" onchange="manualExercises[${i}].reps=this.value" style="background:var(--surface3);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:14px;padding:6px;border-radius:6px;text-align:center;width:100%"></div>
        <div class="fg" style="flex:1"><label>Weight</label><input type="text" value="${ex.weight||''}" placeholder="lbs" onchange="manualExercises[${i}].weight=this.value" style="background:var(--surface3);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:14px;padding:6px;border-radius:6px;text-align:center;width:100%"></div>
      </div>
    </div>
  `).join('');
}

function removeManualEx(i) {
  manualExercises.splice(i, 1);
  renderManualExercises();
}

function addManualExFromLib() {
  const lib = getLibrary();
  const html = lib.map(ex => `
    <div class="lib-item" onclick="pickLibExercise('${ex.name.replace(/'/g,"\\'")}','${ex.muscle}')" style="cursor:pointer">
      <div><div class="lib-item-name">${ex.name}</div><div class="lib-item-meta">${ex.muscle} â€” ${ex.equip||''}</div></div>
      <div class="lib-item-add">+</div>
    </div>
  `).join('');
  document.getElementById('manual-lib-list').innerHTML = html;
  document.getElementById('manual-lib-section').style.display = 'block';
}

function pickLibExercise(name, muscle) {
  manualExercises.push({ name, muscle, sets: 3, reps: '10', weight: '' });
  renderManualExercises();
  document.getElementById('manual-lib-section').style.display = 'none';
}

function addCustomExercise() {
  const name = document.getElementById('manual-custom-name').value.trim();
  if (!name) { toast('Enter an exercise name', true); return; }
  manualExercises.push({ name, muscle: '', sets: 3, reps: '10', weight: '' });
  document.getElementById('manual-custom-name').value = '';
  renderManualExercises();
}

function saveManualWorkout() {
  if (!manualExercises.length) { toast('Add at least one exercise', true); return; }
  const title = document.getElementById('manual-title').value || 'Custom Workout';
  const notes = document.getElementById('manual-notes').value || '';
  const day = selectedDayName();
  const sched = getSchedule(viewKey());
  const dayInfo = sched[day] || { muscle: 'Custom', style: '' };

  todayWorkout = {
    title,
    notes,
    day,
    muscleGroup: dayInfo.muscle,
    style: dayInfo.style,
    exercises: manualExercises.map((ex, i) => ({
      ...ex,
      id: i,
      weight_suggestion: ex.weight || '',
      superset_with: null,
      loggedSets: Array(ex.sets).fill(null).map(() => ({ reps: ex.reps, weight: ex.weight || '', done: false }))
    }))
  };
  closeModal('manual-modal');
  renderToday();
  renderWorkoutDisplay();
  document.querySelector('.btn-row').innerHTML = `
    <button class="btn ai" id="gen-btn" onclick="generateWorkout()">âœ¦ Regenerate</button>
    <button class="btn ghost" onclick="openManualWorkout()">âœï¸ Manual</button>
    <button class="btn ghost" onclick="saveWorkout()">ðŸ’¾ Save Workout</button>`;
  toast('Manual workout loaded! Log your sets and save.');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  ENTER KEY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
document.getElementById('lp').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

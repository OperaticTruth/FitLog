"""
FitLog Backend - FastAPI + PostgreSQL
"""
import os, re, json, secrets
from datetime import date, datetime, timedelta
from typing import Optional, List

import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False

app = FastAPI(title="FitLog API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost:5432/fitlog")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SESSION_DAYS = 30

# ── DB ──────────────────────────────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    partner_id INT REFERENCES users(id),
    height_in REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS weight_entries (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    weight_lbs REAL NOT NULL,
    notes TEXT,
    UNIQUE(user_id, entry_date)
);
CREATE TABLE IF NOT EXISTS measurements (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    stomach REAL, waist REAL, chest REAL, hips REAL, glutes REAL,
    upper_arm_l REAL, upper_arm_r REAL, flexed_l REAL, flexed_r REAL,
    thigh_l REAL, thigh_r REAL,
    UNIQUE(user_id, entry_date)
);
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target REAL, unit TEXT, deadline DATE,
    achieved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    is_gym BOOLEAN DEFAULT TRUE,
    muscle_group TEXT NOT NULL DEFAULT 'Rest',
    style TEXT,
    UNIQUE(user_id, day_of_week)
);
CREATE TABLE IF NOT EXISTS training_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT, style TEXT, experience TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workouts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL,
    muscle_group TEXT, title TEXT, style TEXT, notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, workout_date)
);
CREATE TABLE IF NOT EXISTS workout_exercises (
    id SERIAL PRIMARY KEY,
    workout_id INT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    muscle TEXT, sort_order INT DEFAULT 0, superset_with TEXT
);
CREATE TABLE IF NOT EXISTS workout_sets (
    id SERIAL PRIMARY KEY,
    exercise_id INT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    reps TEXT, weight_lbs REAL, done BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS personal_records (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    weight_lbs REAL NOT NULL,
    reps INT, achieved_date DATE NOT NULL,
    UNIQUE(user_id, exercise_name)
);
"""

DEFAULT_SCHEDULES = {
    "jake": [
        {"day":"Monday","gym":True,"muscle":"Chest & Triceps","style":"Strength"},
        {"day":"Tuesday","gym":True,"muscle":"Posterior Chain","style":"Strength"},
        {"day":"Wednesday","gym":True,"muscle":"Back & Biceps","style":"Strength"},
        {"day":"Thursday","gym":True,"muscle":"Anterior Chain","style":"Strength"},
        {"day":"Friday","gym":True,"muscle":"Shoulders","style":"Strength"},
        {"day":"Saturday","gym":False,"muscle":"Rest","style":""},
        {"day":"Sunday","gym":False,"muscle":"Rest","style":""},
    ],
    "lindsay": [
        {"day":"Monday","gym":True,"muscle":"Upper Body","style":"HIIT / Supersets"},
        {"day":"Tuesday","gym":True,"muscle":"Lower Body","style":"HIIT / Supersets"},
        {"day":"Wednesday","gym":False,"muscle":"Pole Dancing","style":""},
        {"day":"Thursday","gym":True,"muscle":"Full Body","style":"HIIT / Supersets"},
        {"day":"Friday","gym":False,"muscle":"Cardio / Pole","style":""},
        {"day":"Saturday","gym":False,"muscle":"Rest","style":""},
        {"day":"Sunday","gym":False,"muscle":"Rest","style":""},
    ],
}
DEFAULT_PROFILES = {
    "jake":    {"goal":"Body recomp - lose fat, build muscle. Target: 180-185 lbs, body fat 13-15%.","style":"Strength / Hypertrophy","experience":"Intermediate"},
    "lindsay": {"goal":"Lose 40 lbs in 6 months. Fat loss focused. HIIT, supersets, short rest periods.","style":"HIIT / Supersets","experience":"Beginner-Intermediate"},
}

@app.on_event("startup")
def startup():
    with psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA)
        conn.commit()

# ── AUTH HELPERS ────────────────────────────────────────────────────────────

def hash_pw(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def check_pw(pw, h): return bcrypt.checkpw(pw.encode(), h.encode())

def create_session(conn, user_id):
    token = secrets.token_urlsafe(32)
    exp = datetime.utcnow() + timedelta(days=SESSION_DAYS)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO sessions (token,user_id,expires_at) VALUES (%s,%s,%s)", (token, user_id, exp))
    conn.commit()
    return token

def get_current_user(authorization: Optional[str] = Header(None), conn=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    with conn.cursor() as cur:
        cur.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=%s AND s.expires_at>NOW()",
            (token,)
        )
        user = cur.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Session expired - please log in again")
    return dict(user)

# ── MODELS ──────────────────────────────────────────────────────────────────

class RegisterReq(BaseModel):
    username: str
    display_name: str
    password: str
    height_in: Optional[float] = None

class LoginReq(BaseModel):
    username: str
    password: str

class WeightEntry(BaseModel):
    entry_date: date
    weight_lbs: float
    notes: Optional[str] = None

class MeasurementEntry(BaseModel):
    entry_date: date
    stomach: Optional[float]=None; waist: Optional[float]=None
    chest: Optional[float]=None;   hips: Optional[float]=None
    glutes: Optional[float]=None;  upper_arm_l: Optional[float]=None
    upper_arm_r: Optional[float]=None; flexed_l: Optional[float]=None
    flexed_r: Optional[float]=None; thigh_l: Optional[float]=None
    thigh_r: Optional[float]=None

class GoalReq(BaseModel):
    title: str
    target: Optional[float]=None; unit: Optional[str]=None; deadline: Optional[date]=None

class ScheduleDay(BaseModel):
    day_of_week: str; is_gym: bool; muscle_group: str; style: Optional[str]=None

class ProfileReq(BaseModel):
    goal: Optional[str]=None; style: Optional[str]=None; experience: Optional[str]=None

class GenerateReq(BaseModel):
    workout_date: date

class SaveWorkoutReq(BaseModel):
    workout_date: date; muscle_group: str; title: str
    style: Optional[str]=None; notes: Optional[str]=None
    exercises: list

class PRReq(BaseModel):
    exercise_name: str; weight_lbs: float
    reps: Optional[int]=None; achieved_date: date

class PhotoReq(BaseModel):
    photo_date: date
    note: Optional[str]=None
    image_data: str   # base64 JPEG data URL

# ── AUTH ROUTES ──────────────────────────────────────────────────────────────

@app.post("/auth/register")
def register(req: RegisterReq, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE username=%s", (req.username.lower(),))
        if cur.fetchone():
            raise HTTPException(400, "Username already taken")
        cur.execute(
            "INSERT INTO users (username,display_name,password_hash,height_in) VALUES (%s,%s,%s,%s) RETURNING id",
            (req.username.lower(), req.display_name, hash_pw(req.password), req.height_in)
        )
        uid = cur.fetchone()["id"]
        ukey = req.username.lower()
        for s in DEFAULT_SCHEDULES.get(ukey, DEFAULT_SCHEDULES["jake"]):
            cur.execute(
                "INSERT INTO schedules (user_id,day_of_week,is_gym,muscle_group,style) VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (uid, s["day"], s["gym"], s["muscle"], s["style"])
            )
        p = DEFAULT_PROFILES.get(ukey, DEFAULT_PROFILES["jake"])
        cur.execute(
            "INSERT INTO training_profiles (user_id,goal,style,experience) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
            (uid, p["goal"], p["style"], p["experience"])
        )
    conn.commit()
    token = create_session(conn, uid)
    return {"token": token, "user_id": uid, "display_name": req.display_name, "username": req.username.lower()}

@app.post("/auth/login")
def login(req: LoginReq, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE username=%s", (req.username.lower(),))
        user = cur.fetchone()
    if not user or not check_pw(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    token = create_session(conn, user["id"])
    return {"token": token, "user_id": user["id"], "display_name": user["display_name"], "username": user["username"]}

@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None), conn=Depends(get_db)):
    if authorization and authorization.startswith("Bearer "):
        with conn.cursor() as cur:
            cur.execute("DELETE FROM sessions WHERE token=%s", (authorization.split(" ")[1],))
        conn.commit()
    return {"ok": True}

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"user_id": user["id"], "display_name": user["display_name"], "username": user["username"], "height_in": user["height_in"]}

# ── WEIGHT ───────────────────────────────────────────────────────────────────

@app.post("/weight")
def log_weight(e: WeightEntry, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO weight_entries (user_id,entry_date,weight_lbs,notes) VALUES (%s,%s,%s,%s) ON CONFLICT (user_id,entry_date) DO UPDATE SET weight_lbs=EXCLUDED.weight_lbs,notes=EXCLUDED.notes RETURNING *",
            (user["id"], e.entry_date, e.weight_lbs, e.notes)
        )
        row = cur.fetchone()
    conn.commit()
    return dict(row)

@app.get("/weight")
def get_weight(days: int=90, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM weight_entries WHERE user_id=%s AND entry_date>=NOW()-INTERVAL '%s days' ORDER BY entry_date", (user["id"], days))
        return [dict(r) for r in cur.fetchall()]

# ── MEASUREMENTS ──────────────────────────────────────────────────────────────

MFIELDS = ["stomach","waist","chest","hips","glutes","upper_arm_l","upper_arm_r","flexed_l","flexed_r","thigh_l","thigh_r"]

@app.post("/measurements")
def log_measurement(e: MeasurementEntry, user=Depends(get_current_user), conn=Depends(get_db)):
    vals = [getattr(e, f) for f in MFIELDS]
    sc = ", ".join(f"{f}=EXCLUDED.{f}" for f in MFIELDS)
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO measurements (user_id,entry_date,{','.join(MFIELDS)}) VALUES (%s,%s,{','.join(['%s']*len(MFIELDS))}) ON CONFLICT (user_id,entry_date) DO UPDATE SET {sc} RETURNING *",
            (user["id"], e.entry_date, *vals)
        )
        row = cur.fetchone()
    conn.commit()
    return dict(row)

@app.get("/measurements")
def get_measurements(days: int=90, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM measurements WHERE user_id=%s AND entry_date>=NOW()-INTERVAL '%s days' ORDER BY entry_date", (user["id"], days))
        return [dict(r) for r in cur.fetchall()]

# ── GOALS ─────────────────────────────────────────────────────────────────────

@app.get("/goals")
def get_goals(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM goals WHERE user_id=%s ORDER BY created_at", (user["id"],))
        return [dict(r) for r in cur.fetchall()]

@app.post("/goals")
def create_goal(g: GoalReq, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO goals (user_id,title,target,unit,deadline) VALUES (%s,%s,%s,%s,%s) RETURNING *", (user["id"],g.title,g.target,g.unit,g.deadline))
        row = cur.fetchone()
    conn.commit()
    return dict(row)

@app.patch("/goals/{gid}/achieve")
def achieve_goal(gid: int, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("UPDATE goals SET achieved=TRUE WHERE id=%s AND user_id=%s RETURNING *", (gid, user["id"]))
        row = cur.fetchone()
    conn.commit()
    return dict(row) if row else {}

@app.delete("/goals/{gid}")
def delete_goal(gid: int, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM goals WHERE id=%s AND user_id=%s", (gid, user["id"]))
    conn.commit()
    return {"ok": True}

# ── SCHEDULE & PROFILE ────────────────────────────────────────────────────────

@app.get("/schedule")
def get_schedule(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM schedules WHERE user_id=%s ORDER BY id", (user["id"],))
        return [dict(r) for r in cur.fetchall()]

@app.put("/schedule")
def save_schedule(days: List[ScheduleDay], user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        for d in days:
            cur.execute(
                "INSERT INTO schedules (user_id,day_of_week,is_gym,muscle_group,style) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (user_id,day_of_week) DO UPDATE SET is_gym=EXCLUDED.is_gym,muscle_group=EXCLUDED.muscle_group,style=EXCLUDED.style",
                (user["id"], d.day_of_week, d.is_gym, d.muscle_group, d.style)
            )
    conn.commit()
    return {"ok": True}

@app.get("/profile")
def get_profile(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM training_profiles WHERE user_id=%s", (user["id"],))
        row = cur.fetchone()
    return dict(row) if row else {}

@app.put("/profile")
def save_profile(p: ProfileReq, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO training_profiles (user_id,goal,style,experience) VALUES (%s,%s,%s,%s) ON CONFLICT (user_id) DO UPDATE SET goal=EXCLUDED.goal,style=EXCLUDED.style,experience=EXCLUDED.experience,updated_at=NOW()",
            (user["id"], p.goal, p.style, p.experience)
        )
    conn.commit()
    return {"ok": True}

# ── WORKOUT GENERATION ────────────────────────────────────────────────────────

FALLBACK_TEMPLATES = {
    "Chest & Triceps": {"title":"Push Day - Chest & Tris","notes":"Progressive overload. 90s rest on compounds.","exercises":[
        {"name":"Barbell Bench Press","muscle":"Chest","sets":4,"reps":"4-6","weight_suggestion":"Add 5 lbs from last session","notes":"1-sec pause at chest","superset_with":None},
        {"name":"Incline Dumbbell Press","muscle":"Chest","sets":3,"reps":"8-10","weight_suggestion":"Challenging but controlled","notes":"30 degree incline","superset_with":None},
        {"name":"Cable Chest Fly","muscle":"Chest","sets":3,"reps":"12-15","weight_suggestion":"Light - feel the stretch","notes":"Full stretch at bottom","superset_with":"Tricep Pushdown"},
        {"name":"Tricep Pushdown","muscle":"Triceps","sets":3,"reps":"12-15","weight_suggestion":"Moderate","notes":"Fully extend at bottom","superset_with":"Cable Chest Fly"},
        {"name":"Skull Crusher","muscle":"Triceps","sets":3,"reps":"10-12","weight_suggestion":"EZ bar","notes":"Slow eccentric","superset_with":None},
    ]},
    "Back & Biceps": {"title":"Pull Day - Back & Bis","notes":"Keep lats engaged on every pull.","exercises":[
        {"name":"Deadlift","muscle":"Back","sets":3,"reps":"3-5","weight_suggestion":"Heavy and controlled","notes":"Hip hinge, neutral spine","superset_with":None},
        {"name":"Barbell Row","muscle":"Back","sets":3,"reps":"6-8","weight_suggestion":"Moderate to heavy","notes":"45 deg hinge, pull to lower chest","superset_with":None},
        {"name":"Lat Pulldown","muscle":"Back","sets":3,"reps":"10-12","weight_suggestion":"Pull to upper chest","notes":"Squeeze lats at bottom","superset_with":"Barbell Curl"},
        {"name":"Barbell Curl","muscle":"Biceps","sets":3,"reps":"8-10","weight_suggestion":"Full ROM","notes":"Do not swing","superset_with":"Lat Pulldown"},
        {"name":"Hammer Curl","muscle":"Biceps","sets":2,"reps":"12-15","weight_suggestion":"Moderate","notes":"Neutral grip","superset_with":None},
    ]},
    "Shoulders": {"title":"Shoulder Day - Press & Sculpt","notes":"Start heavy, finish with high-rep isolation.","exercises":[
        {"name":"Overhead Press","muscle":"Shoulders","sets":4,"reps":"5-6","weight_suggestion":"Heavy","notes":"Bar from collar, press overhead","superset_with":None},
        {"name":"Dumbbell Shoulder Press","muscle":"Shoulders","sets":3,"reps":"10-12","weight_suggestion":"Moderate","notes":"Seated, control descent","superset_with":None},
        {"name":"Lateral Raise","muscle":"Shoulders","sets":3,"reps":"15-20","weight_suggestion":"Light","notes":"Slight forward lean","superset_with":"Face Pull"},
        {"name":"Face Pull","muscle":"Shoulders","sets":3,"reps":"15-20","weight_suggestion":"Moderate","notes":"High pulley, elbows high","superset_with":"Lateral Raise"},
    ]},
    "Upper Body": {"title":"Upper Body Burn - Superset Blast","notes":"Rest under 45 seconds. Heart rate stays elevated.","exercises":[
        {"name":"Dumbbell Shoulder Press","muscle":"Shoulders","sets":4,"reps":"12-15","weight_suggestion":"Challenging","notes":"Press and squeeze at top","superset_with":"Lateral Raise"},
        {"name":"Lateral Raise","muscle":"Shoulders","sets":4,"reps":"15-20","weight_suggestion":"Light","notes":"Raise to shoulder height","superset_with":"Dumbbell Shoulder Press"},
        {"name":"Lat Pulldown","muscle":"Back","sets":3,"reps":"12-15","weight_suggestion":"Moderate","notes":"Pull to upper chest","superset_with":"Dumbbell Row"},
        {"name":"Dumbbell Row","muscle":"Back","sets":3,"reps":"12-15","weight_suggestion":"Moderate","notes":"Drive elbow back","superset_with":"Lat Pulldown"},
        {"name":"Battle Ropes","muscle":"Cardio","sets":4,"reps":"30 sec","weight_suggestion":"Max effort","notes":"Alternate waves, stay low","superset_with":None},
    ]},
    "Lower Body": {"title":"Lower Body Burn - Glutes & Legs","notes":"Short rest, high reps, feel the burn.","exercises":[
        {"name":"Barbell Back Squat","muscle":"Quads","sets":4,"reps":"12-15","weight_suggestion":"Moderate","notes":"Drive knees out","superset_with":None},
        {"name":"Barbell Hip Thrust","muscle":"Glutes","sets":3,"reps":"15","weight_suggestion":"Moderate to heavy","notes":"Squeeze hard at top","superset_with":"Hip Abduction Machine"},
        {"name":"Hip Abduction Machine","muscle":"Glutes","sets":3,"reps":"20","weight_suggestion":"Moderate","notes":"Push knees out","superset_with":"Barbell Hip Thrust"},
        {"name":"Walking Lunge","muscle":"Quads","sets":3,"reps":"20 steps","weight_suggestion":"Light DBs","notes":"Long stride","superset_with":"Burpee"},
        {"name":"Burpee","muscle":"Full Body","sets":3,"reps":"10","weight_suggestion":"Bodyweight","notes":"Metabolic finisher","superset_with":"Walking Lunge"},
    ]},
    "Full Body": {"title":"Full Body HIIT - Blast","notes":"This one is gonna hurt. In the best way.","exercises":[
        {"name":"Barbell Back Squat","muscle":"Quads","sets":3,"reps":"15","weight_suggestion":"Moderate","notes":"Chest up","superset_with":"Dumbbell Row"},
        {"name":"Dumbbell Row","muscle":"Back","sets":3,"reps":"15","weight_suggestion":"Moderate","notes":"Brace and pull","superset_with":"Barbell Back Squat"},
        {"name":"Dumbbell Shoulder Press","muscle":"Shoulders","sets":3,"reps":"15","weight_suggestion":"Moderate","notes":"Superset with burpees","superset_with":"Burpee"},
        {"name":"Burpee","muscle":"Full Body","sets":3,"reps":"10","weight_suggestion":"Bodyweight","notes":"After each press set","superset_with":"Dumbbell Shoulder Press"},
        {"name":"Battle Ropes","muscle":"Cardio","sets":4,"reps":"30 sec","weight_suggestion":"Max effort","notes":"30s on, 15s off","superset_with":None},
    ]},
    "Posterior Chain": {"title":"Posterior Power","notes":"Own the eccentric on every hinge.","exercises":[
        {"name":"Romanian Deadlift","muscle":"Hamstrings","sets":4,"reps":"6-8","weight_suggestion":"Heavy","notes":"Feel the hamstring stretch","superset_with":None},
        {"name":"Lying Leg Curl","muscle":"Hamstrings","sets":3,"reps":"10-12","weight_suggestion":"Moderate","notes":"Control the negative","superset_with":"Barbell Hip Thrust"},
        {"name":"Barbell Hip Thrust","muscle":"Glutes","sets":3,"reps":"10-12","weight_suggestion":"Heavy","notes":"Squeeze hard at top","superset_with":"Lying Leg Curl"},
        {"name":"Standing Calf Raise","muscle":"Calves","sets":3,"reps":"15-20","weight_suggestion":"BW + plate","notes":"Full ROM, pause at top","superset_with":None},
    ]},
    "Anterior Chain": {"title":"Anterior Chain - Quad Focus","notes":"Knee-dominant patterns. Keep torso upright.","exercises":[
        {"name":"Barbell Back Squat","muscle":"Quads","sets":4,"reps":"5-6","weight_suggestion":"Heavy","notes":"Hip crease below parallel","superset_with":None},
        {"name":"Leg Press","muscle":"Quads","sets":3,"reps":"10-12","weight_suggestion":"Heavy","notes":"Full ROM","superset_with":None},
        {"name":"Bulgarian Split Squat","muscle":"Quads","sets":3,"reps":"10 each","weight_suggestion":"DBs","notes":"Drop straight down","superset_with":"Leg Extension"},
        {"name":"Leg Extension","muscle":"Quads","sets":3,"reps":"15-20","weight_suggestion":"Moderate","notes":"Squeeze at top","superset_with":"Bulgarian Split Squat"},
    ]},
}

def get_recent_wkts(conn, user_id, limit=5):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT w.workout_date, w.muscle_group, w.title,
               json_agg(json_build_object('name',we.exercise_name,'sets',
                   (SELECT json_agg(json_build_object('reps',ws.reps,'weight',ws.weight_lbs))
                    FROM workout_sets ws WHERE ws.exercise_id=we.id)
               ) ORDER BY we.sort_order) as exercises
               FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id=w.id
               WHERE w.user_id=%s GROUP BY w.id ORDER BY w.workout_date DESC LIMIT %s""",
            (user_id, limit)
        )
        return [dict(r) for r in cur.fetchall()]

def build_prompt(user, profile, sched, recent, prs):
    pr_txt = "\n".join(f"  {k}: {v['weight_lbs']}lbs x {v['reps']} reps" for k,v in list(prs.items())[:12]) or "  None yet"
    hist_txt = ""
    for w in recent[:3]:
        exs = w.get("exercises") or []
        hist_txt += f"  {w['workout_date']}: {w['muscle_group']} - {', '.join(e['name'] for e in exs if e.get('name'))}\n"
    if not hist_txt:
        hist_txt = "  No previous workouts\n"
    return f"""You are a personal trainer. Build a workout for {user['display_name']}.

PROFILE:
- Goal: {profile.get('goal','General fitness')}
- Style: {profile.get('style','Strength')}
- Experience: {profile.get('experience','Intermediate')}

TODAY: {sched['muscle_group']} / {sched.get('style','')}

RECENT HISTORY:
{hist_txt}
PERSONAL RECORDS:
{pr_txt}

Respond ONLY with valid JSON, no markdown fences:
{{"title":"...","notes":"one coaching sentence","exercises":[{{"name":"...","muscle":"...","sets":3,"reps":"8-10","weight_suggestion":"...","notes":"...","superset_with":null}}]}}

Rules: 4-6 exercises. Use supersets where appropriate for the style. Reference PRs in weight suggestions. If superset_with is set, the partner exercise must also reference back."""

@app.post("/workouts/generate")
def generate_workout(req: GenerateReq, user=Depends(get_current_user), conn=Depends(get_db)):
    day_name = req.workout_date.strftime("%A")
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM schedules WHERE user_id=%s AND day_of_week=%s", (user["id"], day_name))
        sched = cur.fetchone()
        cur.execute("SELECT * FROM training_profiles WHERE user_id=%s", (user["id"],))
        profile = cur.fetchone() or {}
    if not sched or not sched["is_gym"]:
        raise HTTPException(400, "Not a gym day")
    sched = dict(sched); profile = dict(profile)
    recent = get_recent_wkts(conn, user["id"])
    prs = {r["exercise_name"]: dict(r) for r in (lambda c: (c.execute("SELECT * FROM personal_records WHERE user_id=%s",(user["id"],)), c.fetchall()))(conn.cursor())[1]}

    if ANTHROPIC_API_KEY and CLAUDE_AVAILABLE:
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model="claude-sonnet-4-20250514", max_tokens=1500,
                messages=[{"role":"user","content": build_prompt(user, profile, sched, recent, prs)}]
            )
            raw = re.sub(r"^```[a-z]*\n?","",msg.content[0].text.strip())
            raw = re.sub(r"\n?```$","",raw)
            result = json.loads(raw)
            result.update({"source":"claude","muscle_group":sched["muscle_group"],"style":sched.get("style","")})
            return result
        except Exception:
            pass

    t = FALLBACK_TEMPLATES.get(sched["muscle_group"], list(FALLBACK_TEMPLATES.values())[0])
    result = dict(t)
    result.update({"source":"template","muscle_group":sched["muscle_group"],"style":sched.get("style","")})
    return result

# ── WORKOUTS SAVE / GET ───────────────────────────────────────────────────────

@app.post("/workouts")
def save_workout(req: SaveWorkoutReq, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO workouts (user_id,workout_date,muscle_group,title,style,notes) VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (user_id,workout_date) DO UPDATE SET muscle_group=EXCLUDED.muscle_group,title=EXCLUDED.title,style=EXCLUDED.style,notes=EXCLUDED.notes RETURNING id",
            (user["id"],req.workout_date,req.muscle_group,req.title,req.style,req.notes)
        )
        wid = cur.fetchone()["id"]
        cur.execute("DELETE FROM workout_exercises WHERE workout_id=%s", (wid,))
        for i, ex in enumerate(req.exercises):
            cur.execute(
                "INSERT INTO workout_exercises (workout_id,exercise_name,muscle,sort_order,superset_with) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (wid, ex["name"], ex.get("muscle"), i, ex.get("superset_with"))
            )
            eid = cur.fetchone()["id"]
            best_w, best_r = 0, 0
            for s in ex.get("sets", []):
                cur.execute("INSERT INTO workout_sets (exercise_id,set_number,reps,weight_lbs,done) VALUES (%s,%s,%s,%s,%s)",
                    (eid, s["set_number"], str(s.get("reps","")), s.get("weight_lbs"), s.get("done",False)))
                w = float(s.get("weight_lbs") or 0)
                try: r = int(s.get("reps") or 0)
                except: r = 0
                if w > best_w or (w == best_w and r > best_r):
                    best_w, best_r = w, r
            if best_w > 0:
                cur.execute(
                    "INSERT INTO personal_records (user_id,exercise_name,weight_lbs,reps,achieved_date) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (user_id,exercise_name) DO UPDATE SET weight_lbs=GREATEST(personal_records.weight_lbs,EXCLUDED.weight_lbs), reps=CASE WHEN EXCLUDED.weight_lbs>=personal_records.weight_lbs THEN EXCLUDED.reps ELSE personal_records.reps END, achieved_date=CASE WHEN EXCLUDED.weight_lbs>=personal_records.weight_lbs THEN EXCLUDED.achieved_date ELSE personal_records.achieved_date END",
                    (user["id"], ex["name"], best_w, best_r, req.workout_date)
                )
    conn.commit()
    return {"ok": True, "workout_id": wid}

@app.get("/workouts")
def get_workouts(days: int=30, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT w.id,w.workout_date,w.muscle_group,w.title,w.style,
               json_agg(json_build_object(
                   'name',we.exercise_name,'muscle',we.muscle,'superset_with',we.superset_with,
                   'sets',(SELECT json_agg(json_build_object('set_number',ws.set_number,'reps',ws.reps,'weight_lbs',ws.weight_lbs,'done',ws.done) ORDER BY ws.set_number) FROM workout_sets ws WHERE ws.exercise_id=we.id)
               ) ORDER BY we.sort_order) FILTER (WHERE we.id IS NOT NULL) as exercises
               FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id=w.id
               WHERE w.user_id=%s AND w.workout_date>=NOW()-INTERVAL '%s days'
               GROUP BY w.id ORDER BY w.workout_date DESC""",
            (user["id"], days)
        )
        return [dict(r) for r in cur.fetchall()]

# ── PRs ───────────────────────────────────────────────────────────────────────

@app.get("/prs")
def get_prs(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM personal_records WHERE user_id=%s ORDER BY exercise_name", (user["id"],))
        return [dict(r) for r in cur.fetchall()]

@app.post("/prs")
def upsert_pr(pr: PRReq, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO personal_records (user_id,exercise_name,weight_lbs,reps,achieved_date) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (user_id,exercise_name) DO UPDATE SET weight_lbs=EXCLUDED.weight_lbs,reps=EXCLUDED.reps,achieved_date=EXCLUDED.achieved_date RETURNING *",
            (user["id"],pr.exercise_name,pr.weight_lbs,pr.reps,pr.achieved_date)
        )
        row = cur.fetchone()
    conn.commit()
    return dict(row)

# ── PHOTOS ───────────────────────────────────────────────────────────────────

@app.get("/photos")
def get_photos(user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, photo_date, note, image_data FROM progress_photos WHERE user_id=%s ORDER BY photo_date DESC, created_at DESC",
            (user["id"],)
        )
        return [dict(r) for r in cur.fetchall()]

@app.post("/photos")
def save_photo(req: PhotoReq, user=Depends(get_current_user), conn=Depends(get_db)):
    # Basic validation — must be a data URL
    if not req.image_data.startswith("data:image"):
        raise HTTPException(400, "Invalid image data")
    # Size guard — compressed JPEG should be well under 500KB base64 (~667KB encoded)
    if len(req.image_data) > 900_000:
        raise HTTPException(400, "Image too large — please use a smaller photo")
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO progress_photos (user_id, photo_date, note, image_data) VALUES (%s,%s,%s,%s) RETURNING id, photo_date, note, image_data",
            (user["id"], req.photo_date, req.note, req.image_data)
        )
        row = cur.fetchone()
    conn.commit()
    return dict(row)

@app.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM progress_photos WHERE id=%s AND user_id=%s", (photo_id, user["id"]))
        if cur.rowcount == 0:
            raise HTTPException(404, "Photo not found")
    conn.commit()
    return {"ok": True}

@app.get("/health")
def health():
    return {"status": "ok"}

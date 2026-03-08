# FitLog — Deploy Guide

Your stack: GitHub Pages (frontend) + Render Web Service (backend) + Render PostgreSQL (database)

---

## Step 1 — Create GitHub Repo

1. Go to github.com and create a new repo called `fitlog`
2. Set it to **Public** (required for free GitHub Pages)
3. Clone it locally or use GitHub's web uploader

Upload these files maintaining the folder structure:
```
fitlog/
  frontend/
    index.html
  backend/
    main.py
    requirements.txt
    start.sh
  README.md
```

---

## Step 2 — Create Render PostgreSQL

1. Log into render.com
2. Click **New** → **PostgreSQL**
3. Name it: `fitlog-db`
4. Plan: **Free** (or Starter for persistence guarantees)
5. Click **Create Database**
6. Once created, copy the **Internal Database URL** — you'll need it in Step 3

---

## Step 3 — Create Render Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repo `fitlog`
3. Settings:
   - **Name:** `fitlog-api`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `bash start.sh`
   - **Plan:** Free (spins down after inactivity) or Starter ($7/mo, always on)

4. Under **Environment Variables**, add:
   - `DATABASE_URL` → paste the Internal Database URL from Step 2
   - `ANTHROPIC_API_KEY` → your key from console.anthropic.com (optional but recommended)

5. Click **Create Web Service**
6. Wait for the first deploy — takes about 2-3 minutes
7. Copy your service URL (looks like `https://fitlog-api-xxxx.onrender.com`)

---

## Step 4 — Update Frontend API URL

Open `frontend/index.html` and find this line near the top of the script:

```javascript
var API = window.FITLOG_API_URL || 'https://YOUR-APP-NAME.onrender.com';
```

Replace `YOUR-APP-NAME` with your actual Render service name. Example:
```javascript
var API = window.FITLOG_API_URL || 'https://fitlog-api-xxxx.onrender.com';
```

Save and push to GitHub.

---

## Step 5 — Enable GitHub Pages

1. In your GitHub repo, go to **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder: `/frontend`
4. Click **Save**
5. Your app will be live at: `https://YOUR-GITHUB-USERNAME.github.io/fitlog/`

---

## Step 6 — Register Your Accounts

1. Open your live app URL
2. Tap **Create one** on the login screen
3. Register Jake first (username: `jake`) — gets your default split auto-loaded
4. Sign out, register Lindsay (username: `lindsay`) — gets her split auto-loaded
5. Done. Log in on your phone, let it save the password, and you're set.

---

## Getting Your Anthropic API Key (for AI workout generation)

1. Go to console.anthropic.com
2. Sign up / log in (separate from Claude.ai)
3. Go to **API Keys** → **Create Key**
4. Copy the key and paste it into the `ANTHROPIC_API_KEY` env var on Render
5. Cost: ~$0.003 per workout generated. Two people daily = about $1-2/month

If you skip this, workouts still generate using smart templates — they're solid, just not personalized to your history.

---

## After Deploy — Ongoing Use

- **Updates:** Push to GitHub main → Render auto-deploys in ~2 min
- **Free tier note:** Render free tier spins down after 15 min of inactivity. First open of the day takes ~30 seconds to wake up. Upgrade to Starter ($7/mo) if that's annoying.
- **Database backups:** Render PostgreSQL free tier has no backups. Starter tier has daily backups. Worth it for PRs and workout history.

---

## File Summary

| File | What it does |
|------|-------------|
| `frontend/index.html` | The entire app — login, body tracking, workouts, history, settings |
| `backend/main.py` | API server — all routes, auth, DB logic, Claude integration |
| `backend/requirements.txt` | Python dependencies |
| `backend/start.sh` | Render startup command |

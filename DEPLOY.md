# MediKiosk — Deployment Guide
## Backend → Railway | Frontend → Vercel

---

## Prerequisites

- A [GitHub](https://github.com) account (free)
- A [Railway](https://railway.app) account (free tier; sign in with GitHub)
- A [Vercel](https://vercel.com) account (free tier; sign in with GitHub)
- Your code pushed to a GitHub repository

---

## Step 0 — Push Code to GitHub

If you haven't already:

```powershell
# In c:\Patient_case_taking_software
git add .
git commit -m "feat: production deployment config"
git remote add origin https://github.com/YOUR_USERNAME/medikiosk.git
git push -u origin main
```

> [!WARNING]
> Your real `.env` files are already in `.gitignore` — confirm they are NOT staged before pushing by running `git status`. You should NOT see `backend/.env` or `frontend/.env` listed.

---

## Step 1 — Deploy Backend on Railway

### 1.1 Create a new Railway project

1. Go to **[railway.app](https://railway.app)** → click **New Project**
2. Choose **Deploy from GitHub repo**
3. Select your `medikiosk` repository
4. Railway will auto-detect the `Dockerfile` inside `backend/`

### 1.2 Set the root directory

In Railway project settings → **Source** tab → set **Root Directory** to `backend`

### 1.3 Add Environment Variables

In Railway → your service → **Variables** tab → add:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key |
| `SARVAM_API_KEY` | Your Sarvam API key |
| `ALLOWED_ORIGIN` | `https://your-app.vercel.app` *(fill this in after Step 2)* |
| `PORT` | `8000` |

### 1.4 Deploy and get your URL

- Click **Deploy** — Railway will build the Docker image (takes ~3 minutes first time)
- Once deployed, Railway assigns a public URL like: `https://medikiosk-backend-production.up.railway.app`
- Test it: open `https://YOUR_RAILWAY_URL/health` in your browser → you should see `{"status":"ok","version":"2.0.0"}`
- **Copy this URL — you will need it for the frontend.**

---

## Step 2 — Deploy Frontend on Vercel

### 2.1 Import project into Vercel

1. Go to **[vercel.com](https://vercel.com)** → click **Add New → Project**
2. Import your `medikiosk` GitHub repository
3. Set the **Root Directory** to `frontend`
4. Vercel auto-detects Vite. Leave all settings as-is.

### 2.2 Set the production environment variables

Before clicking Deploy, go to **Environment Variables** in the Vercel deploy wizard and add:

| Variable | Value |
|---|---|
| `VITE_BACKEND_HTTP_URL` | `https://YOUR_RAILWAY_URL` |
| `VITE_BACKEND_WS_URL` | `wss://YOUR_RAILWAY_URL/ws/session` |

> [!IMPORTANT]
> Use `wss://` (not `ws://`) for WebSocket on HTTPS Railway deployments. Use `https://` (not `http://`) for HTTP.

### 2.3 Deploy and get your Vercel URL

Click **Deploy**. Vercel deploys to `https://medikiosk-XXXX.vercel.app`.

---

## Step 3 — Lock Down CORS

Go back to **Railway → Variables** and update:

```
ALLOWED_ORIGIN=https://medikiosk-XXXX.vercel.app
```

Then click **Redeploy** on Railway to apply the CORS restriction.

---

## Step 4 — End-to-End Verification

Open your Vercel URL in a browser and verify:

- [ ] Welcome screen loads with the MediKiosk interface
- [ ] Select a language — TTS plays the greeting (Sarvam AI working)
- [ ] Start a session — conversation begins (Gemini + backend WebSocket working)
- [ ] Hold the mic button — speak — transcript appears (Sarvam STT working)
- [ ] Upload a prescription image — entities extracted (OCR pipeline working)
- [ ] Visit `https://YOUR_RAILWAY_URL/docs` — FastAPI interactive docs load

---

## Future: Custom Domain

To use your own domain (e.g., `medikiosk.yourhospital.in`):

1. **Vercel** → Project Settings → Domains → Add your domain → follow DNS instructions
2. **Update** the `ALLOWED_ORIGIN` Railway variable to `https://medikiosk.yourhospital.in`
3. Redeploy Railway

---

## Ongoing Development

After making code changes:

```powershell
git add .
git commit -m "your change"
git push
```

Both Vercel and Railway auto-deploy on every push to `main`.

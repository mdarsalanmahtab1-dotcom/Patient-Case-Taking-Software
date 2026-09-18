# SwasthyaSync Patient Portal — Complete Deployment Guide

This guide walks you through deploying both the **Patient Portal Backend** (FastAPI) and **Patient Portal Frontend** (React + Vite PWA) from this repository.

---

## 🏗 System Architecture

```
                       ┌────────────────────────────────────────┐
                       │        Patient Portal Frontend         │
                       │     (Vercel / Netlify / Docker)        │
                       │          React + Vite + PWA            │
                       └──────────────────┬─────────────────────┘
                                          │
                                          │ HTTPS REST Calls
                                          │ (VITE_API_BASE)
                                          ▼
                       ┌────────────────────────────────────────┐
                       │        Patient Portal Backend          │
                       │       (Render / Railway / Docker)      │
                       │           FastAPI + Uvicorn            │
                       └──────────┬──────────────────┬──────────┘
                                  │                  │
                                  ▼                  ▼
                    ┌──────────────────┐   ┌────────────────────┐
                    │  Supabase Cloud  │   │ Google Gemini API  │
                    │ PostgreSQL & PDF │   │  AI Consultations  │
                    │     Storage      │   │   & Summary QA     │
                    └──────────────────┘   └────────────────────┘
```

---

## 🚀 Option A: Cloud Deployment (Recommended — 100% Free Tiers)

### 1. Deploy the Backend to Render

1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository (`Zeeshan3h3/swasthyaSync`).
3. Set the service settings:
   - **Name**: `swasthyasync-patient-portal-backend`
   - **Root Directory**: `PatientPortal/backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables** in the Render dashboard:
   | Key | Value | Note |
   |---|---|---|
   | `PYTHON_VERSION` | `3.11.0` | Required |
   | `SUPABASE_DB_URL` | `postgresql://...` | Connection pooling URL from Supabase |
   | `SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Project URL |
   | `SUPABASE_KEY` | `eyJhbGciOi...` | Supabase Service Role or Anon key |
   | `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini API Key |
   | `CORS_ORIGINS` | `*` | Or specify your frontend Vercel URL |
   | `OTP_PROVIDER` | `mock` | Change to `fast2sms` for live SMS |
   | `FAST2SMS_API_KEY` | *(optional)* | Only needed if OTP_PROVIDER=fast2sms |
5. Click **Create Web Service**.
6. Once deployed, copy your backend URL (e.g., `https://swasthyasync-patient-portal-backend.onrender.com`).

---

### 2. Deploy the Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Select your repository `Zeeshan3h3/swasthyaSync`.
3. In **Project Configuration**:
   - **Root Directory**: Click **Edit** and choose `PatientPortal/frontend`.
   - **Framework Preset**: `Vite` (auto-detected).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_BASE` | `https://your-backend-service.onrender.com` |
   *(Paste your Render backend URL from Step 1)*
5. Click **Deploy**.
6. Vercel will automatically build and publish your Patient Portal with HTTPS and SPA routing enabled via `vercel.json`!

---

## ⚡ Option B: Cloud Deployment using Railway

### Backend
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Set **Root Directory** to `PatientPortal/backend`.
3. Under **Variables**, add all keys from `.env.example` (`SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`).
4. Railway will automatically detect `Procfile` or `requirements.txt` and launch the app.

---

## 🐳 Option C: Deploy with Docker

Both the backend and frontend include production-ready `Dockerfile` configurations:

### Backend Docker Container
```bash
cd PatientPortal/backend
docker build -t patient-portal-backend .
docker run -p 8001:8001 \
  -e SUPABASE_DB_URL="your_db_url" \
  -e SUPABASE_URL="your_supabase_url" \
  -e SUPABASE_KEY="your_supabase_key" \
  -e GEMINI_API_KEY="your_gemini_key" \
  -e CORS_ORIGINS="*" \
  patient-portal-backend
```

### Frontend Docker Container
```bash
cd PatientPortal/frontend
docker build -t patient-portal-frontend .
docker run -p 80:80 patient-portal-frontend
```

---

## 🔍 Pre-Flight Verification Checklist

After deploying:
1. **Health Check**: Open `https://your-backend-url.onrender.com/api/patient/health` — it should return:
   ```json
   { "status": "healthy", "service": "swasthyasync-patient-portal", "database": "connected" }
   ```
2. **Frontend Test**: Open your Vercel URL on mobile or desktop browser:
   - Login with demo identifier (e.g. `9876543210` or ABHA ID).
   - Enter OTP `123456` (in mock mode).
   - Verify that patient consultation history, prescription PDFs, hospital info, and AI assistant load seamlessly!

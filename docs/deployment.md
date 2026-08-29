# Terravision Land Digitization Suite: Deployment Guide & Checklist

This document details deployment targets, environment configurations, and the emergency fallback plan for the municipal pitch demonstration.

---

## 1. Frontend Deployment (Vercel)
The frontend application is built with Vite, React, and Tailwind CSS.
- **Target Platform**: [Vercel](https://vercel.com)
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Required Configuration**: Add a `vercel.json` file in the frontend root if API route proxies are needed, or configure the absolute environment variable `VITE_API_URL` to point to the deployed Express backend.

---

## 2. Backend Deployment
The backend consists of an Express entry point (port 5000) proxying specific pipelines to Python microservices.
- **Target Platform**: [Render](https://render.com) or [Railway](https://railway.app)
- **Engine Ports**:
  - Express Entrypoint: `5000`
  - Preprocessing Service: `8000`
  - Extraction Service: `8001`
  - Validation Service: `8002`
  - Pipeline Orchestrator: `8003`
  - Verification-Mark: `8004`
- **Database Connection**: Set up a PostgreSQL database instance on Supabase and run the migration script `backend/db/migrations/002_supabase_schema.sql`.

---

## 3. Required Environment Variables

### Backend Configuration
```bash
PORT=5000
DATABASE_URL=postgresql://postgres:[password]@db.[supabase-ref].supabase.co:5432/postgres
GEMINI_API_KEY=AIzaSyD...       # Gemini API key for text extraction passes
EXTRACTION_ENGINE=gemini        # Options: 'gemini' or 'paddleocr'
```

### Frontend Configuration
```bash
VITE_API_URL=https://[backend-domain].render.com
```

---

## 4. Emergency Demo Fallback Plan
*To be executed if the municipal network fails or the Gemini API experiences latency during the live pitch.*

1. **Local Cached Mode**:
   - The backend includes `backend/test-data/demo_cache.json` populated via `python cache-demo-results.py`.
   - The API will automatically intercept requests and serve these cached responses if the `OFFLINE_DEMO=true` variable is enabled.
2. **Pre-recorded Demonstration Video**:
   - Locate the recorded walk-through demonstration in the project assets folder: `/docs/assets/demo_walkthrough.mp4`.
   - Keep this video buffered on a local media player for immediate display.

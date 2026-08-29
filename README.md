# Land-Record Digitization Web App Monorepo

This repository contains the frontend and backend services for the Land-Record Digitization Web App.

## Directory Structure

- `/frontend` - React SPA (Vite + TS + Tailwind CSS + shadcn/ui)
- `/backend` - Express API
  - `/backend/services` - Core document processing pipelines (preprocessing, extraction, validation, verification)
  - `/backend/db` - PostgreSQL database migrations
- `/docs` - Project documentation
- `SCHEMA.md` - Shared data schema definition

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (for backend database migrations)

### Running the Frontend

Navigate to the `frontend` directory, install dependencies, and start the development server:

```bash
cd frontend
npm install
npm run dev
```

### Running the Backend

Navigate to the `backend` directory, install dependencies, and start the API server:

```bash
cd backend
npm install
npm run start
```

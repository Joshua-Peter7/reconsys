# Smart Reconciliation & Audit System

Production-style MERN system for transaction upload, reconciliation, exception handling, and immutable audit tracking.

## Architecture

- Frontend: React + Vite (`frontend/`)
- Backend: Express + Mongoose (`backend/`)
- Database: MongoDB Atlas only

## MongoDB Policy (Atlas Only)

This project intentionally rejects non-Atlas URIs.

`backend/src/config/database.js` requires:

`MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?appName=<app-name>`

No local MongoDB fallback is used.

## Implemented Requirements

- JWT authentication with role claim (`admin`, `analyst`, `viewer`)
- Backend RBAC enforcement middleware
- No public signup flow; user creation via seed scripts
- Async/non-blocking upload processing with job states:
  - `processing`
  - `completed`
  - `failed`
- Upload idempotency via SHA-256 file hash
- Reconciliation statuses:
  - `matched`
  - `partially_matched`
  - `not_matched`
  - `duplicate`
- Configurable matching rules (`matchingConfig`), including variance
- Immutable audit logs with old/new/user/source/timestamp
- Dashboard cards + chart + dynamic filters
- Upload preview (20 rows) and column mapping correction without re-upload
- Reconciliation compare view with mismatch highlighting and manual correction
- Visual audit timeline UI

## Collections and Indexes

Collections:

- `Users`
- `UploadJobs`
- `Records`
- `ReconciliationResults`
- `AuditLogs`

Mandatory indexed fields are present:

- Transaction ID
- Reference Number
- Upload Job ID

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run seed:system
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Required Environment Variables

### `backend/.env`

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?appName=<app-name>
JWT_SECRET=<strong-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
MAX_FILE_SIZE_MB=50
MAX_UPLOAD_ROWS=50000
DEFAULT_VARIANCE_PERCENT=2
```

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Default Seed Users

- `admin@recons.local / Admin@123`
- `analyst@recons.local / Analyst@123`
- `viewer@recons.local / Viewer@123`

## API Docs

- Markdown reference: `docs/API.md`
- Postman collection: `docs/postman_collection.json`

## Assumptions

- One active system-record baseline is used at a time (`sourceType=system, active=true`).
- Upload deduplication is file-content based, not filename based.
- For large files, partial bad rows are tolerated and counted; valid rows continue.

## Trade-offs

- Async processing uses an in-process queue (`setImmediate`) for simplicity.
- This keeps setup light for assignment review, but is less resilient than Redis/Bull workers.
- Result queries use simple pagination (`limit/skip`) for readability over deep optimization.

## Limitations

- No distributed job queue yet (single-process worker behavior).
- No websocket progress push (UI polling is used).
- No full automated test suite yet.

## Sample Files

- `sample-data/sample_system_records.csv`
- `sample-data/sample_transactions.csv`

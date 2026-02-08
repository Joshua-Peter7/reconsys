# API Reference

Base URL: `http://localhost:5000/api`

Auth: Bearer JWT in `Authorization: Bearer <token>`

Notes:
- Backend expects MongoDB Atlas URI (`mongodb+srv://`) in `MONGO_URI`.
- Public signup is not exposed; users are created via seed scripts (or admin-only register route).

## Auth

### POST `/auth/login`

Request:
```json
{
  "email": "analyst@recons.local",
  "password": "Analyst@123"
}
```

Response:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "fullName": "Ops Analyst",
    "email": "analyst@recons.local",
    "role": "analyst"
  }
}
```

### GET `/auth/profile`

Returns current user.

### GET `/auth/users`

Admin only.

## Upload

### POST `/upload/preview`

Multipart form-data:
- `file`: CSV/XLS/XLSX

Returns:
- `headers`
- `preview` (first 20 rows)
- `totalRows`

### POST `/upload`

Multipart form-data:
- `file`
- `columnMapping` (JSON string)
- `uploadType`: `transaction` or `system`
- `matchingConfig` (optional JSON string)

Returns:
```json
{
  "jobId": "...",
  "status": "processing",
  "reused": false,
  "message": "Upload accepted and queued for asynchronous processing."
}
```

### GET `/upload`

Query params:
- `status`
- `uploadType`
- `uploadedBy` (admin)
- `startDate`
- `endDate`

### GET `/upload/:jobId`

Returns job status and counters.

## Dashboard

### GET `/dashboard/summary`

Query params:
- `startDate`
- `endDate`
- `status`
- `uploadedBy` (admin)

Returns summary cards and chart data.

### GET `/dashboard/filters`

Returns filter metadata (`users`) for admin.

## Reconciliation

### POST `/reconciliation/trigger`

Request:
```json
{
  "uploadJobId": "...",
  "matchingConfig": {
    "partial": {
      "variancePercent": 2
    }
  }
}
```

### GET `/reconciliation/results`

Query params:
- `uploadJobId`
- `status`
- `limit`
- `skip`

Returns uploaded vs system records with status and differences.

### GET `/reconciliation/stats`

Query params:
- `uploadJobId` (optional)

### PATCH `/reconciliation/manual-correction/:resultId`

Request:
```json
{
  "updates": {
    "transactionId": "SYS-1001",
    "referenceNumber": "REF-ALPHA-01",
    "amount": 1200,
    "date": "2026-01-02"
  },
  "status": "matched",
  "notes": "Manual validation completed"
}
```

Creates immutable audit log entry.

## Audit

### GET `/audit/record/:recordId`

Returns visual-timeline payload for a record.

### GET `/audit/job/:uploadJobId`

Returns logs for the upload job.

### GET `/audit/user-actions`

Admin only. Query:
- `userId`
- `startDate`
- `endDate`

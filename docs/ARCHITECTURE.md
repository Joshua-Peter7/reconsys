# Architecture

## System Design

Three-tier architecture:

- React SPA (`frontend/`)
- Express API (`backend/`)
- MongoDB Atlas (`Users`, `UploadJobs`, `Records`, `ReconciliationResults`, `AuditLogs`)

Atlas is enforced in code by requiring an `mongodb+srv://` URI.

## Core Flows

1. Analyst uploads CSV/XLSX.
2. Backend computes file hash, checks idempotency.
3. Job created as `processing`.
4. Async worker parses rows and stores normalized records.
5. Reconciliation engine evaluates every uploaded record.
6. Results and audit logs persist.
7. UI polls status and renders dashboard/reconciliation/timeline.

## Data Model Highlights

- `Users`: credentials, role.
- `UploadJobs`: upload metadata, status, mapping, matching config.
- `Records`: uploaded and system baseline records.
- `ReconciliationResults`: one result per uploaded record.
- `AuditLogs`: append-only immutable change events.

## Matching Engine

- Exact match: `transactionId + amount`
- Partial match: `referenceNumber` with configurable amount variance
- Duplicate: repeated transaction IDs in uploaded set
- Not matched: none of the above

Configurable via `matchingConfig` stored at upload-job level.

## Index Strategy

Mandatory indexes implemented:
- `transactionId`
- `referenceNumber`
- `uploadJobId`

Additional indexes for query performance:
- upload status/date filters
- reconciliation status filters
- audit lookup by record/job/user

## Security and RBAC

- JWT authentication
- JWT includes role claim (`role`) for downstream checks
- Backend role authorization middleware
- Frontend protected routes
- Roles:
  - admin: full access
  - analyst: upload + reconcile + corrections
  - viewer: read-only

## Reliability Notes

- Async processing keeps request/response non-blocking.
- Parse validation errors increment failed row counts without aborting entire job.
- Idempotent upload prevents duplicate jobs for same file hash.
- Audit logs are immutable by schema-level update/delete guards.
- Public user signup is intentionally disabled; users are provisioned by seed scripts.

## Trade-offs

- In-process queue simplifies setup but is less resilient than external workers.
- Polling is simpler than websocket push for progress updates.
- Current API uses offset pagination for simplicity.

## Production Next Steps

1. Move job processing to BullMQ + Redis workers.
2. Add test suite (unit + integration).
3. Add rate limiting and security hardening.
4. Add observability: metrics, logs, tracing.

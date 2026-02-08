# Quick Start

## 1. Configure Atlas

Edit `backend/.env` and set:

`MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?appName=<app-name>`

## 2. Start Backend

```bash
cd backend
npm install
npm run seed
npm run seed:system
npm run dev
```

## 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

## 4. Login

Use analyst user:

- Email: `analyst@recons.local`
- Password: `Analyst@123`

## 5. Validate Flow

1. Upload `sample-data/sample_transactions.csv`
2. Preview first 20 rows
3. Confirm required mapping fields
4. Submit upload and wait for completion
5. Review dashboard and reconciliation screens
6. Open audit timeline from a record

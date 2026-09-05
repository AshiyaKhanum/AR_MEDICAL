# AR Medical — Medical Billing & Inventory Management System

A complete, production-oriented billing and inventory management system built for **AR Medical**, Wadi e Huda, Shimoga 572100.

Covers the full pharmacy workflow: medicine inventory with batch/expiry tracking, POS billing with GST and barcode support, purchases from suppliers, customer accounts, sales & purchase returns, multi-method payments, stock alerts, reporting (with PDF/Excel/CSV export) and a full audit trail — gated behind role-based (Admin / Pharmacist / Staff) JWT authentication.

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS, TanStack Query, React Hook Form + Zod, Recharts, Zustand.

**Backend:** Node.js, Express, TypeScript, JWT (`jsonwebtoken`) + `bcryptjs`, `pdfkit` (invoices/report PDFs), `exceljs` (Excel export), `bwip-js` (barcode PNGs).

**Database:** PostgreSQL via Prisma ORM, accessed through the `@prisma/adapter-pg` driver adapter (Prisma's engine-less "client" mode — no native Rust binary required at runtime, which also makes this project easy to run in locked-down/offline-CLI environments).

## Repository layout

```
ar-medical/
├── backend/                 # Express + TypeScript REST API
│   ├── prisma/
│   │   ├── schema.prisma    # Full data model (16 tables + 7 enums)
│   │   ├── migrations/      # SQL migration history (apply with `prisma migrate deploy`)
│   │   └── seed.ts          # Demo users, categories, medicines, batches, sales
│   ├── prisma.config.ts     # Driver-adapter config (Postgres via pg, no native engine)
│   ├── src/
│   │   ├── routes/          # One file per module (auth, medicines, sales, purchases, ...)
│   │   ├── services/        # Billing math, PDF generation, inventory alerts, exports
│   │   ├── middleware/      # JWT auth, role-based authorize(), error handler
│   │   └── server.ts        # Entry point
│   └── .env.example
└── frontend/                 # React + Vite SPA
    ├── src/
    │   ├── pages/            # One page per module
    │   ├── hooks/            # TanStack Query hooks per resource
    │   ├── layouts/          # Branded app shell (sidebar/header/footer)
    │   └── components/
    └── .env.example
```

## Data model highlights

`User → Sale/Purchase/Return (createdBy)`, `Supplier → Purchase → PurchaseItem → Batch`, `Medicine → Batch → SaleItem/PurchaseItem/StockMovement`, `Sale → SaleItem/Payment/Return`, `Customer → Sale`. Every stock-changing operation (purchase receipt, sale, sales return, purchase return, manual adjustment) writes a `StockMovement` row, and every create/update/delete/login/payment/export writes an `AuditLog` row with before/after JSON — see `prisma/schema.prisma` for the full picture.

## Core business logic

- **Purchase:** Supplier → Purchase → Batch (created or replenished) → inventory increased, all inside one DB transaction.
- **Sale (POS):** Medicine/barcode search → batch selected (FEFO-friendly, nearest expiry surfaced first) → stock validated (rejects if insufficient or expired) → discount % and GST % applied per line → invoice numbered and generated → payment recorded → stock decremented atomically (race-safe `updateMany` guard).
- **Return:** Invoice/Purchase → item(s) selected → quantity capped at what was actually sold/purchased (minus prior returns) → stock restored (sales return) or reduced (purchase return) → refund amount computed. Returns created by Admin/Pharmacist auto-approve; Staff-created returns require Admin/Pharmacist approval.
- **GST/discount math** lives in `backend/src/services/billingService.ts` and is unit-verified by `api-flows` style assertions (see Testing below).

## Getting started locally

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 14+

### 2. Backend setup

```bash
cd backend
cp .env.example .env       # edit DATABASE_URL, JWT secrets, business info if needed
npm install
npx prisma generate
npx prisma migrate deploy  # applies prisma/migrations/*_init
npm run seed                # creates demo users + sample catalog/medicines/sales
npm run dev                 # http://localhost:4000
```

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000 in dev)
```

Open `http://localhost:5173` and sign in with one of the demo accounts below.

### 4. Demo login credentials

| Role       | Email                        | Password     |
|------------|-------------------------------|---------------|
| Admin      | admin@armedical.in            | Admin@123     |
| Pharmacist | pharmacist@armedical.in       | Pharma@123    |
| Staff      | staff@armedical.in            | Staff@123     |

**Change these passwords (or deactivate/recreate the users) before using this in a real store.**

## Environment variables

### backend/.env
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | Comma-separated allowed origins for the frontend |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token signing |
| `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_PHONE`, `BUSINESS_GSTIN` | Printed on every invoice/report/PDF |

### frontend/.env
| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | API base path (relative `/api` in dev via Vite proxy; full origin in prod, e.g. `https://api.yourdomain.com/api`) |
| `VITE_BUSINESS_NAME`, `VITE_BUSINESS_ADDRESS` | Header/footer/login branding |

## A note on Prisma + offline/locked-down environments

This project intentionally runs Prisma in **engine-less "client" mode** (`engineType = "client"` in `schema.prisma`, plus `prisma.config.ts` wiring a `@prisma/adapter-pg` driver adapter for both the runtime client *and* the CLI's schema engine). This means `prisma generate`, `migrate`, and the running app never need to download the native Rust query/schema engine binaries from `binaries.prisma.sh` — everything runs through the bundled WASM/TS query compiler and the ordinary `pg` driver. If you ever see engine-download errors on a different Prisma version, this is the pattern to fall back to.

## Testing performed before delivery

- **Backend integration assertions** (41 checks) covering: login for all 3 roles + rejected bad password, RBAC enforcement (Staff blocked from inventory writes), medicine CRUD, supplier→purchase→batch→inventory increase, stock-validation rejection of over-selling, POS sale with exact GST/discount math verified to the paisa, stock decrement, invoice PDF generation, credit sale + partial payment status transitions, sales return with stock restoration, purchase return with stock reduction, low-stock/expiry alerts, all 8 report endpoints plus CSV/Excel/PDF export, global search, barcode PNG generation, audit log entries for both business events and logins, and soft-delete/deactivation.
- **Browser end-to-end pass** (Playwright/Chromium) covering: login → dashboard (branding verified) → POS search-and-add → checkout → invoice screen (AR Medical header + GST breakdown verified) → PDF download (verified as a valid, correctly branded PDF) → dashboard reflecting the new sale → medicines list → expiring-batches view → new-purchase form → reports page → users (admin) page → audit logs page → mobile (390px) viewport render → logout.
- Full `tsc` typecheck and production `vite build` both pass cleanly on the frontend; `tsc --noEmit` passes cleanly on the backend.

## Deployment

The app is two independently deployable pieces:

1. **Database:** any managed PostgreSQL (Render, Supabase, RDS, Railway, Neon, etc.). Run `npx prisma migrate deploy` once against it, then `npm run seed` if you want the demo data.
2. **Backend:** any Node host (Render/Railway/Fly/EC2/etc.) — `npm run build && npm start`, with the env vars above set.
3. **Frontend:** any static host (Render Static Site/Netlify/Vercel/S3+CloudFront) — `npm run build`, publish `dist/`, set `VITE_API_BASE_URL` to the deployed backend's `/api` URL, and configure the backend's `CORS_ORIGIN` to match the deployed frontend origin.

See the delivery message for this project's specific live URL / repository status.

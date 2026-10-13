# Expense Tracker

A full-stack personal finance application. Users register, record income and expenses, organize them into categories, analyze spending on an interactive dashboard, filter their history, and export it to CSV or Excel.

- **Frontend:** React 19 + Vite, React Router, Chart.js (react-chartjs-2), responsive CSS with light and dark themes
- **Backend:** Node.js + Express 5 REST API, JWT authentication, bcrypt password hashing, zod validation
- **Database:** PostgreSQL (via `pg`), versioned SQL migrations

---

## Contents

1. [Features](#features)
2. [Tech stack and versions](#tech-stack-and-versions)
3. [Project structure](#project-structure)
4. [Setup](#setup)
5. [Running the app](#running-the-app)
6. [Testing](#testing)
7. [API reference](#api-reference)
8. [Database design](#database-design)
9. [Security](#security)
10. [Known limitations](#known-limitations)
11. [Troubleshooting](#troubleshooting)

---

## Features

**Authentication**
- Register and log in with email and password. Passwords are hashed with bcrypt.
- Stateless JWT sessions. The browser logs out automatically when the token expires or is rejected, and logging out in one tab logs out every tab.
- Login and registration are rate-limited per IP address.

**Transactions**
- Create, edit and delete income and expense transactions. Each one has an amount, type, category, optional description and date.
- Filter by date range, type and category. Filters are stored in the URL, so refresh, back/forward and bookmarks keep them.
- Paginated list, with totals (income, expenses, net) for the filtered set.

**Categories**
- Every new user gets their own copy of 15 default categories: 5 income and 10 expense.
- Add, rename and delete categories. A category that still has transactions can't be deleted or switch type, which protects your history.

**Dashboard**
- Current balance (all time), plus income, expenses and net for a selected period. Periods: this month, last 3/6/12 months, this year, all time, or a custom range.
- **Monthly trend** chart: income and expense columns with a net line, all on one money axis.
- **Spending by category** chart, largest first, with the long tail grouped into "Other".
- Income sources table and recent transactions.
- Every chart has a "View as table" option, so no value depends on color or hovering.

**Export**
- CSV and Excel (.xlsx) exports of the **currently applied filters**, always limited to the logged-in user's data.
- Excel files contain real date and number cells, an auto-filter, and a Summary sheet listing the filters and totals.

**User experience**
- Loading, empty, success (toast) and error states throughout. Validation messages appear next to the relevant field.
- Responsive from 320 px phones to desktop. On phones the transaction table becomes cards.
- Follows the operating system's light or dark mode. Keyboard and screen-reader friendly, with labels, focus rings, a skip link and native `<dialog>` modals.

---

## Tech stack and versions

Exact versions are pinned in each `package.json`, and lockfiles are committed. Developed and tested with **Node.js 24.21** and **PostgreSQL 18.6** on Windows 11.

| Area | Package | Version |
|---|---|---|
| Runtime | Node.js | ≥ 20.19 (tested on 24.21) |
| Database | PostgreSQL | tested on 18.6 (13+ should work) |
| API | express | 5.2.1 |
| | pg | 8.23.0 |
| | jsonwebtoken | 9.0.3 |
| | bcrypt | 6.0.0 |
| | zod | 4.6.5 |
| | helmet | 8.3.0 |
| | cors | 2.8.6 |
| | express-rate-limit | 8.7.0 |
| | exceljs | 4.4.0 |
| | dotenv | 18.0.4 |
| UI | react / react-dom | 19.3.0 |
| | react-router-dom | 7.18.4 |
| | chart.js | 4.5.1 |
| | react-chartjs-2 | 5.3.1 |
| | vite | 8.3.1 |
| | @vitejs/plugin-react | 6.1.1 |
| Testing | vitest | 5.0.2 |
| | supertest | 7.3.0 |

**How versions were chosen:** for each package, the newest stable release that had been public for at least two weeks. Brand-new releases occasionally ship regressions.

**Why exceljs instead of `xlsx`:** the npm releases of `xlsx` (SheetJS) are outdated and have known vulnerabilities. exceljs's own `uuid` dependency is pinned to a patched version through `overrides` in `server/package.json`.

---

## Project structure

```
expense-tracker/
├── package.json            # convenience scripts for both apps
├── server/                 # Express REST API
│   ├── db/migrations/      # numbered, forward-only SQL migrations
│   ├── scripts/            # migrate.js, check-db.js
│   ├── src/
│   │   ├── app.js          # builds the Express app (no port) → testable
│   │   ├── server.js       # entry point: config, DB pool, listen, graceful shutdown
│   │   ├── config/         # env loading + validation (fails fast on bad config)
│   │   ├── constants/      # default categories
│   │   ├── db/             # pg pool (query, withTransaction), migration runner
│   │   ├── routes/         # URL → middleware → controller
│   │   ├── controllers/    # HTTP in/out only
│   │   ├── services/       # business rules + SQL (auth, categories, transactions, dashboard, export)
│   │   ├── middleware/     # requireAuth, validate, rate limiter, error handler, logger
│   │   ├── validators/     # zod schemas
│   │   └── utils/          # AppError, jwt, logger, pg error helpers
│   └── tests/              # integration tests against the TEST database
└── client/                 # React + Vite SPA
    └── src/
        ├── api/            # fetch wrapper (adds JWT, maps errors) + one module per resource
        ├── context/        # AuthContext (session), ToastContext
        ├── hooks/          # useApi (abortable loading), useColorScheme
        ├── pages/          # Login, Register, Dashboard, Transactions, Categories, 404
        ├── components/     # feature components, charts/, ui/ (Button, Field, Modal, ...)
        ├── utils/          # formatting, local-calendar dates, validation, downloads
        └── styles/         # global.css with light/dark design tokens
```

**How a request flows:** `route → requireAuth → validate (zod) → controller → service (SQL) → JSON`. Errors from any layer reach a single error handler, which returns `{ "error": { "code", "message", "details?" } }`.

**How the API gets its dependencies:** `createApp({ db, config, logger })` receives its database connection and settings as arguments. Tests can therefore run the real app against the test database, or against a deliberately broken one, and can never reach the development database by accident.

---

## Setup

### 1. Prerequisites

- Node.js **20.19 or newer** (`node -v`)
- PostgreSQL running locally (`pg_isready -h localhost -p 5432`)

### 2. Create the database user and databases

Run this once as the PostgreSQL superuser. Use your own strong password and keep it out of version control.

```powershell
# Windows (psql is usually not on PATH):
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres
# macOS / Linux:
psql -h localhost -U postgres
```

```sql
CREATE ROLE expense_app WITH LOGIN PASSWORD 'choose-a-strong-password';
CREATE DATABASE expense_tracker      OWNER expense_app;  -- development data
CREATE DATABASE expense_tracker_test OWNER expense_app;  -- used only by automated tests
\q
```

The app connects as `expense_app`, a user with limited rights, never as the superuser. The test database is separate so tests can create and delete data freely.

### 3. Install dependencies

```bash
npm run install:all        # = npm ci in server/ and client/
```

### 4. Configure the API

```bash
cp server/.env.example server/.env      # Windows PowerShell: Copy-Item server\.env.example server\.env
```

Edit `server/.env`:

| Variable | Required | Description |
|---|---|---|
| `DB_PASSWORD` | yes | password of `expense_app` (quote it if it contains `#`) |
| `JWT_SECRET` | yes | random string of **at least 32 characters**. Generate one with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `DB_NAME_TEST` | yes | defaults in the example match the SQL above |
| `PORT` | no | API port, default `5000` |
| `CLIENT_ORIGIN` | yes | front-end origin(s) allowed by CORS. Comma-separated. Default `http://localhost:5173` |
| `JWT_EXPIRES_IN` | no | session length, e.g. `15m`, `12h`, `1d` (default) |
| `BCRYPT_SALT_ROUNDS` | no | 10–15, default `12` |

The server checks all of these at startup and refuses to start with a clear message if something is missing or invalid.

Optional client settings go in `client/.env` (copy `client/.env.example`):

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` | API location |
| `VITE_CURRENCY` | `USD` | ISO 4217 code used to display amounts (e.g. `EUR`, `EGP`) |

### 5. Check the connection and create the schema

```bash
npm run db:check --prefix server   # should print two "OK" lines
npm run db:migrate                 # creates the tables in expense_tracker
```

Migrations are tracked in `schema_migrations` and each one runs inside a transaction. Running the command again is safe: it skips anything already applied.

---

## Running the app

Use two terminals:

```bash
npm run dev:server     # API on http://localhost:5000 (restarts on file changes)
npm run dev:client     # UI  on http://localhost:5173
```

Open http://localhost:5173 and create an account. Your data is stored in PostgreSQL, so it persists across restarts.

Health check: `GET http://localhost:5000/api/health` returns `{"status":"ok","database":"up"}`, or HTTP 503 if the database is unreachable.

**Production build of the UI:** `npm run build` writes static files to `client/dist/`. Serve them from any static host, set `VITE_API_URL` before building, and add the host's origin to `CLIENT_ORIGIN`. Start the API with `NODE_ENV=production npm start --prefix server`.

---

## Testing

```bash
npm test               # server + client
npm test --prefix server
npm test --prefix client
```

- **Server (188 tests, 12 files):** integration tests against **`expense_tracker_test` only**. A guard refuses to run if the database name doesn't end in `_test`, and the test setup applies migrations automatically.
  - **Schema:** every constraint is checked directly in the database, including cross-user categories, type mismatches, amounts, cascades and the "category in use" block.
  - **Migration runner:** idempotency, atomic rollback of a failing file, detection of edited migrations.
  - **Auth:** registration including atomic creation of default categories, login, token tampering, `alg: none`, expiry, rate limiting.
  - **Categories and transactions:** CRUD, validation, ownership (another user's resources always return 404), filters, pagination, exact totals.
  - **Dashboard:** exact sums, monthly series including empty months, isolation between users.
  - **Exports:** filters respected, CSV escaping, formula-injection protection, typed Excel cells.
  - **Infrastructure:** health checks with a wrong password, closed port and hung database, the error handler (no leaked internals), config validation.
- **Client (24 tests):** formatting, local-calendar period ranges, validation rules, download filenames, JWT expiry parsing, chart grouping.

Tests delete every user they create (all use `@api-test.example` addresses), so the test database is left empty.

---

## API reference

Base URL: `http://localhost:5000/api`. Bodies are JSON. Private endpoints need `Authorization: Bearer <token>`.

**Error format, used by every endpoint:**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please correct the highlighted fields",
             "details": [{ "field": "amount", "message": "Amount must be greater than 0" }] } }
```

Common codes:
- `400`: `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_CATEGORY`, `CATEGORY_TYPE_MISMATCH`, `EXPORT_TOO_LARGE`
- `401`: `AUTH_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`
- `404`: `NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `CATEGORY_NOT_FOUND`
- `409`: `EMAIL_TAKEN`, `CATEGORY_EXISTS`, `CATEGORY_IN_USE`
- `413`: `PAYLOAD_TOO_LARGE`
- `429`: `TOO_MANY_REQUESTS`
- `500`: `INTERNAL_ERROR`

**Data conventions:**
- Amounts are **decimal strings** such as `"42.50"`, because JavaScript numbers can't represent money exactly.
- Dates are `YYYY-MM-DD`.
- IDs are numbers.

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | – | `200 {status:"ok", database:"up", timestamp}` · `503 {status:"error", database:"down"}` |

### Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` | `201 { user, token }`. Also creates the default categories |
| POST | `/auth/login` | `{ email, password }` | `200 { user, token }` · `401 INVALID_CREDENTIALS` |
| GET | `/auth/me` | – (auth) | `200 { user }` |

- **Password rules:** 8–72 bytes, at least one letter and one number.
- **Email:** trimmed and lowercased.
- **Rate limit:** 20 requests per IP per 15 minutes on register and login. Only failed logins count.

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" \
     -d '{"name":"Ann Lee","email":"ann@example.com","password":"secret123"}'
# → {"user":{"id":1,"name":"Ann Lee","email":"ann@example.com","createdAt":"..."},"token":"eyJ..."}
```

### Categories (auth)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/categories` | `?type=income\|expense` | `200 { data: [{ id, name, type, transactionCount }] }` |
| POST | `/categories` | `{ name, type }` | `201 { data }` · `409 CATEGORY_EXISTS` |
| PUT | `/categories/:id` | `{ name, type }` | `200 { data }` · `409 CATEGORY_IN_USE` if changing the type while it has transactions |
| DELETE | `/categories/:id` | – | `204` · `409 CATEGORY_IN_USE` |

Names are 1–50 characters, unique per user and type, ignoring case.

### Transactions (auth)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/transactions` | `?startDate&endDate&type&categoryId&page=1&pageSize=20` (max 100) | `200 { data, pagination: { page, pageSize, total, totalPages }, summary: { count, income, expense, net } }` |
| GET | `/transactions/:id` | – | `200 { data }` |
| POST | `/transactions` | `{ type, categoryId, amount, date, description? }` | `201 { data }` |
| PUT | `/transactions/:id` | same as POST (full replacement) | `200 { data }` |
| DELETE | `/transactions/:id` | – | `204` |
| GET | `/transactions/export` | `?format=csv\|xlsx` + the same filters as the list | file download (`Content-Disposition: attachment`) |

- **Amount:** greater than 0, at most 2 decimals, up to 9,999,999,999.99.
- **Date:** a real calendar date between 1900 and 2100.
- **Description:** optional, up to 255 characters. Blank becomes `null`.
- **Category:** must belong to you and match `type`.
- **Date filters:** inclusive.
- **Exports:** limited to 50,000 rows.

```json
// GET /transactions?type=expense&startDate=2026-01-01&endDate=2026-01-31
{ "data": [{ "id": 7, "type": "expense", "amount": "85.40", "description": "Weekly shop",
             "date": "2026-01-10", "category": { "id": 8, "name": "Groceries" },
             "createdAt": "...", "updatedAt": "..." }],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 },
  "summary": { "count": 1, "income": "0.00", "expense": "85.40", "net": "-85.40" } }
```

### Dashboard (auth)

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/dashboard` | `?startDate&endDate` (both optional, default all time) | see below |

```json
{ "period": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "totals": { "count": 7, "income": "2900.55", "expense": "1100.30", "net": "1800.25" },
  "currentBalance": "3400.25",
  "expenseByCategory": [{ "categoryId": 6, "name": "Housing", "total": "900.00", "count": 1 }],
  "incomeByCategory":  [{ "categoryId": 1, "name": "Salary",  "total": "2500.00", "count": 1 }],
  "monthly": [{ "month": "2026-01", "income": "2900.55", "expense": "1100.30", "net": "1800.25" }] }
```

- `currentBalance` is all-time and ignores the period.
- `monthly` includes months with no activity.
- All sums are computed in PostgreSQL with exact `NUMERIC` arithmetic.

---

## Database design

```
users 1 ──< categories 1 ──< transactions
  └───────────────────────────────┘ (each transaction also belongs to a user)
```

| Table | Key columns |
|---|---|
| `users` | `email` unique and always lowercase · `password_hash` (bcrypt) |
| `categories` | `user_id` → users (cascade) · `type` ∈ {income, expense} · unique (`user_id`, `type`, `lower(name)`) |
| `transactions` | `amount NUMERIC(12,2) > 0` · `type` ∈ {income, expense} · `transaction_date DATE` · optional `description` ≤ 255 |

**Key decisions:**
- **A transaction can't use another user's category, at the database level.** A composite foreign key `(category_id, user_id, type) → categories(id, user_id, type)` makes PostgreSQL reject any transaction whose category belongs to a different user or has a different type. The API also checks this to give a clear message. The database rule is the safety net.
- **Money is exact.** Amounts are `NUMERIC(12,2)`, never floating point, and they're stored as positive values. `type` says which direction the money moved.
- **Dates are calendar dates.** `transaction_date` is a `DATE`, so time zones can never move a transaction into another month.
- **Deleting is safe.** Deleting a user cascades to their data. A category that's still in use can't be deleted.
- **Indexes match the queries.** `(user_id, transaction_date DESC, id DESC)` serves listing, date filters, the dashboard and exports. `(category_id, transaction_date DESC)` serves the category filter and the "category in use" check.
- **Registration is atomic.** The user and their default categories are inserted in one database transaction.

---

## Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt (12 rounds by default). The 72-byte bcrypt limit is enforced, and plaintext is never stored or logged |
| Sessions | JWT signed with HS256 (algorithm pinned, so `alg: none` and algorithm-confusion attacks are rejected). The secret must be at least 32 characters. The token carries only the user id and expiry |
| Authorization | Every query is scoped with `user_id = <authenticated user>`. Another user's resources return **404**, so their existence is never revealed. Client-supplied `user_id` fields are ignored |
| SQL injection | All values are passed as parameters (`$1, $2, …`). The only text built into SQL is fixed column lists and placeholder numbers |
| Input validation | zod schemas on every body, query and route parameter. Unknown fields are dropped. JSON bodies are capped at 10 KB |
| Account enumeration on login | Identical response and similar timing for an unknown email and a wrong password |
| Brute force | Rate limiting on login and registration |
| HTTP hardening | `helmet` security headers, no `X-Powered-By`, CORS limited to `CLIENT_ORIGIN`, `Cache-Control: no-store` on all API responses |
| Error leakage | Unexpected errors return a generic 500 message. Details go only to the server log, and logs never include bodies, headers, query strings or tokens |
| Exports | Scoped to the user and the active filters. CSV cells starting with `= + - @` are neutralized against spreadsheet formula injection |
| Secrets | Only in `server/.env`, which is git-ignored. `.env.example` files contain no real values |
| Dependencies | `npm audit` reports 0 vulnerabilities in both apps |

---

## Known limitations

- **The token is stored in `localStorage`.** This keeps the setup simple: no cookies, so no CSRF handling is needed. The trade-off is that any script running on the page (an XSS flaw) could read it. React escapes all rendered text, and the API sets strict headers. For production, serve the UI with a strict Content-Security-Policy, or move to httpOnly cookies with CSRF protection.
- **Logout can't cancel a token.** Logout happens in the browser. A copied token stays valid until it expires (`JWT_EXPIRES_IN`, default 1 day). There are no refresh tokens or server-side revocation list.
- **Registration reveals whether an email exists.** Signing up with an existing email returns `409 EMAIL_TAKEN`. Login doesn't reveal this.
- **One currency.** All amounts are assumed to be in `VITE_CURRENCY`. There is no conversion.
- **Rate limits are kept in memory**, per API process, and reset on restart. Behind a reverse proxy, configure Express `trust proxy` so client IPs are seen correctly.
- **Exports** are capped at 50,000 rows per file.
- **Migrations only go forward.** Schema changes are made by adding a new numbered file, never by editing an applied one; the runner enforces this.
- **Deprecated sub-dependencies.** `npm install` shows deprecation warnings (`glob@7`, `rimraf@2`, `fstream`, `inflight`). They come from exceljs's own dependencies, have no known vulnerabilities, and would require replacing exceljs to remove.
- **No account management** (password reset, email verification, account deletion) in this version.
- **Not automatically verified:** graceful shutdown on Ctrl+C. Windows can't send that signal from a script, but it works when you press Ctrl+C in a terminal.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid configuration: JWT_SECRET must be ...` | set a 32+ character `JWT_SECRET` in `server/.env` |
| `password authentication failed for user "expense_app"` | check `DB_PASSWORD`. Quote it if it contains `#` |
| `/api/health` returns `503` | PostgreSQL isn't running or isn't reachable. Check `pg_isready` and the `DB_*` settings |
| `Port 5000 is already in use` | stop the other process, or change `PORT` (and `VITE_API_URL`) |
| The browser shows "Cannot reach the server" | start the API (`npm run dev:server`) and check `VITE_API_URL` |
| CORS error in the browser console | add the UI's exact origin (scheme + host + port) to `CLIENT_ORIGIN` |
| `Migration ... was modified after it was applied` | revert the edit and add a new migration file instead |
| `psql` not found on Windows | use the full path `C:\Program Files\PostgreSQL\18\bin\psql.exe` |

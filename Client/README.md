<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b55c5182-49a2-4ab2-95d8-718e09068308

## Run Locally (client only)

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

The client is the front end of a full-stack HR system. It expects the API
server (in the sibling `Server/` folder) to be running. For a complete
deployment, follow the guide below.

---

# Full Setup on a New Server

This sets up the whole stack — MySQL database, the Express API (`Server/`), and
the React/Vite client (`Client/`) — from scratch on a fresh machine.

## 1. Prerequisites

Install these on the server first:

- **Node.js 20+** and npm (`node -v`, `npm -v`)
- **MySQL 8+** (or MariaDB 10.5+) reachable from the server
- **Git**
- A reverse proxy for production (nginx, IIS, Caddy, …) — optional for local

## 2. Get the code

```bash
git clone <your-repo-url> HR
cd HR
```

The repo has two apps:

| Folder    | What it is                          | Default port |
|-----------|-------------------------------------|--------------|
| `Server/` | Express + Prisma API + cron jobs    | `3040`       |
| `Client/` | React 19 + Vite front end           | `3002` (dev) |

## 3. Create the database

Create an empty MySQL database and a user with full rights on it:

```sql
CREATE DATABASE xhrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hr'@'%' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON xhrm.* TO 'hr'@'%';
FLUSH PRIVILEGES;
```

The schema is applied by Prisma in step 4 — you do **not** import a SQL dump.

## 4. Set up the API server (`Server/`)

```bash
cd Server
npm install
```

Create a `Server/.env` file. The required keys (see the existing `.env` for the
full list, including optional SMTP / GL-posting / employee-sync integrations):

```dotenv
PORT=3040
NODE_ENV=production
LOG_LEVEL=info

# Public URL of the client app — used in emails (e.g. the "Sign In" link in the
# new-user welcome email). Set this to your real app URL in production.
FRONTEND_URL=https://hr.your-company.com

# Prisma connection string — must match the DB/user created above
DATABASE_URL="mysql://hr:a-strong-password@localhost:3306/xhrm"

# Auth secrets — generate long random strings (e.g. `openssl rand -hex 32`)
ACCESS_TOKEN_SECRET=<random>
REFRESH_TOKEN_SECRET=<random>
JWT_SECRET=<random>
JWT_EXPIRES_IN=1d
API_KEY=<random>

# Optional integrations (leave blank to disable):
# SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / SMTP_FROM
# EMPLOYEE_SYNC_URL
# POSTING_API_URL / POSTING_API_KEY / POSTING_API_SECRET / POSTING_CHANNEL_CODE / ...
# PAYROLL_EXPENSE_GL / PAYROLL_DEDUCTION_GL / PAYROLL_NET_PAYABLE_GL
```

Generate the Prisma client and create all tables:

```bash
npx prisma generate
npx prisma db push      # creates the schema in the empty database
```

Seed the baseline data. Run these once, in order:

```bash
node src/prisma/seed.js              # roles, permissions, and the default super-admin login
node src/prisma/seedPermissions.js   # syncs to the current canonical permission catalog + role grants
node src/prisma/seedCodeLists.js     # reference lists: titles, genders, nationalities, etc.
```

`seed.js` (also runnable via `npx prisma db seed`) creates the four system roles
and the **super-admin** user. `seedPermissions.js` then reconciles permissions to
the latest catalog (it is safe to re-run any time the permission list changes).

Start the API:

```bash
npm run start        # production (node server.js)
# or
npm run dev          # development (nodemon, auto-restart)
```

The API now listens on `http://<server>:3040`. Uploaded files are stored under
`Server/uploads/` and served from there — make sure that folder is writable and
persisted (back it up / mount a volume).

## 5. Set up the client (`Client/`)

```bash
cd ../Client
npm install
```

**Point the client at the API.** In dev, Vite proxies `/v1/api/hr` and
`/uploads` to `http://localhost:3040` — if your API runs elsewhere, edit the
`target` in [`Client/vite.config.ts`](vite.config.ts).

Run it:

```bash
npm run dev          # dev server on http://<server>:3002 (host 0.0.0.0)
```

For production, build static files and serve them behind your reverse proxy:

```bash
npm run build        # outputs to Client/dist
npm run preview      # optional: preview the production build locally
```

## 6. Production wiring (recommended)

Put both apps behind one reverse proxy on a single hostname so the browser sees
one origin (no CORS, public QR/onboarding links resolve correctly):

- Serve `Client/dist` as the site root (`/`).
- Proxy `/v1/api/hr` and `/uploads` to the API at `http://127.0.0.1:3040`.
- Run the API with a process manager (`pm2 start server.js --name hr-api`) so it
  restarts on reboot. Cron jobs (auto-absent marking, daily digests) run inside
  the API process, so it must stay up.

> The self-onboarding and attendance-kiosk links are built from the server's
> LAN IP / the browser's origin. Behind a real domain they use that domain
> automatically; on a bare server make sure the chosen port is reachable and the
> firewall allows it.

## 7. First login & verification

1. Open the client URL and log in with the seeded **super-admin** account:
   - **Username:** `superadmin@usg.com`
   - **Password:** `pass1234`

   **Change this password immediately after first login.**
2. Go to **Settings → Email Setup** to configure SMTP and send a test email.
3. Sanity-check: `GET http://<server>:3040/v1/api/hr/health` returns
   `{ "status": "ok" }`.
4. Run `npm run lint` in `Client/` (type-check) and confirm the API console shows
   `🚀 Server running on port 3040`.

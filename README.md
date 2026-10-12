# Pact Pulse

Contract analysis in plain language. Upload an NDA, a rental agreement or a services contract, and get
back a report written for someone who is not a lawyer: what the document is, what it actually commits
you to, and which clauses are worth arguing about before you sign.

Built for advocates and small firms who need a first pass through a document quickly. The analysis is
automated and it is not legal advice — every report says so.

## What it does

1. **Upload.** A PDF, DOCX or TXT file, up to 10 MB. The text is extracted immediately, so an
   unreadable file (scanned PDF, corrupt document, password-protected) is rejected at upload rather
   than failing later inside the analysis job.
2. **Analyse.** `POST /analysis/analyze/{id}` starts a background job and returns `202` straight away.
   The document goes to Google's Gemini API, which returns a structured report rather than prose.
   Documents too long for one pass are split into chunks, analysed in parallel, then merged.
3. **Read.** The report gives a short summary, what it means in practice, the parties and governing
   law, the key commercial terms, each party's obligations, and the flagged clauses — each with its
   severity, the exact wording quoted verbatim, and a concrete suggestion for what to do about it.
4. **Export.** Copy the summary, or download it as `.txt` or `.md`. Both are generated in the browser
   from what is already on screen; there is no export endpoint and nothing is sent anywhere.

Reports are written in plain language at roughly an 8th-grade reading level. Older reports in the
previous, more formal wording still open, and can be re-analysed on request.

## Requirements

| | |
|---|---|
| Python | 3.14 is what this was built on (3.10+ should work — `google-genai` requires it) |
| Node | 18 or newer (built on Node 24) |
| MongoDB | Running locally on `27017` |
| Gemini API key | A Google AI Studio key with access to the analysis model |

## Setup

### Backend

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

A virtual environment already exists at `Backend/venv`, so skip those two lines if you are using it.

Create `Backend/.env` from the example and fill it in:

```powershell
copy .env.example .env
```

`Backend/.env.example` documents every setting. The ones that matter:

| Variable | Notes |
|---|---|
| `GEMINI_API_KEY` | Required. The analysis cannot run without it |
| `JWT_SECRET` | Required, and must be at least 32 characters. The server **refuses to start** without it. Changing it signs every user out |
| `MONGODB_URI` | Defaults to `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Defaults to `pact_pulse` |
| `CORS_ORIGINS` | Must **not** be `*`. The refresh cookie needs `allow_credentials`, and browsers reject a wildcard origin in that mode. The server refuses a wildcard |
| `FRONTEND_ORIGIN` | Decides the `Secure` flag on the refresh cookie |

`.env` is git-ignored. Do not commit it, and do not put real keys in `.env.example`.

### Frontend

```powershell
cd Frontend
npm install
copy .env.example .env
```

Frontend `.env` holds one setting, `VITE_API_URL`, defaulting to `http://localhost:8000`.

**Use `localhost`, not `127.0.0.1`.** The refresh cookie is `SameSite=Lax`, and a browser treats those
two hostnames as different sites. A page served from `localhost:5173` calling `127.0.0.1:8000` is a
cross-site request, so the cookie is withheld and the session never restores. Same hostname with a
different port counts as same-site, which is why this works.

## Running

Two terminals. **Start the backend first** — the frontend is unusable without it, and MongoDB must
already be running before either.

**Terminal 1 — API.** It must be started from the repository root:

```powershell
.\Backend\venv\Scripts\python.exe -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Both parts of that command are load-bearing:

- **From the repository root, as `Backend.app.main:app`.** `Backend/app/main.py` imports
  `Backend.app.config`, so the module cannot be imported as a top-level `main`. Running
  `uvicorn main:app` from inside `Backend/app` will not work.
- **Calling the venv's `python.exe` directly.** This works whether or not the environment is
  activated. If you prefer `uvicorn` on your PATH, activate first with
  `.\Backend\venv\Scripts\Activate.ps1`.

Interactive API docs: <http://127.0.0.1:8000/docs>. Endpoint index: <http://127.0.0.1:8000/>.

**Terminal 2 — web app:**

```powershell
cd Frontend
npm run dev
```

<http://localhost:5173>

| Command | |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production bundle into `Frontend/dist/` |
| `npm run preview` | Serve the built bundle |

### Using Docker for MongoDB instead

`Backend/docker-compose.yml` starts MongoDB in a container. Two things to know before using it:

- It sets root credentials, so you must put them in `MONGODB_URI` in `Backend/.env`, including
  `?authSource=admin`. The default URI has no credentials and will not authenticate against it.
- It binds port `27017`, which conflicts with an already-running local `mongod`. Stop one first.

## Project layout

```
Backend/
  app/
    main.py             FastAPI app, CORS, lifespan, router registration
    config.py           settings, read from .env via pydantic-settings
    database.py         Mongo client, collections, indexes
    rate_limit.py       per-IP limiter for login and registration
    auth/               password hashing, JWT issue/verify, the auth dependency
    models/             contract, insights (the report schema), user
    routes/             auth, contract, analysis
    service/            document parsing, the Gemini call, prompts, chunking
    sample/             a sample NDA for testing
  scripts/              one-off maintenance scripts
  API_REFERENCE.md      the API, endpoint by endpoint

Frontend/
  src/
    api/client.js       every HTTP call; the only place fetch is used
    components/         feature components (ReportView, RiskCard, FileDropzone, ...)
    components/ui/      primitives (Button, Card, Modal, Input, Reveal, ...)
    components/layout/  AppShell, Sidebar, ThemeToggle
    context/            AuthContext, ThemeContext
    hooks/              useContracts, useAnalysis, useDebouncedValue, useMediaQuery
    lib/                constants, report, severity, credentials, validateFile
    pages/              Landing, Login, Register, Dashboard, Upload, Contract, Account, 404
  README.md             frontend detail: routes, session handling, behaviour notes
  API_NOTES.md          frontend-side decisions about the API
```

## How the report is produced

The report schema is defined once, in `Backend/app/models/insights.py`, and used both as the Gemini
`response_schema` and as the API response — so what the model is asked for and what the client
receives cannot drift apart.

Documents under the single-pass threshold go to the model in one call. Longer documents are split on
paragraph boundaries with overlap, so a quoted clause is never cut in half, and analysed concurrently
under a small semaphore to avoid rate limits. The partial reports are then merged by a second model
call; if that merge call fails, a deterministic local merge concatenates and de-duplicates the
findings instead, and says so.

If any chunk fails, the whole run fails rather than returning a report with sections quietly missing.
The status becomes `failed` with a reason, and it can be re-run.

## Documentation

| File | Covers |
|---|---|
| `README.md` | This file — setup, running, layout |
| `Backend/API_REFERENCE.md` | Every endpoint, the auth model, the report schema, error codes |
| `Frontend/README.md` | Frontend routes, session handling, behaviour notes, accessibility |
| `Frontend/API_NOTES.md` | How the frontend talks to the API, and why |

## Limitations

These are real and current. None of them is hidden behind a claim the code does not support.

- **The output can be wrong.** It is generated by a language model. It can miss clauses, misread them,
  or quote a document inaccurately. Read the source document before relying on anything in a report.
- **The risk count is not stable.** The same unchanged contract has returned three findings on one run
  and five on another. It is not a score, and it should not be presented as one.
- **There is no password reset.** The backend has no way to send email, so there is no verification or
  recovery flow. A forgotten password means a lost account.
- **Access tokens cannot be revoked.** Logging out stops new tokens being minted and clears the refresh
  cookie immediately, but an access token already issued stays valid until it expires — up to 20
  minutes. That is why the access lifetime is short.
- **Analysis runs in-process.** `BackgroundTasks` are not a queue. Restarting the server mid-run
  strands that job; it is reported as failed after 10 minutes and can be re-run.
- **Rate limiting is per process and per IP.** It resets on restart and is not shared between workers.
- **There are no automated tests.** The API is exercised through `/docs`.
- **No compliance claims are made.** There is no encryption at rest, no audit log, and no certification
  of any kind. Passwords are stored as argon2id hashes and the session token is held in memory rather
  than in browser storage — that is the extent of it.
- **Documents leave your machine.** The text of an uploaded contract is sent to Google's Gemini API for
  processing. If a document cannot leave your organisation, do not upload it here.

## Author

Made by **Salman Zulfiqar Shaikh**.

- Website — <https://www.salmanzulfi.dev>
- GitHub — <https://www.github.com/SalmanZulfiqarShaikh>
- LinkedIn — <https://www.linkedin.com/in/SalmanZulfiqarShaikh>

No licence file is included in this repository.

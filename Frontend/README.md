# Pact Pulse — Frontend

A web interface for the Pact Pulse contract analysis API. Upload a contract, run an automated risk
analysis, and read the report: what it means in plain language, the risky clauses with severity, key
terms, obligations and parties.

React 18 + Vite, Tailwind CSS, React Router. No component library — the UI primitives are in
`src/components/ui`.

## Requirements

- Node 18 or newer (built and tested on Node 24)
- The backend running and reachable (see the repository root)

## Setup

```bash
cd Frontend
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

`.env` holds one setting:

```
VITE_API_URL=http://localhost:8000
```

**Use `localhost`, not `127.0.0.1`.** The session's refresh cookie is `SameSite=Lax`, and a browser
treats those two hostnames as different sites — a page on `localhost:5173` calling `127.0.0.1:8000`
is a cross-site request, the cookie is withheld, and the session never restores. Same hostname,
different port, counts as same-site. `Frontend/API_NOTES.md` explains this in more detail.

Vite reads the setting at startup, so restart the dev server after changing it.

## Running

Start the backend first, from the **repository root**:

```bash
Backend/venv/Scripts/python.exe -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000
```

Then:

```bash
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve the built bundle
```

## Accounts and the session

Every screen except the landing page needs a signed-in account. Register with an email and a
password of at least 8 characters; there is no email verification and no password reset.

The session is two tokens, handled differently on purpose:

| | Where it lives | Lifetime |
| --- | --- | --- |
| Access token | A variable inside `src/api/client.js`. **Memory only** | 20 minutes |
| Refresh token | An httpOnly cookie JavaScript never sees | 10 days |

- The access token is never written to `localStorage` or `sessionStorage`, and never logged. Any
  script running on the page could read a stored token; it cannot read a module variable it would
  have to be injected to reach, and it cannot read the cookie at all.
- The cost of that choice: a page reload has no token. On load the app calls `POST /auth/refresh`
  with the cookie to get a new one, showing a neutral loading screen while it waits. That call is
  the only way to know whether a reload is still signed in.
- Every request sends `credentials: 'include'`, so the cookie travels with it.
- A `401` from a protected call means the access token expired. The client refreshes **once** and
  replays the request. If that also fails, the session is dropped and you land on `/login`, with the
  page you were trying to reach remembered so you return to it.
- Parallel `401`s share one in-flight refresh. The server rotates the refresh cookie, so two
  simultaneous refreshes would leave one caller holding a cookie that no longer exists.

Logging out revokes the cookie on the server immediately, so a captured cookie cannot be replayed.
An access token already issued keeps working until it expires — up to 20 minutes. The app discards
it from memory, so the UI is correct either way; this only matters if someone captured the token.

## Routes

| Route | Access | |
| --- | --- | --- |
| `/` | Public | Landing page |
| `/login`, `/register` | Public | Redirect to `/app` if already signed in |
| `/app` | Signed in | Contracts: search, status filter, sort, delete |
| `/app/upload` | Signed in | Drag-and-drop upload, then straight into the analysis |
| `/app/contracts/:id` | Signed in | Report, analysis status, extracted text, delete |
| `/app/account` | Signed in | Email, log out, backend reachability |
| anything else | — | 404 page |

An unauthenticated visit to `/app/*` redirects to `/login` and returns you to the page you wanted
after you sign in.

## Layout

```
src/
  api/client.js        every HTTP call; the only place fetch/XHR is used
  components/          feature components (ReportView, RiskCard, ContractTable, FileDropzone, ...)
  components/ui/       primitives (Button, Card, Badge, Modal, Input, Skeleton, ...)
  components/layout/   AppShell, Sidebar, MobileNav, ThemeToggle
  context/             AuthContext, ThemeContext
  hooks/               useContracts, useAnalysis, useDebouncedValue, useMediaQuery
  lib/                 constants, format, credentials, report, severity, validateFile
  pages/               Landing, LoginPage, RegisterPage, Dashboard, UploadPage, ContractPage,
                       AccountPage, NotFound
```

### Behaviour worth knowing

- **Analysis is asynchronous.** `POST /analysis/analyze/{id}` returns `202`; the page then polls
  `GET /analysis/{id}/insights` every 3 seconds, and gives up at the server's 10-minute stale limit.
  Polling pauses while the tab is hidden and refreshes the moment it is shown again.
- **Polling is the only progress signal.** The API reports a status, not a percentage, so the
  progress view is deliberately indeterminate.
- **A missing analysis is not an error.** `GET /analysis/{id}/insights` answers `404` until an
  analysis has ever been started; the UI shows "Not analyzed" and an action, not a failure.
- **Old reports still open.** Reports written before the plain-language rewrite lack
  `reading_level: "plain"`. They render in their original wording, with a note offering to re-analyze
  and a confirmation before replacing the report.
- **Theme** follows the system by default and can be pinned to light or dark. The stored preference
  is applied by an inline script in `index.html` before first paint, so there is no flash.
- **Print** on the contract page prints the report. Use "Expand all" first if you want the clause
  details in the printout.
- **Only the report uses saturated colour.** Severity badges always carry their word, so severity is
  never conveyed by colour alone.

## Notes and limitations

- `ALLOWED_EXTENSIONS` and `MAX_FILE_SIZE` in `src/lib/constants.js` mirror the server config. They
  exist only to fail fast; the server re-validates everything.
- There is no export endpoint on the backend. "Copy summary" and the `.txt` / `.md` downloads are
  generated in the browser from the report already on screen.
- The risk count is not stable. The analysis runs at a low temperature but is still generative: the
  same unchanged contract has returned 3 findings on one run and 5 on another. Do not present or
  read it as a score.
- There is no password reset, because the backend has no way to send email.
- `Frontend/API_NOTES.md` records the frontend-side API decisions;
  `Backend/API_REFERENCE.md` is the reference for the API itself.

## Accessibility

Semantic landmarks and headings, labelled form controls, a visible focus ring everywhere, keyboard
operable dialogs and dropzone, `aria-live` on the analysis status and result counts, and `sr-only`
captions on data tables.

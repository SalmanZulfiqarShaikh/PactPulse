# Pact Pulse — API notes for the frontend

**The reference is [`Backend/API_REFERENCE.md`](../Backend/API_REFERENCE.md).** It documents every
endpoint, every field, the error codes and the report schema, and it is kept next to the code that
implements it. Read that first; nothing here restates it.

This file used to hold a second copy of the endpoint list. That copy described the pre-2.0.0 backend
— the shared `X-API-Key`, no accounts — and had gone stale enough to be actively misleading, so it
was replaced by this note.

## What is specific to the frontend

### Base URL

`src/lib/constants.js` resolves `VITE_API_URL`, defaulting to `http://localhost:8000`.

The host has to be **`localhost`**, not `127.0.0.1`. The refresh cookie is set `SameSite=Lax` and
`Path=/auth`. A browser treats `localhost:5173` and `127.0.0.1:8000` as different *sites*, so a page
served from one calling the other is a cross-site request, the cookie is withheld, and every session
silently fails to restore. The same hostname on a different port is same-site, which is what makes
the refresh flow work in development.

There is no Vite proxy: the browser calls the API directly, so CORS on the backend must list the
dev-server origin (`http://localhost:5173`).

### The session

Two tokens, handled differently on purpose:

| | Where it lives | Lifetime |
|---|---|---|
| Access token | A module variable in `src/api/client.js`. **Memory only** | 20 minutes |
| Refresh token | An httpOnly cookie the JavaScript never sees | 10 days |

- The access token is never written to `localStorage` or `sessionStorage`, and never logged. A
  reload gets a new one by calling `POST /auth/refresh`, which is the only way to find out whether a
  reload is still signed in — hence the neutral loading screen while that call is in flight.
- Every request sends `credentials: 'include'` so the cookie rides along.
- A `401` from a protected call triggers **one** refresh and **one** replay of the request. If that
  fails, the session is dropped and the guards send the reader to `/login`.
- Concurrent `401`s share a single in-flight refresh promise. The server rotates the refresh cookie,
  so two parallel refreshes would leave one of them holding a cookie that no longer exists.
- `login`, `register`, `logout` and `GET /` are marked `auth: false`, so a real `401` from a wrong
  password is never mistaken for an expired session.
- `logout` revokes the refresh cookie server-side (a replay of the old cookie then gets `401`). An
  access token already issued keeps working until it expires — the app drops it from memory, so this
  is only reachable by someone who captured the token.

### Endpoints the app calls

`api.health`, `api.register`, `api.login`, `api.logout`, `api.refresh`, `api.listContracts`,
`api.getContract`, `api.getSummary`, `api.deleteContract`, `api.analyze`, `api.getInsights`,
`api.uploadContract` — all in `src/api/client.js`, which is the only file in the app that touches
`fetch` or `XMLHttpRequest`.

Upload progress needs a progress event, which `fetch` does not report, so the upload uses
`XMLHttpRequest` with `withCredentials = true`. It is the one exception.

### Reports

`GET /analysis/{id}/insights` returns stored reports exactly as they were recorded, without
re-validating them. Reports written before 2.0.0 therefore still load, in the old shape
(`summary`, `risks[].explanation`, `risks[].recommendation`).

`src/lib/report.js` normalises both shapes field by field, so a partly-migrated report still renders.
`reading_level === 'plain'` is the only thing that distinguishes them, and it is used solely to offer
a re-analysis.

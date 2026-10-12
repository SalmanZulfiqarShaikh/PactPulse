# Pact Pulse API Reference

Version 2.0.0. Base URL in development: `http://127.0.0.1:8000`.

Interactive docs are at `/docs` (Swagger UI) and `/redoc`.

---

## What changed in 2.0.0

**Breaking for any existing client.** Read this section before upgrading the frontend.

| Area | Before | Now |
|---|---|---|
| Authentication | Shared `X-API-Key` header | Per-user email/password accounts, JWT bearer tokens |
| Endpoint auth | Some endpoints open, two key-gated | **Every** endpoint except `GET /` requires a bearer token |
| Ownership | None — every user saw every contract | Every contract and analysis carries `owner_id`; you only ever see your own |
| Unauthorised access | — | 404, never 403, so ids cannot be probed |
| Report shape | `summary`, `risks[].explanation`, `risks[].recommendation` | `tldr`, `risks[].plain_explanation`, `risks[].what_to_do` |
| Language | Formal legal register | Plain language, ~8th-grade reading level |
| `DELETE /contracts/{id}` | Did not exist | Exists |
| `GET /contracts` paging | Did not exist | `limit` and `skip` |

Old reports written before 2.0.0 still load, unchanged, from
`GET /analysis/{id}/insights`. See [Reading a report](#reading-a-report-safely).

---

## Authentication

### The model

Two tokens, with different jobs.

| | Access token | Refresh token |
|---|---|---|
| Lifetime | 20 minutes (`ACCESS_TOKEN_MINUTES`) | 10 days (`REFRESH_TOKEN_DAYS`) |
| Sent as | `Authorization: Bearer <token>` header | httpOnly cookie |
| Readable by JS | Yes — but keep it in memory only | No |
| Stored where | Client memory. **Never** `localStorage` | Browser cookie jar |

The refresh cookie is set with `HttpOnly`, `SameSite=lax`, `Path=/auth`, and
`Secure` whenever the frontend origin is not localhost. The narrow `Path` means
the browser only attaches it to `/auth/*` requests.

Call `POST /auth/refresh` when the access token is close to expiring. It returns
a new access token *and* rotates the refresh cookie.

### `POST /auth/register`

Creates an account and logs straight in.

Rate limit: **5 requests per minute per IP**.

```json
{ "email": "ada@example.com", "password": "correct-horse-battery" }
```

`email` must look like an address; it is lowercased and trimmed before storage,
so `Ada@Example.com` and `ada@example.com` are the same account. `password` must
be 8–128 characters.

**201 Created** — the response body is a [token response](#token-response), and
a refresh cookie is set.

| Error | When |
|---|---|
| `409` `{"detail": "An account with that email already exists."}` | Email already registered |
| `422` | Email malformed, or password outside 8–128 |
| `429` | Rate limit exceeded |

> **Note:** registration necessarily reveals whether an address is already
> registered — the alternative is silently not creating the account. Login does
> not, and that is the endpoint that matters for enumeration.

### `POST /auth/login`

Rate limit: **10 requests per minute per IP**.

```json
{ "email": "ada@example.com", "password": "correct-horse-battery" }
```

**200 OK** — [token response](#token-response) plus a refresh cookie.

Every failure — unknown email, wrong password — returns the identical
`401 {"detail": "Incorrect email or password."}`, and an unknown email still
performs a full password verification so the response *time* does not
distinguish the two either. Do not render different UI for "no such account"
versus "wrong password"; there is no way to tell them apart, by design.

Login is deliberately laxer about input than registration: the email is not
format-validated and the password has no minimum length, so a bad guess produces
the same 401 as a good-format wrong password rather than a 422. Send whatever the
user typed.

### `POST /auth/refresh`

No body. Reads the refresh cookie.

**200 OK** — a new [token response](#token-response), and the cookie is rotated.
Rotating means a cookie captured earlier stops working once the real client
refreshes.

| Error | When |
|---|---|
| `401` `{"detail": "No refresh token."}` | No cookie sent (expected when signed out) |
| `401` `{"detail": "Refresh token is invalid or has expired."}` | Expired, forged, wrong token type, or issued before the last logout |
| `401` `{"detail": "Account no longer exists."}` | The account was deleted |

All three clear the cookie so the client stops retrying.

### `POST /auth/logout`

No body. **204 No Content**, always — even with no cookie, or an expired one.

Ends the session: the account's session generation is bumped, so no new access
token can be minted from any refresh token issued before this call. The cookie
is cleared.

Access tokens already issued are **not** invalidated — they are stateless and
stay valid for the remainder of their 20 minutes. That is the reason the access
lifetime is short.

### `GET /auth/me`

**200 OK** — `{"user_id": "a475301b...", "email": "ada@example.com"}`.

Use it on app start to check whether a session can be restored.

### Token response

Returned by register, login and refresh.

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 1200,
  "user_id": "a475301b51f242caa4ae8b1a696e1412",
  "email": "ada@example.com"
}
```

`expires_in` is seconds.

### Authenticating a request

```
Authorization: Bearer eyJhbGciOi...
```

A missing, expired, forged or wrong-type token all return the same
`401 {"detail": "Not authenticated."}` with a `WWW-Authenticate: Bearer` header.

### Suggested client flow

1. On load, `POST /auth/refresh` with `credentials: "include"`. Success means a
   live session — keep the access token in a variable. Failure means signed out;
   show the login screen.
2. Before each request, attach the access token. On a `401`, refresh once and
   retry; if the refresh also fails, sign out.
3. Sign out with `POST /auth/logout`, then drop the in-memory access token.

`fetch` must use `credentials: "include"` for the cookie to be sent to `/auth/*`.

---

## Contracts

All endpoints below require `Authorization: Bearer <access token>`.

### Ownership

Every contract and analysis has an `owner_id`. Every query is filtered by it.

**Accessing another account's contract returns `404`, not `403`.** This is
deliberate — a 403 would confirm that the id exists. A 404 means "no such
contract, or not yours"; treat them as the same thing.

### `POST /contracts/upload`

`multipart/form-data`, field name `file`. Allowed types: **DOCX, PDF, TXT**. Max
**10 MB**.

**201 Created**

```json
{
  "message": "Contract uploaded and parsed successfully.",
  "contract_id": "351b1d0da5d843d4942d536f38cf5454",
  "filename": "nda_sample1_351b1d0d....txt",
  "originalname": "nda_sample1.txt",
  "size_bytes": 6908,
  "page_count": 1,
  "word_count": 942,
  "status": "uploaded",
  "upload_date": "2026-10-12T08:30:52.922282+00:00",
  "text_content": "..."
}
```

Use `contract_id` for every later call — not `filename`.

`page_count` for DOCX is an estimate: the format does not record pagination, so
it is derived from the text length.

| Error | When |
|---|---|
| `400` | Wrong extension, empty file, over 10 MB, or the text could not be extracted (corrupt or password-protected) |
| `401` | No valid token |

A parse failure happens at upload time, so an unreadable file is rejected
immediately rather than failing later inside the analysis job.

### `GET /contracts`

Lists the caller's contracts, newest first. Excludes `text_content`.

| Query param | Type | Notes |
|---|---|---|
| `search` | string | Case-insensitive substring match on the original filename |
| `status` | string | `uploaded`, `analyzing`, `analyzed` or `failed` |
| `limit` | int 1–200 | Omit for all matches |
| `skip` | int ≥ 0 | Default 0 |

```json
{
  "count": 1,
  "total": 3,
  "limit": null,
  "skip": 0,
  "contracts": [ { "contract_id": "...", "originalname": "...", "status": "analyzed", "...": "..." } ]
}
```

`count` is how many are in this page; `total` is how many matched before
`limit`/`skip`, so you can paginate without a second request.

### `GET /contracts/{contract_id}`

**200 OK** — the full contract record including `text_content`. **404** if it
does not exist or belongs to someone else.

### `GET /contracts/{contract_id}/summary`

Metadata plus a 500-character preview, lighter than fetching the whole document.

```json
{
  "contract_id": "...",
  "filename": "...", "originalname": "...", "upload_date": "...",
  "page_count": 1, "word_count": 942, "size_bytes": 6908,
  "status": "analyzed",
  "analysis_status": "analyzed",
  "preview": "...",
  "preview_truncated": true
}
```

### `DELETE /contracts/{contract_id}`

Owner only. Deletes the contract, its analysis and the uploaded file.

**200 OK** — `{"message": "Contract deleted.", "contract_id": "..."}`.
**404** if it does not exist or is not yours. Deleting twice returns 404, not an
error.

**This cannot be undone.** Re-analysis is impossible afterwards. Confirm with the
user before calling it — these are confidential documents.

---

## Analysis

### `POST /analysis/analyze/{contract_id}`

Starts a background job. Rate-limit-free, but it costs Gemini quota, and only the
owner can start one.

**202 Accepted**

```json
{
  "message": "Analysis started.",
  "contract_id": "...",
  "status": "analyzing",
  "poll": "/analysis/351b1d.../insights"
}
```

| Error | When |
|---|---|
| `400` | The contract has no extracted text |
| `404` | Not found, or not yours |
| `409` | An analysis is already running for this contract |

Poll the `poll` path until the status leaves `analyzing`.

### `GET /analysis/{contract_id}/insights`

**200 OK** while running, and after. Poll on a fixed interval; do not treat a
non-`analyzed` status as an error.

```json
{
  "contract_id": "...",
  "status": "analyzing" | "analyzed" | "failed",
  "insights": null,
  "error": null,
  "model": "gemini-2.5-flash",
  "chunk_count": 1,
  "started_at": "2026-10-12T08:32:29.868854+00:00",
  "completed_at": "2026-10-12T08:32:52.938036+00:00"
}
```

- `analyzing` — job running. `insights` is `null`.
- `analyzed` — `insights` holds the report.
- `failed` — `error` explains why. Anything longer than 10 minutes in `analyzing`
  is reported as failed, because the job runs in-process and a server restart
  would otherwise strand it. Re-running `POST /analysis/analyze/{id}` is allowed
  once it is stale.

**404** if there is no analysis for this contract — including when the contract
belongs to another account.

### The report

New reports have `reading_level: "plain"`.

```json
{
  "tldr": "…",
  "what_this_means": ["…", "…"],
  "contract_type": "Non-Disclosure Agreement",
  "parties": ["PACT PULSE (Disclosing Party)", "…"],
  "effective_date": null,
  "governing_law": "Pakistani law",
  "key_terms":  [ { "term": "…", "value": "…" } ],
  "obligations": [ { "party": "You", "obligation": "…" } ],
  "risks": [ … ],
  "chunk_count": 1,
  "reading_level": "plain"
}
```

| Field | Type | Notes |
|---|---|---|
| `tldr` | string | 2–3 sentences, then one sentence on the single most important thing to watch |
| `what_this_means` | string[] | 3–6 short bullets |
| `contract_type` | string | Plain name, e.g. `"Rental agreement"` |
| `parties` | string[] | As named in the document |
| `effective_date` | string \| null | `null` when the document does not state one |
| `governing_law` | string | Plain phrase, e.g. `"Pakistani law"` |
| `key_terms` | object[] | `{term, value}`, both in plain words |
| `obligations` | object[] | `{party, obligation}`; `party` may be `"You"` |
| `risks` | object[] | See below |
| `chunk_count` | int | How many sections the document was split into. `> 1` means a merge call composed the summary |
| `reading_level` | `"plain"` | Marks the v2 schema |

Long documents are split into chunks and analysed in parallel, then merged. The
merge is itself a model call; if it fails, a deterministic local merge
concatenates and de-duplicates the risk lists, and `reading_level` is still
`"plain"`. **If any chunk fails, the whole run fails** rather than returning a
report with sections silently missing. `error` says so; retry.

### Risks

```json
{
  "title": "You must keep some information secret forever.",
  "severity": "high",
  "clause_text": "The confidentiality obligations under this Agreement shall survive…",
  "plain_explanation": "While most confidential information must be kept secret for three years, anything that counts as a trade secret…",
  "what_to_do": "Ask them to put a clear time limit on all confidentiality obligations…",
  "legal_note": "While indefinite protection for trade secrets is common…"
}
```

| Field | Notes |
|---|---|
| `title` | Short, plain. Suitable as a heading |
| `severity` | `critical` \| `high` \| `medium` \| `low` |
| `clause_text` | **Verbatim** from the document. Lawyers need this; do not paraphrase it |
| `plain_explanation` | What it means in practice |
| `what_to_do` | A concrete next step, or a note that the clause is standard |
| `legal_note` | Optional. Technical or redline detail. May be absent |

### Reading a report safely

`GET /analysis/{id}/insights` returns stored reports **exactly as recorded**,
without re-validating them against the current schema. That is what lets reports
written before 2.0.0 keep working.

Any client must therefore handle both shapes:

```js
const tldr = insights.tldr ?? insights.summary ?? "";
const riskText = r.plain_explanation ?? r.explanation ?? "";
const riskAction = r.what_to_do ?? r.recommendation ?? "";
```

Old reports have `summary` and `risks[].explanation` / `risks[].recommendation`,
and no `tldr`, `what_this_means`, `reading_level` or `legal_note`. Everything
else in the schema is unchanged.

New reports always carry `reading_level: "plain"`. Check for it to know which
shape you have, but still fall back per-field as above.

---

## Errors

Every error body is `{"detail": "..."}` — a single string.

| Status | Meaning |
|---|---|
| `400` | Bad input: file type, size, empty file, unparseable document, nothing to analyse |
| `401` | Not authenticated, or bad credentials. Also the single message for bad login |
| `404` | Not found, **or exists but is not yours** |
| `409` | Email already registered, or an analysis is already running |
| `422` | Request body failed validation (malformed email, password length) |
| `429` | Rate limited |
| `500` | Server error. Not used for bad input |

`429` body: `{"detail": "Too many attempts. Please wait a minute and try again."}`

Rate limits apply per client IP, to `POST /auth/login` (10/min) and
`POST /auth/register` (5/min) only. Counters are held in process memory, so they
reset on restart and are **not** shared between workers. See
[Nothing here is a substitute for legal advice](#nothing-here-is-a-substitute-for-legal-advice).

---

## Operational notes

### Configuration

Settings come from `Backend/.env`. See `Backend/.env.example` for the full list
with comments. The server **refuses to start** if `JWT_SECRET` is missing or
shorter than 32 characters, or if `CORS_ORIGINS` contains `*`.

`CORS_ORIGINS` cannot be a wildcard because `allow_credentials=True` is required
for the refresh cookie, and browsers reject a wildcard origin in that mode. Add
every origin the frontend is served from, comma-separated.

Changing `JWT_SECRET` invalidates every issued token, signing all users out.

### Legacy contracts

Contracts created before 2.0.0 have no `owner_id`. They are **invisible to every
account** and cannot be reached through the API. To hand them to an account:

```bash
# Show what would change
Backend/venv/Scripts/python.exe Backend/scripts/assign_legacy_contracts.py ada@example.com

# Do it
Backend/venv/Scripts/python.exe Backend/scripts/assign_legacy_contracts.py ada@example.com --apply
```

Analyses inherit their contract's owner, so an analysis can never end up
belonging to a different account than its contract.

### Nothing here is a substitute for legal advice

Every report is automated output from a language model and can be wrong,
incomplete, or overconfident. The client must display:

> Automated analysis. Review before relying on it.

### Known limitations

- **Rate limiting is per process and per IP.** It resets on restart and is not
  shared across workers. Behind a proxy, every request may appear to come from
  the proxy unless `--proxy-headers` and a trusted `Forwarded`/`X-Forwarded-For`
  are configured — which would make the limit shared across all users.
- **Access tokens cannot be revoked.** Logout stops new tokens being minted but
  an already-issued access token works until it expires, up to 20 minutes.
- **The analysis job runs in-process.** A server restart mid-run strands the
  analysis, which is reported as failed after 10 minutes and can be re-run.
- **`analysis` collection has a unique index on `contract_id`**, so one contract
  has at most one analysis. Re-analysing replaces the previous report.

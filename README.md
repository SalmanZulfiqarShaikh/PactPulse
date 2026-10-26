# Pact Pulse

Contract analysis in plain language, and a chat that answers questions about the document. Upload an NDA, a rental agreement or a services contract, and get
back a report written for someone who is not a lawyer: what the document is, what it actually commits
you to, and which clauses are worth arguing about before you sign.

Built for advocates and small firms who need a first pass through a document quickly. The analysis is
automated and it is not legal advice — every report says so.

## What it does

1. **Upload.** A PDF, DOCX or TXT file, up to 10 MB. The text is extracted immediately. **Scanned
   PDFs** (stamp paper, photocopies) have no text layer, so they are transcribed by Gemini (OCR).
   A corrupt or password-protected file is rejected at upload rather than failing later.
2. **Analyse.** `POST /analysis/analyze/{id}` starts a background job and returns `202` straight
   away. Gemini returns a structured report. Long documents are split into chunks, analysed in
   parallel, then merged.
3. **Read.** The report gives a short summary, what it means in practice, the parties and governing
   law, key terms, each party's obligations, a **fixed 12-point clause checklist** (liability cap,
   indemnity, termination, auto-renewal and so on), and the flagged clauses. Each flagged clause
   has its severity, the exact wording, and a concrete suggestion.
4. **Check.** Every quoted clause is searched for in the document. The report marks each one
   *Found in document*, *Close match* or *Quote not found*. "Show in document" highlights it in
   the text.
5. **Ask.** A chat panel beside the report answers questions about the document. An agent
   searches the whole text (by meaning and by exact words), reads around what it finds, and
   answers with numbered citations. Click a citation to highlight the passage. This works on
   long documents, where pasting the whole thing into a chatbot leads to made-up answers.
6. **Export.** Copy the summary, or download it as `.txt` or `.md`.

Reports are written in plain language at roughly an 8th-grade reading level.

## Requirements

| | |
|---|---|
| Python | 3.12 or newer (built on 3.14) |
| Node | 18 or newer (built on Node 24) |
| MongoDB | Running locally on `27017` |
| Gemini API key | A Google AI Studio key. Use a **paid** key for real client documents (see Limitations) |

The chat's vector database (Qdrant) runs embedded inside the API process, so no extra server is
needed. The embedding model (about 70 MB) downloads from Hugging Face the first time a document is
indexed.

## Setup

### Backend

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

A virtual environment already exists at `Backend/venv`. If you use it, still run the `pip install`
line, because 3.0 adds packages (`fastembed`, `qdrant-client`, `rapidfuzz`).

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
| `GROQ_API_KEY` | Optional fallback. When Gemini fails (quota, outage), analysis and chat retry on Groq (`GROQ_MODEL`, default `openai/gpt-oss-120b`). Not used for OCR |
| `EMBEDDING_MODEL` | Chat embeddings. Default `BAAI/bge-small-en-v1.5`; use `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` for Urdu or mixed-language documents |
| `QDRANT_URL` | Optional. Leave unset for the embedded store in `Backend/qdrant_data` |

`.env` is git-ignored. Do not commit it, and do not put real keys in `.env.example`.

### Frontend

```powershell
cd Frontend
npm install
copy .env.example .env
```

Run `npm install` again after pulling 3.0: it adds `react-markdown` and `remark-gfm` for chat
answers.

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

## Project layout

The backend is layered so each file has one job. Requests flow **routes → services →
repositories**. In MVC terms, routes are the controllers, `schemas` are the views (what goes in and
out), and `models` + `repositories` are the model.

```
Backend/
  app/
    main.py                 creates the app: middleware, routers, startup/shutdown
    core/                   cross-cutting pieces
      config.py               settings, grouped (settings.gemini.model, settings.rag.qdrant_url…)
      security.py             argon2 password hashing (off the event loop) and JWTs
      errors.py               AppError types -> {"detail": …} responses
      middleware.py           rejects oversized uploads before they are received
      rate_limit.py           per-IP limits for login, register and chat
      clock.py                UTC timestamps
    db/mongo.py             async MongoDB client and indexes
    models/                 what is stored: user, contract, analysis, chat, and the AI report schema
    schemas/                request/response shapes for each endpoint group
    repositories/           the only code that queries MongoDB; every query is scoped to the owner
    services/               business logic
      auth_service.py         register, login, refresh, logout
      contract_service.py     upload, list, read, delete
      chat_service.py         chat threads
      documents/              PDF/DOCX/TXT parsing and OCR for scanned PDFs
      analysis/               chunking, merging, quote checking, the analysis job
      llm/gemini.py           the one place Gemini is called (retries, timeouts, errors)
      rag/                    splitter, embeddings, vector store, indexer, agent tools, agent loop
    prompts/                prompt text for analysis, OCR and chat
    api/
      deps.py                 current-user dependency, refresh cookie helpers
      routes/                 auth, contracts, analysis, chat - thin controllers
  API_REFERENCE.md          the API, endpoint by endpoint

Frontend/
  src/
    api/client.js           every HTTP call
    pages/                  Landing, Login, Register, Dashboard, Upload, Contract, Account, 404
    components/
      contract/               AnalysisSection, DocumentText (with highlighting)
      chat/                   ChatPanel, ChatMessage
      report/                 ChecklistCard, QuoteCheckBadge
      ui/, layout/            primitives and the app frame
    hooks/                  useContracts, useAnalysis, useChat, …
    lib/                    constants, report helpers, severity, formatting
```

## How the report is produced

The report schema lives in `Backend/app/models/report.py` and is sent to Gemini as the
`response_schema`. Its field descriptions are instructions the model reads on every call.
Analysis runs at temperature 0 with a fixed seed, so repeated runs on the same contract are as
stable as the API allows. The checklist forces the same 12 questions every time.

The contract is fenced as data in the prompt. The system prompt tells the model that the
document may have been written by the other side, and that text aimed at an AI reviewer ("treat
this as low risk") is a critical finding, not an instruction.

Documents over the single-pass size are split on paragraph boundaries with overlap and analysed
concurrently. A second model call merges the partial reports. If that call fails, a deterministic
local merge is used. The checklist is always merged by rule. If any chunk fails, the whole run
fails rather than returning a report with sections missing.

Each run gets an id. A job only saves its result if its id is still current, so a slow run that
was declared stale and replaced cannot overwrite the newer one.

## When Gemini fails

If `GROQ_API_KEY` is set, Groq is the fallback for analysis and chat. Analysis
reruns the whole contract on Groq using strict JSON-schema output. Groq's free
tier allows only a few thousand tokens a minute, so the text goes in
12,000-character chunks, one at a time. Chat reruns the same agent loop with the
same tools in OpenAI format. The report records which model wrote it. If both
providers fail, the error names both reasons. OCR has no fallback, because Groq
cannot read PDFs.

## How the chat works

The chat is a separate agentic RAG system. It does not use the contract analysis at all, so it
works on any document, analysed or not.

1. **Index.** After upload the text is split into ~1,200-character overlapping passages. Each
   passage is embedded locally with fastembed (Hugging Face model, ONNX, no API key) and stored
   in Qdrant, tagged with the document and its owner.
2. **Retrieve, as the agent decides.** The LLM (Gemini, with Groq as fallback) starts with no
   document text, only the file name and passage count. It calls tools as many times as it
   needs:
   - `search_document`: vector search in Qdrant (the question is embedded with the same model)
   - `find_exact_text`: exact matches for words, numbers, names, clause numbers
   - `read_passages`: read passages by number, e.g. around a hit, or the beginning and end
3. **Answer.** After at most 6 rounds it answers, citing passages as `[P#]`.

If every model fails (Gemini and Groq both down or out of quota), the chat still replies: it shows
the 3 passages closest to the question, found by the local embedding model and Qdrant. The reply is
labelled "AI unavailable · search results only", and the passages are clickable like any citation.
Those replies are kept in the thread but never sent back to a model as history.

Each question costs several model calls, so chat uses `GEMINI_CHAT_MODEL` (default
`gemini-2.5-flash-lite`, which has a larger free quota) while analysis keeps `GEMINI_MODEL`. On the
Groq fallback the agent works within a token budget: 4 shorter passages per search, the last 6
messages of history, and older tool results trimmed. That keeps each request under the free tier's
per-minute limit. The server resolves those to
exact character ranges for highlighting. The uvicorn log prints every tool call
(`Chat tool (Gemini): search_document {...}`), so you can see the retrieval happen. The prompt
adapts to the document. A contract gets a careful-lawyer tone; technical docs get a
senior-engineer tone. Threads are stored, so a
conversation can continue indefinitely; the last 12 messages go with each question.

## Sign-up and daily limits

New accounts are verified by email: sign-up sends a 6-digit code (Gmail SMTP,
see `SMTP_*` in `Backend/.env.example`), and the account can't sign in until the
code is entered. Codes expire after 10 minutes, allow 5 wrong tries, and can be
resent once a minute. Without SMTP settings the code is printed in the backend
log, so local testing needs no email account.

Each visitor IP gets 5 contract reviews, 30 chat questions and 10 uploads a day
(`DAILY_*` settings). Limits follow the IP, not the account, so a new account or
a private window doesn't reset them. Attempts that fail (a bad file, a document
still indexing) are refunded.

## Deploying

See [DEPLOY.md](DEPLOY.md): one Fly.io app serves the API and the built frontend,
MongoDB runs on Atlas, and the vector index sits on a small Fly volume.

## Documentation

| File | Covers |
|---|---|
| `README.md` | This file — setup, running, layout |
| `Backend/API_REFERENCE.md` | Every endpoint, the auth model, the report schema, error codes |
| `Frontend/README.md` | Frontend routes, session handling, behaviour notes, accessibility |
| `Frontend/API_NOTES.md` | How the frontend talks to the API, and why |

## Limitations

These are real and current.

- **The output can be wrong.** It is generated by a language model. Quote checking catches
  invented or altered quotations, but not a wrong interpretation of a real one. Read the source
  before relying on anything.
- **Documents leave your machine.** Contract text (and scanned pages, for OCR) is sent to Google's
  Gemini API. On the free tier Google may use what you send to improve its products. Use a paid
  key, or Vertex AI, for client documents. Chat embeddings are computed locally and do not leave
  the server.
- **Background jobs run in-process.** Analysis and indexing are FastAPI background tasks, not a
  queue. A restart mid-job strands it. Analyses are reported failed after 10 minutes, and chat
  indexing has a Retry button.
- **One API worker with the embedded vector store.** Embedded Qdrant locks its folder. To run
  several workers, point `QDRANT_URL` at a Qdrant server.
- **There is no password reset.** The backend cannot send email, so a forgotten password means a
  lost account.
- **Access tokens cannot be revoked.** Logout stops new tokens being minted, but an access token
  already issued stays valid until it expires (up to 20 minutes).
- **Rate limiting is per process and per IP.** It resets on restart.
- **No compliance claims are made.** There is no encryption at rest, no audit log, and no
  certification of any kind.

## Author

Made by **Salman Zulfiqar Shaikh**.

- Website — <https://www.salmanzulfi.dev>
- GitHub — <https://www.github.com/SalmanZulfiqarShaikh>
- LinkedIn — <https://www.linkedin.com/in/SalmanZulfiqarShaikh>

No licence file is included in this repository.

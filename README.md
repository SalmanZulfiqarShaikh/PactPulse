<div align="center">

# Pact Pulse

**Understand a contract before you sign it.**

Upload an NDA, lease or services agreement and get a plain-English risk report in about a minute.
Every finding points to the exact clause it came from. Then ask the document questions and get
answers that cite their source.

**[Try it live → pactpulse.fly.dev](https://pactpulse.fly.dev)**

</div>

---

## What it does

**A risk report you can check.**
Pact Pulse reads the whole contract and tells you what it means, which clauses could hurt you and
how badly, what you're committing to, and the key terms: dates, amounts, notice periods and parties.
Every risk quotes the contract word for word. Click a quote and the document scrolls to it,
highlighted. If a quote can't be found in the original text, the report says so instead of hiding it.

**A standard checklist, every time.**
Each contract is checked against the same list: termination, liability caps, indemnities,
confidentiality, governing law, auto-renewal, payment terms and more. You see what's present, what
needs attention and what's missing, not just what the AI happened to notice.

**Ask the contract anything.**
"Can I end this early?" "Who owns what I create?" "What happens if I pay late?" The assistant
searches the document, reads the relevant clauses and answers with citations like `[P4]` that jump
to the source. It only answers from the document itself.

**Scanned PDFs too.**
Photographed or scanned contracts are read with OCR, so a contract with no text layer still works.

**Stays up when the AI doesn't.**
If the main model is rate-limited, Pact Pulse switches to a backup provider. If every model is down,
the chat still returns the three most relevant passages instead of an error.

> Pact Pulse is an assistant, not a lawyer. Reports are AI-generated and can be wrong. Read the
> contract and get legal advice before relying on anything important.

---

## How it works

```
Upload ──► Extract text ──► Analyse ──────────► Verified report
            (PDFium / OCR)   Gemini → Groq        quotes matched to the source
                │
                └──► Split · embed · index ──► Agentic chat
                     (fastembed + Qdrant)       search → read → cite
```

**Analysis.** The document is analysed against a fixed JSON schema at temperature 0, so repeated
runs stay consistent. Long contracts are split into overlapping chunks, analysed in parallel and
merged. Every quote is then matched against the source text with fuzzy matching, and its exact
character position is stored for highlighting.

**Chat (agentic RAG).** The chat is separate from the analysis. The model gets three tools, all
limited to the user's own document:

| Tool | What it does |
|---|---|
| `search_document` | Semantic search over the document's passages (Qdrant + bge-small embeddings) |
| `find_exact_text` | Exact lookup for clause numbers, names, amounts and dates |
| `read_passages` | Reads the passages around a hit for full context |

The agent decides which tools to call and how many times, then writes an answer citing the passages
it used. Citations are resolved on the server to exact text ranges.

**Reliability.**
- Background jobs never block the event loop.
- Oversized uploads are rejected before the body is read.
- A stale analysis run can never overwrite a newer one.
- Document text is fenced off in prompts to resist prompt injection.

---

## Tech stack

| | |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router, react-markdown |
| **Backend** | FastAPI, Pydantic v2, PyMongo (async), slowapi |
| **AI** | Google Gemini (analysis, OCR, chat), Groq as fallback, structured output and function calling |
| **Retrieval** | Qdrant (embedded), fastembed with `BAAI/bge-small-en-v1.5` (ONNX, runs locally) |
| **Documents** | pypdfium2, python-docx, rapidfuzz |
| **Auth** | Argon2 password hashing, JWT access tokens, rotating httpOnly refresh cookie, email verification codes |
| **Infra** | MongoDB Atlas, Fly.io (Docker, persistent volume, scale-to-zero), Gmail SMTP |

---

## Security and abuse protection

- Email verification by 6-digit code on sign-up. Codes are hashed, expire, and allow limited attempts and resends.
- Every database and vector query is scoped to the document's owner.
- Per-IP daily limits on uploads, analyses and chat questions, plus per-minute rate limits on login and sign-up.
- Refresh tokens rotate on every use. Logging out invalidates every session for the account.
- No secrets in the repo. Configuration comes from environment variables.

---

## Project structure

```
Backend/app/
  api/            routes (thin controllers) and dependencies
  services/       business logic: auth, contracts, analysis, chat, email, usage limits
    analysis/       chunking, merging, quote verification
    documents/      PDF / DOCX / TXT parsing and OCR
    llm/            Gemini and Groq clients
    rag/            splitter, embeddings, vector store, agent tools, agent loop
  repositories/   the only code that talks to MongoDB
  models/         stored data and the report schema
  schemas/        request and response shapes
  prompts/        prompt text
  core/           config, security, errors, middleware

Frontend/src/
  pages/          landing, auth, dashboard, contract view
  components/     report, chat, contract viewer, UI kit
  api/client.js   every HTTP call
```

Requests flow **routes → services → repositories**.

---

## Run it locally

**You need:** Python 3.12+, Node 20+, a MongoDB connection string (Atlas free tier works), and a
[Gemini API key](https://aistudio.google.com/apikey). A [Groq key](https://console.groq.com) and a
Gmail app password are optional.

```bash
git clone https://github.com/SalmanZulfiqarShaikh/PactPulse.git
cd PactPulse

# Backend
cd Backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env         # macOS/Linux: cp .env.example .env
# Fill in JWT_SECRET, MONGODB_URI and GEMINI_API_KEY
cd ..
python -m uvicorn Backend.app.main:app --reload

# Frontend (second terminal)
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173. Without SMTP settings, sign-up codes are printed in the backend log.

Generate a `JWT_SECRET` with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Deploy

One Fly.io app serves both the API and the built frontend. See [DEPLOY.md](DEPLOY.md), or on Windows run:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

The machine stops when idle and wakes on the next request, so a demo costs close to nothing.

---

## API

Full reference in [Backend/API_REFERENCE.md](Backend/API_REFERENCE.md). Interactive docs are at
`/docs` when running locally.

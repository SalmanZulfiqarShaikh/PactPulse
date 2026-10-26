# Deploying Pact Pulse to Fly.io

One Fly app serves both the API and the frontend at **https://pactpulse.fly.dev**.
MongoDB lives on MongoDB Atlas (free M0). The chat's vector index and the
uploaded files live on a 1 GB Fly volume. The embedding model is baked into the
image.

All commands run in PowerShell from the `legalAI` folder.

## The quick way

Fill in `Backend\.env` (JWT_SECRET, MONGODB_URI, GEMINI_API_KEY, GROQ_API_KEY,
SMTP_USER, SMTP_PASSWORD), then:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

It installs the Fly CLI if needed, logs you in, creates the app and volume if
they don't exist, copies the secrets from `Backend\.env` into Fly, and deploys.
Run it again for every new version. The manual steps below do the same thing.

## 1. One-time setup

Install the Fly CLI if you don't have it, then log in:

```powershell
iwr https://fly.io/install.ps1 -useb | iex
fly auth login
```

Create the app and its volume (same region as `primary_region` in `fly.toml`):

```powershell
fly apps create pactpulse
fly volumes create pactpulse_data --size 1 --region sin --app pactpulse
```

Fly may warn that a single volume has no redundancy. That's expected for a demo; answer yes.

## 2. Secrets

Generate a JWT secret:

```powershell
.\Backend\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Then set every secret in one command, each value in double quotes:

```powershell
fly secrets set --app pactpulse `
  JWT_SECRET="paste-the-generated-secret" `
  MONGODB_URI="mongodb+srv://user:password@cluster0.kjnnbvz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" `
  GEMINI_API_KEY="..." `
  GROQ_API_KEY="..." `
  SMTP_USER="you@gmail.com" `
  SMTP_PASSWORD="your16charapppassword"
```

`fly secrets list --app pactpulse` shows which are set (never their values).

## 3. Deploy

```powershell
fly deploy --ha=false
```

`--ha=false` keeps it to one machine: the volume can only attach to one, and the
background jobs expect a single process. The first build takes a few minutes
because it downloads the embedding model into the image.

Open https://pactpulse.fly.dev, sign up, check your inbox for the code, upload a document.

## Everyday commands

| What | Command |
|---|---|
| Ship a new version | `fly deploy --ha=false` |
| Live logs | `fly logs --app pactpulse` |
| Status and machine | `fly status --app pactpulse` |
| Change a secret | `fly secrets set --app pactpulse NAME="value"` (redeploys automatically) |
| Change daily limits | `fly secrets set --app pactpulse DAILY_CHAT_LIMIT=50` |

## Cost

The machine stops when nobody is using the site and starts on the next visit
(the first request takes a few seconds). You pay for running time plus the 1 GB
volume, which for a rarely used demo should stay well under Fly's $5 invoice
threshold. Check Fly's pricing page for current numbers.

## If something goes wrong

- **Deploy fails on the health check:** `fly logs` usually shows a missing secret
  (`JWT_SECRET must be set`) or a MongoDB error. Check `MONGODB_URI` and that
  Atlas Network Access allows `0.0.0.0/0`.
- **Machine keeps restarting with "out of memory":** raise `memory` in `fly.toml` to `"2gb"`.
- **Sign-up email never arrives:** check spam, then `fly logs` for an SMTP error.
  The Gmail app password must have no spaces, and 2-Step Verification must be on.
- **Chat says the document couldn't be prepared:** press Retry in the chat. If
  the volume was ever recreated, every document re-indexes on Retry.

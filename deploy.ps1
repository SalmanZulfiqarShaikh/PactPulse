# Deploy Pact Pulse to Fly.io in one go.
#
# Run from the legalAI folder:
#   powershell -ExecutionPolicy Bypass -File .\deploy.ps1
#
# Safe to run again for every new version: it only creates what's missing,
# re-uploads the secrets from Backend\.env, and deploys.

$App = "pactpulse"
$Region = "sin"
$Volume = "pactpulse_data"

# Copied from Backend\.env into Fly. Everything else (origins, paths, the IP
# header) is set in fly.toml, so local values like localhost never leak in.
$SecretKeys = @(
    "JWT_SECRET", "MONGODB_URI",
    "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_CHAT_MODEL",
    "GROQ_API_KEY", "GROQ_MODEL",
    "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_NAME",
    "DAILY_ANALYSIS_LIMIT", "DAILY_CHAT_LIMIT", "DAILY_UPLOAD_LIMIT"
)
$Required = @("JWT_SECRET", "MONGODB_URI", "GEMINI_API_KEY", "SMTP_USER", "SMTP_PASSWORD")

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "`n$text" -ForegroundColor Red; exit 1 }

if (-not (Test-Path "Backend\.env")) { Fail "Run this from the legalAI folder (Backend\.env not found)." }

# --- Fly CLI and login --------------------------------------------------------
if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    Step "Installing the Fly CLI"
    Invoke-WebRequest https://fly.io/install.ps1 -UseBasicParsing | Invoke-Expression
    $env:Path += ";$env:USERPROFILE\.fly\bin"
}

Step "Checking Fly login"
fly auth whoami *> $null
if ($LASTEXITCODE -ne 0) {
    fly auth login
    if ($LASTEXITCODE -ne 0) { Fail "Fly login failed." }
}

# --- App and volume -----------------------------------------------------------
Step "Making sure the app '$App' exists"
fly status --app $App *> $null
if ($LASTEXITCODE -ne 0) {
    fly apps create $App
    if ($LASTEXITCODE -ne 0) { Fail "Could not create '$App'. The name may be taken: change `$App here and 'app' in fly.toml." }
}

Step "Making sure the volume '$Volume' exists"
$volumes = fly volumes list --app $App --json | ConvertFrom-Json
if (-not ($volumes | Where-Object { $_.name -eq $Volume })) {
    fly volumes create $Volume --size 1 --region $Region --app $App --yes
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the volume." }
}

# --- Secrets from Backend\.env ------------------------------------------------
Step "Uploading secrets from Backend\.env"
$secrets = [ordered]@{}
foreach ($line in Get-Content "Backend\.env" -Encoding UTF8) {
    $line = $line.TrimStart([char]0xFEFF)
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$') {
        $key = $Matches[1]
        $value = $Matches[2].Trim('"').Trim("'")
        if ($SecretKeys -contains $key -and $value -ne "") { $secrets[$key] = $value }
    }
}
$missing = $Required | Where-Object { -not $secrets.Contains($_) }
if ($missing) { Fail "Fill these in Backend\.env first: $($missing -join ', ')" }

# Passed as arguments, not piped: Windows PowerShell puts a byte-order mark in
# front of piped text, which Fly then reads as part of the first secret's name.
$pairs = $secrets.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
fly secrets set --app $App --stage @pairs
if ($LASTEXITCODE -ne 0) { Fail "Could not set the secrets." }
Write-Host "Set: $($secrets.Keys -join ', ')"

# --- Deploy -------------------------------------------------------------------
Step "Building and deploying (the first build takes a few minutes)"
fly deploy --app $App --ha=false
if ($LASTEXITCODE -ne 0) { Fail "Deploy failed. Run: fly logs --app $App" }

Write-Host "`nLive at https://$App.fly.dev" -ForegroundColor Green

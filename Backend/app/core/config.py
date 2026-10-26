"""Application settings, grouped by concern.

Every group reads the same ``Backend/.env`` file, so the environment variable
names are unchanged from before: ``GEMINI_MODEL`` still sets the Gemini model,
``JWT_SECRET`` still sets the signing key, and so on. In code they are reached
through one object, for example ``settings.gemini.model``.
"""

from functools import cached_property, lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

_LOCAL_ORIGINS = ("http://localhost", "http://127.0.0.1", "http://[::1]")


def _config(prefix: str = "") -> SettingsConfigDict:
    return SettingsConfigDict(
        env_prefix=prefix,
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


class GeminiSettings(BaseSettings):
    """GEMINI_* - the model used for analysis, OCR and chat."""

    model_config = _config("GEMINI_")

    api_key: str | None = None
    model: str = "gemini-2.5-flash"
    max_output_tokens: int = 16_384
    # The chat agent makes several calls per question, so it uses the lighter
    # model, whose free-tier quota is much larger.
    chat_model: str = "gemini-2.5-flash-lite"
    merge_max_output_tokens: int = 32_768
    # 0 + a fixed seed makes repeated runs on the same contract as stable as
    # the API allows.
    temperature: float = 0.0
    seed: int = 7
    max_attempts: int = 3
    timeout_seconds: float = 180.0


class GroqSettings(BaseSettings):
    """GROQ_* - optional fallback when Gemini fails (quota, outage, missing key).

    Used for analysis and chat. Not for OCR: Groq models cannot read PDFs.
    """

    model_config = _config("GROQ_")

    api_key: str | None = None
    # Supports both tool calling (chat) and strict JSON schema (analysis).
    model: str = "openai/gpt-oss-120b"
    max_output_tokens: int = 8_192
    # Groq's free tier allows only a few thousand tokens per minute, so
    # contracts are analysed in much smaller pieces, one at a time.
    chunk_chars: int = 12_000
    chunk_overlap_chars: int = 500
    max_concurrent_chunks: int = 1
    max_retries: int = 4
    timeout_seconds: float = 120.0
    # Chat on the free tier must fit a per-minute token budget, so the agent
    # retrieves fewer, shorter passages and trims old tool results.
    chat_search_results: int = 4
    chat_passage_chars: int = 900
    chat_budget_chars: int = 14_000
    chat_max_output_tokens: int = 1_024
    chat_history_messages: int = 6

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


class AuthSettings(BaseSettings):
    model_config = _config()

    # Required, with no default: a shared fallback key would let anyone who
    # knows it mint tokens for any account.
    jwt_secret: str = Field(default="", validate_default=True)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 20
    refresh_token_days: int = 10
    refresh_cookie_name: str = "pactpulse_refresh"
    refresh_cookie_path: str = "/auth"
    cookie_secure: bool | None = None

    @field_validator("jwt_secret")
    @classmethod
    def _strong_secret(cls, value: str) -> str:
        if len(value.strip()) < 32:
            raise ValueError(
                "JWT_SECRET must be set in Backend/.env and be at least 32 characters. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return value


class MongoSettings(BaseSettings):
    """MONGODB_*"""

    model_config = _config("MONGODB_")

    uri: str = "mongodb://localhost:27017"
    db_name: str = "pact_pulse"


class AnalysisSettings(BaseSettings):
    model_config = _config()

    chunk_chars: int = 400_000
    chunk_overlap_chars: int = 2_000
    max_concurrent_chunks: int = 3
    stale_analysis_seconds: int = 600


class UploadSettings(BaseSettings):
    model_config = _config()

    upload_dir: Path = BACKEND_DIR / "uploads"
    max_file_size: int = 10 * 1024 * 1024
    allowed_extensions: frozenset[str] = frozenset({".pdf", ".docx", ".txt"})
    # A PDF averaging fewer extractable characters per page than this is
    # treated as scanned and sent to OCR.
    ocr_min_chars_per_page: int = 80
    ocr_pages_per_request: int = 10

    @property
    def max_file_size_mb(self) -> int:
        return self.max_file_size // (1024 * 1024)

    @property
    def allowed_label(self) -> str:
        return ", ".join(sorted(ext.lstrip(".").upper() for ext in self.allowed_extensions))


class RagSettings(BaseSettings):
    """Document chat: embeddings, the vector store and the agent."""

    model_config = _config()

    # Any model fastembed supports. For Urdu or mixed-language documents use
    # sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2.
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    # Embedded Qdrant on disk by default. Set QDRANT_URL to use a server.
    qdrant_path: Path = BACKEND_DIR / "qdrant_data"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "document_passages"
    passage_chars: int = 1_200
    passage_overlap_chars: int = 200
    search_results: int = 8
    chat_history_messages: int = 12
    agent_max_steps: int = 6


class EmailSettings(BaseSettings):
    """SMTP_* - sends sign-up verification codes. Works with a Gmail app password.

    Without SMTP_USER the code is written to the server log instead, which is
    handy for local development.
    """

    model_config = _config("SMTP_")

    host: str = "smtp.gmail.com"
    port: int = 587
    user: str | None = None
    password: str | None = None
    from_name: str = "Pact Pulse"

    @property
    def enabled(self) -> bool:
        return bool(self.user and self.password)


class LimitSettings(BaseSettings):
    """DAILY_* - how much each visitor (by IP address) may use per day."""

    model_config = _config("DAILY_")

    analysis_limit: int = 5
    chat_limit: int = 30
    upload_limit: int = 10
    # Verification codes: lifetime, wrong guesses allowed, resend cooldown.
    code_minutes: int = 10
    code_attempts: int = 5
    code_resend_seconds: int = 60


class HttpSettings(BaseSettings):
    model_config = _config()

    cors_origins: str = "http://localhost:5173"
    frontend_origin: str = "http://localhost:5173"
    rate_limit_enabled: bool = True
    login_rate_limit: str = "10/minute"
    register_rate_limit: str = "5/minute"
    chat_rate_limit: str = "20/minute"
    resend_code_rate_limit: str = "5/hour"
    # Behind a proxy every request seems to come from the proxy. Name the header
    # the proxy puts the real visitor IP in: on Fly.io it is Fly-Client-IP.
    # Leave empty locally, where there is no proxy.
    client_ip_header: str | None = None
    # The built frontend (npm run build). Served by the API when present.
    frontend_dist: Path = BACKEND_DIR.parent / "Frontend" / "dist"

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard(cls, value: str) -> str:
        if "*" in (origin.strip() for origin in value.split(",")):
            raise ValueError(
                "CORS_ORIGINS cannot be '*' because the refresh cookie needs credentials."
            )
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


class Settings:
    """All settings groups. Each is loaded once, on first use."""

    @cached_property
    def gemini(self) -> GeminiSettings:
        return GeminiSettings()

    @cached_property
    def groq(self) -> GroqSettings:
        return GroqSettings()

    @cached_property
    def auth(self) -> AuthSettings:
        return AuthSettings()

    @cached_property
    def mongo(self) -> MongoSettings:
        return MongoSettings()

    @cached_property
    def analysis(self) -> AnalysisSettings:
        return AnalysisSettings()

    @cached_property
    def upload(self) -> UploadSettings:
        return UploadSettings()

    @cached_property
    def rag(self) -> RagSettings:
        return RagSettings()

    @cached_property
    def email(self) -> EmailSettings:
        return EmailSettings()

    @cached_property
    def limits(self) -> LimitSettings:
        return LimitSettings()

    @cached_property
    def http(self) -> HttpSettings:
        return HttpSettings()

    @property
    def cookie_secure(self) -> bool:
        """Secure cookies everywhere except a plain-HTTP localhost frontend."""
        if self.auth.cookie_secure is not None:
            return self.auth.cookie_secure
        return not self.http.frontend_origin.startswith(_LOCAL_ORIGINS)

    def validate(self) -> None:
        """Load every group now, so a bad .env fails at start-up, not mid-request."""
        for name in (
            "gemini",
            "groq",
            "auth",
            "mongo",
            "analysis",
            "upload",
            "rag",
            "email",
            "limits",
            "http",
        ):
            getattr(self, name)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root, i.e. the directory containing app/. Anchoring paths here means
# .env and uploads/ resolve the same way no matter which directory the server
# is started from.
BASE_DIR = Path(__file__).resolve().parents[1]

# A signing key shorter than this is not worth having: HS256 keys are brute
# forced offline from a single captured token, so the key has to be long enough
# that guessing it is hopeless.
MIN_JWT_SECRET_LENGTH = 32

# Origins treated as local development, where the refresh cookie cannot be
# marked Secure because the browser is talking plain HTTP.
_LOCAL_ORIGIN_PREFIXES = ("http://localhost", "http://127.0.0.1", "http://[::1]")


class Settings(BaseSettings):
    """Application settings, read from the environment and .env.

    Lookups are case-insensitive, so lowercase keys in .env populate the same
    fields as their uppercase equivalents.
    """

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Secrets -----------------------------------------------------------
    gemini_api_key: str | None = None

    # Signing key for access and refresh tokens. Deliberately has no usable
    # default: a built-in fallback would ship the same key to every deployment,
    # and anyone holding it could mint a token for any account. Validation
    # below makes the app refuse to start without it.
    jwt_secret: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 20
    refresh_token_days: int = 10

    refresh_cookie_name: str = "pactpulse_refresh"
    # Scoping the cookie to /auth means it is attached to /auth/refresh and
    # /auth/logout only, and never travels with ordinary API calls.
    refresh_cookie_path: str = "/auth"
    # None means "decide from FRONTEND_ORIGIN": Secure off on localhost, on
    # everywhere else. Set COOKIE_SECURE explicitly to override.
    cookie_secure: bool | None = None

    # --- Database ----------------------------------------------------------
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "pact_pulse"

    # --- Gemini ------------------------------------------------------------
    gemini_model: str = "gemini-2.5-flash"
    gemini_max_output_tokens: int = 16_384
    # Merging partial reports has to reproduce a whole contract's findings in
    # one response, so it needs more room than a single-pass analysis. Sharing
    # one cap is what used to make big contracts fall back to a local merge.
    gemini_merge_max_output_tokens: int = 32_768
    gemini_temperature: float = 0.2
    # Transient 429s and 5xx responses from the API are common on long jobs.
    gemini_max_attempts: int = 3
    gemini_timeout_seconds: float = 180.0

    # --- Chunking ----------------------------------------------------------
    chunk_chars: int = 400_000
    chunk_overlap_chars: int = 2_000
    max_concurrent_chunks: int = 3

    # --- Uploads -----------------------------------------------------------
    upload_dir: Path = BASE_DIR / "uploads"
    max_file_size: int = 10 * 1024 * 1024  # 10 MB
    allowed_extensions: set[str] = {".pdf", ".docx", ".txt"}

    # --- HTTP --------------------------------------------------------------
    # Comma separated, explicit origins. "*" is rejected below because
    # allow_credentials cannot be combined with a wildcard origin.
    cors_origins: str = "http://localhost:5173"
    frontend_origin: str = "http://localhost:5173"

    # --- Rate limiting -----------------------------------------------------
    rate_limit_enabled: bool = True
    login_rate_limit: str = "10/minute"
    register_rate_limit: str = "5/minute"

    # An analysis still marked "analyzing" after this long is treated as
    # interrupted, e.g. because the server restarted mid-job.
    stale_analysis_seconds: int = 600

    # --- Validation --------------------------------------------------------

    @field_validator("jwt_secret")
    @classmethod
    def _check_jwt_secret(cls, value: str | None) -> str:
        """Refuse to boot without a strong signing key.

        Raising here propagates out of ``Settings()`` at import time, so the
        server exits during start-up rather than serving traffic with a missing
        or guessable key.
        """
        if not value or not value.strip():
            raise ValueError(
                "JWT_SECRET is not set. Generate one and add it to Backend/.env, for example:\n"
                '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

        if len(value) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters "
                f"(got {len(value)}). Generate a longer one with:\n"
                '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

        return value

    @field_validator("cors_origins")
    @classmethod
    def _check_cors_origins(cls, value: str) -> str:
        """Reject a wildcard origin, which cannot be used with credentials."""
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]

        if "*" in origins:
            raise ValueError(
                "CORS_ORIGINS cannot be '*'. The refresh cookie requires "
                "allow_credentials=True, and browsers reject a wildcard origin "
                "in that mode. List the frontend origins explicitly, comma separated."
            )

        return value

    # --- Derived -----------------------------------------------------------

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def refresh_cookie_secure(self) -> bool:
        """Whether the refresh cookie gets the Secure flag.

        Secure cookies are only sent over HTTPS, so setting it on a local
        development server over plain HTTP would silently drop the cookie.
        """
        if self.cookie_secure is not None:
            return self.cookie_secure

        return not self.frontend_origin.startswith(_LOCAL_ORIGIN_PREFIXES)

    @property
    def allowed_extensions_label(self) -> str:
        return ", ".join(sorted(e.lstrip(".").upper() for e in self.allowed_extensions))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

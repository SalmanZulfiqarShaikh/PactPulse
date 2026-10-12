"""Rate limiting for the credential endpoints.

Only /auth/login and /auth/register are limited. They are the two endpoints
where an attacker can profit from unlimited attempts: guessing passwords, and
filling the users collection. Everything else is authenticated and cheap.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from Backend.app.config import settings

# Keyed on the client IP. Behind a reverse proxy every request appears to come
# from the proxy unless it forwards X-Forwarded-For *and* the app is told to
# trust it, so in that deployment this limit collapses to one shared bucket.
# The counts are also per process: running several workers multiplies the
# effective allowance. Both are worth fixing with a Redis-backed store if this
# ever runs multi-worker behind a proxy.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
    headers_enabled=True,
)

"""The visitor's IP address, used for rate limits and daily usage limits."""

from starlette.requests import Request

from Backend.app.core.config import settings


def client_ip(request: Request) -> str:
    """Behind Fly.io the connection comes from Fly's proxy, so the real address
    is read from the header the proxy sets (CLIENT_IP_HEADER). Locally there is
    no proxy and the socket address is used.
    """
    if (header := settings.http.client_ip_header) and (value := request.headers.get(header)):
        return value.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

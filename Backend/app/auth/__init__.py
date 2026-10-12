"""Authentication: password hashing, tokens and request dependencies."""

from Backend.app.auth.dependencies import (
    CurrentUser,
    clear_refresh_cookie,
    get_current_user,
    get_refresh_user,
    set_refresh_cookie,
)
from Backend.app.auth.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    dummy_verify,
    hash_password,
    password_needs_rehash,
    verify_password,
)

__all__ = [
    "CurrentUser",
    "TokenError",
    "clear_refresh_cookie",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "dummy_verify",
    "get_current_user",
    "get_refresh_user",
    "hash_password",
    "password_needs_rehash",
    "set_refresh_cookie",
    "verify_password",
]

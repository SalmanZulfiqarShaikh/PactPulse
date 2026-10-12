"""Account endpoints: register, login, refresh, logout, me."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pymongo.errors import DuplicateKeyError

from Backend.app.auth import (
    CurrentUser,
    TokenError,
    clear_refresh_cookie,
    create_access_token,
    create_refresh_token,
    decode_token,
    dummy_verify,
    get_current_user,
    get_refresh_user,
    hash_password,
    password_needs_rehash,
    set_refresh_cookie,
    verify_password,
)
from Backend.app.auth.security import REFRESH_TOKEN_TYPE
from Backend.app.config import settings
from Backend.app.database import users_collection
from Backend.app.models.user import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    normalise_email,
)
from Backend.app.rate_limit import limiter
from Backend.app.service.timeutil import iso_now

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# The single failure message for login. Returning this for an unknown email, a
# wrong password and a deleted account alike means the endpoint cannot be used
# to test whether an address is registered.
_INVALID_CREDENTIALS = "Incorrect email or password."


def _token_response(user_id: str, email: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id, email),
        expires_in=settings.access_token_minutes * 60,
        user_id=user_id,
        email=email,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
@limiter.limit(settings.register_rate_limit)
async def register(request: Request, response: Response, payload: RegisterRequest):
    """Create an account and log straight in.

    Returns the access token in the body and sets the refresh cookie, so the
    client is usable immediately without a second round trip.
    """
    email = normalise_email(payload.email)
    user_id = uuid.uuid4().hex

    document = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "created_at": iso_now(),
        # Session generation, bumped by logout. See create_refresh_token.
        "token_version": 0,
    }

    try:
        users_collection.insert_one(document)
    except DuplicateKeyError:
        # The unique index on email is what raises this, so it is an exact
        # answer to "is this address taken" - which registration has to give,
        # since the alternative is silently not creating the account.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        ) from None

    logger.info("Registered user %s", user_id)

    set_refresh_cookie(response, create_refresh_token(user_id, 0))
    return _token_response(user_id, email)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.login_rate_limit)
async def login(request: Request, response: Response, payload: LoginRequest):
    """Exchange email and password for an access token.

    Every failure returns the same 401 with the same message, and an unknown
    email still costs a full password verification, so neither the status, the
    body nor the response time reveals whether an account exists.
    """
    email = normalise_email(payload.email)

    # The projection keeps the hash off every other code path.
    user = users_collection.find_one(
        {"email": email}, {"password_hash": 1, "user_id": 1, "token_version": 1}
    )

    if user is None:
        dummy_verify()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Opportunistically upgrade a hash made with older parameters. The password
    # is in hand here and nowhere else, which is why this is done at login.
    if password_needs_rehash(user["password_hash"]):
        users_collection.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"password_hash": hash_password(payload.password)}},
        )

    # Logging in mints a cookie at the account's *current* generation, so a
    # session the user logged out of earlier stays dead.
    set_refresh_cookie(
        response, create_refresh_token(user["user_id"], user.get("token_version", 0))
    )
    return _token_response(user["user_id"], email)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(response: Response, user: CurrentUser = Depends(get_refresh_user)):
    """Issue a new access token from the refresh cookie.

    The refresh token is rotated as well, so a cookie captured earlier stops
    being useful once the legitimate client refreshes.
    """
    record = users_collection.find_one(
        {"user_id": user.user_id}, {"email": 1, "token_version": 1, "_id": 0}
    )

    if record is None:
        # The account was deleted while a token was still valid. Clearing the
        # cookie stops the client retrying against a user that no longer exists.
        clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # The session generation must still match. Logout bumps the stored value, so
    # a cookie that outlived its logout - a copy taken before it, or one a
    # browser kept - is refused here instead of minting fresh access tokens for
    # the rest of its ten days.
    current_version = int(record.get("token_version", 0))

    if user.token_version != current_version:
        clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = record.get("email", "")

    set_refresh_cookie(response, create_refresh_token(user.user_id, current_version))
    return _token_response(user.user_id, email)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response):
    """End the session and clear the refresh cookie.

    Deliberately unauthenticated and always successful: requiring a valid token
    here would leave a client with an already-expired session unable to clean
    up. A cookie that is present and still valid is used to bump the account's
    session generation, which is what actually ends the session; an absent or
    unusable one has nothing left to revoke, so clearing the cookie is the whole
    job.

    This does not invalidate access tokens that have already been issued - they
    are stateless and stay valid for the rest of their short lifetime. What it
    guarantees is that no *new* access token can be minted from a refresh token
    issued before this point.
    """
    token = request.cookies.get(settings.refresh_cookie_name)

    if token:
        try:
            claims = decode_token(token, expected_type=REFRESH_TOKEN_TYPE)
        except TokenError:
            # Expired or forged: there is no live session behind it to revoke.
            claims = None

        if claims and claims.get("sub"):
            users_collection.update_one(
                {"user_id": claims["sub"]}, {"$inc": {"token_version": 1}}
            )

    clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser = Depends(get_current_user)):
    """Return the authenticated account, for the client to confirm its token."""
    return UserResponse(user_id=user.user_id, email=user.email)

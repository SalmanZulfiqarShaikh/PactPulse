from pydantic import BaseModel


class User(BaseModel):
    """A stored account. The password hash never leaves the auth service."""

    user_id: str
    email: str
    password_hash: str
    created_at: str
    # Session generation. Logout bumps it, which kills older refresh tokens.
    token_version: int = 0
    # New accounts start unverified. Accounts created before verification
    # existed have no such field and count as verified.
    email_verified: bool = True

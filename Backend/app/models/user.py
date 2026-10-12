from pydantic import BaseModel, EmailStr, Field, field_validator

# Minimum and maximum are counted in characters, not bytes, so a password in a
# non-Latin script is judged the same as an ASCII one.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def normalise_email(value: str) -> str:
    """Fold an email to the form used as the unique key.

    Lowercased and trimmed, so ``Ada@Example.com`` and ``ada@example.com`` are
    the same account rather than two.
    """
    return value.strip().lower()


class User(BaseModel):
    """A stored account. The password hash never leaves the auth package."""

    user_id: str = Field(description="Public identifier for the user")
    email: str = Field(description="Email address, stored lowercase")
    password_hash: str = Field(description="argon2id hash; never a plaintext password")
    created_at: str = Field(description="ISO-8601 timestamp of registration")


class RegisterRequest(BaseModel):
    """Request body for registration.

    The email is format-checked here, because this is where an account is
    created and a malformed address would become a permanent bad record.
    """

    email: EmailStr = Field(description="Email address")
    password: str = Field(
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
        description=f"Password, {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters",
    )

    @field_validator("email")
    @classmethod
    def _normalise(cls, value: str) -> str:
        return normalise_email(str(value))


class LoginRequest(BaseModel):
    """Request body for login.

    Deliberately *not* validated the way registration is: the email is a plain
    string and the password has no minimum length.

    Two reasons. A password rule here would hand an attacker a 422 that means
    "malformed", distinct from the 401 that means "wrong", and it would lock out
    any account whose password predates a change to the policy. Every failure on
    this endpoint is therefore the same 401. The maximum length is still
    enforced, purely so a huge body cannot be pushed through the hasher.
    """

    email: str = Field(description="Email address")
    password: str = Field(
        max_length=MAX_PASSWORD_LENGTH,
        description=f"Password, up to {MAX_PASSWORD_LENGTH} characters",
    )


class TokenResponse(BaseModel):
    """The access token, plus the details a client needs to greet the user."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    user_id: str
    email: str


class UserResponse(BaseModel):
    user_id: str
    email: str
